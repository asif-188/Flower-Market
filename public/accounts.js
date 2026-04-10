
const AccountsModule = (() => {
  let _container = null, _db = null, tenantId = '';
  
  // State for Day Account
  let dayDate = new Date().toISOString().split('T')[0];
  
  // State for Month Account
  let monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM

  function init(container, db, type) {
    _container = container; _db = db;
    tenantId = _db.currentTenant;
    if (type === 'day') renderDayAccount();
    else renderMonthAccount();
  }

  function getDailyData(date) {
    const p = JSON.parse(sessionStorage.getItem(`purchases_${tenantId}`) || '[]');
    const pay = JSON.parse(sessionStorage.getItem(`payments_${tenantId}`) || '[]');
    const exp = JSON.parse(sessionStorage.getItem(`expenses_${tenantId}`) || '[]');

    return {
      purchases: p.filter(x => x.date === date),
      payments: pay.filter(x => x.date === date),
      expenses: exp.filter(x => x.date === date)
    };
  }

  function getMonthlyData(yearMonth) {
    const p = JSON.parse(sessionStorage.getItem(`purchases_${tenantId}`) || '[]');
    const pay = JSON.parse(sessionStorage.getItem(`payments_${tenantId}`) || '[]');
    const exp = JSON.parse(sessionStorage.getItem(`expenses_${tenantId}`) || '[]');

    return {
      purchases: p.filter(x => x.date.startsWith(yearMonth)),
      payments: pay.filter(x => x.date.startsWith(yearMonth)),
      expenses: exp.filter(x => x.date.startsWith(yearMonth))
    };
  }

  function renderDayAccount() {
    const data = getDailyData(dayDate);
    const totalP = data.purchases.reduce((s, x) => s + parseFloat(x.net), 0);
    const totalPay = data.payments.reduce((s, x) => s + parseFloat(x.amount), 0);
    const totalExp = data.expenses.reduce((s, x) => s + parseFloat(x.amount), 0);
    const balance = totalP - totalPay - totalExp;

    _container.innerHTML = `
      <div class="fm-page-header">
        <h1 class="fm-title">📅 ${App.i18n.t('dayAccountTitle')}</h1>
        <div class="fm-filter-group">
          <label>${App.i18n.t('filterDate')}:</label>
          <input type="date" id="day-date-filter" class="fm-input" value="${dayDate}">
        </div>
      </div>

      <div class="fm-summary-grid">
        <div class="fm-stat-card card-blue">
          <h3>${App.i18n.t('totalPurchase')}</h3>
          <p>₹${totalP.toFixed(2)}</p>
        </div>
        <div class="fm-stat-card card-red">
          <h3>${App.i18n.t('cashPaid')}</h3>
          <p>₹${totalPay.toFixed(2)}</p>
        </div>
        <div class="fm-stat-card card-orange">
          <h3>${App.i18n.t('expenses')}</h3>
          <p>₹${totalExp.toFixed(2)}</p>
        </div>
        <div class="fm-stat-card card-green">
          <h3>${App.i18n.t('netBalance')}</h3>
          <p>₹${balance.toFixed(2)}</p>
        </div>
      </div>

      <div class="fm-card animate-fade-in">
        <h3 class="fm-section-subtitle">${App.i18n.t('detailedEntries')}</h3>
        <table class="fm-table">
          <thead>
            <tr><th>${App.i18n.t('status')}</th><th>${App.i18n.t('name')}/${App.i18n.t('status')}</th><th>${App.i18n.t('debit')} (₹)</th><th>${App.i18n.t('credit')} (₹)</th></tr>
          </thead>
          <tbody>
            ${data.purchases.map(x => `<tr><td>${App.i18n.t('purchase')}</td><td>${x.farmerName} (${App.i18n.t(x.flowerName.toLowerCase())})</td><td class="color-green">₹${x.net}</td><td>—</td></tr>`).join('')}
            ${data.payments.map(x => `<tr><td>${App.i18n.t('cashPay')}</td><td>${x.farmerName}</td><td>—</td><td class="color-red">₹${x.amount}</td></tr>`).join('')}
            ${data.expenses.map(x => `<tr><td>${App.i18n.t('expenses')}</td><td>${App.i18n.t('type' + x.type)}</td><td>—</td><td class="color-red">₹${x.amount}</td></tr>`).join('')}
            ${data.purchases.length === 0 && data.payments.length === 0 && data.expenses.length === 0 ? `<tr><td colspan="4" class="fm-empty-state">${App.i18n.t('noTransactions')}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;

    _container.querySelector('#day-date-filter').addEventListener('change', (e) => {
      dayDate = e.target.value;
      renderDayAccount();
    });
  }

  function renderMonthAccount() {
    const data = getMonthlyData(monthYear);
    
    // Aggregating Farmer-wise data
    const summaryMap = {};
    data.purchases.forEach(p => {
       if (!summaryMap[p.farmerId]) summaryMap[p.farmerId] = { id: p.farmerId, name: p.farmerName, location: p.location || '—', p: 0, pay: 0, net: 0 };
       summaryMap[p.farmerId].p += parseFloat(p.net);
    });
    data.payments.forEach(pay => {
       if (!summaryMap[pay.farmerId]) summaryMap[pay.farmerId] = { id: pay.farmerId, name: pay.farmerName, location: pay.location || '—', p: 0, pay: 0, net: 0 };
       summaryMap[pay.farmerId].pay += parseFloat(pay.amount);
    });
    
    // Calculate Net and Totals
    const displayList = Object.values(summaryMap).map(f => {
       f.net = f.p - f.pay;
       return f;
    });
    
    const totalP = displayList.reduce((s, f) => s + f.p, 0);
    const totalPay = displayList.reduce((s, f) => s + f.pay, 0);
    // For Month Report, we also want total Expenses
    const totalExp = data.expenses.reduce((s, x) => s + parseFloat(x.amount), 0);
    const netBalanace = totalP - totalPay - totalExp;

    _container.innerHTML = `
      <div class="fm-page-header print-hide">
        <h1 class="fm-title">📊 ${App.i18n.t('monthAccountTitle')}</h1>
        <div class="fm-header-actions">
           <button class="fm-tpl-btn ripple" id="month-print-btn">🖨 ${App.i18n.t('print')}</button>
           <button class="fm-import-btn ripple" id="month-dl-btn">📥 ${App.i18n.t('download')}</button>
        </div>
      </div>

      <div class="fm-search-row print-hide" style="margin-bottom: 25px;">
        <input type="month" id="month-filter" class="fm-input" style="width: 200px" value="${monthYear}">
        <div class="fm-search-wrap" style="flex:1">
          <span class="fm-search-icon">🔍</span>
          <input id="month-search" class="fm-search-input" type="text" placeholder="${App.i18n.t('searchHint')}" />
        </div>
      </div>

      <div class="fm-summary-grid">
        <div class="fm-stat-card card-green">
          <div class="fm-stat-icon">📦</div>
          <div class="fm-stat-info">
            <h3>${App.i18n.t('totalPurchase')} (${App.i18n.t('debit')})</h3>
            <p>₹${totalP.toFixed(2)}</p>
          </div>
        </div>
        <div class="fm-stat-card card-red">
          <div class="fm-stat-icon">💸</div>
          <div class="fm-stat-info">
            <h3>${App.i18n.t('cashPaid')} (${App.i18n.t('credit')})</h3>
            <p>₹${totalPay.toFixed(2)}</p>
          </div>
        </div>
        <div class="fm-stat-card card-orange">
          <div class="fm-stat-icon">📝</div>
          <div class="fm-stat-info">
            <h3>${App.i18n.t('expenses')}</h3>
            <p>₹${totalExp.toFixed(2)}</p>
          </div>
        </div>
        <div class="fm-stat-card ${netBalanace > 0 ? 'card-blue' : 'card-red'}">
          <div class="fm-stat-icon">🏦</div>
          <div class="fm-stat-info">
            <h3>${App.i18n.t('netBalance')}</h3>
            <p>₹${Math.abs(netBalanace).toFixed(2)} ${netBalanace >= 0 ? App.i18n.t('debit') : App.i18n.t('credit')}</p>
          </div>
        </div>
      </div>

      <div class="fm-card animate-fade-in">
        <div class="fm-card-header">
           <h3>${App.i18n.t('monthFarmerReport')} - ${monthYear}</h3>
        </div>
        <div class="fm-tbl-scroll">
          <table class="fm-table" id="month-rep-table">
            <thead>
              <tr>
                <th>${App.i18n.t('sNo')}</th>
                <th>${App.i18n.t('farmer')} ${App.i18n.t('name')}</th>
                <th>${App.i18n.t('location')}</th>
                <th class="th-num">${App.i18n.t('debit')}<br>(${App.i18n.t('totalPurchase')})</th>
                <th class="th-num">${App.i18n.t('credit')}<br>(${App.i18n.t('cashPaid')})</th>
                <th class="th-num">${App.i18n.t('total')}<br>(${App.i18n.t('netBalance')})</th>
              </tr>
            </thead>
            <tbody id="month-farmer-summary">
              ${displayList.length === 0 ? `<tr><td colspan="6" class="fm-empty-state">${App.i18n.t('noTransactionsMonth')}</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const tbody = _container.querySelector('#month-farmer-summary');
    displayList.forEach((f, idx) => {
      const row = document.createElement('tr');
      row.className = 'fm-row fm-drilldown-row';
      row.title = 'Click to open Farmer Ledger';
      
      const balStr = `₹${Math.abs(f.net).toFixed(2)} ${f.net < 0 ? 'CR' : 'DR'}`;
      const balClass = f.net > 0 ? 'due-dr' : f.net < 0 ? 'due-cr' : 'due-zero';
      
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td class="fm-semi-bold">${f.name} <span class="fm-id-badge">${f.id}</span></td>
        <td>${f.location ? App.i18n.t(f.location.toLowerCase()) : '—'}</td>
        <td class="th-num color-green">${f.p > 0 ? '₹' + f.p.toFixed(2) : '-'}</td>
        <td class="th-num color-red">${f.pay > 0 ? '₹' + f.pay.toFixed(2) : '-'}</td>
        <td class="th-num ${balClass}">${balStr}</td>
      `;
      
      row.addEventListener('click', () => {
         if (window.FarmerModule && typeof window.FarmerModule.openLedger === 'function') {
            window.FarmerModule.openLedger(f.id);
         }
      });
      
      tbody.appendChild(row);
    });

    // Listeners
    _container.querySelector('#month-filter').addEventListener('change', (e) => {
      monthYear = e.target.value;
      renderMonthAccount();
    });

    _container.querySelector('#month-search').addEventListener('input', (e) => {
       const q = e.target.value.toLowerCase();
       const rows = _container.querySelectorAll('#month-farmer-summary tr.fm-row');
       rows.forEach(r => {
          const txt = r.textContent.toLowerCase();
          r.style.display = txt.includes(q) ? '' : 'none';
       });
    });

    // Print
    _container.querySelector('#month-print-btn').addEventListener('click', () => {
      window.print();
    });

    // Download Excel
    _container.querySelector('#month-dl-btn').addEventListener('click', () => {
      if (typeof XLSX === 'undefined') return alert('Excel library not loaded.');
      const headers = ['S.No', 'Farmer Name', 'Farmer ID', 'Location', 'Debit (Purchase)', 'Credit (Payment)', 'Net Balance'];
      const rows = displayList.map((f, i) => [
        i + 1, f.name, f.id, f.location, f.p, f.pay, f.net
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Month Report');
      XLSX.writeFile(wb, `Month_Report_${monthYear}.xlsx`);
    });
  }

  return { init };
})();
window.AccountsModule = AccountsModule;
