
(() => {
  'use strict';
  const api = '/plugins/plugin.switch/api.php';
  const plugins = new Map();
  let loading = false, lastFetch = 0, queued = false;
  let modalHost = null, modalTrigger = null, originalBodyOverflow = '';

  const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
  const lock = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
  const info = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
  const controlsCSS = `
    :host{display:block;width:68px;height:26px;vertical-align:middle;color:#aeb8c6}
    *,*::before,*::after{box-sizing:border-box}
    .actions{display:flex;align-items:center;justify-content:flex-start;gap:9px;height:26px}
    button{all:unset;box-sizing:border-box}
    .switch{position:relative;flex:0 0 39px;width:39px;height:22px;border-radius:999px;
      background:#6b7480;cursor:pointer;transition:background .15s}
    .switch[aria-checked="true"]{background:#238c68}
    .switch .thumb{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;
      background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.24);pointer-events:none;transition:transform .15s}
    .switch[aria-checked="true"] .thumb{transform:translateX(17px)}
    .switch:disabled{opacity:.56;cursor:not-allowed}
    .switch:focus-visible,.details:focus-visible{outline:2px solid #78b4ff;outline-offset:3px}
    .details{flex:0 0 20px;display:flex;align-items:center;justify-content:center;width:20px;
      height:24px;padding:0;border:0;background:transparent;color:#aab4c1;cursor:pointer}
    .details:hover,.details[aria-expanded="true"]{color:#fff}
    .details svg{display:block;width:15px;height:15px;fill:none;stroke:currentColor;
      stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    @media(prefers-reduced-motion:reduce){.switch,.switch .thumb{transition:none}}
  `;
  const modalCSS = `
    :host{all:initial;position:fixed!important;inset:0!important;display:block!important;
      z-index:2147483000!important;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;
      color:#edf1f7;color-scheme:dark}
    *,*::before,*::after{box-sizing:border-box}
    .overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
      padding:24px;background:rgba(5,8,15,.74);backdrop-filter:blur(3px)}
    .dialog{display:flex;flex-direction:column;width:min(640px,100%);min-height:0;
      max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);
      border:1px solid #454d59;border-radius:16px;background:#20242b;color:#edf1f7;
      box-shadow:0 25px 80px rgba(0,0,0,.5);overflow:hidden}
    .header{flex:none;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;
      padding:22px 26px 16px}
    .eyebrow{text-transform:uppercase;letter-spacing:.10em;font-size:10px;font-weight:700;color:#a3b0c0}
    h2{margin:5px 0 0;color:#fff;font-size:20px;line-height:1.35;font-weight:650;overflow-wrap:anywhere}
    .close{all:unset;box-sizing:border-box;display:grid;place-items:center;flex:0 0 32px;
      width:32px;height:32px;border-radius:8px;font-size:24px;line-height:1;
      color:#c7d3df;cursor:pointer}
    .close:hover{background:#36404d;color:#fff}
    .close:focus-visible,.done:focus-visible{outline:2px solid #78b4ff;outline-offset:2px}
    .scroll{flex:1 1 auto;min-height:0;overflow-y:auto!important;overflow-x:hidden!important;
      overscroll-behavior:contain;padding:0 26px 23px;scrollbar-color:#697789 transparent}
    .badges{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}
    .chip{display:inline-flex;align-items:center;min-height:25px;padding:4px 10px;
      font-size:12px;font-weight:600;border:1px solid #4a5462;border-radius:999px;
      background:#303742;color:#e0e8f0}
    .chip.available{border-color:#2b8f6c;background:#173b2d;color:#a7ead3}
    .reason{background:#2b323c;border:1px solid #3e4855;border-radius:10px;
      padding:13px 15px;margin:0 0 20px;line-height:1.55;overflow-wrap:anywhere}
    .section-title{margin:0 0 7px;color:#adbccd;font-weight:700;font-size:12px}
    dl{margin:0;min-width:0}
    .field{display:grid;grid-template-columns:145px minmax(0,1fr);gap:18px;
      align-items:start;padding:11px 0;border-bottom:1px solid #39404a}
    .field:last-child{border-bottom:0}
    dt{font-size:12px;font-weight:600;color:#a9b7c7}
    dd{margin:0;min-width:0;font-size:13px;line-height:1.55;color:#edf1f7;
      overflow-wrap:anywhere;word-break:normal;white-space:normal}
    .footer{flex:none;display:flex;justify-content:flex-end;padding:13px 26px;
      border-top:1px solid #39404b;background:#20242b}
    .done{all:unset;box-sizing:border-box;padding:9px 19px;border:1px solid #606b79;
      border-radius:8px;background:#384350;color:#f3f7fc;cursor:pointer;
      font:600 13px system-ui,-apple-system,"Segoe UI",sans-serif}
    .done:hover{background:#4b5969}
    @media(max-width:540px){
      .overlay{padding:12px}
      .dialog{max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);border-radius:12px}
      .header{padding:18px 18px 13px}h2{font-size:18px}
      .scroll{padding:0 18px 18px}
      .field{grid-template-columns:1fr;gap:3px}
      .footer{padding:12px 18px}
    }
  `;

  const table = () => document.getElementById('plugin_table');
  function csrf() {
    if (typeof window.csrf_token === 'string' && window.csrf_token) return window.csrf_token;
    return document.querySelector('input[name="csrf_token"]')?.value || '';
  }
  function compatibilityStatus(p) {
    if (p.support === 'protected' || p.compatibility?.classification === 'protected') return 'Protected';
    if (p.supported) return p.enabled ? 'Live control available' : 'Restore available';
    if (p.compatibility?.classification === 'candidate') return 'Needs review';
    if (p.support === 'invalid-adapter') return 'Adapter blocked';
    if (p.support === 'status-error') return 'Adapter error';
    return 'No live control';
  }
  function explanation(p) {
    return (p.enabled ? 'Installed' : 'Parked')+' · '+compatibilityStatus(p)+'. '+
      (p.compatibility?.reason || p.reason || 'No compatibility details available.');
  }
  function evidence(p) {
    const c = p.compatibility || {};
    const joined = a => Array.isArray(a) && a.length ? a.join(', ') : 'None detected';
    return [
      ['Current state',p.enabled?'Installed / enabled at boot':'Parked / disabled at boot'],
      ['Compatibility',compatibilityStatus(p)],
      ['Classification',c.classification || 'Unknown'],
      ['Reason',c.reason || p.reason || 'Unavailable'],
      ['Service candidates',joined(c.services)],
      ['Review signals',joined(c.signals)],
      ['Profile',c.profile || c.profile_status || 'None'],
      ['Control source',c.control_source || 'None'],
      ['Last scanned',c.scanned_at || 'Unknown']
    ];
  }
  function updateCell(cell,p) {
    const root = cell.querySelector('.ps-controls-host')?.shadowRoot;
    if (!root) return;
    const switchButton = root.querySelector('.switch');
    if (!switchButton.dataset.busy) {
      const checked = p.enabled ? 'true' : 'false';
      if (switchButton.getAttribute('aria-checked') !== checked)
        switchButton.setAttribute('aria-checked',checked);
      switchButton.disabled = !p.supported;
    }
    switchButton.setAttribute('aria-label',(p.enabled ? 'Disable ' : 'Enable ')+p.name);
    switchButton.title = explanation(p);
    const details = root.querySelector('.details');
    details.title = explanation(p);
    details.setAttribute('aria-label','View compatibility details for '+p.name);
    const icon = p.supported ? 'info' : 'lock';
    if (details.dataset.icon !== icon) {
      details.innerHTML = p.supported ? info : lock;
      details.dataset.icon = icon;
    }
    details.setAttribute('aria-expanded',modalHost && modalHost.dataset.id === p.id ? 'true' : 'false');
  }
  function createCell(p) {
    const cell = document.createElement('td');
    cell.className = 'ps-cell';
    cell.dataset.pluginSwitch = p.id;
    cell.style.setProperty('text-align','left','important');
    cell.style.setProperty('vertical-align','middle','important');
    cell.style.setProperty('min-width','92px');
    cell.style.setProperty('width','100px');
    // Align the controls to a fixed inset from the cell's left edge.
    // Unraid's native table sizing/padding can otherwise visually shift
    // centered elements right of the Enabled header.
    cell.style.setProperty('position','relative','important');
    cell.style.setProperty('padding-left','0','important');
    cell.style.setProperty('padding-right','0','important');
    const host = document.createElement('span');
    host.className = 'ps-controls-host';
    host.style.setProperty('position','absolute','important');
    host.style.setProperty('left','12px','important');
    host.style.setProperty('top','50%','important');
    host.style.setProperty('transform','translateY(-50%)','important');
    const root = host.attachShadow({mode:'open'});
    root.innerHTML = '<style>'+controlsCSS+'</style><div class="actions">'+
      '<button type="button" class="switch" role="switch" aria-checked="false">'+
      '<span class="thumb" aria-hidden="true"></span></button>'+
      '<button type="button" class="details" aria-haspopup="dialog" aria-expanded="false">'+
      lock+'</button></div>';
    cell.appendChild(host);
    root.querySelector('.switch').addEventListener('click',() => togglePlugin(p.id));
    root.querySelector('.details').addEventListener('click',e => {
      e.stopPropagation();
      showModal(p.id,root.querySelector('.details'));
    });
    updateCell(cell,p);
    return cell;
  }

  function closeModal() {
    if (!modalHost) return;
    modalHost.remove();
    modalHost = null;
    document.body.style.overflow = originalBodyOverflow;
    const previous = modalTrigger;
    modalTrigger = null;
    if (previous && previous.isConnected) {
      previous.setAttribute('aria-expanded','false');
      previous.focus();
    }
  }
  function showModal(id,trigger) {
    if (modalHost && modalHost.dataset.id === id) { closeModal(); return; }
    const p = plugins.get(id);
    if (!p) return;
    closeModal();
    const host = document.createElement('div');
    host.id = 'ps-modal-host';
    host.dataset.id = id;
    const shadow = host.attachShadow({mode:'open'});
    const rows = evidence(p).map(([key,value]) =>
      '<div class="field"><dt>'+escapeHtml(key)+'</dt><dd>'+escapeHtml(value)+'</dd></div>'
    ).join('');
    shadow.innerHTML = '<style>'+modalCSS+'</style><div class="overlay">'+
      '<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="ps-modal-title">'+
      '<header class="header"><div><div class="eyebrow">Plugin Switch · Compatibility</div>'+
      '<h2 id="ps-modal-title">'+escapeHtml(p.name)+'</h2></div>'+
      '<button type="button" class="close" aria-label="Close dialog">×</button></header>'+
      '<div class="scroll" tabindex="0">'+
      '<div class="badges"><span class="chip">'+escapeHtml(p.enabled?'Installed':'Disabled')+
      '</span><span class="chip '+(p.supported?'available':'')+'">'+
      escapeHtml(compatibilityStatus(p))+'</span></div>'+
      '<p class="reason">'+escapeHtml(p.compatibility?.reason || p.reason ||
      'Compatibility has not been verified.')+'</p>'+
      '<h3 class="section-title">Detection details</h3><dl>'+rows+'</dl></div>'+
      '<footer class="footer"><button type="button" class="done">Close</button></footer>'+
      '</section></div>';
    document.body.appendChild(host);
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalHost = host;
    modalTrigger = trigger;
    trigger.setAttribute('aria-expanded','true');
    shadow.querySelector('.close').addEventListener('click',closeModal);
    shadow.querySelector('.done').addEventListener('click',closeModal);
    shadow.querySelector('.overlay').addEventListener('click',e => {
      if (e.target.classList.contains('overlay')) closeModal();
    });
    shadow.querySelector('.close').focus();
  }
  document.addEventListener('keydown',e => {
    if (!modalHost) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    } else if (e.key === 'Tab') {
      const root = modalHost.shadowRoot;
      const items = [...root.querySelectorAll('.close,.scroll,.done')];
      const index = items.indexOf(root.activeElement);
      if (e.shiftKey && index <= 0) { e.preventDefault(); items[items.length-1].focus(); }
      if (!e.shiftKey && index === items.length-1) { e.preventDefault(); items[0].focus(); }
    }
  });

  function toolbar(t) {
    if (document.getElementById('ps-toolbar')) return;
    const bar = document.createElement('div');
    bar.id = 'ps-toolbar';
    bar.innerHTML = '<span id="ps-summary" aria-live="polite"></span>'+
      '<button type="button" id="ps-rescan" title="Refresh read-only compatibility discovery">Scan compatibility</button>'+
      '<button type="button" id="ps-export" title="Download compatibility evidence locally">Export report</button>';
    t.parentNode.insertBefore(bar,t);
  }
  function summary() {
    const counts = {live:0,candidate:0,'next-boot':0,protected:0};
    plugins.forEach(p => {
      const c = p.compatibility?.classification;
      if (Object.prototype.hasOwnProperty.call(counts,c)) counts[c]++;
    });
    return 'Live '+counts.live+' · Review '+counts.candidate+' · Next boot '+counts['next-boot']+
      ' · Protected '+counts.protected;
  }
  function activeRowMap() {
    const rows = new Map();
    table()?.querySelectorAll('tbody tr').forEach(row => {
      const nativeControl = row.querySelector('input.remove[data]');
      if (nativeControl) rows.set(nativeControl.getAttribute('data'),row);
    });
    return rows;
  }
  function ensureTable() {
    const t = table();
    if (!t) return;
    const header = t.querySelector('thead tr');
    if (!header) return;
    toolbar(t);
    if (!header.querySelector('.ps-head')) {
      const th = document.createElement('th');
      th.className = 'ps-head';
      th.textContent = 'Enabled';
      th.title = 'The switch shows installed state. The icon opens compatibility details.';
      th.style.setProperty('width','100px');
      header.appendChild(th);
    }
    const summaryElement = document.getElementById('ps-summary');
    if (summaryElement && summaryElement.textContent !== summary())
      summaryElement.textContent = summary();
    const rows = activeRowMap();
    rows.forEach((row,id) => {
      const p = plugins.get(id);
      if (p && !row.querySelector('td.ps-cell')) row.appendChild(createCell(p));
    });
    plugins.forEach(p => {
      if (p.enabled || rows.has(p.id)) return;
      const key = 'ps-disabled-'+p.id.replace(/[^a-z0-9_-]/gi,'_');
      if (document.getElementById(key)) return;
      const row = document.createElement('tr');
      row.id = key;
      row.className = 'ps-disabled-row';
      row.innerHTML = '<td>◌</td><td><strong>'+escapeHtml(p.name)+
        '</strong><br><small>Disabled by Plugin Switch</small></td>'+
        '<td>'+escapeHtml(p.author)+'</td><td>'+escapeHtml(p.version)+
        '</td><td>Disabled</td><td>—</td>';
      row.appendChild(createCell(p));
      t.tBodies[0]?.appendChild(row);
    });
    t.querySelectorAll('tr.ps-disabled-row').forEach(row => {
      const id = row.querySelector('td.ps-cell')?.dataset.pluginSwitch;
      if (!id || plugins.get(id)?.enabled) row.remove();
    });
    t.querySelectorAll('td.ps-cell').forEach(cell => {
      const p = plugins.get(cell.dataset.pluginSwitch);
      if (p) updateCell(cell,p);
    });
    t.querySelectorAll('tbody td[colspan="6"]').forEach(td => { td.colSpan = 7; });
  }

  async function fetchPlugins(force=false) {
    const response = await fetch(force?api+'?rescan=1':api,{credentials:'same-origin',cache:'no-store'});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to load compatibility');
    return data.plugins || [];
  }
  async function refresh(force=false) {
    if (loading || !table()) return;
    loading = true;
    try {
      const data = await fetchPlugins(force);
      plugins.clear();
      data.forEach(p => plugins.set(p.id,p));
      closeModal();
      lastFetch = Date.now();
      ensureTable();
    } catch(e) {
      console.warn('[Plugin Switch]',e);
      if (force) window.alert('Plugin Switch: '+e.message);
    } finally {
      loading = false;
    }
  }
  async function togglePlugin(id) {
    const p = plugins.get(id);
    if (!p || !p.supported) return;
    const enabled = !p.enabled;
    if (!window.confirm((enabled?'Enable ':'Disable ')+p.name+
      '? Runtime services may change immediately.')) return;
    const token = csrf();
    if (!token) {
      window.alert('Plugin Switch: Unraid CSRF session unavailable. Refresh the page.');
      return;
    }
    const cell = [...table().querySelectorAll('td.ps-cell')]
      .find(el => el.dataset.pluginSwitch === id);
    const button = cell?.querySelector('.ps-controls-host')?.shadowRoot?.querySelector('.switch');
    if (button) { button.dataset.busy='1'; button.disabled=true; }
    try {
      const body = new URLSearchParams({id,enabled:enabled?'1':'0',csrf_token:token});
      const response = await fetch(api,{
        method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},body
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'State change failed');
      plugins.set(id,data.plugin);
      window.location.reload();
    } catch(e) {
      window.alert('Plugin Switch: '+e.message);
    } finally {
      if (button) { delete button.dataset.busy; button.disabled=!p.supported; }
    }
  }
  function exportReport() {
    const report = {
      generated_at:new Date().toISOString(),
      notice:'Local compatibility evidence only. Discovery does not certify live safety.',
      plugins:[...plugins.values()].map(p => ({
        id:p.id,name:p.name,version:p.version,enabled:p.enabled,
        supported:p.supported,compatibility:p.compatibility
      }))
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a = document.createElement('a');
    a.href = url;
    a.download='plugin-switch-compatibility.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  document.addEventListener('click',e => {
    if (e.target.id === 'ps-rescan') {
      const button=e.target;
      if (!loading) {
        button.disabled=true;
        refresh(true).finally(() => { button.disabled=false; });
      }
    }
    if (e.target.id === 'ps-export') exportReport();
  });
  const observer = new MutationObserver(() => {
    if (queued || !table()) return;
    queued=true;
    requestAnimationFrame(() => {
      queued=false;
      ensureTable();
      if (Date.now()-lastFetch>30000) refresh();
    });
  });
  function init() {
    observer.observe(document.body,{childList:true,subtree:true});
    if (table()) refresh();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
