(function () {
  'use strict';
  const api = '/plugins/plugin.switch/api.php';
  const cache = new Map();
  let loading = false;
  let lastFetch = 0;
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
  function isPlugins() {
    return !!document.querySelector('#plugin_table thead');
  }
  function table() {
    return document.getElementById('plugin_table');
  }
  function activeRowMap() {
    const map = new Map();
    document.querySelectorAll('#plugin_table tbody tr').forEach(row => {
      const entry = row.querySelector('input.remove[data]');
      if (entry) map.set(entry.getAttribute('data'), row);
    });
    return map;
  }
  function getStatus(p) {
    if (p.support === 'protected' || p.compatibility?.classification === 'protected') return 'Protected';
    if (p.supported) return p.enabled ? 'Live ready' : 'Restore available';
    if (p.compatibility?.classification === 'candidate') return 'Review required';
    // Installed/parked state is independent of runtime controllability.
    switch (p.support) {
      case 'no-adapter': return 'No live control';
      case 'invalid-adapter': return 'Adapter blocked';
      case 'status-error': return 'Adapter error';
      case 'restore-only': return 'Restore available';
    }
    if (!p.enabled) return p.runtime === 'enabled' ? 'Still running' : 'Disabled';
    return p.runtime === 'enabled' ? 'Live ready' : 'Service stopped';
  }
  // All scanner results are untrusted data from third-party manifests:
  // render evidence with text escaping, never as executable HTML.
  function evidence(p) {
    const c = p.compatibility || {};
    const services = Array.isArray(c.services) && c.services.length ? c.services.join(', ') : 'None detected';
    const signals = Array.isArray(c.signals) && c.signals.length ? c.signals.join(', ') : 'None detected';
    const source = c.control_source || 'none';
    return '<div><strong>Classification:</strong> ' + escapeHtml(c.classification || 'unknown') + '</div>' +
      '<div><strong>Reason:</strong> ' + escapeHtml(c.reason || p.reason || 'Unknown') + '</div>' +
      '<div><strong>Service candidates:</strong> ' + escapeHtml(services) + '</div>' +
      '<div><strong>Review signals:</strong> ' + escapeHtml(signals) + '</div>' +
      '<div><strong>Profile:</strong> ' + escapeHtml(c.profile || c.profile_status || 'none') + '</div>' +
      '<div><strong>Control:</strong> ' + escapeHtml(source) + '</div>' +
      '<div><strong>Scanned:</strong> ' + escapeHtml(c.scanned_at || 'unknown') + '</div>';
  }
  function controlSummary() {
    const counts = {live:0,candidate:0,'next-boot':0,protected:0};
    cache.forEach(p => { const c = p.compatibility?.classification; if (c in counts) counts[c]++; });
    return 'Live ' + counts.live + ' · Review ' + counts.candidate +
      ' · Next boot ' + counts['next-boot'] + ' · Protected ' + counts.protected;
  }
  function toolbar(t) {
    if (document.getElementById('ps-toolbar')) return;
    const div = document.createElement('div');
    div.id = 'ps-toolbar';
    div.innerHTML = '<span id="ps-summary" aria-live="polite"></span>' +
      '<button type="button" id="ps-rescan" title="Refresh read-only compatibility discovery">Scan compatibility</button>' +
      '<button type="button" id="ps-export" title="Download compatibility evidence locally; no data is uploaded">Export report</button>';
    t.parentNode.insertBefore(div,t);
  }
  function updateToolbar() {
    const label = document.getElementById('ps-summary');
    const summary = controlSummary();
    if (label && label.textContent !== summary) label.textContent = summary;
  }
  function makeCell(p) {
    const label = p.enabled ? 'Disable' : 'Enable';
    const disabled = !p.supported;
    const reason = (p.enabled ? 'Installed at boot' : 'Parked / not loaded at boot') +
      '. ' + (p.reason || (label + ' ' + p.name));
    const checked = p.enabled ? ' checked' : '';
    return '<td class="ps-cell" data-plugin-switch="' + escapeHtml(p.id) + '">' +
      '<label class="ps-control" title="' + escapeHtml(reason) + '">' +
      '<input type="checkbox" class="ps-toggle" aria-label="' + escapeHtml(label + ' ' + p.name) +
      '" data-id="' + escapeHtml(p.id) + '"' + checked + (disabled ? ' disabled' : '') + '>' +
      '<span class="ps-track"></span></label>' +
      '<small class="ps-state">' + escapeHtml(getStatus(p)) + '</small>' +
      '<span class="ps-help" role="img" aria-label="' + escapeHtml(reason) +
      '" title="' + escapeHtml(reason) + '">ⓘ</span>' +
      '<details class="ps-detail"><summary>Why?</summary><div class="ps-evidence">' +
      evidence(p) + '</div></details></td>';
  }
  function addHeader(t) {
    const header = t.querySelector('thead tr');
    if (!header || header.querySelector('.ps-head')) return;
    const th = document.createElement('th');
    th.className = 'ps-head';
    th.textContent = 'Enabled';
    th.title = 'ON means installed; OFF means parked. Live control requires a verified adapter. Hover the info symbol for details.';
    // Append as final column so native tablesorter column mappings remain stable.
    header.appendChild(th);
  }
  function addCSS() {
    if (document.getElementById('ps-css')) return;
    const style = document.createElement('style');
    style.id = 'ps-css';
    style.textContent = '.ps-head,.ps-cell{text-align:center!important;min-width:90px}' +
      '.ps-control{position:relative;display:inline-flex;vertical-align:middle;cursor:pointer}' +
      '.ps-toggle{position:absolute;opacity:0;width:42px;height:24px;cursor:pointer}' +
      '.ps-track{width:42px;height:24px;border-radius:16px;background:#777;position:relative;pointer-events:none;transition:background .15s}' +
      '.ps-track:after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:100%;background:#fff;transition:transform .15s}' +
      '.ps-toggle:checked+.ps-track{background:#278d63}' +
      '.ps-toggle:checked+.ps-track:after{transform:translateX(18px)}' +
      '.ps-toggle:focus-visible+.ps-track{outline:2px solid #378aff;outline-offset:2px}' +
      '.ps-toggle:disabled+.ps-track{opacity:.68;cursor:not-allowed}' +
      '.ps-state{display:block;white-space:nowrap;margin-top:3px;font-size:10px}' +
      '.ps-help{font-size:12px;cursor:help;margin-left:4px;opacity:.7}' +
      '.ps-note{color:inherit;opacity:.8;font-size:12px}' +
      '.ps-disabled-row td{opacity:.8}' +
      '.ps-disabled-row td.ps-cell{opacity:1}' +
      '#ps-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0}' +
      '#ps-summary{margin-right:auto;font-size:12px;opacity:.85}' +
      '#ps-toolbar button{font-size:12px;cursor:pointer;padding:5px 8px}' +
      '.ps-detail{max-width:270px;text-align:left;margin:4px auto;font-size:11px}' +
      '.ps-detail summary{cursor:pointer;white-space:nowrap;text-align:center}' +
      '.ps-evidence{font-size:11px;line-height:1.45;overflow-wrap:anywhere;padding:5px;min-width:190px}' +
      '.ps-evidence div{margin:2px 0}';
    document.head.appendChild(style);
  }
  function ensureTable() {
    const t = table();
    if (!t) return;
    addCSS();
    toolbar(t);
    addHeader(t);
    updateToolbar();
    const rows = activeRowMap();
    // Remove stale/incomplete cells after Unraid refreshes its table.
    rows.forEach((row,id) => {
      const p = cache.get(id);
      if (!p) return;
      const existing = row.querySelector('td.ps-cell');
      if (!existing) row.insertAdjacentHTML('beforeend', makeCell(p));
    });
    // Disabled entries are not returned by ShowPlugins.php. Inject them into
    // the same table with clear metadata and an inert uninstall column.
    cache.forEach(p => {
      if (p.enabled || rows.has(p.id)) return;
      const key = 'ps-disabled-' + p.id.replace(/[^a-z0-9_-]/gi, '_');
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
      const id = row.querySelector('input.ps-toggle')?.dataset.id;
      if (!id || cache.get(id)?.enabled) row.remove();
    });
    t.querySelectorAll('td.ps-cell').forEach(cell => {
      const p = cache.get(cell.dataset.pluginSwitch);
      if (!p) return;
      const toggle = cell.querySelector('input.ps-toggle');
      if (document.activeElement === toggle || toggle?.dataset.busy) return;
      if (toggle) {
        toggle.checked = p.enabled;
        const label = cell.querySelector('.ps-control');
        const reason = (p.enabled ? 'Installed at boot' : 'Parked / not loaded at boot') +
          '. ' + (p.reason || '');
        if (label && label.title !== reason) label.title = reason;
        const help = cell.querySelector('.ps-help');
        if (help) {
          if (help.title !== reason) help.title = reason;
          if (help.getAttribute('aria-label') !== reason) help.setAttribute('aria-label', reason);
        }
        toggle.disabled = !p.supported;
      }
      const status = cell.querySelector('.ps-state');
      if (status && status.textContent !== getStatus(p)) status.textContent = getStatus(p);
      const details = cell.querySelector('.ps-evidence');
      if (details) {
        const updated = evidence(p);
        if (details.innerHTML !== updated) details.innerHTML = updated;
      }
    });
    // Fixed-width placeholders and tablesorter may need adjustment after a new column.
    t.querySelectorAll('tbody td[colspan="6"]').forEach(td => td.colSpan = 7);
  }
  function csrf() {
    if (typeof window.csrf_token === 'string') return window.csrf_token;
    return '';
  }
  async function refresh() {
    if (loading || !isPlugins()) return;
    loading = true;
    try {
      const response = await fetch(api, {credentials:'same-origin',cache:'no-store'});
      if (!response.ok) throw new Error('Cannot load plugin states');
      const data = await response.json();
      cache.clear();
      (data.plugins || []).forEach(p => cache.set(p.id,p));
      ensureTable();
      lastFetch = Date.now();
    } catch (e) {
      console.warn('[Plugin Switch]',e);
    } finally {
      loading = false;
    }
  }
  async function toggle(input) {
    const id = input.dataset.id;
    const p = cache.get(id);
    if (!p || !p.supported) return;
    const enable = input.checked;
    const verb = enable ? 'enable' : 'disable';
    if (!window.confirm('Really ' + verb + ' ' + p.name + '? Its services and interfaces may be affected immediately.')) {
      input.checked = !enable; return;
    }
    input.dataset.busy = '1';
    input.disabled = true;
    try {
      const form = new URLSearchParams({id:id,enabled:enable ? '1':'0',csrf_token:csrf()});
      const response = await fetch(api, {
        method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:form
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Plugin state change failed');
      cache.set(id, data.plugin);
      // Unraid's own list will now be stale: request a reload after state update.
      window.location.reload();
    } catch (e) {
      input.checked = !enable;
      window.alert('Plugin Switch: ' + e.message);
      delete input.dataset.busy;
      input.disabled = !p.supported;
      await refresh();
    }
  }
  document.addEventListener('change', e => {
    if (e.target.matches('.ps-toggle')) toggle(e.target);
  });
  document.addEventListener('click', async e => {
    if (e.target.id === 'ps-rescan') {
      const button = e.target;
      if (loading) return;
      button.disabled = true;
      loading = true;
      try {
        const form = new URLSearchParams({action:'rescan',csrf_token:csrf()});
        const response = await fetch(api, {
          method:'POST',credentials:'same-origin',
          headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Scan failed');
        cache.clear();
        (data.plugins || []).forEach(p => cache.set(p.id,p));
        lastFetch = Date.now();
        ensureTable();
      } catch (error) {
        window.alert('Plugin Switch: ' + error.message);
      } finally {
        loading = false;
        button.disabled = false;
      }
    }
    if (e.target.id === 'ps-export') {
      const report = {
        generated_at:new Date().toISOString(),
        notice:'Local compatibility evidence only. Candidate discovery is NOT a live-control guarantee.',
        plugins:Array.from(cache.values()).map(p => ({
          id:p.id,name:p.name,version:p.version,enabled:p.enabled,
          supported:p.supported,compatibility:p.compatibility
        }))
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plugin-switch-compatibility.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url),1000);
    }
  });
  // MutationObserver handles async ShowPlugins.php list rendering.
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued || !isPlugins()) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      ensureTable();
      if (Date.now() - lastFetch > 30000) refresh();
    });
  });
  function init() {
    observer.observe(document.body, {childList:true,subtree:true});
    if (isPlugins()) refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
