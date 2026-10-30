(function () {
  'use strict';

  const api = '/plugins/plugin.switch/api.php';
  const cache = new Map();
  let loading = false;
  let lastFetch = 0;
  let queued = false;
  let openDetailId = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[ch]);

  function table() { return document.getElementById('plugin_table'); }
  function isPlugins() { return !!table()?.querySelector('thead'); }
  function csrf() {
    // Unraid exposes this in HeadInlineJS.php. Its local_prepend.php consumes
    // the POST token before our PHP handler is called.
    if (typeof window.csrf_token === 'string' && window.csrf_token) return window.csrf_token;
    return document.querySelector('input[name="csrf_token"]')?.value || '';
  }
  function getStatus(p) {
    if (p.support === 'protected' || p.compatibility?.classification === 'protected') return 'Protected';
    if (p.supported) return p.enabled ? 'Live ready' : 'Restore available';
    if (p.compatibility?.classification === 'candidate') return 'Review required';
    switch (p.support) {
      case 'no-adapter': return 'No live control';
      case 'invalid-adapter': return 'Adapter blocked';
      case 'status-error': return 'Adapter error';
      case 'restore-only': return 'Restore available';
    }
    return p.enabled ? 'No live control' : 'Disabled';
  }
  function explanation(p) {
    const state = p.enabled ? 'Installed (ON)' : 'Parked (OFF)';
    return state + ' · ' + getStatus(p) + '. ' +
      (p.compatibility?.reason || p.reason || 'No compatibility details available.');
  }
  function evidence(p) {
    const c = p.compatibility || {};
    const services = Array.isArray(c.services) && c.services.length ? c.services.join(', ') : 'None detected';
    const signals = Array.isArray(c.signals) && c.signals.length ? c.signals.join(', ') : 'None detected';
    const entries = [
      ['State', p.enabled ? 'Installed (ON)' : 'Parked (OFF)'],
      ['Compatibility', getStatus(p)],
      ['Classification', c.classification || 'unknown'],
      ['Reason', c.reason || p.reason || 'Unknown'],
      ['Service candidates', services],
      ['Review signals', signals],
      ['Profile', c.profile || c.profile_status || 'none'],
      ['Control source', c.control_source || 'none'],
      ['Scanned', c.scanned_at || 'unknown']
    ];
    return entries.map(([label,value]) =>
      '<div class="ps-evidence-row"><dt>' + escapeHtml(label) + '</dt><dd>' +
      escapeHtml(value) + '</dd></div>'
    ).join('');
  }
  function makeCell(p) {
    const label = p.enabled ? 'Disable' : 'Enable';
    const checked = p.enabled ? ' checked' : '';
    const disabled = p.supported ? '' : ' disabled';
    const icon = p.supported ? 'fa-info-circle' : 'fa-lock';
    const reason = explanation(p);
    return '<td class="ps-cell" data-plugin-switch="' + escapeHtml(p.id) + '">' +
      '<div class="ps-actions">' +
      '<label class="ps-control" title="' + escapeHtml(reason) + '">' +
      '<input type="checkbox" class="ps-toggle" aria-label="' +
      escapeHtml(label + ' ' + p.name) + '" data-id="' + escapeHtml(p.id) + '"' +
      checked + disabled + '><span class="ps-track"></span></label>' +
      '<button type="button" class="ps-info" data-id="' + escapeHtml(p.id) +
      '" title="' + escapeHtml(reason) + '" aria-label="Compatibility details for ' +
      escapeHtml(p.name) + '" aria-expanded="false">' +
      '<i class="fa ' + icon + '" aria-hidden="true"></i></button>' +
      '</div></td>';
  }
  function addHeader(t) {
    const header = t.querySelector('thead tr');
    if (!header || header.querySelector('.ps-head')) return;
    const th = document.createElement('th');
    th.className = 'ps-head';
    th.textContent = 'Enabled';
    th.title = 'A switch shows installed state. The icon explains live-control compatibility.';
    header.appendChild(th);
  }
  function addCSS() {
    if (document.getElementById('ps-css')) return;
    const style = document.createElement('style');
    style.id = 'ps-css';
    style.textContent =
      '.ps-head,.ps-cell{text-align:center!important;min-width:92px;width:104px;vertical-align:middle!important}' +
      '.ps-actions{display:flex;align-items:center;justify-content:center;gap:8px;min-height:26px}' +
      '.ps-control{position:relative;display:inline-flex;width:38px;height:22px;flex:0 0 auto;cursor:pointer}' +
      '.ps-toggle{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;z-index:1}' +
      '.ps-track{display:block;width:38px;height:22px;border-radius:99px;background:#777;pointer-events:none;transition:background .15s}' +
      '.ps-track:after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}' +
      '.ps-toggle:checked+.ps-track{background:#23845f}' +
      '.ps-toggle:checked+.ps-track:after{transform:translateX(16px)}' +
      '.ps-toggle:focus-visible+.ps-track{outline:2px solid #459bff;outline-offset:2px}' +
      '.ps-toggle:disabled{cursor:not-allowed}' +
      '.ps-toggle:disabled+.ps-track{opacity:.55}' +
      '.ps-control:has(.ps-toggle:disabled){cursor:not-allowed}' +
      '.ps-info{width:25px;height:25px;min-width:25px;padding:0;border:0;border-radius:6px;background:transparent!important;color:inherit;opacity:.7;cursor:pointer;line-height:25px}' +
      '.ps-info:hover,.ps-info:focus-visible,.ps-info[aria-expanded=true]{opacity:1;background:rgba(128,128,128,.14)!important}' +
      '.ps-info:focus-visible{outline:2px solid #459bff;outline-offset:1px}' +
      '.ps-note{font-size:12px;opacity:.75}.ps-disabled-row td{opacity:.8}.ps-disabled-row td.ps-cell{opacity:1}' +
      '#ps-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0}' +
      '#ps-summary{font-size:12px;opacity:.85;margin-right:auto}' +
      '#ps-toolbar button{font-size:12px;cursor:pointer;padding:5px 8px}' +
      '#ps-details{position:fixed;z-index:10020;max-width:min(390px,calc(100vw - 24px));width:340px;max-height:min(430px,calc(100vh - 24px));overflow:auto;' +
      'box-sizing:border-box;padding:15px 16px;border:1px solid #656b74;border-radius:10px;background:var(--background-color,#20232b);color:var(--text-color,#ededed);' +
      'box-shadow:0 14px 35px rgba(0,0,0,.35);font-size:12px;line-height:1.4}' +
      '.ps-details-head{display:flex;align-items:center;gap:12px;justify-content:space-between;margin-bottom:10px}' +
      '#ps-details-close{font-size:18px;line-height:20px;cursor:pointer;border:0;background:transparent;color:inherit}' +
      '.ps-evidence-row{display:grid;grid-template-columns:105px minmax(0,1fr);gap:8px;border-top:1px solid rgba(128,128,128,.2);padding:7px 0}' +
      '.ps-evidence-row dt{opacity:.72}.ps-evidence-row dd{margin:0;overflow-wrap:anywhere}';
    document.head.appendChild(style);
  }
  function summary() {
    const count = {live:0,candidate:0,'next-boot':0,protected:0};
    cache.forEach(p => {
      const cls = p.compatibility?.classification;
      if (Object.prototype.hasOwnProperty.call(count,cls)) count[cls]++;
    });
    return 'Live ' + count.live + ' · Review ' + count.candidate +
      ' · Next boot ' + count['next-boot'] + ' · Protected ' + count.protected;
  }
  function toolbar(t) {
    if (document.getElementById('ps-toolbar')) return;
    const div = document.createElement('div');
    div.id = 'ps-toolbar';
    div.innerHTML = '<span id="ps-summary" aria-live="polite"></span>' +
      '<button type="button" id="ps-rescan" title="Refresh compatibility discovery">Scan compatibility</button>' +
      '<button type="button" id="ps-export" title="Download a local JSON report">Export report</button>';
    t.parentNode.insertBefore(div,t);
  }
  function activeRowMap() {
    const map = new Map();
    document.querySelectorAll('#plugin_table tbody tr').forEach(row => {
      const entry = row.querySelector('input.remove[data]');
      if (entry) map.set(entry.getAttribute('data'),row);
    });
    return map;
  }
  function closeDetails() {
    document.getElementById('ps-details')?.remove();
    document.querySelectorAll('.ps-info[aria-expanded="true"]').forEach(btn =>
      btn.setAttribute('aria-expanded','false'));
    openDetailId = null;
  }
  function showDetails(button) {
    const id = button.dataset.id;
    if (openDetailId === id) { closeDetails(); return; }
    const p = cache.get(id);
    if (!p) return;
    closeDetails();
    const panel = document.createElement('section');
    panel.id = 'ps-details';
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-label','Plugin compatibility details');
    panel.innerHTML = '<div class="ps-details-head"><strong>' + escapeHtml(p.name) +
      '</strong><button id="ps-details-close" type="button" aria-label="Close details">×</button></div>' +
      '<dl class="ps-evidence">' + evidence(p) + '</dl>';
    document.body.appendChild(panel);
    const rect = button.getBoundingClientRect();
    const width = panel.getBoundingClientRect().width;
    const left = Math.max(12,Math.min(window.innerWidth-width-12,rect.right-width));
    const desiredY = rect.bottom+8;
    const height = panel.getBoundingClientRect().height;
    const top = desiredY+height <= window.innerHeight-12
      ? desiredY : Math.max(12,rect.top-height-8);
    panel.style.left = left+'px';
    panel.style.top = top+'px';
    button.setAttribute('aria-expanded','true');
    openDetailId = id;
  }
  function ensureTable() {
    const t = table();
    if (!t) return;
    addCSS();
    toolbar(t);
    addHeader(t);
    const status = document.getElementById('ps-summary');
    const nextStatus = summary();
    if (status && status.textContent !== nextStatus) status.textContent = nextStatus;
    const rows = activeRowMap();
    rows.forEach((row,id) => {
      const p = cache.get(id);
      if (p && !row.querySelector('.ps-cell')) row.insertAdjacentHTML('beforeend',makeCell(p));
    });
    cache.forEach(p => {
      if (p.enabled || rows.has(p.id)) return;
      const key = 'ps-disabled-' + p.id.replace(/[^a-z0-9_-]/gi,'_');
      if (document.getElementById(key)) return;
      const row = document.createElement('tr');
      row.id = key;
      row.className = 'ps-disabled-row';
      row.innerHTML = '<td>◌</td><td><strong>' + escapeHtml(p.name) +
        '</strong><br><span class="ps-note">Disabled by Plugin Switch</span></td>' +
        '<td>' + escapeHtml(p.author) + '</td><td>' + escapeHtml(p.version) +
        '</td><td>Disabled</td><td>—</td>' + makeCell(p);
      t.tBodies[0]?.appendChild(row);
    });
    t.querySelectorAll('tr.ps-disabled-row').forEach(row => {
      const id = row.querySelector('.ps-toggle')?.dataset.id;
      if (!id || cache.get(id)?.enabled) row.remove();
    });
    t.querySelectorAll('.ps-cell').forEach(cell => {
      const p = cache.get(cell.dataset.pluginSwitch);
      if (!p) return;
      const input = cell.querySelector('.ps-toggle');
      if (!input || input.dataset.busy) return;
      if (document.activeElement !== input) {
        input.checked = p.enabled;
        input.disabled = !p.supported;
      }
      const title = explanation(p);
      const label = cell.querySelector('.ps-control');
      const button = cell.querySelector('.ps-info');
      if (label && label.title !== title) label.title = title;
      if (button) {
        if (button.title !== title) button.title = title;
        const icon = button.querySelector('.fa');
        if (icon) {
          const expected = p.supported ? 'fa-info-circle' : 'fa-lock';
          if (!icon.classList.contains(expected)) icon.className = 'fa '+expected;
        }
      }
    });
    t.querySelectorAll('tbody td[colspan="6"]').forEach(td => td.colSpan = 7);
  }
  async function fetchPlugins(force=false) {
    const endpoint = force ? api+'?rescan=1' : api;
    const response = await fetch(endpoint,{credentials:'same-origin',cache:'no-store'});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to load plugin compatibility');
    return data.plugins || [];
  }
  async function refresh(force=false) {
    if (loading || !isPlugins()) return;
    loading = true;
    try {
      const plugins = await fetchPlugins(force);
      cache.clear();
      plugins.forEach(p => cache.set(p.id,p));
      closeDetails();
      lastFetch = Date.now();
      ensureTable();
    } catch (e) {
      console.warn('[Plugin Switch]',e);
      if (force) window.alert('Plugin Switch: '+e.message);
    } finally { loading = false; }
  }
  async function toggle(input) {
    const id = input.dataset.id;
    const p = cache.get(id);
    if (!p || !p.supported) return;
    const enable = input.checked;
    const verb = enable ? 'enable' : 'disable';
    if (!window.confirm('Really '+verb+' '+p.name+'? Its services may change immediately.')) {
      input.checked = !enable;
      return;
    }
    const token = csrf();
    if (!token) {
      input.checked = !enable;
      window.alert('Plugin Switch: CSRF session not available. Refresh Unraid and try again.');
      return;
    }
    input.dataset.busy = '1';
    input.disabled = true;
    try {
      const body = new URLSearchParams({id,enabled:enable?'1':'0',csrf_token:token});
      const response = await fetch(api,{
        method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'State change failed. Refresh Unraid and retry.');
      cache.set(id,data.plugin);
      window.location.reload();
    } catch (e) {
      input.checked = !enable;
      delete input.dataset.busy;
      input.disabled = !p.supported;
      window.alert('Plugin Switch: '+e.message);
    }
  }
  function exportReport() {
    const report = {
      generated_at:new Date().toISOString(),
      notice:'Local evidence only; candidate discovery does not guarantee live safety.',
      plugins:Array.from(cache.values()).map(p => ({
        id:p.id,name:p.name,version:p.version,enabled:p.enabled,
        supported:p.supported,compatibility:p.compatibility
      }))
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plugin-switch-compatibility.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  document.addEventListener('change',e => {
    if (e.target.matches('.ps-toggle')) toggle(e.target);
  });
  document.addEventListener('click',e => {
    const info = e.target.closest('.ps-info');
    if (info) { showDetails(info); return; }
    if (e.target.closest('#ps-details-close')) { closeDetails(); return; }
    if (!e.target.closest('#ps-details')) closeDetails();
    if (e.target.id === 'ps-rescan') {
      const button = e.target;
      if (loading) return;
      button.disabled = true;
      refresh(true).finally(() => { button.disabled = false; });
    }
    if (e.target.id === 'ps-export') exportReport();
  });
  document.addEventListener('keydown',e => {
    if (e.key === 'Escape' && openDetailId !== null) closeDetails();
  });
  window.addEventListener('resize',closeDetails);
  window.addEventListener('scroll',closeDetails,true);

  const observer = new MutationObserver(() => {
    if (queued || !isPlugins()) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      ensureTable();
      if (Date.now()-lastFetch>30000) refresh();
    });
  });
  function init() {
    observer.observe(document.body,{childList:true,subtree:true});
    if (isPlugins()) refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
