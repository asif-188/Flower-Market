// ============================================================
// FARMER MODULE — Full CRUD + Excel Import + Smart Ledger
// Multi-tenant | Flower Market Billing
// ============================================================

const FarmerModule = (() => {

  let _container = null;
  let _db = null;
  let searchQuery = '';
  let currentPage = 1;
  const PAGE_SIZE = 10;

  // ── Data helpers ─────────────────────────────────────────────────────────
  function storageKey() { return `fmb_farmers_${_db.currentTenant}`; }

  function getFarmers() {
    return _db.tenants[_db.currentTenant]?.data?.farmers || [];
  }

  function saveFarmers(list) {
    _db.tenants[_db.currentTenant].data.farmers = list;
    sessionStorage.setItem(storageKey(), JSON.stringify(list));
  }

  function loadFarmers() {
    const raw = sessionStorage.getItem(storageKey());
    if (raw) {
      try { _db.tenants[_db.currentTenant].data.farmers = JSON.parse(raw); } catch(e) {}
    }
  }

  function generateId() {
    const farmers = getFarmers();
    if (!farmers.length) return '101';
    const nums = farmers.map(f => {
      const m = String(f.id || '').match(/\d+/);
      return m ? parseInt(m[0], 10) : 0;
    });
    const max = Math.max(...nums);
    return max < 101 ? '101' : String(max + 1);
  }

  function getAmountDue(farmer) {
    const ledger = farmer.ledger || [];
    const totalDebit  = ledger.reduce((s, t) => s + (Number(t.debit)  || 0), 0);
    const totalCredit = ledger.reduce((s, t) => s + (Number(t.credit) || 0), 0);
    return (Number(farmer.initialDues) || 0) + totalDebit - totalCredit;
  }

  function filteredFarmers() {
    const all = getFarmers();
    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(f =>
      String(f.name || '').toLowerCase().includes(q) ||
      String(f.id || '').toLowerCase().includes(q) ||
      String(f.contact || '').includes(q)
    );
  }

  // ── Public: render ────────────────────────────────────────────────────────
  function render(container, db) {
    _container = container;
    _db = db;
    loadFarmers();
    renderPage();
  }

  // ── Main page ─────────────────────────────────────────────────────────────
  function renderPage() {
    _container.innerHTML = '';
    _container.className = 'content-panel glass-card fm-root';

    // ── Header ──
    const header = el('div', 'fm-header');
    header.innerHTML = `
      <div class="fm-page-header">
        <h1 class="fm-title">👨‍🌾 ${App.i18n.t('farmerMgmt')}</h1>
        <div class="fm-header-actions">
          <button class="fm-tpl-btn ripple" id="fm-tpl-btn" title="Download Excel Template">
            📋 ${App.i18n.t('template')}
          </button>
            <span>📥 ${App.i18n.t('import')}</span>
            <input type="file" id="fm-import-input" accept=".xlsx,.xls" style="display:none" />
          </label>
          <button class="fm-btn-add ripple" id="fm-add-btn" style="background:#fff !important; color:#1e8a4a !important; border:2px solid #1e8a4a !important; font-weight:800 !important; cursor:pointer !important; min-width:130px !important; display:flex !important; align-items:center !important; justify-content:center !important;">
            ${App.i18n.t('addFarmerBtn')}
          </button>
        </div>
      </div>
      <div class="fm-search-row">
        <div class="fm-search-wrap">
          <span class="fm-search-icon">🔍</span>
          <input id="fm-search" class="fm-search-input" type="text"
            placeholder="${App.i18n.t('searchHint')}"
            value="${esc(searchQuery)}" autocomplete="off" />
          ${searchQuery ? '<button class="fm-clear-btn" id="fm-clear">✕</button>' : ''}
        </div>
      </div>`;
    _container.appendChild(header);

    renderTable();

    // ── Events (use _container.querySelector — panel may not be in document yet) ──
    _container.querySelector('#fm-add-btn')
      ?.addEventListener('click', () => openModal());

    _container.querySelector('#fm-tpl-btn')
      ?.addEventListener('click', downloadTemplate);

    _container.querySelector('#fm-import-input')
      ?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) { importFarmers(file); e.target.value = ''; }
      });

    const inp = _container.querySelector('#fm-search');
    if (inp) {
      inp.addEventListener('input', e => {
        searchQuery = e.target.value;
        currentPage = 1;
        renderTable();
        const clearBtn = _container.querySelector('#fm-clear');
        const sw = _container.querySelector('.fm-search-wrap');
        if (searchQuery && !clearBtn && sw) {
          const btn = el('button', 'fm-clear-btn');
          btn.id = 'fm-clear'; btn.textContent = '✕';
          btn.addEventListener('click', clearSearch);
          sw.appendChild(btn);
        } else if (!searchQuery && clearBtn) {
          clearBtn.remove();
        }
      });
      setTimeout(() => inp.focus(), 120);
    }

    _container.querySelector('#fm-clear')?.addEventListener('click', clearSearch);

    // ── Keyboard Shortcuts ──
    _container.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openModal();
      }
    });
  }

  function clearSearch() {
    searchQuery = '';
    currentPage = 1;
    const inp = document.getElementById('fm-search');
    if (inp) inp.value = '';
    document.getElementById('fm-clear')?.remove();
    renderTable();
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  function renderTable() {
    document.getElementById('fm-table-area')?.remove();

    const area = el('div', 'fm-table-area');
    area.id = 'fm-table-area';

    const farmers = filteredFarmers();
    const total = farmers.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = farmers.slice(start, start + PAGE_SIZE);

    if (total === 0) {
      area.innerHTML = `
        <div class="fm-empty">
          <div class="fm-empty-emoji">🌱</div>
          <p class="fm-empty-text">${searchQuery
            ? 'No farmers match your search.'
            : 'No farmers yet. Click <strong>Add Farmer</strong> or <strong>Import</strong> to get started!'}</p>
        </div>`;
    } else {
      const stats = el('div', 'fm-stats-bar');
      stats.innerHTML = `
        <span class="fm-stat">📋 ${App.i18n.t('total')}: <strong>${getFarmers().length}</strong></span>
        <span class="fm-stat">🔍 ${App.i18n.t('shown')}: <strong>${total}</strong></span>
        <span class="fm-stat">💰 ${App.i18n.t('totalDue')}: <strong>₹${fmt(
          getFarmers().reduce((s, f) => s + Math.max(0, getAmountDue(f)), 0)
        )}</strong></span>`;
      area.appendChild(stats);

      const tblWrap = el('div', 'fm-tbl-scroll');
      const table = document.createElement('table');
      table.className = 'fm-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th class="th-id">${App.i18n.t('id')}</th>
            <th>${App.i18n.t('date')}</th>
            <th>${App.i18n.t('name')}</th>
            <th>${App.i18n.t('contact')}</th>
            <th class="th-center">${App.i18n.t('ledger')}</th>
            <th class="th-center">${App.i18n.t('edit')}</th>
            <th class="th-center">${App.i18n.t('delete')}</th>
          </tr>
        </thead>
        <tbody id="fm-tbody"></tbody>`;
      tblWrap.appendChild(table);
      area.appendChild(tblWrap);

      const tbody = table.querySelector('#fm-tbody');
      pageData.forEach((farmer, idx) => {
        const due = getAmountDue(farmer);
        const dueClass = due > 0 ? 'due-dr' : due < 0 ? 'due-cr' : 'due-zero';
        const tr = document.createElement('tr');
        tr.className = 'fm-row' + (idx % 2 ? ' fm-row-alt' : '');
        tr.innerHTML = `
          <td><span class="fm-id-badge">${esc(farmer.id)}</span></td>
          <td style="font-size: 0.85rem; color: var(--text-muted);">${esc(farmer.createdAt || '—')}</td>
          <td class="fm-name-cell">${esc(farmer.name)}</td>
          <td>${esc(farmer.contact || '—')}</td>
          <td class="th-center">
            <button class="fm-ledger-btn ripple" data-id="${esc(farmer.id)}">📒 ${App.i18n.t('view')}</button>
          </td>
          <td class="th-center">
            <button class="fm-edit-btn ripple" data-id="${esc(farmer.id)}">✏️ ${App.i18n.t('edit')}</button>
          </td>
          <td class="th-center">
            <button class="fm-delete-btn ripple" data-id="${esc(farmer.id)}">🗑 ${App.i18n.t('delete')}</button>
          </td>`;
        tbody.appendChild(tr);
      });

      area.querySelectorAll('.fm-edit-btn').forEach(b =>
        b.addEventListener('click', () => openModal(b.dataset.id)));
      area.querySelectorAll('.fm-ledger-btn').forEach(b =>
        b.addEventListener('click', () => openLedger(b.dataset.id)));
      area.querySelectorAll('.fm-delete-btn').forEach(b =>
        b.addEventListener('click', () => deleteFarmer(b.dataset.id)));

      if (totalPages > 1) {
        const pg = el('div', 'fm-pagination');
        pg.innerHTML = `
          <button class="fm-pg-btn ripple" id="fm-pg-prev" ${currentPage===1?'disabled':''}>◀ Prev</button>
          <span class="fm-pg-info">Page ${currentPage} / ${totalPages} &nbsp;|&nbsp; ${total} records</span>
          <button class="fm-pg-btn ripple" id="fm-pg-next" ${currentPage===totalPages?'disabled':''}>Next ▶</button>`;
        pg.querySelector('#fm-pg-prev')?.addEventListener('click', () => { currentPage--; renderTable(); });
        pg.querySelector('#fm-pg-next')?.addEventListener('click', () => { currentPage++; renderTable(); });
        area.appendChild(pg);
      }
    }

    _container.appendChild(area);
  }

  // ── Excel: Download Template ────────────────────────────────────────────
  function downloadTemplate() {
    if (typeof XLSX === 'undefined') {
      toast('⚠️ Excel library not loaded. Check internet connection.'); return;
    }
    const headers = ['Farmer ID', 'Farmer Name', 'Contact Number', 'Location', 'Initial Dues'];
    const sample  = ['F001', 'Sample Farmer', '9876543210', 'Chennai', '500'];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);

    // Column widths
    ws['!cols'] = [14, 22, 18, 16, 14].map(w => ({ wch: w }));

    // Header style hint (bold — SheetJS CE doesn't apply cell styles but sets structure)
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Farmers');
    XLSX.writeFile(wb, 'farmer_import_template.xlsx');
    toast('📋 Template downloaded!');
  }

  // ── Excel: Import ─────────────────────────────────────────────────────────
  function importFarmers(file) {
    if (typeof XLSX === 'undefined') {
      toast('⚠️ Excel library not loaded. Check internet connection.'); return;
    }

    // Show loading overlay
    const loadOverlay = el('div', 'fm-overlay fm-ov-show');
    loadOverlay.id = 'fm-loading-ov';
    loadOverlay.innerHTML = `
      <div class="fm-modal fm-loading-modal">
        <div class="fm-loading-body">
          <div class="fm-spinner"></div>
          <p class="fm-loading-text">Reading Excel file…</p>
        </div>
      </div>`;
    document.body.appendChild(loadOverlay);

    const reader = new FileReader();
    reader.onload = (e) => {
      setTimeout(() => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb   = XLSX.read(data, { type: 'array' });
          const ws   = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

          document.getElementById('fm-loading-ov')?.remove();

          if (!rows || rows.length < 2) {
            showImportResult({ error: 'File is empty or has no data rows.' });
            return;
          }

          // Validate headers
          const EXPECTED = ['Farmer ID', 'Farmer Name', 'Contact Number', 'Location', 'Initial Dues'];
          const headers = (rows[0] || []).map(h => String(h).trim());
          const mismatched = EXPECTED.filter((h, i) => headers[i] !== h);
          if (mismatched.length) {
            showImportResult({ error: `Column headers don't match template.\n\nExpected:\n${EXPECTED.join(' | ')}\n\nFound:\n${headers.join(' | ')}` });
            return;
          }

          const existing = getFarmers();
          const existingIds = new Set(existing.map(f => f.id));
          const results = { success: [], failed: [], total: rows.length - 1 };

          rows.slice(1).forEach((row, idx) => {
            const rowNum = idx + 2;
            const id         = String(row[0] || '').trim();
            const name       = String(row[1] || '').trim();
            const contact    = String(row[2] || '').trim();
            const location   = String(row[3] || '').trim();
            const initialDues= parseFloat(row[4]) || 0;

            if (!id && !name) return; // skip blank rows

            if (!id)   { results.failed.push({ row: rowNum, id, name, reason: 'Missing Farmer ID' }); return; }
            if (!name) { results.failed.push({ row: rowNum, id, name, reason: 'Missing Farmer Name' }); return; }
            if (!contact) { results.failed.push({ row: rowNum, id, name, reason: 'Missing Contact Number' }); return; }

            if (existingIds.has(id)) {
              results.failed.push({ row: rowNum, id, name, reason: `Duplicate ID "${id}"` }); return;
            }

            existingIds.add(id);
            results.success.push({ id, name, contact, location, initialDues, createdAt: today(), ledger: [] });
          });

          if (results.success.length > 0) {
            saveFarmers([...existing, ...results.success]);
          }

          showImportResult(results);

        } catch(err) {
          document.getElementById('fm-loading-ov')?.remove();
          showImportResult({ error: `Failed to parse file: ${err.message}` });
        }
      }, 400); // small delay so loader is visible
    };
    reader.onerror = () => {
      document.getElementById('fm-loading-ov')?.remove();
      showImportResult({ error: 'Could not read file.' });
    };
    reader.readAsArrayBuffer(file);
  }

  function showImportResult(results) {
    const isError = !!results.error;
    const overlay = el('div', 'fm-overlay');
    overlay.id = 'fm-import-result-ov';

    let bodyHtml = '';

    if (isError) {
      bodyHtml = `
        <div class="fm-import-error-msg">
          <div class="fm-confirm-icon">⚠️</div>
          <p class="fm-confirm-msg">Import Failed</p>
          <pre class="fm-import-pre">${esc(results.error)}</pre>
        </div>`;
    } else {
      const failedRows = (results.failed || []).slice(0, 10);
      bodyHtml = `
        <div class="fm-import-summary">
          <div class="fm-import-counts">
            <div class="fm-count-card fm-count-total">
              <span class="fm-count-num">${results.total}</span>
              <span class="fm-count-lbl">Total Rows</span>
            </div>
            <div class="fm-count-card fm-count-success">
              <span class="fm-count-num">${results.success.length}</span>
              <span class="fm-count-lbl">✅ Imported</span>
            </div>
            <div class="fm-count-card fm-count-fail">
              <span class="fm-count-num">${results.failed.length}</span>
              <span class="fm-count-lbl">❌ Failed</span>
            </div>
          </div>
          ${results.failed.length > 0 ? `
            <div class="fm-import-errors">
              <p class="fm-import-err-title">Failed Rows:</p>
              <table class="fm-table">
                <thead><tr><th>Row</th><th>ID</th><th>Name</th><th>Reason</th></tr></thead>
                <tbody>
                  ${failedRows.map(f => `
                    <tr class="fm-row">
                      <td>${f.row}</td>
                      <td><span class="fm-id-badge">${esc(f.id||'—')}</span></td>
                      <td>${esc(f.name||'—')}</td>
                      <td class="fm-err-reason">${esc(f.reason)}</td>
                    </tr>`).join('')}
                  ${results.failed.length > 10 ? `<tr class="fm-row"><td colspan="4" style="text-align:center;color:var(--text-muted)">…and ${results.failed.length - 10} more</td></tr>` : ''}
                </tbody>
              </table>
            </div>` : ''}
        </div>`;
    }

    overlay.innerHTML = `
      <div class="fm-modal fm-import-modal" id="fm-import-result-modal">
        <div class="fm-modal-header">
          <h3 class="fm-modal-title">📥 Import ${isError ? 'Error' : 'Result'}</h3>
          <button class="fm-modal-close ripple" id="fm-import-result-close">✕</button>
        </div>
        <div class="fm-modal-body">${bodyHtml}</div>
        <div class="fm-modal-footer">
          <button class="fm-btn-save ripple" id="fm-import-result-ok">Done</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('fm-ov-show');
      document.getElementById('fm-import-result-modal')?.classList.add('fm-modal-show');
    });

    const close = () => {
      closeOverlay('fm-import-result-ov');
      currentPage = 1;
      renderPage();
    };
    document.getElementById('fm-import-result-close')?.addEventListener('click', close);
    document.getElementById('fm-import-result-ok')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function deleteFarmer(farmerId) {
    const farmers = getFarmers();
    const farmer = farmers.find(f => f.id === farmerId);
    if (!farmer) return;

    const overlay = el('div', 'fm-overlay');
    overlay.id = 'fm-confirm-ov';
    overlay.innerHTML = `
      <div class="fm-modal fm-confirm-modal" id="fm-confirm-modal" role="dialog">
        <div class="fm-modal-header">
          <h3 class="fm-modal-title">🗑 ${App.i18n.t('delete')} ${App.i18n.t('farmer')}</h3>
        </div>
        <div class="fm-modal-body" style="text-align:center; padding: 28px 24px;">
          <div class="fm-confirm-icon">⚠️</div>
          <p class="fm-confirm-msg">
            ${App.i18n.t('deleteConfirm')}<br/>
            <strong>${esc(farmer.name)}</strong> (${esc(farmer.id)})?
          </p>
          <p class="fm-confirm-sub">${App.i18n.t('deleteActionUndone')}</p>
        </div>
        <div class="fm-modal-footer" style="justify-content:center; gap:16px;">
          <button class="fm-btn-cancel ripple" id="fm-confirm-cancel">${App.i18n.t('cancel')}</button>
          <button class="fm-btn-delete ripple" id="fm-confirm-delete">🗑 ${App.i18n.t('yesDelete')}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('fm-ov-show');
      document.getElementById('fm-confirm-modal')?.classList.add('fm-modal-show');
    });

    const close = () => closeOverlay('fm-confirm-ov');
    document.getElementById('fm-confirm-cancel')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('fm-confirm-delete')?.addEventListener('click', () => {
      saveFarmers(farmers.filter(f => f.id !== farmerId));
      close();
      currentPage = 1;
      renderPage();
      toast(`🗑 ${farmer.name} deleted.`);
    });
  }

  // ── Add / Edit Modal ──────────────────────────────────────────────────────
  function openModal(farmerId = null) {
    const farmers = getFarmers();
    const existing = farmerId ? farmers.find(f => f.id === farmerId) : null;

    const overlay = el('div', 'fm-overlay');
    overlay.id = 'fm-modal-ov';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px); transition: opacity 0.3s;';
    
    overlay.innerHTML = `
      <div class="fm-modal animate-pop" id="fm-modal" role="dialog" aria-modal="true" style="background:#fff; border-radius:16px; width:90%; max-width:600px; box-shadow:0 10px 40px rgba(0,0,0,0.2); overflow:hidden; border:1px solid #ddd;">
        <div class="fm-modal-header" style="padding:20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; background:#f9fcfb;">
          <h3 class="fm-modal-title" style="margin:0; color:#1e8a4a; font-size:1.4rem; font-weight:800;">${existing ? '✏️ ' + App.i18n.t('edit') + ' ' + App.i18n.t('farmer') : '➕ ' + App.i18n.t('addFarmerBtn')}</h3>
          <button class="fm-modal-close ripple" id="fm-modal-close" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#999;">✕</button>
        </div>
        <form class="fm-modal-body" id="fm-form" novalidate style="padding:25px;">
          <div class="fm-form-grid">
            <div class="fm-field">
              <label class="fm-label" for="fm-fid">${App.i18n.t('id')}</label>
              <input id="fm-fid" class="fm-input${existing?' fm-input-readonly':''}" type="text"
                value="${esc(existing?.id || generateId())}"
                ${existing ? 'readonly' : ''}
                placeholder="${App.i18n.t('placeholderAuto')}" />
            </div>
            <div class="fm-field">
              <label class="fm-label" for="fm-fname">${App.i18n.t('name')} <span class="fm-req">*</span></label>
              <input id="fm-fname" class="fm-input" type="text"
                value="${esc(existing?.name || '')}" placeholder="${App.i18n.t('placeholderName')}" />
            </div>
            <div class="fm-field">
              <label class="fm-label" for="fm-finitial">${App.i18n.t('initialDues')}</label>
              <input id="fm-finitial" class="fm-input" type="number"
                min="0" step="0.01"
                value="${existing?.initialDues ?? ''}" placeholder="0.00" />
            </div>
            <div class="fm-field">
              <label class="fm-label" for="fm-fcontact">${App.i18n.t('contact')} <span class="fm-req">*</span></label>
              <input id="fm-fcontact" class="fm-input" type="tel"
                value="${esc(existing?.contact || '')}" placeholder="${App.i18n.t('placeholderMobile')}" maxlength="15" />
            </div>
            <div class="fm-field">
              <label class="fm-label" for="fm-flocation">${App.i18n.t('location')}</label>
              <input id="fm-flocation" class="fm-input" type="text"
                value="${esc(existing?.location || '')}" placeholder="${App.i18n.t('placeholderLocation')}" />
            </div>
          </div>
          <div id="fm-form-err" class="fm-form-err hidden" style="margin-top:15px; color:#d32f2f; background:#ffebee; padding:10px; border-radius:6px; font-size:0.9rem;"></div>
        </form>
        <div class="fm-modal-footer" style="padding:20px; border-top:1px solid #eee; background:#f9fcfb; display:flex; justify-content:flex-end; gap:12px;">
          <button class="fm-btn-cancel ripple" id="fm-modal-cancel" style="padding:10px 20px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer;">${App.i18n.t('cancel')}</button>
          <button class="fm-btn-save ripple" id="fm-modal-save" style="padding:10px 25px; border-radius:8px; border:none; background:#10b981; color:#fff; font-weight:600; cursor:pointer;">
            ${existing ? '💾 ' + App.i18n.t('save') : '✅ ' + App.i18n.t('register')}
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('fm-ov-show');
      document.getElementById('fm-modal')?.classList.add('fm-modal-show');
    });

    const close = () => closeOverlay('fm-modal-ov');
    document.getElementById('fm-modal-close')?.addEventListener('click', close);
    document.getElementById('fm-modal-cancel')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('fm-modal-save')?.addEventListener('click', () => saveFarmer(existing));
    document.getElementById('fm-form')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') saveFarmer(existing);
      if (e.key === 'Escape') close();
    });

    setTimeout(() => {
      (existing ? document.getElementById('fm-fname') : document.getElementById('fm-fid'))?.focus();
    }, 150);
  }

  function saveFarmer(existing) {
    const id         = v('fm-fid');
    const name       = v('fm-fname');
    const contact    = v('fm-fcontact');
    const location   = v('fm-flocation');
    const initialDues = parseFloat(v('fm-finitial')) || 0;
    const errEl = document.getElementById('fm-form-err');

    if (!name)    { showErr(errEl, '⚠️ ' + App.i18n.t('farmerNameReq')); return; }
    if (!contact) { showErr(errEl, '⚠️ ' + App.i18n.t('contactNumReq')); return; }
    if (!id)      { showErr(errEl, '⚠️ ' + App.i18n.t('farmerIdReq')); return; }

    errEl?.classList.add('hidden');
    const farmers = getFarmers();

    if (existing) {
      const idx = farmers.findIndex(f => f.id === existing.id);
      if (idx > -1) {
        farmers[idx] = { ...farmers[idx], name, contact, location, initialDues };
      }
    } else {
      if (farmers.find(f => f.id === id)) {
        showErr(errEl, `⚠️ Farmer ID "${id}" already exists.`); return;
      }
      farmers.push({ id, name, contact, location, initialDues, createdAt: today(), ledger: [] });
    }

    saveFarmers(farmers);
    closeOverlay('fm-modal-ov');
    searchQuery = '';
    currentPage = 1;
    renderPage();
    toast(existing ? '✅ Farmer updated!' : '✅ Farmer registered!');
  }

  // ── Ledger Modal ──────────────────────────────────────────────────────────
  function openLedger(farmerId) {
    const farmers = getFarmers();
    const farmer = farmers.find(f => f.id === farmerId);
    if (!farmer) return;

    let selectedPreset = 'all';
    let customFrom = '', customTo = '';

    const overlay = el('div', 'fm-overlay');
    overlay.id = 'fm-ledger-ov';
    overlay.innerHTML = `
      <div class="fm-modal fm-ledger-modal" id="fm-ledger-modal" role="dialog">
        <div class="fm-modal-header">
          <div class="fm-ledger-header-info">
            <h3 class="fm-modal-title">📒 Ledger</h3>
            <div class="fm-ledger-farmer-name">${esc(farmer.name)}</div>
            <span class="fm-id-badge">${esc(farmer.id)}</span>
          </div>
          <button class="fm-modal-close ripple" id="fm-ledger-close">✕</button>
        </div>
        <div class="fm-modal-body">
          <div class="fm-ledger-filters">
            <div class="fm-filter-group">
              <label class="fm-label">Date Range</label>
              <select id="fm-date-preset" class="fm-select">
                <option value="all">📅 All Time</option>
                <option value="this-week">This Week</option>
                <option value="this-month">This Month</option>
                <option value="prev-month">Previous Month</option>
                <option value="this-year">This Year</option>
                <option value="custom">📆 Custom Range</option>
              </select>
            </div>
            <div id="fm-custom-dates" class="fm-custom-dates hidden">
              <div class="fm-field-inline">
                <label class="fm-label">From</label>
                <input id="fm-lfrom" type="date" class="fm-input fm-date-inp" />
              </div>
              <div class="fm-field-inline">
                <label class="fm-label">To</label>
                <input id="fm-lto" type="date" class="fm-input fm-date-inp" />
              </div>
              <button class="fm-pg-btn ripple" id="fm-l-apply">Apply</button>
            </div>
          </div>
          <div id="fm-ledger-body" class="fm-ledger-body"></div>
        </div>
        <div class="fm-modal-footer fm-ledger-footer">
          <div id="fm-ledger-summary" class="fm-ledger-summary"></div>
          <button class="fm-btn-cancel ripple" id="fm-ledger-close2">Close</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('fm-ov-show');
      document.getElementById('fm-ledger-modal')?.classList.add('fm-modal-show');
    });

    function applyFilter() {
      let from = '', to = '';
      if (selectedPreset !== 'all' && selectedPreset !== 'custom') {
        const range = getDateRange(selectedPreset);
        from = range.from; to = range.to;
      } else if (selectedPreset === 'custom') {
        from = customFrom; to = customTo;
      }
      drawLedger(from, to);
    }

    document.getElementById('fm-date-preset')?.addEventListener('change', e => {
      selectedPreset = e.target.value;
      const customEl = document.getElementById('fm-custom-dates');
      if (selectedPreset === 'custom') {
        customEl?.classList.remove('hidden');
      } else {
        customEl?.classList.add('hidden');
        applyFilter();
      }
    });

    document.getElementById('fm-l-apply')?.addEventListener('click', () => {
      customFrom = document.getElementById('fm-lfrom')?.value || '';
      customTo   = document.getElementById('fm-lto')?.value   || '';
      applyFilter();
    });

    function drawLedger(from, to) {
      let rows = [...(farmer.ledger || [])];
      if (from) rows = rows.filter(r => r.date >= from);
      if (to)   rows = rows.filter(r => r.date <= to);

      const body  = document.getElementById('fm-ledger-body');
      const sumEl = document.getElementById('fm-ledger-summary');
      if (!body) return;

      if (rows.length === 0) {
        body.innerHTML = `<div class="fm-empty">
          <div class="fm-empty-emoji">📋</div>
          <p class="fm-empty-text">No ledger entries for this period.</p>
        </div>`;
        if (sumEl) sumEl.innerHTML = '';
        return;
      }

      let balance = Number(farmer.initialDues) || 0;
      let html = `<div class="fm-tbl-scroll"><table class="fm-table">
        <thead><tr>
          <th>Date</th><th>Description</th>
          <th class="th-num">Debit (₹)</th>
          <th class="th-num">Credit (₹)</th>
          <th class="th-num">Balance (₹)</th>
        </tr></thead><tbody>
        <tr class="fm-row fm-opening-row">
          <td colspan="2"><em>Opening Balance</em></td>
          <td></td><td></td>
          <td class="th-num fm-balance-cell">₹${fmt(balance)}</td>
        </tr>`;

      rows.forEach((tx, i) => {
        balance += (Number(tx.debit) || 0) - (Number(tx.credit) || 0);
        html += `<tr class="${i % 2 ? 'fm-row-alt' : 'fm-row'}">
          <td>${esc(tx.date)}</td>
          <td>${esc(tx.description)}</td>
          <td class="th-num ${tx.debit ? 'ldr-debit' : ''}">${tx.debit ? '₹'+fmt(tx.debit) : '—'}</td>
          <td class="th-num ${tx.credit ? 'ldr-credit' : ''}">${tx.credit ? '₹'+fmt(tx.credit) : '—'}</td>
          <td class="th-num fm-balance-cell">
            <span class="${balance<0?'due-cr':'due-dr'}">₹${fmt(Math.abs(balance))} ${balance<0?'<em>CR</em>':''}</span>
          </td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      body.innerHTML = html;

      const totalDr = rows.reduce((s,r) => s+(Number(r.debit)||0), 0);
      const totalCr = rows.reduce((s,r) => s+(Number(r.credit)||0), 0);
      if (sumEl) sumEl.innerHTML = `
        <span class="fm-sum-item ldr-debit">↑ Debit: ₹${fmt(totalDr)}</span>
        <span class="fm-sum-item ldr-credit">↓ Credit: ₹${fmt(totalCr)}</span>
        <span class="fm-sum-item ${balance<0?'due-cr':'due-dr'}">Balance: ₹${fmt(Math.abs(balance))} ${balance<0?'CR':'DR'}</span>`;
    }

    drawLedger('', '');

    const closeL = () => closeOverlay('fm-ledger-ov');
    document.getElementById('fm-ledger-close')?.addEventListener('click', closeL);
    document.getElementById('fm-ledger-close2')?.addEventListener('click', closeL);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeL(); });
  }

  // ── Date Range Presets ────────────────────────────────────────────────────
  function getDateRange(preset) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const todayStr = ymd(now);

    switch (preset) {
      case 'this-week': {
        const d = new Date(now);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day; // Monday start
        d.setDate(d.getDate() + diff);
        return { from: ymd(d), to: todayStr };
      }
      case 'this-month':
        return { from: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`, to: todayStr };
      case 'prev-month': {
        const y = now.getMonth() === 0 ? now.getFullYear()-1 : now.getFullYear();
        const m = now.getMonth() === 0 ? 12 : now.getMonth();
        const lastDay = new Date(y, m, 0).getDate();
        return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${lastDay}` };
      }
      case 'this-year':
        return { from: `${now.getFullYear()}-01-01`, to: todayStr };
      default:
        return { from: '', to: '' };
    }
  }

  // ── Utility ───────────────────────────────────────────────────────────────
  function el(tag, cls = '') {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, m =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function v(id) { return (document.getElementById(id)?.value || '').trim(); }

  function today() { return new Date().toISOString().split('T')[0]; }

  function showErr(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 600);
  }

  function closeOverlay(id) {
    const ov = document.getElementById(id);
    if (!ov) return;
    ov.classList.remove('fm-ov-show');
    setTimeout(() => ov.remove(), 300);
  }

  function toast(msg) {
    document.querySelectorAll('.fm-toast').forEach(t => t.remove());
    const t = el('div', 'fm-toast');
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('fm-toast-show'));
    setTimeout(() => {
      t.classList.remove('fm-toast-show');
      setTimeout(() => t.remove(), 400);
    }, 2800);
  }

  return { render };
})();
