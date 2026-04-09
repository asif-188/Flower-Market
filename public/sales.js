
const SalesModule = (() => {
  let _container = null, _db = null, tenantId = '';
  let currentBatch = [];
  let sales = [];

  function init(container, db) {
    _container = container; _db = db;
    tenantId = _db.currentTenant;
    loadData();
    renderPage();
  }

  function loadData() {
    sales = JSON.parse(sessionStorage.getItem(`sales_${tenantId}`) || '[]');
  }

  function saveData() {
    sessionStorage.setItem(`sales_${tenantId}`, JSON.stringify(sales));
  }

  function getCustomers() {
     return JSON.parse(sessionStorage.getItem(`customers_${tenantId}`) || '[]');
  }

  function getFlowers() {
    const list = JSON.parse(sessionStorage.getItem(`flowers_${tenantId}`) || '[]');
    if (list.length === 0) {
      // Fallback for better UX: Common flowers
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

  function renderPage() {
    const custs = getCustomers();
    const flowers = getFlowers();
    const today = new Date().toISOString().split('T')[0];

    _container.innerHTML = `
      <div class="fm-page-header" style="margin-bottom: 20px;">
        <h1 class="fm-title" style="color: #1e8a4a; font-weight: 800; font-size: 1.8rem;">${App.i18n.t('directCustomer')}</h1>
        <p style="color: #64748b; margin-top: -5px;">Log details of flowers sold to customers.</p>
      </div>

      <div class="fm-split-layout" style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: start;">
        
        <!-- LEFT SIDE: Entry Form -->
        <div class="fm-entry-side fm-card-simple animate-fade-in" style="background: white; border-radius: 12px; padding: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
          <h2 style="font-size: 1.1rem; color: #1e8a4a; font-weight: 800; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.3rem;">📝</span> ${App.i18n.t('newPurchaseEntry')}
          </h2>

          <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Customer Selection -->
            <div class="fm-field">
              <label style="display: block; font-weight: bold; color: #64748b; margin-bottom: 8px; font-size: 0.85rem; text-transform: uppercase;">${App.i18n.t('customer')}</label>
              <div style="position: relative;">
                 <input type="text" id="s-cust-input" placeholder="${App.i18n.t('searchHint')}" style="width: 100%; padding: 12px; border: 2px solid #f1f5f9; border-radius: 10px; outline: none; background: #f8fafc; font-size: 1rem;">
                 <div id="s-cust-results" style="position: absolute; top: 100%; left: 0; width: 100%; background: white; border: 1px solid #e2e8f0; border-radius: 8px; z-index: 100; display: none; max-height: 200px; overflow-y: auto; box-shadow: 0 10px 15px rgba(0,0,0,0.1);"></div>
                 <input type="hidden" id="s-cust-id">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <!-- Date Selection -->
              <div class="fm-field">
                <label style="display: block; font-weight: bold; color: #64748b; margin-bottom: 8px; font-size: 0.85rem; text-transform: uppercase;">${App.i18n.t('saleDate')}</label>
                <input type="date" id="s-date" value="${today}" style="width: 100%; padding: 12px; border: 2px solid #f1f5f9; border-radius: 10px; outline: none; background: #f8fafc;">
              </div>
              <!-- Flower Variety -->
              <div class="fm-field">
                <label style="display: block; font-weight: bold; color: #64748b; margin-bottom: 8px; font-size: 0.85rem; text-transform: uppercase;">${App.i18n.t('flowerVariety')}</label>
                <div style="position: relative;">
                   <input type="text" id="s-flower-input" placeholder="${App.i18n.t('selectFlower')}" style="width: 100%; padding: 12px; border: 2px solid #f1f5f9; border-radius: 10px; outline: none; background: #f8fafc;">
                   <div id="s-flower-results" style="position: absolute; top: 100%; left: 0; width: 100%; background: white; border: 1px solid #e2e8f0; border-radius: 8px; z-index: 100; display: none; max-height: 200px; overflow-y: auto; box-shadow: 0 10px 15px rgba(0,0,0,0.1);"></div>
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9; margin-top: 10px;">
              <div class="fm-field">
                <label style="display: block; font-size: 0.75rem; font-weight: bold; color: #64748b; margin-bottom: 5px; text-transform: uppercase;">${App.i18n.t('weightQty')}</label>
                <input type="number" id="s-weight" placeholder="0.00" step="0.01" style="width: 100%; padding: 10px; border: 2px solid #fff; border-radius: 8px; outline: none; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              </div>
              <div class="fm-field">
                <label style="display: block; font-size: 0.75rem; font-weight: bold; color: #64748b; margin-bottom: 5px; text-transform: uppercase;">${App.i18n.t('rate')}</label>
                <input type="number" id="s-price" placeholder="0.00" step="0.01" style="width: 100%; padding: 10px; border: 2px solid #fff; border-radius: 8px; outline: none; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              </div>
              <div class="fm-field">
                <label style="display: block; font-size: 0.75rem; font-weight: bold; color: #64748b; margin-bottom: 5px; text-transform: uppercase;">${App.i18n.t('total')}</label>
                <div id="s-row-total-display" style="width: 100%; padding: 10px; background: #f1f5f9; border-radius: 8px; font-weight: 800; color: #1e8a4a; font-size: 1rem;">₹0.00</div>
              </div>
            </div>

            <div style="margin-top: 10px;">
               <button id="s-add-item" style="width: 100%; height: 50px; background: #1e8a4a; color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s; box-shadow: 0 4px 10px rgba(30, 138, 74, 0.2);">
                 <span>＋</span> ${App.i18n.t('addNew')}
               </button>
            </div>
          </div>
        </div>

        <!-- RIGHT SIDE: Live Preview & History -->
        <div class="fm-preview-side animate-fade-in" style="display: flex; flex-direction: column; gap: 20px;">

          <!-- Batch Table -->
          <div class="fm-card-simple" style="background: white; border-radius: 12px; border: 1px solid #f1f5f9; box-shadow: 0 4px 10px rgba(0,0,0,0.03); overflow: hidden; flex: 1;">
            <div style="padding: 15px 20px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
               <h3 style="margin: 0; font-size: 0.9rem; font-weight: 800; color: #334155;">Current Batch Items</h3>
               <span id="s-item-count" style="background: #1e8a4a; color: white; font-size: 0.7rem; padding: 2px 8px; border-radius: 99px; font-weight: bold;">0 Items</span>
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead style="background: #fff; border-bottom: 1px solid #f1f5f9; position: sticky; top: 0; z-index: 10;">
                  <tr>
                    <th style="padding: 12px 15px; color: #64748b; font-size: 0.75rem; text-transform: uppercase;">${App.i18n.t('flower')}</th>
                    <th style="padding: 12px 15px; color: #64748b; font-size: 0.75rem; text-transform: uppercase; text-align: center;">${App.i18n.t('qty')}</th>
                    <th style="padding: 12px 15px; color: #64748b; font-size: 0.75rem; text-transform: uppercase; text-align: right;">${App.i18n.t('total')}</th>
                    <th style="padding: 12px 15px; text-align: right;"></th>
                  </tr>
                </thead>
                <tbody id="s-batch-body">
                  <tr><td colspan="4" style="padding: 30px; text-align: center; color: #94a3b8; font-style: italic; font-size: 0.85rem;">${App.i18n.t('noItemsAdded')}</td></tr>
                </tbody>
              </table>
            </div>

            <!-- Total Bar -->
            <div style="padding: 20px; background: #f1f5f9; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
               <div>
                  <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 800; margin-bottom: 3px;">Total Quantity</div>
                  <div id="s-total-qty" style="font-weight: 900; color: #334155; font-size: 1.1rem;">0.00</div>
               </div>
               <div style="text-align: right;">
                  <div style="font-size: 0.7rem; color: #1e8a4a; text-transform: uppercase; font-weight: 800; margin-bottom: 3px;">Grand Total</div>
                  <div id="s-grand-total" style="font-weight: 900; color: #1e8a4a; font-size: 1.5rem;">₹0.00</div>
               </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 12px;">
             <button id="s-submit" style="flex: 1; background: #1e8a4a; color: #fff; border: none; padding: 15px; border-radius: 12px; font-weight: 900; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s;">
                🚀 ${App.i18n.t('submitSales')}
             </button>
             <div style="display: flex; gap: 8px;">
               <button id="s-print" title="Print Bill" style="width: 50px; height: 50px; border: 2px solid #3b82f6; border-radius: 12px; background: #f0f7ff; color: #3b82f6; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">🖨️</button>
               <button id="s-whatsapp" title="Send via WhatsApp" style="width: 50px; height: 50px; border: 2px solid #22c55e; border-radius: 12px; background: #f0fdf4; color: #22c55e; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">🟢</button>
             </div>
          </div>

        </div>

      </div>
    `;

    // ── Elements ──
    const custInput = _container.querySelector('#s-cust-input');
    const custResults = _container.querySelector('#s-cust-results');
    const custIdHidden = _container.querySelector('#s-cust-id');
    const flowerInput = _container.querySelector('#s-flower-input');
    const flowerResults = _container.querySelector('#s-flower-results');
    const wInp = _container.querySelector('#s-weight');
    const pInp = _container.querySelector('#s-price');
    const addItemBtn = _container.querySelector('#s-add-item');
    const submitBtn = _container.querySelector('#s-submit');

    // \u2500\u2500 Row Total (live calc) \u2500\u2500
    const rowTotalDisplay = _container.querySelector('#s-row-total-display');
    const calcRowTotal = () => {
      const w = parseFloat(wInp.value) || 0;
      const p = parseFloat(pInp.value) || 0;
      if (rowTotalDisplay) rowTotalDisplay.textContent = `\u20b9${(w * p).toFixed(2)}`;
    };
    wInp.addEventListener('input', calcRowTotal);
    pInp.addEventListener('input', calcRowTotal);

    // \u2500\u2500 Customer Search Logic \u2500\u2500
    custInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) { custResults.style.display = 'none'; return; }
      
      const filtered = custs.filter(c => c.name.toLowerCase().includes(q) || String(c.id).includes(q));
      if (filtered.length) {
        custResults.innerHTML = filtered.map(c => `<div class="fm-search-item" data-id="${c.id}" data-name="${c.name}" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f1f5f9;">${c.name} (${c.id})</div>`).join('');
        custResults.style.display = 'block';
        custResults.querySelectorAll('.fm-search-item').forEach(item => {
           item.addEventListener('click', () => {
              custInput.value = item.dataset.name;
              custIdHidden.value = item.dataset.id;
              custResults.style.display = 'none';
              updatePreview();
           });
        });
      } else {
        custResults.style.display = 'none';
      }
    });

    // ── Flower Search Logic ──
    flowerInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) { flowerResults.style.display = 'none'; return; }
      
      const filtered = flowers.filter(f => f.name.toLowerCase().includes(q));
      if (filtered.length) {
        flowerResults.innerHTML = filtered.map(f => {
          const translated = App.i18n.t(f.name.toLowerCase());
          const display = translated !== f.name.toLowerCase() ? translated : f.name;
          return `<div class="fm-search-item" data-name="${f.name}" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f1f5f9;">${display}</div>`;
        }).join('');
        flowerResults.style.display = 'block';
        flowerResults.querySelectorAll('.fm-search-item').forEach(item => {
           item.addEventListener('click', () => {
              flowerInput.value = item.dataset.name;
              flowerResults.style.display = 'none';
              updatePreview();
           });
        });
      } else {
        flowerResults.style.display = 'none';
      }
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      if (custInput && !custInput.contains(e.target) && !custResults.contains(e.target)) {
        custResults.style.display = 'none';
      }
      if (flowerInput && !flowerInput.contains(e.target) && !flowerResults.contains(e.target)) {
        flowerResults.style.display = 'none';
      }
    });

    // ── Row Keyboard Navigation ──
    flowerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (flowerResults.style.display === 'none' || flowerResults.innerHTML === '') {
           wInp.focus();
        }
      }
    });

    wInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        pInp.focus();
      }
    });

    pInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addItemBtn.click();
        setTimeout(() => flowerInput.focus(), 10);
      }
    });

    // ── Batch Management ──
    addItemBtn.addEventListener('click', () => {
      const flower = flowerInput.value;
      const weight = parseFloat(wInp.value);
      const price = parseFloat(pInp.value);
      if (!flower || isNaN(weight) || isNaN(price)) return alert('Please fill all item fields!');

      currentBatch.push({ name: flower, weight, price, total: weight * price });
      renderBatchTable();
      flowerInput.value = ''; wInp.value = ''; pInp.value = '';
    });

    submitBtn.addEventListener('click', () => {
      const cid = custIdHidden.value;
      const date = _container.querySelector('#s-date').value;
      if (!cid || !currentBatch.length) return alert('Select a customer and add items!');

      const cust = custs.find(c => c.id === cid);
      const total = currentBatch.reduce((s, i) => s + i.total, 0);
      
      const sale = {
        invNo: 'INV-' + Date.now().toString().slice(-6),
        date,
        customerId: cid,
        customerName: cust.name,
        customerContact: cust.contact,
        items: currentBatch,
        total: total.toFixed(2),
        paid: false
      };

      sales.push(sale);
      updateCustomerLedger(sale);
      saveData();
      currentBatch = [];
      alert('Sales submitted successfully!');
      renderPage();
    });

    _container.querySelector('#s-print').addEventListener('click', () => {
       if (!currentBatch.length) return alert('Add items to print preview!');
       // Quick Print Summary
       window.print();
    });

    _container.querySelector('#s-whatsapp').addEventListener('click', () => {
       if (!custIdHidden.value || !currentBatch.length) return alert('Please select a customer and add items first!');
       const cust = custs.find(c => c.id === custIdHidden.value);
       const total = currentBatch.reduce((s, i) => s + i.total, 0);
       let itemsText = currentBatch.map(i => `${i.name} (${i.weight} @ ₹${i.price})`).join('%0A');
       const text = `🌸 *New Sale - Bill Summary*%0A---------------------------%0AHello *${cust.name}*,%0AYour total bill is *₹${total.toFixed(2)}*%0A%0A*Items:*%0A${itemsText}%0A%0APowered by Sakura Market`;
       window.open(`https://wa.me/91${cust.contact}?text=${text}`, '_blank');
    });

  }

  function renderBatchTable() {
    const body = _container.querySelector('#s-batch-body');
    const totalQty = _container.querySelector('#s-total-qty');
    const grandTotal = _container.querySelector('#s-grand-total');
    
    if (!currentBatch.length) {
      body.innerHTML = `<tr><td colspan="4" style="padding:30px; text-align:center; color:#94a3b8; font-style:italic;">${App.i18n.t('noItemsAdded')}</td></tr>`;
      totalQty.textContent = '0.00';
      grandTotal.textContent = '₹0.00';
      return;
    }

    body.innerHTML = currentBatch.map((i, idx) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 15px; font-weight: 600; color: #334155;">${App.i18n.t(i.name.toLowerCase()) || i.name}</td>
        <td style="padding: 12px 15px; color: #475569; text-align: center;">${i.weight} <span style="font-size:0.75rem; color:#94a3b8;">@ ₹${i.price.toFixed(2)}</span></td>
        <td style="padding: 12px 15px; font-weight: bold; color: #1e8a4a; text-align: right;">₹${i.total.toFixed(2)}</td>
        <td style="padding: 12px 15px; text-align: right;">
          <button class="s-del-row" data-idx="${idx}" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; filter: grayscale(1);">🗑️</button>
        </td>
      </tr>
    `).join('');

    body.querySelectorAll('.s-del-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentBatch.splice(e.target.dataset.idx, 1);
        renderBatchTable();
      });
    });

    const total = currentBatch.reduce((s, i) => s + i.total, 0);
    const weightSum = currentBatch.reduce((s, i) => s + i.weight, 0);
    totalQty.textContent = weightSum.toFixed(2);
    grandTotal.textContent = `₹${total.toFixed(2)}`;
    _container.querySelector('#s-item-count').textContent = `${currentBatch.length} Items`;
  }

  function downloadBatchCSV() {
    if (!currentBatch.length) return alert('No items to export.');
    const headers = ['Flower Name', 'Weight', 'Price', 'Total'];
    const rows = currentBatch.map(i => [i.name, i.weight, i.price, i.total.toFixed(2)]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Sales_Entry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
  }

  function updateCustomerLedger(sale) {
    const custs = JSON.parse(sessionStorage.getItem(`customers_${tenantId}`) || '[]');
    const idx = custs.findIndex(c => c.id === sale.customerId);
    if (idx > -1) {
      if (!custs[idx].ledger) custs[idx].ledger = [];
      custs[idx].ledger.push({
        date: sale.date,
        description: `Sales: ${sale.invNo}`,
        debit: sale.total,
        credit: 0
      });
      sessionStorage.setItem(`customers_${tenantId}`, JSON.stringify(custs));
    }
  }

  return { init };
})();

window.SalesModule = SalesModule;
