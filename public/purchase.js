const PurchaseModule = (() => {
  let _container = null, _db = null, tenantId = '';
  let batches = [];
  let currentItems = [];

  function init(container, db) {
    _container = container; _db = db;
    tenantId = _db.currentTenant;
    loadData();
    renderPage();
  }

  function loadData() {
    const data = sessionStorage.getItem(`purchase_batches_${tenantId}`);
    batches = data ? JSON.parse(data) : [];
  }

  function saveData() {
    sessionStorage.setItem(`purchase_batches_${tenantId}`, JSON.stringify(batches));
  }

  function getFarmers() {
    if (_db && _db.tenants && _db.tenants[tenantId] && _db.tenants[tenantId].data && _db.tenants[tenantId].data.farmers) {
        return _db.tenants[tenantId].data.farmers;
    }
    const data = sessionStorage.getItem(`fmb_farmers_${tenantId}`);
    return data ? JSON.parse(data) : [];
  }

  function getFlowers() {
    const list = JSON.parse(sessionStorage.getItem(`flowers_${tenantId}`) || '[]');
    if (list.length === 0) {
      return [
        { name: 'Rose', createdAt: '2026-01-01' },
        { name: 'Jasmine', createdAt: '2026-01-01' },
        { name: 'Marigold', createdAt: '2026-01-01' },
        { name: 'Crossandra', createdAt: '2026-01-01' },
        { name: 'Lotus', createdAt: '2026-01-01' },
        { name: 'Mullai', createdAt: '2026-01-01' }
      ];
    }
    return list;
  }

  function getBuyers() {
    // In Vanilla, buyers/customers are stored in customers_ key
    const data = sessionStorage.getItem(`customers_${tenantId}`);
    return data ? JSON.parse(data) : [];
  }

  function renderPage() {
    const farmers = getFarmers();
    const flowers = getFlowers();
    const buyers = getBuyers();

    _container.innerHTML = `
      <div class="fm-page-header">
        <h1 class="fm-title">🛒 Intake</h1>
      </div>

      <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-8 animate-fade-in">
        <div class="mb-8">
            <h2 class="text-3xl font-bold text-emerald-600 mb-1">Intake Entry</h2>
        </div>

        <!-- Top Form: Farmer & Date -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem;">
            <div style="position: relative;" id="farmer-search-container">
                <label class="fm-label font-bold text-gray-700 uppercase tracking-wide">Farmer / விவசாயி</label>
                <input type="text" id="p-farmer-search" class="fm-input" placeholder="Search and Select Farmer..." autocomplete="off" style="width: 100%; padding: 0.75rem; border: 2px solid #f1f5f9; border-radius: 0.75rem; background: #f8fafc; outline: none; cursor: text;">
                <input type="hidden" id="p-farmer" value="">
                <div id="p-farmer-dropdown" style="display: none; position: absolute; z-index: 50; width: 100%; max-height: 200px; overflow-y: auto; background: #fff; border: 2px solid #f1f5f9; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-top: 5px;"></div>
            </div>
            <div>
                <label class="fm-label font-bold text-gray-700 uppercase tracking-wide">விற்பனை தேதி</label>
                <input type="date" id="p-date" class="fm-input" value="${new Date().toISOString().split('T')[0]}" style="width: 100%; padding: 0.75rem; border: 2px solid #f1f5f9; border-radius: 0.75rem; background: #f8fafc;">
            </div>
        </div>

        <!-- Middle Form: Add Items Area -->
        <div class="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-6 mb-8" style="background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 1rem; padding: 1.5rem; margin-bottom: 2rem;">
            <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-end" style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 1.5rem; align-items: end;">
                <div style="grid-column: span 3; position: relative;">
                    <label class="fm-label text-xs font-bold text-gray-500 uppercase">Flower Variety</label>
                    <input type="text" id="i-flower-input" class="fm-input" placeholder="Search Flower..." autocomplete="off" style="width: 100%; padding: 0.75rem; border: 2px solid #fff; border-radius: 0.75rem; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05); outline: none;">
                    <div id="i-flower-dropdown" style="display: none; position: absolute; z-index: 50; width: 100%; max-height: 200px; overflow-y: auto; background: #fff; border: 2px solid #f1f5f9; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-top: 5px;"></div>
                </div>
                <div style="grid-column: span 3;">
                    <label class="fm-label text-xs font-bold text-gray-500 uppercase">Weight</label>
                    <input type="number" id="i-qty" class="fm-input" placeholder="e.g. 100" style="width: 100%; padding: 0.75rem; border: 2px solid #fff; border-radius: 0.75rem; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                </div>
                <div style="grid-column: span 2;">
                    <label class="fm-label text-xs font-bold text-gray-500 uppercase">Price</label>
                    <input type="number" id="i-rate" class="fm-input" placeholder="e.g. 80" style="width: 100%; padding: 0.75rem; border: 2px solid #fff; border-radius: 0.75rem; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                </div>
                <div style="grid-column: span 2;">
                    <label class="fm-label text-xs font-bold text-gray-500 uppercase">Total</label>
                    <div id="i-total-display" class="fm-input" style="width: 100%; padding: 0.75rem; background: #f1f5f9; border-radius: 0.75rem; font-weight: bold; color: #4b5563;">₹0.00</div>
                </div>
                <div style="grid-column: span 2; display: flex; justify-content: center;">
                    <button id="add-item-btn" class="fm-btn-add" style="width: 3.5rem; height: 3.5rem; background: #10b981; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.2);">
                        <span style="font-size: 1.5rem;">＋</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Table Container -->
        <div class="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden mb-10 shadow-sm" style="background: #fff; border: 2px solid #f1f5f9; border-radius: 1rem; overflow: hidden; margin-bottom: 2.5rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <table class="fm-table" style="width: 100%; text-align: left; border-collapse: collapse;">
                <thead style="background: #f8fafc; border-bottom: 2px solid #f1f5f9;">
                    <tr>
                        <th style="padding: 1rem; font-size: 0.75rem; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Flower Variety</th>
                        <th style="padding: 1rem; font-size: 0.75rem; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; text-align: center;">Weight</th>
                        <th style="padding: 1rem; font-size: 0.75rem; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; text-align: right;">Price</th>
                        <th style="padding: 1rem; font-size: 0.75rem; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; text-align: right;">Total</th>
                        <th style="padding: 1rem; font-size: 0.75rem; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; text-align: center;">Actions</th>
                    </tr>
                </thead>
                <tbody id="current-items-list">
                    ${currentItems.length === 0 ? `<tr><td colspan="5" style="padding: 3rem; text-align: center; color: #94a3b8; font-style: italic;">No items added yet. Click the + button to start.</td></tr>` : ''}
                </tbody>
            </table>
        </div>

        <!-- Bottom Summary Section -->
        <div class="flex flex-col md:flex-row gap-10 items-end justify-between border-t-2 border-gray-50 pt-10" style="display: flex; justify-content: space-between; align-items: end; gap: 2.5rem; border-top: 2px solid #f8fafc; padding-top: 2.5rem;">
            <div class="bg-emerald-50 rounded-3xl p-8 w-full md:max-w-sm border-2 border-emerald-100 shadow-sm" style="background: #ecfdf5; border-radius: 1.5rem; padding: 2rem; width: 100%; max-width: 24rem; border: 2px solid #d1fae5;">
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #4b5563;">
                        <span style="font-weight: bold; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em;">Total Flower cost</span>
                        <span id="summ-total-display" style="font-weight: 900; font-size: 1.125rem;">₹0.00</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; border-top: 2px solid rgba(209, 250, 229, 0.5);">
                        <span style="font-weight: bold; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; color: #065f46;">Debit</span>
                        <input type="number" id="summ-paid" class="fm-input" style="width: 8rem; padding: 0.75rem; text-align: right; background: #fff; border: 2px solid #a7f3d0; border-radius: 0.75rem; font-weight: bold; color: #064e3b; outline: none;" placeholder="0.00">
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 1rem;">
                        <span style="font-weight: 900; text-transform: uppercase; font-size: 0.875rem; letter-spacing: 0.1em; color: #111827;">Net Payable Amount</span>
                        <span id="summ-balance-display" style="font-weight: 900; font-size: 1.5rem; color: #059669;">₹0.00</span>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 1rem;">
                 <button class="fm-btn-sub" style="padding: 1rem; border: 2px solid #f1f5f9; border-radius: 50%; background: transparent; color: #94a3b8; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 3.5rem; height: 3.5rem;">
                    <span style="font-size: 1.5rem;">＋</span>
                 </button>
                 <button id="save-purchase-btn" class="fm-btn-add" style="background: #059669; color: #fff; padding: 1rem 3rem; border-radius: 1rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; border: none; cursor: pointer; box-shadow: 0 10px 15px -3px rgba(5, 150, 105, 0.3); transition: all 0.2s;">
                    INTAKE
                </button>
            </div>
        </div>
      </div>
    `;

    // Event Listeners
    // Custom Farmer Dropdown Logic
    const searchInput = _container.querySelector('#p-farmer-search');
    const hiddenInput = _container.querySelector('#p-farmer');
    const dropdown = _container.querySelector('#p-farmer-dropdown');

    function renderFarmerDropdown(filterText = '') {
        dropdown.innerHTML = '';
        const filtered = farmers.filter(f => f.name.toLowerCase().includes(filterText.toLowerCase()) || (f.id && f.id.toLowerCase().includes(filterText.toLowerCase())));
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div style="padding: 0.75rem; color: #94a3b8; text-align: center;">No farmers found</div>';
            return;
        }
        filtered.forEach(f => {
            const div = document.createElement('div');
            div.textContent = `${f.name} (${f.id})`;
            div.style.cssText = 'padding: 0.75rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.2s; color: #334155; font-weight: 500; font-size: 0.875rem;';
            div.addEventListener('mouseenter', () => div.style.background = '#f8fafc');
            div.addEventListener('mouseleave', () => div.style.background = 'transparent');
            div.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent input blur before click registers
                hiddenInput.value = f.id;
                searchInput.value = `${f.name}`;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(div);
        });
    }

    searchInput.addEventListener('focus', () => {
        renderFarmerDropdown(searchInput.value);
        dropdown.style.display = 'block';
    });

    searchInput.addEventListener('blur', () => {
        dropdown.style.display = 'none';
        if (!hiddenInput.value) searchInput.value = '';
    });

    searchInput.addEventListener('input', (e) => {
        hiddenInput.value = ''; // Reset ID while typing
        renderFarmerDropdown(e.target.value);
        dropdown.style.display = 'block';
    });

    // Custom Flower Dropdown Logic
    const flowerInput = _container.querySelector('#i-flower-input');
    const flowerDropdown = _container.querySelector('#i-flower-dropdown');

    function renderFlowerDropdown(filterText = '') {
        flowerDropdown.innerHTML = '';
        const filtered = flowers.filter(f => f.name.toLowerCase().includes(filterText.toLowerCase()));
        if (filtered.length === 0) {
            flowerDropdown.innerHTML = '<div style="padding: 0.75rem; color: #94a3b8; text-align: center;">No flowers found</div>';
            return;
        }
        filtered.forEach(f => {
            const div = document.createElement('div');
            div.textContent = f.name;
            div.style.cssText = 'padding: 0.75rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.2s; color: #334155; font-weight: 500; font-size: 0.875rem;';
            div.addEventListener('mouseenter', () => div.style.background = '#f8fafc');
            div.addEventListener('mouseleave', () => div.style.background = 'transparent');
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                flowerInput.value = f.name;
                flowerDropdown.style.display = 'none';
            });
            flowerDropdown.appendChild(div);
        });
    }

    flowerInput.addEventListener('focus', () => {
        renderFlowerDropdown(flowerInput.value);
        flowerDropdown.style.display = 'block';
    });

    flowerInput.addEventListener('blur', () => {
        flowerDropdown.style.display = 'none';
    });

    flowerInput.addEventListener('input', (e) => {
        renderFlowerDropdown(e.target.value);
        flowerDropdown.style.display = 'block';
    });
    const iQty = _container.querySelector('#i-qty');
    const iRate = _container.querySelector('#i-rate');
    const iTotalDisplay = _container.querySelector('#i-total-display');
    const addItemBtn = _container.querySelector('#add-item-btn');
    const saveBtn = _container.querySelector('#save-purchase-btn');
    const summPaid = _container.querySelector('#summ-paid');

    function updateItemTotal() {
      const q = parseFloat(iQty.value) || 0;
      const r = parseFloat(iRate.value) || 0;
      iTotalDisplay.textContent = `₹${(q * r).toFixed(2)}`;
    }

    iQty.addEventListener('input', updateItemTotal);
    iRate.addEventListener('input', updateItemTotal);

    // ── Row Keyboard Navigation ──
    flowerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (flowerDropdown.style.display === 'none' || flowerDropdown.innerHTML === '') {
           iQty.focus();
        }
      }
    });

    iQty.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        iRate.focus();
      }
    });

    iRate.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addItemBtn.click();
        setTimeout(() => flowerInput.focus(), 10);
      }
    });

    addItemBtn.addEventListener('click', () => {
      const flower = flowerInput.value;
      const qty = parseFloat(iQty.value);
      const rate = parseFloat(iRate.value);

      if (!flower || isNaN(qty) || isNaN(rate)) {
        alert('Please fill flower details!');
        return;
      }

      currentItems.push({ flowerType: flower, qty, rate, total: qty * rate });
      flowerInput.value = '';
      iQty.value = '';
      iRate.value = '';
      iTotalDisplay.textContent = '₹0.00';
      renderItems();
      updateSummary();
    });

    summPaid.addEventListener('input', updateSummary);

    saveBtn.addEventListener('click', () => {
      const farmerId = _container.querySelector('#p-farmer').value;
      const date = _container.querySelector('#p-date').value;

      if (!farmerId || currentItems.length === 0) {
        alert('Please select farmer and add items!');
        return;
      }

      const farmer = farmers.find(f => f.id === farmerId);
      const totalCost = currentItems.reduce((s, i) => s + i.total, 0);
      const paid = parseFloat(summPaid.value) || 0;

      const batch = {
        batchId: 'BAT-' + Date.now().toString().slice(-6),
        date,
        farmerId,
        farmerName: farmer.name,
        items: [...currentItems],
        summary: {
          totalCost: totalCost,
          netTotal: totalCost,
          paid: paid,
          newBalance: totalCost - paid
        }
      };

      batches.push(batch);
      updateFarmerLedger(batch);
      saveData();
      alert('Purchase Saved Successfully!');
      currentItems = [];
      renderPage(); // Reset form
    });
  }

  function renderItems() {
    const list = _container.querySelector('#current-items-list');
    if (currentItems.length === 0) {
      list.innerHTML = `<tr><td colspan="5" style="padding: 3rem; text-align: center; color: #94a3b8; font-style: italic;">No items added yet. Click the + button to start.</td></tr>`;
      return;
    }
    list.innerHTML = '';
    currentItems.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #f8fafc';
      tr.innerHTML = `
        <td style="padding: 1rem; font-weight: bold; color: #334155;">${item.flowerType}</td>
        <td style="padding: 1rem; color: #475569; text-align: center;">${item.qty}</td>
        <td style="padding: 1rem; color: #475569; text-align: right;">₹${item.rate}</td>
        <td style="padding: 1rem; font-weight: bold; color: #059669; text-align: right;">₹${item.total.toFixed(2)}</td>
        <td style="padding: 1rem; text-align: center;">
            <button class="edit-btn" style="color: #64748b; border: none; background: transparent; cursor: pointer; font-size: 1.25rem; margin-right: 0.5rem;" title="Edit">✏️</button>
            <button class="remove-btn" style="color: #ef4444; border: none; background: transparent; cursor: pointer; font-size: 1.25rem;" title="Delete">🗑️</button>
        </td>
      `;
      tr.querySelector('.edit-btn').addEventListener('click', () => {
        _container.querySelector('#i-flower').value = item.flowerType;
        _container.querySelector('#i-qty').value = item.qty;
        _container.querySelector('#i-rate').value = item.rate;
        currentItems.splice(idx, 1);
        updateSummary();
        renderItems();
      });
      tr.querySelector('.remove-btn').addEventListener('click', () => {
        currentItems.splice(idx, 1);
        renderItems();
        updateSummary();
      });
      list.appendChild(tr);
    });
  }

  function updateSummary() {
    const totalCost = currentItems.reduce((s, i) => s + i.total, 0);
    const paid = parseFloat(_container.querySelector('#summ-paid').value) || 0;
    _container.querySelector('#summ-total-display').textContent = `₹${totalCost.toFixed(2)}`;
    _container.querySelector('#summ-balance-display').textContent = `₹${(totalCost - paid).toFixed(2)}`;
  }

  function updateFarmerLedger(batch) {
    const farmers = getFarmers();
    const fIdx = farmers.findIndex(f => f.id === batch.farmerId);
    if (fIdx > -1) {
      if (!farmers[fIdx].ledger) farmers[fIdx].ledger = [];
      farmers[fIdx].ledger.push({
        date: batch.date,
        description: `Purchase Batch: ${batch.batchId}`,
        debit: batch.summary.netTotal,
        credit: 0
      });
      if (batch.summary.paid > 0) {
        farmers[fIdx].ledger.push({
          date: batch.date,
          description: `Payment: ${batch.batchId}`,
          debit: 0,
          credit: batch.summary.paid
        });
      }
      if (_db && _db.tenants && _db.tenants[tenantId] && _db.tenants[tenantId].data) {
        _db.tenants[tenantId].data.farmers = farmers;
      }
      sessionStorage.setItem(`fmb_farmers_${tenantId}`, JSON.stringify(farmers));
    }
  }

  return { init };
})();
window.PurchaseModule = PurchaseModule;
