const CustomerModule = (() => {
  let _container = null, _db = null, tenantId = '';
  let customers = [];

  function init(container, db) {
    _container = container; _db = db;
    tenantId = _db.currentTenant;
    loadData();
    renderPage();
  }

  function loadData() {
    const data = sessionStorage.getItem(`customers_${tenantId}`);
    customers = data ? JSON.parse(data) : [];
  }

  function saveData() {
    sessionStorage.setItem(`customers_${tenantId}`, JSON.stringify(customers));
    renderPage();
  }

  function getDues(c) {
    const ledger = c.ledger || [];
    const debit = ledger.reduce((s, t) => s + (parseFloat(t.debit) || 0), 0);
    const credit = ledger.reduce((s, t) => s + (parseFloat(t.credit) || 0), 0);
    return (parseFloat(c.initialDues) || 0) + debit - credit;
  }

  function generateId() {
    if (!customers.length) return '101';
    const nums = customers.map(c => {
      const m = String(c.id || '').match(/\d+/);
      return m ? parseInt(m[0], 10) : 0;
    });
    const max = Math.max(...nums);
    return max < 101 ? '101' : String(max + 1);
  }

  function renderPage() {
    _container.innerHTML = `
      <div class="fm-page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="padding: 10px; background: #ede9fe; border-radius: 16px;">
            <span style="font-size: 1.8rem; color: #7c3aed;">👤</span>
          </div>
          <h1 class="fm-title" style="font-size: 2rem; font-weight: 900; letter-spacing: -0.05em; color: #1e293b; margin: 0;">Customer Master</h1>
        </div>
        <div class="fm-header-actions" style="display: flex; gap: 12px; align-items: center;">
          <button class="fm-tpl-btn" id="c-tpl-btn" style="background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; padding: 10px 20px; border-radius: 9999px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
            📄 ${App.i18n.t('template')}
          </button>
          <label class="fm-import-label" style="cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: bold; color: #475569; background: white; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 9999px; transition: all 0.2s;">
            <span style="color: #3b82f6;">📥</span> ${App.i18n.t('import')}
            <input type="file" id="c-import-input" accept=".xlsx,.xls" style="display:none" />
          </label>
          <button id="add-cust-btn" style="background: #fff; color: #059669; border: 2px solid #10b981; font-weight: 900; cursor: pointer; padding: 10px 24px; border-radius: 9999px; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.1);">
            ＋ ${App.i18n.t('addCustomer')}
          </button>
        </div>
      </div>
      <div class="fm-search-row" style="margin-bottom: 60px; display: flex; align-items: center;">
        <div class="fm-search-wrap" style="position: relative; flex: 1; max-width: 500px;">
          <input id="c-search" type="text" placeholder="Search by ID and Name..." style="width: 100%; padding: 14px 30px; border: 2px solid #10b981; background: #fff; border-radius: 9999px; outline: none; font-size: 1.1rem; font-weight: 700; color: #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        </div>
      </div>
      <div style="height: 1px; background: #f1f5f9; margin: 40px 0;"></div>
      <div class="fm-card animate-fade-in" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <table class="fm-table" style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 2px solid #f1f5f9; color: #64748b;">
              <th style="padding: 1rem;">${App.i18n.t('id')}</th>
              <th style="padding: 1rem;">${App.i18n.t('name')}</th>
              <th style="padding: 1rem;">${App.i18n.t('contact')}</th>
              <th style="padding: 1rem;">${App.i18n.t('amountDue')}</th>
              <th style="padding: 1rem; text-align:center;">${App.i18n.t('ledger')}</th>
              <th style="padding: 1rem; text-align:right">${App.i18n.t('actions')}</th>
            </tr>
          </thead>
          <tbody id="cust-list"></tbody>
        </table>
      </div>
    `;

    const searchInput = _container.querySelector('#c-search');
    searchInput.addEventListener('input', (e) => renderList(e.target.value));

    renderList();

    _container.querySelector('#c-tpl-btn').addEventListener('click', downloadTemplate);
    _container.querySelector('#c-import-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) { importCustomers(file); e.target.value = ''; }
    });
    _container.querySelector('#add-cust-btn').addEventListener('click', () => openModal());

    // ── Keyboard Shortcuts ──
    _container.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openModal();
      }
    });
  }

  function renderList(query = '') {
    const list = _container.querySelector('#cust-list');
    list.innerHTML = '';
    const q = query.toLowerCase().trim();
    const filtered = customers.filter(c => c.name.toLowerCase().includes(q) || String(c.id).toLowerCase().includes(q) || String(c.contact).includes(q));

    if (filtered.length === 0) {
      list.innerHTML = `<tr><td colspan="6" class="fm-empty-state" style="padding: 3rem; text-align: center; color: #94a3b8; font-style: italic;">${App.i18n.t('noRecords')}</td></tr>`;
      return;
    }

    filtered.forEach(c => {
      const idx = customers.findIndex(x => x.id === c.id);
      const dues = getDues(c);
      const isOverLimit = dues > 0;

      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #f8fafc';
      row.innerHTML = `
        <td style="padding: 1rem;"><span class="fm-badge-id" style="background:#f1f5f9; padding:4px 8px; border-radius:6px; font-size:0.85rem;">${c.id}</span></td>
        <td class="fm-semi-bold" style="padding: 1rem; font-weight: bold; color: #334155;">${c.name}</td>
        <td style="padding: 1rem; color: #475569;">${c.contact}</td>
        <td class="fm-semi-bold ${isOverLimit ? 'color-red' : 'color-green'}" style="padding: 1rem; font-weight: bold; color: ${isOverLimit ? '#ef4444' : '#10b981'};">₹${dues.toFixed(2)}</td>
        <td style="padding: 1rem; text-align:center;">
          <button class="fm-ledger-btn ripple" style="background: #e0f2fe; color: #0ea5e9; border: 1px solid #7dd3fc; border-radius: 6px; padding: 4px 12px; cursor: pointer; font-weight: bold; font-size: 0.85rem;" title="${App.i18n.t('view')}">${App.i18n.t('view')}</button>
        </td>
        <td style="padding: 1rem;">
          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
            <button class="fm-action-btn edit-btn" style="border:none !important; background:transparent !important; cursor:pointer; font-size:1.3rem; padding: 4px; box-shadow: none !important; width: auto !important; height: auto !important;" title="${App.i18n.t('edit')}">✏️</button>
            <button class="fm-action-btn delete-btn" style="border:none !important; background:transparent !important; cursor:pointer; font-size:1.3rem; padding: 4px; box-shadow: none !important; width: auto !important; height: auto !important;" title="${App.i18n.t('delete')}">🗑️</button>
          </div>
        </td>
      `;
      row.querySelector('.edit-btn').addEventListener('click', () => openModal(c, idx));
      row.querySelector('.delete-btn').addEventListener('click', () => confirmDelete(idx));
      row.querySelector('.fm-ledger-btn').addEventListener('click', () => openLedger(c.id));
      list.appendChild(row);
    });
  }

  function openModal(cust = null, index = -1) {
    const isEdit = cust !== null;
    const overlay = document.createElement('div');
    overlay.className = 'fm-overlay fm-ov-show';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);';
    
    overlay.innerHTML = `
      <div class="fm-modal animate-pop fm-modal-show" style="background:#fff; border-radius:10px; width:95%; max-width:540px; box-shadow:0 10px 40px rgba(0,0,0,0.15); overflow:hidden; font-family: 'Inter', sans-serif;">
        <div class="fm-modal-header" style="padding:24px 32px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#22c55e"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
            <h3 style="margin:0; color:#22c55e; font-size:1.6rem; font-weight:700; letter-spacing:-0.03em;">${isEdit ? App.i18n.t('editCustomer') : App.i18n.t('addCustomer')}</h3>
          </div>
          <button class="fm-close-btn" style="background:none; border:none; font-size:1.8rem; cursor:pointer; color:#cbd5e1;">✕</button>
        </div>
        <form class="fm-form cust-form">
          <div style="padding:32px;">
            <div class="fm-field" style="margin-bottom: 24px;">
              <label style="display:block; font-weight:700; color:#64748b; margin-bottom:12px; font-size:0.95rem;">${App.i18n.t('id')}</label>
              <input type="text" id="c-id" value="${isEdit ? cust.id : generateId()}" disabled style="width: 100%; padding: 14px 20px; border:none; border-radius:10px; background:#f1f5f9; color:#475569; font-weight:700; font-size:1rem;">
            </div>
            <div class="fm-field" style="margin-bottom: 24px;">
              <label style="display:block; font-weight:700; color:#64748b; margin-bottom:12px; font-size:0.95rem;">${App.i18n.t('name')} *</label>
              <input type="text" id="c-name" value="${isEdit ? cust.name : ''}" required style="width: 100%; padding: 14px 20px; border:1px solid #f1f5f9; border-radius: 10px; background: #f8fafc; outline:none; font-size:1rem; color:#1e293b;">
            </div>
            <div class="fm-field" style="margin-bottom: 24px;">
              <label style="display:block; font-weight:700; color:#64748b; margin-bottom:12px; font-size:0.95rem;">${App.i18n.t('contact')} *</label>
              <input type="tel" id="c-contact" value="${isEdit ? cust.contact : ''}" required style="width: 100%; padding: 14px 20px; border:1px solid #f1f5f9; border-radius: 10px; background: #f8fafc; outline:none; font-size:1rem; color:#1e293b;">
            </div>
            <div class="fm-field" style="margin-bottom: 24px;">
              <label style="display:block; font-weight:700; color:#64748b; margin-bottom:12px; font-size:0.95rem;">${App.i18n.t('initialDues')}</label>
              <input type="number" id="c-dues" value="${isEdit ? cust.initialDues : '0'}" step="0.01" style="width: 100%; padding: 14px 20px; border:1px solid #f1f5f9; border-radius: 10px; background: #f8fafc; outline:none; font-size:1rem; color:#1e293b;">
            </div>
          </div>
          <div class="fm-modal-footer" style="padding: 24px 32px; border-top:1px solid #f1f5f9; background: #f9fafb; display:flex; justify-content:flex-end; gap:16px;">
              <button type="button" class="cancel-btn" style="padding:12px 32px; border-radius:10px; border:1px solid #d1d5db; background:#fff; cursor:pointer; color:#64748b; font-weight:700; font-size:1rem;">${App.i18n.t('cancel')}</button>
              <button type="submit" class="fm-btn-add" style="padding:12px 36px; border-radius:10px; border:2px solid #22c55e; background:#fff; color:#22c55e; font-weight:800; font-size:1rem; cursor:pointer;">
                ${isEdit ? App.i18n.t('update') : App.i18n.t('register')}
              </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeHandler = () => {
      overlay.remove();
    };

    overlay.querySelector('.fm-close-btn').addEventListener('click', closeHandler);
    overlay.querySelector('.cancel-btn').addEventListener('click', closeHandler);
    overlay.addEventListener('click', (e) => { if(e.target === overlay) closeHandler(); });

    overlay.querySelector('.cust-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const payload = {
        id: overlay.querySelector('#c-id').value,
        name: overlay.querySelector('#c-name').value,
        contact: overlay.querySelector('#c-contact').value,
        initialDues: parseFloat(overlay.querySelector('#c-dues').value) || 0,
        limit: isEdit ? cust.limit : 5000, // Legacy support if needed
        ledger: isEdit ? cust.ledger : []
      };

      if (isEdit) {
        customers[index] = payload;
      } else {
        customers.push(payload);
      }
      
      saveData();
      closeHandler();
    });
    
    setTimeout(() => { overlay.querySelector('#c-name').focus(); }, 100);
  }

  function confirmDelete(idx) {
    if(confirm(App.i18n.t('deleteCustomerConfirm'))) { 
      customers.splice(idx, 1); 
      saveData(); 
    }
  }

  function downloadTemplate() {
    if (typeof XLSX === 'undefined') {
      alert('⚠️ Excel library not loaded. Check internet connection.'); return;
    }
    const headers = ['Customer ID', 'Customer Name', 'Contact Number', 'Outstanding Amount'];
    const sample  = ['101', 'Sample Customer', '9876543210', '500'];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws['!cols'] = [16, 22, 18, 20].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'customer_import_template.xlsx');
  }

  function importCustomers(file) {
    if (typeof XLSX === 'undefined') {
      alert('⚠️ Excel library not loaded.'); return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        
        if (!rows || rows.length < 2) return alert('File is empty or invalid.');
        
        const existingIds = new Set(customers.map(c => c.id));
        let added = 0;

        rows.slice(1).forEach(row => {
          const id = String(row[0] || '').trim();
          const name = String(row[1] || '').trim();
          const contact = String(row[2] || '').trim();
          const dues = parseFloat(row[3]) || 0;

          if (!id || !name || existingIds.has(id)) return;
          
          existingIds.add(id);
          customers.push({ id, name, contact, initialDues: dues, limit: 5000, ledger: [] });
          added++;
        });

        if (added > 0) {
          saveData();
          alert(`Successfully imported ${added} customers!`);
        } else {
          alert('No valid new customers found to import.');
        }
      } catch (err) {
        alert('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function openLedger(customerId) {
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;

    let selectedPreset = 'all';
    let customFrom = '', customTo = '';

    const overlay = document.createElement('div');
    overlay.className = 'fm-overlay fm-ov-show';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);';

    overlay.innerHTML = `
      <div class="fm-modal fm-modal-show animate-pop" style="background:#fff; border-radius:16px; width:95%; max-width:800px; max-height:90vh; display:flex; flex-direction:column; box-s        <div class="fm-modal-header" style="padding:20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; background:#f9fcfb;">
          <div>
            <h3 style="margin:0; color:#1e8a4a; font-size:1.4rem; font-weight:800;">📒 ${App.i18n.t('ledger')}</h3>
            <div style="font-weight: bold; color: #334155; margin-top: 4px;">${cust.name} <span style="background:#f1f5f9; padding:2px 6px; border-radius:6px; font-size:0.8rem; margin-left:8px;">${cust.id}</span></div>
          </div>
          <button class="fm-close-btn" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#999;">✕</button>
        </div>
        
        <div class="fm-modal-body" style="padding:20px; flex:1; overflow-y:auto; background:#f8fafc;">
          <div style="display:flex; gap:16px; margin-bottom: 20px; align-items: end; flex-wrap: wrap;">
            <div>
              <label style="display:block; font-weight:bold; color:#64748b; font-size:0.85rem; margin-bottom:4px;">${App.i18n.t('dateRange')}</label>
              <select id="l-preset" style="padding:8px 12px; border:2px solid #e2e8f0; border-radius:8px; outline:none; font-weight:bold; color:#334155;">
                <option value="all">📅 ${App.i18n.t('allTime')}</option>
                <option value="this-month">${App.i18n.t('thisMonth')}</option>
                <option value="prev-month">${App.i18n.t('lastMonth')}</option>
                <option value="custom">📆 ${App.i18n.t('customDate')}</option>
              </select>
            </div>
            <div id="l-custom-dates" style="display:none; gap:12px; align-items:end;">
              <div>
                <label style="display:block; font-weight:bold; color:#64748b; font-size:0.85rem; margin-bottom:4px;">${App.i18n.t('from')}</label>
                <input type="date" id="l-from" style="padding:8px 12px; border:2px solid #e2e8f0; border-radius:8px; outline:none; color:#334155;">
              </div>
              <div>
                <label style="display:block; font-weight:bold; color:#64748b; font-size:0.85rem; margin-bottom:4px;">${App.i18n.t('to')}</label>
                <input type="date" id="l-to" style="padding:8px 12px; border:2px solid #e2e8f0; border-radius:8px; outline:none; color:#334155;">
              </div>
              <button id="l-apply" style="padding:8px 16px; background:#3b82f6; color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">${App.i18n.t('apply')}</button>
            </div>
          </div>
          
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
              <thead style="background:#f1f5f9; border-bottom:2px solid #e2e8f0;">
                <tr>
                  <th style="padding:12px; color:#475569;">${App.i18n.t('date')}</th>
                  <th style="padding:12px; color:#475569;">${App.i18n.t('description')}</th>
                  <th style="padding:12px; color:#475569; text-align:right;">${App.i18n.t('debit')} (₹)</th>
                  <th style="padding:12px; color:#475569; text-align:right;">${App.i18n.t('credit')} (₹)</th>
                  <th style="padding:12px; color:#475569; text-align:right;">${App.i18n.t('balanceAmount')} (₹)</th>
                </tr>
              </thead>
              <tbody id="l-body"></tbody>
            </table>
          </div>
        </div>l-body"></tbody>
            </table>
          </div>
        </div>
        
        <div class="fm-modal-footer" style="padding:20px; border-top:1px solid #eee; background:#fff; display:flex; justify-content:space-between; align-items:center;">
          <div id="l-summary" style="display:flex; gap:16px; font-weight:bold; font-size:0.95rem;"></div>
          <button class="cancel-btn" style="padding:10px 20px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer; color:#64748b; font-weight:bold;">${App.i18n.t('close')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeHandler = () => overlay.remove();
    overlay.querySelector('.fm-close-btn').addEventListener('click', closeHandler);
    overlay.querySelector('.cancel-btn').addEventListener('click', closeHandler);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeHandler(); });

    const presetSel = overlay.querySelector('#l-preset');
    const customDiv = overlay.querySelector('#l-custom-dates');
    presetSel.addEventListener('change', e => {
      selectedPreset = e.target.value;
      if (selectedPreset === 'custom') {
        customDiv.style.display = 'flex';
      } else {
        customDiv.style.display = 'none';
        applyFilter();
      }
    });

    overlay.querySelector('#l-apply').addEventListener('click', () => {
      customFrom = overlay.querySelector('#l-from').value;
      customTo = overlay.querySelector('#l-to').value;
      applyFilter();
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

    function drawLedger(from, to) {
      let rows = cust.ledger || [];
      if (from) rows = rows.filter(r => r.date >= from);
      if (to) rows = rows.filter(r => r.date <= to);

      const tbody = overlay.querySelector('#l-body');
      const summary = overlay.querySelector('#l-summary');
      
      let balance = parseFloat(cust.initialDues) || 0;
      
      let html = '<tr style="border-bottom:1px solid #f1f5f9; background:#fffbdd;">';
      html += '<td colspan="2" style="padding:12px; font-style:italic; color:#64748b;">' + App.i18n.t('openingBalance') + '</td>';
      html += '<td style="padding:12px;"></td><td style="padding:12px;"></td>';
      html += '<td style="padding:12px; text-align:right; font-weight:bold; color:' + (balance > 0 ? '#ef4444' : '#10b981') + ';">₹' + balance.toFixed(2) + '</td></tr>';

      let totalDr = 0, totalCr = 0;

      rows.forEach((tx) => {
        const dr = parseFloat(tx.debit) || 0;
        const cr = parseFloat(tx.credit) || 0;
        totalDr += dr; totalCr += cr;
        balance += (dr - cr);
        
        html += '<tr style="border-bottom:1px solid #f1f5f9;">';
        html += '<td style="padding:12px; color:#475569;">' + (tx.date || '—') + '</td>';
        html += '<td style="padding:12px; color:#334155;">' + (tx.description || '—') + '</td>';
        html += '<td style="padding:12px; text-align:right; color:' + (dr ? '#ef4444' : '#94a3b8') + ';">' + (dr ? '₹'+dr.toFixed(2) : '-') + '</td>';
        html += '<td style="padding:12px; text-align:right; color:' + (cr ? '#10b981' : '#94a3b8') + ';">' + (cr ? '₹'+cr.toFixed(2) : '-') + '</td>';
        html += '<td style="padding:12px; text-align:right; font-weight:bold; color:' + (balance > 0 ? '#ef4444' : '#10b981') + ';">₹' + Math.abs(balance).toFixed(2) + ' ' + (balance > 0 ? 'DR' : (balance < 0 ? 'CR' : '')) + '</td>';
        html += '</tr>';
      });
      
      if (rows.length === 0) {
        html += '<tr><td colspan="5" style="padding:32px; text-align:center; color:#94a3b8; font-style:italic;">' + App.i18n.t('noRecords') + '</td></tr>';
      }

      tbody.innerHTML = html;
      
      summary.innerHTML = '<span style="color:#ef4444;">↑ ' + App.i18n.t('totalDebit') + ': ₹' + totalDr.toFixed(2) + '</span>' +
                          '<span style="color:#10b981;">↓ ' + App.i18n.t('totalCredit') + ': ₹' + totalCr.toFixed(2) + '</span>' +
                          '<span style="margin-left:16px; color:' + (balance > 0 ? '#ef4444' : '#10b981') + ';">' + App.i18n.t('balanceAmount') + ': ₹' + Math.abs(balance).toFixed(2) + ' ' + (balance > 0 ? 'DR' : (balance < 0 ? 'CR' : '')) + '</span>';
    }

    drawLedger('', '');
  }

  function getDateRange(preset) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const ymd = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
    const todayStr = ymd(now);

    switch (preset) {
      case 'this-month':
        return { from: now.getFullYear() + '-' + pad(now.getMonth()+1) + '-01', to: todayStr };
      case 'prev-month': {
        const y = now.getMonth() === 0 ? now.getFullYear()-1 : now.getFullYear();
        const m = now.getMonth() === 0 ? 12 : now.getMonth();
        const lastDay = new Date(y, m, 0).getDate();
        return { from: y + '-' + pad(m) + '-01', to: y + '-' + pad(m) + '-' + lastDay };
      }
    }
    return { from: '', to: '' };
  }

  return { init, getDues };
})();
window.CustomerModule = CustomerModule;
