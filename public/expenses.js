
const ExpensesModule = (() => {
  let _container = null, _db = null, tenantId = '';
  let expenses = [];

  function init(container, db) {
    _container = container; _db = db;
    tenantId = _db.currentTenant;
    loadData();
    renderPage();
  }

  function loadData() {
    const data = sessionStorage.getItem(`expenses_${tenantId}`);
    expenses = data ? JSON.parse(data) : [];
  }

  function saveData() {
    sessionStorage.setItem(`expenses_${tenantId}`, JSON.stringify(expenses));
    renderPage();
  }

  function renderPage() {
    _container.innerHTML = `
      <div class="fm-page-header">
        <h1 class="fm-title">📉 ${App.i18n.t('expenses')}</h1>
        <button id="add-exp-btn" class="fm-btn-add">＋ ${App.i18n.t('addExpense')}</button>
      </div>
      <div class="fm-card animate-fade-in">
        <table class="fm-table">
          <thead>
            <tr>
              <th>${App.i18n.t('date')}</th><th>${App.i18n.t('expenseType')}</th><th>${App.i18n.t('amount')}</th><th>${App.i18n.t('notes')}</th><th style="text-align:right">${App.i18n.t('actions')}</th>
            </tr>
          </thead>
          <tbody id="exp-list">
            ${expenses.length === 0 ? `<tr><td colspan="5" class="fm-empty-state">${App.i18n.t('noExpenses')}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;

    const list = _container.querySelector('#exp-list');
    [...expenses].reverse().forEach((e, idxOrig) => {
      const idx = expenses.length - 1 - idxOrig;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${e.date}</td>
        <td class="fm-semi-bold">${e.type}</td>
        <td class="fm-semi-bold color-red">₹${e.amount}</td>
        <td>${e.notes || '—'}</td>
        <td style="text-align:right">
          <button class="fm-action-btn delete-btn">🗑️</button>
        </td>
      `;
      row.querySelector('.delete-btn').addEventListener('click', () => confirmDelete(idx));
      list.appendChild(row);
    });

    _container.querySelector('#add-exp-btn').addEventListener('click', openModal);
  }

  function openModal() {
    const modal = document.createElement('div');
    modal.className = 'fm-modal-overlay';
    modal.innerHTML = `
      <div class="fm-modal animate-pop">
        <div class="fm-modal-header">
          <h2>📊 ${App.i18n.t('addExpense')}</h2>
          <button class="fm-close-btn">&times;</button>
        </div>
        <form class="fm-form exp-form">
          <div class="fm-field">
            <label>${App.i18n.t('date')}</label>
            <input type="date" id="exp-date" value="${new Date().toISOString().split('T')[0]}" required>
          </div>
          <div class="fm-field">
            <label>${App.i18n.t('expenseType')} *</label>
            <select id="exp-type" required>
              <option value="Rent">${App.i18n.t('typeRent')}</option>
              <option value="Electricity">${App.i18n.t('typeElectricity')}</option>
              <option value="Tea/Snacks">${App.i18n.t('typeTea')}</option>
              <option value="Transport">${App.i18n.t('typeTransport')}</option>
              <option value="Labour">${App.i18n.t('typeLabour')}</option>
              <option value="Stationary">${App.i18n.t('typeStationary')}</option>
              <option value="Other">${App.i18n.t('typeOther')}</option>
            </select>
          </div>
          <div class="fm-field">
            <label>${App.i18n.t('amount')} (₹) *</label>
            <input type="number" id="exp-amount" placeholder="0.00" step="0.01" required>
          </div>
          <div class="fm-field">
            <label>${App.i18n.t('notes')}</label>
            <textarea id="exp-notes" placeholder="..."></textarea>
          </div>
          <div class="fm-modal-footer">
            <button type="button" class="fm-btn-sub cancel-btn">${App.i18n.t('cancel')}</button>
            <button type="submit" class="fm-btn-add">${App.i18n.t('recordExpense')}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.fm-close-btn').addEventListener('click', () => modal.remove());
    modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('.exp-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const exp = {
        id: Date.now(),
        date: modal.querySelector('#exp-date').value,
        type: modal.querySelector('#exp-type').value,
        amount: parseFloat(modal.querySelector('#exp-amount').value),
        notes: modal.querySelector('#exp-notes').value
      };
      expenses.push(exp);
      saveData();
      modal.remove();
    });
  }

  function confirmDelete(idx) {
    if (confirm(App.i18n.t('deleteConfirm'))) {
      expenses.splice(idx, 1);
      saveData();
    }
  }

  return { init };
})();
window.ExpensesModule = ExpensesModule;
