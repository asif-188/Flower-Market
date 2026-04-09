
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

  function init(container, db) {
    _container = container; _db = db;
    tenantId = _db.currentTenant;
    renderPage();
  }

  function getCustomers() {
    return JSON.parse(sessionStorage.getItem(`customers_${tenantId}`) || '[]');
  }

  function renderPage() {
    const custs = getCustomers();
    _container.innerHTML = `
      <div class="fm-page-header">
        <h1 class="fm-title">📈 Customer Reports</h1>
      </div>
      <div class="fm-summary-grid">
        <div class="fm-stat-card card-blue">
          <h3>Total Customers</h3>
          <p>${custs.length}</p>
        </div>
        <div class="fm-stat-card card-red">
          <h3>Outstanding Dues</h3>
          <p>₹${custs.reduce((s, c) => s + CustomerModule.getDues(c), 0).toFixed(2)}</p>
        </div>
      </div>
      <div class="fm-card animate-fade-in">
        <table class="fm-table">
          <thead>
            <tr>
              <th>Customer</th><th>Contact</th><th>Credit Limit</th><th>Current Dues</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${custs.map(c => {
              const dues = CustomerModule.getDues(c);
              const limit = c.limit || 5000;
              return `
                <tr>
                  <td class="fm-semi-bold">${c.name}</td>
                  <td>${c.contact}</td>
                  <td>₹${limit}</td>
                  <td class="${dues > limit ? 'color-red' : 'color-green'}">₹${dues.toFixed(2)}</td>
                  <td>${dues > limit ? '<span class="fm-tag-absent">Over Limit</span>' : '<span class="fm-badge-id">Healthy</span>'}</td>
                </tr>
              `;
            }).join('')}
            ${custs.length === 0 ? '<tr><td colspan="5" class="fm-empty-state">No customer data available.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    `;
  }

  return { init };
})();

window.CashReceiveModule = CashReceiveModule;
window.CustomerReportModule = CustomerReportModule;
