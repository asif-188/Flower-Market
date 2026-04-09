
const CashReceiveModule = (() => {
  let _container = null, _db = null, tenantId = '';
  let receipts = [];

  function init(container, db) {
    _container = container; _db = db;
    tenantId = _db.currentTenant;
    loadData();
    renderPage();
  }

  function loadData() {
    const data = sessionStorage.getItem(`receipts_${tenantId}`);
    receipts = data ? JSON.parse(data) : [];
  }

  function saveData() {
    sessionStorage.setItem(`receipts_${tenantId}`, JSON.stringify(receipts));
    renderPage();
  }

  function getCustomers() {
    return JSON.parse(sessionStorage.getItem(`customers_${tenantId}`) || '[]');
  }

  function renderPage() {
    _container.innerHTML = `
      <div class="fm-page-header">
        <h1 class="fm-title">💰 Cash Receive</h1>
        <button id="add-receipt-btn" class="fm-btn-add">＋ Receive Payment</button>
      </div>
      <div class="fm-card animate-fade-in">
        <table class="fm-table">
          <thead>
            <tr>
              <th>Date</th><th>Customer Name</th><th>Amount Received</th><th>Notes</th><th style="text-align:right">Action</th>
            </tr>
          </thead>
          <tbody id="receipt-list">
            ${receipts.length === 0 ? `<tr><td colspan="5" class="fm-empty-state">No receipts found.</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;

    const list = _container.querySelector('#receipt-list');
    [...receipts].reverse().forEach((r, idxOrig) => {
      const idx = receipts.length - 1 - idxOrig;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${r.date}</td>
        <td class="fm-semi-bold">${r.customerName}</td>
        <td class="fm-semi-bold color-green">₹${r.amount}</td>
        <td>${r.notes || '—'}</td>
        <td style="text-align:right">
          <button class="fm-action-btn delete-btn">🗑️</button>
        </td>
      `;
      row.querySelector('.delete-btn').addEventListener('click', () => confirmDelete(idx));
      list.appendChild(row);
    });

    _container.querySelector('#add-receipt-btn').addEventListener('click', openModal);
  }

  function openModal() {
    const custs = getCustomers();
    const modal = document.createElement('div');
    modal.className = 'fm-modal-overlay';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);';

    modal.innerHTML = `
      <div class="fm-modal animate-pop" style="background:#fff; border-radius:12px; width:95%; max-width:600px; box-shadow:0 10px 40px rgba(0,0,0,0.2); overflow:hidden; position:relative;">
        <div class="fm-modal-header" style="padding:15px 20px; background:#1e8a4a; display:flex; justify-content:space-between; align-items:center;">
          <h2 style="margin:0; color:#fff; font-size:1.4rem; font-weight:800;">Cash Receive</h2>
          <button class="fm-close-btn" style="background:none; border:none; color:rgba(255,255,255,0.6); font-size:1.5rem; cursor:pointer;">&times;</button>
        </div>
        <form class="fm-form receipt-form" style="padding:25px; display:flex; flex-direction:column; gap:12px;">
          <input type="hidden" id="r-date" value="${new Date().toISOString().split('T')[0]}">

          <!-- Customer Row -->
          <div style="display:grid; grid-template-columns: 200px 1fr; align-items:center; gap:15px;">
            <label style="font-weight:bold; color:#334155;">Customer</label>
            <select id="r-cust" style="padding:8px 12px; border:1px solid #ddd; border-radius:6px; outline:none;" required>
              <option value="">Select Customer</option>
              ${custs.map(c => `<option value="${c.id}">${c.name} (${c.id})</option>`).join('')}
            </select>
          </div>

          <!-- Opening Balance Row -->
          <div style="display:grid; grid-template-columns: 200px 1fr; align-items:center; gap:15px;">
            <label style="font-weight:bold; color:#334155;">Opening Balance / Debit</label>
            <div id="r-opening" style="padding:8px; font-weight:bold; color:#475569;">₹0.00</div>
          </div>

          <!-- Given Amount Row -->
          <div style="display:grid; grid-template-columns: 200px 1fr; align-items:center; gap:15px;">
            <label style="font-weight:bold; color:#334155;">Given Amount</label>
            <div style="display:flex; align-items:center; gap:10px;">
              <input type="number" id="r-amount" placeholder="0.00" step="0.01" style="flex:1; padding:8px 12px; border:1px solid #ddd; border-radius:6px; outline:none;" required>
              <label style="display:flex; align-items:center; gap:6px; color:#475569; font-size:0.9rem; font-weight:600;">
                <input type="checkbox" id="r-gpay"> GPay
              </label>
            </div>
          </div>

          <!-- Closing Balance Row -->
          <div style="display:grid; grid-template-columns: 200px 1fr; align-items:center; gap:15px;">
            <label style="font-weight:bold; color:#334155;">Closing Balance</label>
            <div id="r-closing" style="padding:8px; font-weight:bold; color:#1e8a4a;">₹0.00</div>
          </div>

          <div class="fm-modal-footer" style="padding-top:20px; display:flex; justify-content:flex-end; gap:12px;">
            <button type="submit" style="background:#1e8a4a; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:bold; display:flex; align-items:center; gap:8px;">
               <span style="font-size:1.2rem;">✅</span>
            </button>
            <button type="button" class="cancel-btn" style="background:#64748b; color:#fff; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">Close</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const custSel = modal.querySelector('#r-cust');
    const amountInp = modal.querySelector('#r-amount');
    const openDisp = modal.querySelector('#r-opening');
    const closeDisp = modal.querySelector('#r-closing');

    function updateBalances() {
       const cid = custSel.value;
       const cust = custs.find(c => c.id === cid);
       const opening = cust ? (window.CustomerModule ? window.CustomerModule.getDues(cust) : 0) : 0;
       const given = parseFloat(amountInp.value) || 0;
       
       openDisp.textContent = `₹${opening.toFixed(2)}`;
       closeDisp.textContent = `₹${(opening - given).toFixed(2)}`;
    }

    custSel.addEventListener('change', updateBalances);
    amountInp.addEventListener('input', updateBalances);

    modal.querySelector('.fm-close-btn').addEventListener('click', () => modal.remove());
    modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('.receipt-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const custId = custSel.value;
      const cust = custs.find(c => c.id === custId);
      const isGPay = modal.querySelector('#r-gpay').checked;
      
      const r = {
        id: Date.now(),
        date: modal.querySelector('#r-date').value,
        customerId: custId,
        customerName: cust.name,
        amount: parseFloat(amountInp.value),
        notes: isGPay ? 'GPay' : 'Cash',
        method: isGPay ? 'GPay' : 'Cash'
      };

      receipts.push(r);
      updateCustomerLedger(r);
      saveData();
      modal.remove();
    });
  }

  function updateCustomerLedger(r) {
    const custs = getCustomers();
    const idx = custs.findIndex(c => c.id === r.customerId);
    if (idx > -1) {
      if (!custs[idx].ledger) custs[idx].ledger = [];
      custs[idx].ledger.push({
        date: r.date,
        description: `Cash Received: ${r.notes || 'No notes'}`,
        debit: 0,
        credit: r.amount
      });
      sessionStorage.setItem(`customers_${tenantId}`, JSON.stringify(custs));
    }
  }

  function confirmDelete(idx) {
    if(confirm('Delete receipt?')) { receipts.splice(idx, 1); saveData(); }
  }

  return { init };
})();

const CustomerReportModule = (() => {
  let _container = null, _db = null, tenantId = '';
  let reportState = {
    view: 'today', // today, month, custom
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
    searchTerm: ''
  };

  function init(container, db) {
    _container = container; _db = db;
    tenantId = _db.currentTenant;
    
    // Set default month range if needed
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    renderPage();
  }

  function getCustomers() {
    return JSON.parse(sessionStorage.getItem(`customers_${tenantId}`) || '[]');
  }

  function getSales() {
    return JSON.parse(sessionStorage.getItem(`sales_${tenantId}`) || '[]');
  }
  
  function getReceipts() {
    return JSON.parse(sessionStorage.getItem(`receipts_${tenantId}`) || '[]');
  }

  function renderPage() {
    // Fresh data fetch to ensure all new additions/transactions are captured
    const tenantId = _db.currentTenant; 
    const custs = JSON.parse(sessionStorage.getItem(`customers_${tenantId}`) || '[]');
    const sales = JSON.parse(sessionStorage.getItem(`sales_${tenantId}`) || '[]');
    const receipts = JSON.parse(sessionStorage.getItem(`receipts_${tenantId}`) || '[]');
    
    // Filter data based on reportState
    const filteredSales = sales.filter(s => s.date >= reportState.start && s.date <= reportState.end);
    const filteredReceipts = receipts.filter(r => r.date >= reportState.start && r.date <= reportState.end);
    
    // Aggregate by customer
    const reportData = custs.map(c => {
      const cSales = filteredSales.filter(s => s.customerId === c.id);
      const cReceipts = filteredReceipts.filter(r => r.customerId === c.id);
      const salesVol = cSales.reduce((s, x) => s + parseFloat(x.total || 0), 0);
      const paidVol = cReceipts.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
      const currentDues = window.CustomerModule ? window.CustomerModule.getDues(c) : 0;
      
      return { ...c, salesVol, paidVol, currentDues };
    });

    // Filter by search term if active
    const q = reportState.searchTerm.toLowerCase().trim();
    const finalReportData = reportData.filter(c => 
      c.name.toLowerCase().includes(q) || 
      String(c.id).toLowerCase().includes(q)
    );
    
    // Totals derived FROM the filtered report data for perfect sync
    const totalSalesInRange = finalReportData.reduce((s, x) => s + x.salesVol, 0);
    const totalPaidInRange = finalReportData.reduce((s, x) => s + x.paidVol, 0);
    const totalDuesOverall = finalReportData.reduce((s, x) => s + x.currentDues, 0);
    const netChange = totalSalesInRange - totalPaidInRange;

    _container.innerHTML = `
      <div class="fm-page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: #fff; padding: 15px 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; gap: 15px;">
          <h1 class="fm-title" style="margin:0; font-size: 1.5rem;">📈 ${App.i18n.t('customerReport')}</h1>
          <div style="height: 24px; width: 2px; background: #e2e8f0;"></div>
          <p style="color: #64748b; margin: 0; font-size: 0.9rem; font-weight: 600;">${reportState.start} to ${reportState.end}</p>
        </div>
        
        <div style="display: flex; align-items: center; gap: 15px;">
           <div style="display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 8px;">
              <button class="report-tab-btn ${reportState.view === 'today' ? 'active' : ''}" data-view="today" style="padding: 4px 12px; border-radius: 6px; border: none; background: ${reportState.view === 'today' ? '#10b981' : 'transparent'}; color: ${reportState.view === 'today' ? '#fff' : '#475569'}; cursor: pointer; font-size: 0.85rem; font-weight: 700;">Today</button>
              <button class="report-tab-btn ${reportState.view === 'month' ? 'active' : ''}" data-view="month" style="padding: 4px 12px; border-radius: 6px; border: none; background: ${reportState.view === 'month' ? '#10b981' : 'transparent'}; color: ${reportState.view === 'month' ? '#fff' : '#475569'}; cursor: pointer; font-size: 0.85rem; font-weight: 700;">Month</button>
           </div>
           <div style="display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <input type="date" id="rep-start" value="${reportState.start}" style="padding: 2px 5px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.8rem;">
              <span style="color: #64748b; font-size: 0.8rem;">to</span>
              <input type="date" id="rep-end" value="${reportState.end}" style="padding: 2px 5px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.8rem;">
              <button id="apply-range" style="background: #3b82f6; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold;">Apply</button>
           </div>
           <div style="display: flex; gap: 8px;">
              <button id="rep-whatsapp" title="WhatsApp Summary" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid #10b981; background: #fff; color: #10b981; cursor: pointer;">🟢</button>
              <button id="rep-csv" title="CSV Export" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid #64748b; background: #fff; color: #64748b; cursor: pointer;">📊</button>
           </div>
        </div>
      </div>

      <div class="fm-report-controls" style="display: flex; gap: 15px; align-items: center; margin-bottom: 20px;">
        <div class="fm-stat-strip" style="flex: 1; display: flex; gap: 10px;">
          <div style="background: #eff6ff; padding: 8px 15px; border-radius: 8px; border-left: 4px solid #3b82f6; flex: 1;">
            <div style="font-size: 0.7rem; color: #1e40af; font-weight: 800; text-transform: uppercase;">Sales</div>
            <div style="font-size: 1.1rem; font-weight: 900; color: #1e3a8a;">₹${totalSalesInRange.toFixed(2)}</div>
          </div>
          <div style="background: #ecfdf5; padding: 8px 15px; border-radius: 8px; border-left: 4px solid #10b981; flex: 1;">
            <div style="font-size: 0.7rem; color: #065f46; font-weight: 800; text-transform: uppercase;">Paid</div>
            <div style="font-size: 1.1rem; font-weight: 900; color: #064e3b;">₹${totalPaidInRange.toFixed(2)}</div>
          </div>
          <div style="background: #fff7ed; padding: 8px 15px; border-radius: 8px; border-left: 4px solid #f97316; flex: 1;">
            <div style="font-size: 0.7rem; color: #9a3412; font-weight: 800; text-transform: uppercase;">Net</div>
            <div style="font-size: 1.1rem; font-weight: 900; color: #7c2d12;">₹${(totalSalesInRange - totalPaidInRange).toFixed(2)}</div>
          </div>
          <div style="background: #fef2f2; padding: 8px 15px; border-radius: 8px; border-left: 4px solid #ef4444; flex: 1;">
            <div style="font-size: 0.7rem; color: #991b1b; font-weight: 800; text-transform: uppercase;">Dues</div>
            <div style="font-size: 1.1rem; font-weight: 900; color: #7f1d1d;">₹${totalDuesOverall.toFixed(2)}</div>
          </div>
        </div>

        <div style="width: 300px; position: relative;">
          <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: #10b981;">🔍</span>
          <input id="rep-search" type="text" placeholder="Search customer ID/name..." value="${reportState.searchTerm}" style="width: 100%; padding: 8px 12px 8px 35px; border: 1px solid #10b981; border-radius: 8px; outline: none; font-size: 0.9rem; font-weight: 600;">
        </div>
      </div>

      <div class="fm-full-grid" style="background: #fff; border-radius: 12px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; width: 100%; display: flex; flex-direction: column;">
        <div style="max-height: 60vh; overflow-y: auto; width: 100%;">
          <table class="fm-table" style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead style="background: #f8fafc; border-bottom: 2px solid #f1f5f9; position: sticky; top: 0; z-index: 10;">
              <tr>
                <th style="padding: 10px 15px; font-size: 0.85rem; background: #f8fafc;">Customer Name</th>
                <th style="padding: 10px 15px; font-size: 0.85rem; background: #f8fafc;">Sales</th>
                <th style="padding: 10px 15px; font-size: 0.85rem; background: #f8fafc;">Paid</th>
                <th style="padding: 10px 15px; font-size: 0.85rem; background: #f8fafc;">Balance</th>
                <th style="padding: 10px 15px; text-align: right; font-size: 0.85rem; background: #f8fafc;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${finalReportData.map(c => `
                  <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.1s; cursor: default;">
                    <td style="padding: 8px 15px;">
                      <div style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">${c.name}</div>
                      <div style="font-size: 0.7rem; color: #64748b;">ID: ${c.id} • ${c.contact}</div>
                    </td>
                    <td style="padding: 8px 15px; font-weight: 600; color: #334155; font-size: 0.95rem;">₹${c.salesVol.toFixed(2)}</td>
                    <td style="padding: 8px 15px; font-weight: 600; color: #10b981; font-size: 0.95rem;">₹${c.paidVol.toFixed(2)}</td>
                    <td style="padding: 8px 15px; font-weight: 800; color: ${c.currentDues > 0 ? '#ef4444' : '#1e293b'}; font-size: 0.95rem;">₹${c.currentDues.toFixed(2)}</td>
                    <td style="padding: 8px 15px; text-align: right;">
                       <button class="send-cust-wa" data-idx="${c.id}" style="background: #25d366; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem;">📲</button>
                    </td>
                  </tr>
              `).join('')}
              ${finalReportData.length === 0 ? '<tr><td colspan="5" style="padding: 50px; text-align: center; color: #94a3b8; font-style: italic;">No customer matches found.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // ── Listeners ──
    _container.querySelectorAll('.report-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        reportState.view = view;
        const now = new Date();
        if (view === 'today') {
           reportState.start = reportState.end = now.toISOString().split('T')[0];
        } else if (view === 'month') {
           reportState.start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
           reportState.end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }
        renderPage();
      });
    });

    _container.querySelector('#apply-range').addEventListener('click', () => {
       reportState.view = 'custom';
       reportState.start = _container.querySelector('#rep-start').value;
       reportState.end = _container.querySelector('#rep-end').value;
       renderPage();
    });

    _container.querySelector('#rep-search').addEventListener('input', (e) => {
        reportState.searchTerm = e.target.value;
        renderPage();
        // Maintain focus
        _container.querySelector('#rep-search').focus();
        _container.querySelector('#rep-search').setSelectionRange(e.target.value.length, e.target.value.length);
    });

    _container.querySelector('#rep-csv').addEventListener('click', () => {
       // --- Section 1: Summaries ---
       const summaryHeaders = ['SECTION: CUSTOMER SUMMARIES', '', '', '', '', ''];
       const rowHeaders = ['Customer Name', 'ID', 'Initial Dues', 'Sales in Period', 'Paid in Period', 'Final Balance'];
       const summaryRows = finalReportData.map(c => [
         c.name, 
         c.id, 
         parseFloat(c.initialDues || 0).toFixed(2), 
         c.salesVol.toFixed(2), 
         c.paidVol.toFixed(2), 
         c.currentDues.toFixed(2)
       ]);

       // --- Section 2: Detailed Transaction Log ---
       const logHeaders = ['', '', '', '', '', ''];
       const logTitle = ['SECTION: DETAILED TRANSACTION LOG (EXACT VALUES)', '', '', '', '', ''];
       const logRowHeaders = ['Date', 'Customer Name', 'Type', 'ID/Ref', 'Amount (₹)', 'Method/Note'];
       
       const transactionLog = [];
       // Add all sales
       filteredSales.forEach(s => {
          if (finalReportData.some(c => c.id === s.customerId)) {
             transactionLog.push([s.date, (s.customerName || '—'), 'SALE', (s.id || '—'), parseFloat(s.total || 0).toFixed(2), (s.flowerType || '—')]);
          }
       });
       // Add all receipts
       filteredReceipts.forEach(r => {
          if (finalReportData.some(c => c.id === r.customerId)) {
             transactionLog.push([r.date, (r.customerName || '—'), 'RECEIPT', (r.id || '—'), parseFloat(r.amount || 0).toFixed(2), (r.notes || '—')]);
          }
       });
       // Sort log by date
       transactionLog.sort((a, b) => a[0].localeCompare(b[0]));

       const csvRows = [
          summaryHeaders,
          rowHeaders,
          ...summaryRows,
          logHeaders, // empty separator
          logTitle,
          logRowHeaders,
          ...transactionLog
       ];

       const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
       const link = document.createElement("a");
       link.setAttribute("href", encodeURI(csvContent));
       link.setAttribute("download", `Customer_Report_${reportState.start}_to_${reportState.end}.csv`);
       document.body.appendChild(link);
       link.click();
       link.remove();
    });

    _container.querySelector('#rep-whatsapp').addEventListener('click', () => {
       const text = `📊 *Market Report Summary*%0APeriod: ${reportState.start} to ${reportState.end}%0A---------------------------%0ATotal Sales: ₹${totalSalesInRange.toFixed(2)}%0ACash Received: ₹${totalPaidInRange.toFixed(2)}%0A---------------------------%0AKeep Growing! 🌿`;
       window.open(`https://wa.me/?text=${text}`, '_blank');
     });

     _container.querySelectorAll('.send-cust-wa').forEach(btn => {
        btn.addEventListener('click', () => {
           const c = reportData.find(x => x.id === btn.dataset.idx);
           const text = `🌸 *Payment Reminder*%0AHello *${c.name}*,%0AYour current outstanding balance is *₹${c.currentDues.toFixed(2)}*.%0APlease clear your dues at the earliest. Thank you!`;
           window.open(`https://wa.me/91${c.contact}?text=${text}`, '_blank');
        });
     });
  }

  return { init };
})();

window.CashReceiveModule = CashReceiveModule;
window.CustomerReportModule = CustomerReportModule;
