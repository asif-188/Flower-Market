const AbsentFarmerModule = (() => {
  let _container = null;
  let _db = null;
  let tenantId = '';
  let selectedDate = new Date().toISOString().split('T')[0];
  let filterType = 'today'; // today, this-week, this-month, prev-month, this-year, custom
  let searchQuery = '';

  function init(container, db) {
    _container = container;
    _db = db;
    tenantId = _db.currentTenant;
    renderPage();
  }

  function getDateRange(preset) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    switch (preset) {
      case 'today':
        return { from: ymd(now), to: ymd(now) };
      case 'this-week': {
        const d = new Date(now);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day; // Monday start
        d.setDate(d.getDate() + diff);
        return { from: ymd(d), to: ymd(now) };
      }
      case 'this-month':
        return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: ymd(now) };
      case 'prev-month': {
        const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const m = now.getMonth() === 0 ? 12 : now.getMonth();
        const lastDay = new Date(y, m, 0).getDate();
        return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${lastDay}` };
      }
      case 'this-year':
        return { from: `${now.getFullYear()}-01-01`, to: ymd(now) };
      default:
        return { from: selectedDate, to: selectedDate };
    }
  }

  function getAbsentFarmers() {
    const range = getDateRange(filterType);
    
    // 1. Load all registered farmers (using fmb_ prefix)
    const farmersRaw = sessionStorage.getItem(`fmb_farmers_${tenantId}`);
    const allFarmers = farmersRaw ? JSON.parse(farmersRaw) : [];

    // 2. Load purchase/entry data to see who is PRESENT
    const purchaseRaw = sessionStorage.getItem(`fmb_purchases_${tenantId}`);
    const allPurchases = purchaseRaw ? JSON.parse(purchaseRaw) : [];

    // 3. Filter purchases by selected range
    const presentFarmerIds = new Set();
    allPurchases.forEach(p => {
      if (p.date >= range.from && p.date <= range.to) {
        presentFarmerIds.add(p.farmerId);
      }
    });

    // 4. Absent = All - Present
    let absent = allFarmers.filter(f => !presentFarmerIds.has(f.id));

    // 5. Apply Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      absent = absent.filter(f => 
        String(f.name || '').toLowerCase().includes(q) || 
        String(f.id || '').toLowerCase().includes(q)
      );
    }

    return { absent, range };
  }

  function downloadCSV() {
    const { absent } = getAbsentFarmers();
    if (absent.length === 0) {
      alert("No absent farmers found for this range.");
      return;
    }
    
    // Prepare data for Excel/CSV
    const data = absent.map(f => ({
      "Farmer ID": f.id,
      "Name": f.name,
      "Contact": f.contact || "",
      "Location": f.location || "",
      "Reg. Date": f.createdAt || ""
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absent_Farmers");
    XLSX.writeFile(wb, `Absent_Farmers_${filterType}_${new Date().toISOString().split('T')[0]}.csv`);
  }

  function sendWA(f) {
    if (!f.contact) {
      alert("No contact number available for this farmer.");
      return;
    }
    const msg = encodeURIComponent(`Hello ${f.name}, we noticed you were absent recently at the Flower Market. Please let us know if you have produce ready for tomorrow. Regards.`);
    const phone = f.contact.replace(/\D/g, '');
    const finalPhone = phone.length === 10 ? '91' + phone : phone;
    window.open(`https://wa.me/${finalPhone}?text=${msg}`, '_blank');
  }

  function renderPage() {
    _container.innerHTML = `
      <div class="fm-page-header">
        <div class="fm-title-group">
           <h1 class="fm-title">🚫 <span>${App.i18n.t('absentMgmt')}</span></h1>
        </div>
        <div class="fm-header-actions">
          <button id="absent-wa-all-btn" class="fm-wa-btn ripple" style="background: var(--green-pale); border-color: var(--green-primary);">💬 WhatsApp</button>
          <button id="absent-csv-btn" class="fm-btn-secondary ripple">📥 CSV</button>
          <div class="fm-filter-group">
            <select id="absent-date-preset" class="fm-select">
              <option value="today" ${filterType === 'today' ? 'selected' : ''}>${App.i18n.t('today')}</option>
              <option value="this-week" ${filterType === 'this-week' ? 'selected' : ''}>${App.i18n.t('thisWeek')}</option>
              <option value="this-month" ${filterType === 'this-month' ? 'selected' : ''}>${App.i18n.t('thisMonth')}</option>
              <option value="prev-month" ${filterType === 'prev-month' ? 'selected' : ''}>${App.i18n.t('lastMonth')}</option>
              <option value="this-year" ${filterType === 'this-year' ? 'selected' : ''}>${App.i18n.t('thisYear')}</option>
              <option value="custom" ${filterType === 'custom' ? 'selected' : ''}>${App.i18n.t('customDate')}</option>
            </select>
          </div>
          <div id="custom-date-container" class="fm-filter-group ${filterType !== 'custom' ? 'hidden' : ''}">
            <input type="date" id="absent-date-inp" class="fm-input" value="${selectedDate}">
          </div>
        </div>
      </div>

      <div class="fm-search-row" style="margin-bottom: 20px;">
        <div class="fm-search-wrap">
          <span class="fm-search-icon">🔍</span>
          <input type="text" id="absent-search" class="fm-search-input" placeholder="${App.i18n.t('searchHint')}" value="${searchQuery}">
        </div>
        <div id="absent-range-info" class="fm-search-hint"></div>
      </div>

      <div class="fm-card glass-card">
        <table class="fm-table">
          <thead>
            <tr>
              <th>${App.i18n.t('id')}</th>
              <th>${App.i18n.t('date')}</th>
              <th>${App.i18n.t('name')}</th>
              <th>${App.i18n.t('location')}</th>
              <th>${App.i18n.t('status')}</th>
            </tr>
          </thead>
          <tbody id="absent-list"></tbody>
        </table>
      </div>
    `;

    renderList();

    // Events
    _container.querySelector('#absent-wa-all-btn')?.addEventListener('click', () => {
        const { absent, range } = getAbsentFarmers();
        if (absent.length === 0) {
            alert(App.i18n.t('noAbsentFound'));
            return;
        }
        const names = absent.map(f => f.name).slice(0, 10).join(', ') + (absent.length > 10 ? '...' : '');
        const msg = encodeURIComponent(`Absent Farmers (${range.from} to ${range.to}): ${names}`);
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    });

    _container.querySelector('#absent-csv-btn')?.addEventListener('click', downloadCSV);

    const preset = _container.querySelector('#absent-date-preset');
    preset.addEventListener('change', (e) => {
      filterType = e.target.value;
      if (filterType !== 'custom') {
        _container.querySelector('#custom-date-container').classList.add('hidden');
      } else {
        _container.querySelector('#custom-date-container').classList.remove('hidden');
      }
      renderList();
    });

    _container.querySelector('#absent-date-inp').addEventListener('change', (e) => {
      selectedDate = e.target.value;
      renderList();
    });

    _container.querySelector('#absent-search').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderList();
    });
  }

  function renderList() {
    const list = _container.querySelector('#absent-list');
    const rangeInfo = _container.querySelector('#absent-range-info');
    const { absent, range } = getAbsentFarmers();

    if (rangeInfo) {
      rangeInfo.innerHTML = `${App.i18n.t('viewRange')}: <strong>${range.from}</strong> to <strong>${range.to}</strong>`;
    }

    if (absent.length === 0) {
      list.innerHTML = `<tr><td colspan="5" class="fm-empty-state">${App.i18n.t('allPresent')}</td></tr>`;
      return;
    }

    list.innerHTML = absent.map(f => `
      <tr class="animate-fade-in">
        <td><span class="fm-badge-id">${f.id}</span></td>
        <td style="font-size: 0.85rem; color: var(--text-muted);">${f.createdAt || '—'}</td>
        <td class="fm-semi-bold">${f.name}</td>
        <td>${f.location ? App.i18n.t(f.location.toLowerCase()) : '—'}</td>
        <td><span class="tag-absent">${App.i18n.t('absent')}</span></td>
      </tr>
    `).join('');
  }

  return { init };
})();
