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
    if (!p.supported) return 'No live adapter';
    return p.runtime === 'enabled' ? 'Running' : p.runtime === 'disabled' ? 'Stopped' : 'Unknown';
  }
  function makeCell(p) {
    const label = p.enabled ? 'Disable' : 'Enable';
    const disabled = !p.supported;
    const reason = disabled ? p.reason : label + ' ' + p.name;
    const checked = p.runtime === 'enabled' ? ' checked' : '';
    return '<td class="ps-cell" data-plugin-switch="' + escapeHtml(p.id) + '">' +
      '<label class="ps-control" title="' + escapeHtml(reason) + '">' +
      '<input type="checkbox" class="ps-toggle" aria-label="' + escapeHtml(label + ' ' + p.name) +
      '" data-id="' + escapeHtml(p.id) + '"' + checked + (disabled ? ' disabled' : '') + '>' +
      '<span class="ps-track"></span></label>' +
      '<small class="ps-state">' + escapeHtml(getStatus(p)) + '</small></td>';
  }
  function addHeader(t) {
    const header = t.querySelector('thead tr');
    if (!header || header.querySelector('.ps-head')) return;
    const th = document.createElement('th');
    th.className = 'ps-head';
    th.textContent = 'Enabled';
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
      '.ps-toggle:disabled+.ps-track{opacity:.33;cursor:not-allowed}' +
      '.ps-state{display:block;white-space:nowrap;margin-top:3px;font-size:10px}' +
      '.ps-note{color:inherit;opacity:.8;font-size:12px}' +
      '.ps-disabled-row td{opacity:.8}' +
      '.ps-disabled-row td.ps-cell{opacity:1}';
    document.head.appendChild(style);
  }
  function ensureTable() {
    const t = table();
    if (!t) return;
    addCSS();
    addHeader(t);
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
        toggle.checked = p.runtime === 'enabled';
        toggle.disabled = !p.supported;
      }
      const status = cell.querySelector('.ps-state');
      if (status) status.textContent = getStatus(p);
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
