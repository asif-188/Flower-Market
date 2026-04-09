
const CashPayModule = (() => {
  let _container = null, _db = null, tenantId = '';
  let payments = [];

  function init(container, db) {
    _container = container; _db = db;
    tenantId = _db.currentTenant;
    loadData();
    renderPage();
  }

  function loadData() {
    const data = sessionStorage.getItem(`payments_${tenantId}`);
    payments = data ? JSON.parse(data) : [];
  }

  function saveData() {
    sessionStorage.setItem(`payments_${tenantId}`, JSON.stringify(payments));
    renderPage();
  }

  function getFarmers() {
    const data = sessionStorage.getItem(`farmers_${tenantId}`);
    return data ? JSON.parse(data) : [];
  }

  function renderPage() {
    _container.innerHTML = `
      <div class="fm-page-header">
        <h1 class="fm-title">💸 ${App.i18n.t('cashPay')}</h1>
        <button id="add-pay-btn" class="fm-btn-add">＋ ${App.i18n.t('addPayment')}</button>
      </div>
      <div class="fm-card animate-fade-in">
        <table class="fm-table">
          <thead>
            <tr>
              <th>${App.i18n.t('date')}</th><th>${App.i18n.t('farmer')} ${App.i18n.t('name')}</th><th>${App.i18n.t('amountPaid')}</th><th>${App.i18n.t('notes')}</th><th style="text-align:right">${App.i18n.t('actions')}</th>
            </tr>
          </thead>
          <tbody id="pay-list">
            ${payments.length === 0 ? `<tr><td colspan="5" class="fm-empty-state">${App.i18n.t('noPaymentsMade')}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;

    const list = _container.querySelector('#pay-list');
    [...payments].reverse().forEach((p, idxOrig) => {
      const idx = payments.length - 1 - idxOrig;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${p.date}</td>
        <td class="fm-semi-bold">${p.farmerName}</td>
        <td class="fm-semi-bold color-red">₹${p.amount}</td>
        <td>${p.notes || '—'}</td>
        <td style="text-align:right">
          <button class="fm-action-btn delete-btn">🗑️</button>
        </td>
      `;
      row.querySelector('.delete-btn').addEventListener('click', () => confirmDelete(idx));
      list.appendChild(row);
    });

    _container.querySelector('#add-pay-btn').addEventListener('click', openModal);
  }

  function openModal() {
    const farmers = getFarmers();
    const modal = document.createElement('div');
    modal.className = 'fm-modal-overlay';
    modal.innerHTML = `
      <div class="fm-modal animate-pop">
        <div class="fm-modal-header">
          <h2>💸 ${App.i18n.t('newCashPayment')}</h2>
          <button class="fm-close-btn">&times;</button>
        </div>
        <form class="fm-form pay-form">
          <div class="fm-field">
            <label>${App.i18n.t('date')}</label>
            <input type="date" id="pay-date" value="${new Date().toISOString().split('T')[0]}" required>
          </div>
          <div class="fm-field">
            <label>${App.i18n.t('farmer')} ${App.i18n.t('name')} *</label>
            <select id="pay-farmer" required>
              <option value="">${App.i18n.t('selectFarmer')}</option>
              ${farmers.map(f => `<option value="${f.id}">${f.name} (${f.id})</option>`).join('')}
            </select>
          </div>
          <div class="fm-field">
            <label>${App.i18n.t('amount')} (₹) *</label>
            <input type="number" id="pay-amount" placeholder="0.00" step="0.01" required>
          </div>
          <div class="fm-field">
            <label>${App.i18n.t('notes')}</label>
            <textarea id="pay-notes" placeholder="..."></textarea>
          </div>
          <div class="fm-modal-footer">
            <button type="button" class="fm-btn-sub cancel-btn">${App.i18n.t('cancel')}</button>
            <button type="submit" class="fm-btn-add">${App.i18n.t('savePayment')}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.fm-close-btn').addEventListener('click', () => modal.remove());
    modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('.pay-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const farmerId = modal.querySelector('#pay-farmer').value;
      const farmer = farmers.find(f => f.id === farmerId);
      
      const p = {
        id: Date.now(),
        date: modal.querySelector('#pay-date').value,
        farmerId,
        farmerName: farmer.name,
        amount: parseFloat(modal.querySelector('#pay-amount').value),
        notes: modal.querySelector('#pay-notes').value
      };

      payments.push(p);
      updateFarmerLedger(p);
      saveData();
      modal.remove();
    });
  }

  function updateFarmerLedger(p) {
    const farmers = getFarmers();
    const fIdx = farmers.findIndex(f => f.id === p.farmerId);
    if (fIdx > -1) {
      if (!farmers[fIdx].ledger) farmers[fIdx].ledger = [];
      farmers[fIdx].ledger.push({
        date: p.date,
        description: `Cash Payment - ${p.notes || 'No notes'}`,
        debit: 0,
        credit: p.amount
      });
      sessionStorage.setItem(`farmers_${tenantId}`, JSON.stringify(farmers));
    }
  }

  function confirmDelete(idx) {
    if (confirm(App.i18n.t('deleteConfirm'))) {
      payments.splice(idx, 1);
      saveData();
    }
  }

  return { init };
})();
window.CashPayModule = CashPayModule;
