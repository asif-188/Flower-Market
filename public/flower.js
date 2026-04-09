const FlowerModule = (() => {
  let flowers = [];
  let _container = null;
  let tenantId = '';
  let _db = null;

  function init(container, db) {
    _container = container;
    _db = db;
    tenantId = _db.currentTenant;
    loadData();
    renderPage();
  }

  function loadData() {
    const data = sessionStorage.getItem(`flowers_${tenantId}`);
    flowers = data ? JSON.parse(data) : [];
  }

  function saveData() {
    sessionStorage.setItem(`flowers_${tenantId}`, JSON.stringify(flowers));
    renderPage();
  }

  function renderPage() {
    _container.innerHTML = `
      <div class="fm-page-header">
        <h1 class="fm-title">🌼 <span>${App.i18n.t('flowerMgmt')}</span></h1>
        <button id="add-flower-btn" class="fm-btn-add">＋ ${App.i18n.t('addNew')}</button>
      </div>

      <div class="fm-card">
        <table class="fm-table">
          <thead>
            <tr>
              <th style="width: 80%">${App.i18n.t('name')}</th>
              <th style="text-align: right">${App.i18n.t('actions')}</th>
            </tr>
          </thead>
          <tbody id="flower-list">
            ${flowers.length === 0 ? `<tr><td colspan="2" class="fm-empty-state">${App.i18n.t('noFlowers')}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;

    const list = _container.querySelector('#flower-list');
    flowers.forEach((flower, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="fm-semi-bold">${App.i18n.t(flower.name.toLowerCase())}</td>
        <td style="text-align: right">
          <div class="fm-table-actions">
            <button class="fm-action-btn edit-btn" title="Edit">✏️</button>
            <button class="fm-action-btn delete-btn" title="Delete">🗑️</button>
          </div>
        </td>
      `;
      
      row.querySelector('.edit-btn').addEventListener('click', () => openModal(flower, index));
      row.querySelector('.delete-btn').addEventListener('click', () => confirmDelete(index));
      list.appendChild(row);
    });

    _container.querySelector('#add-flower-btn').addEventListener('click', () => openModal());
  }

  function openModal(flower = null, index = -1) {
    const isEdit = flower !== null;
    const overlay = document.createElement('div');
    overlay.className = 'fm-overlay';
    overlay.id = 'flower-modal-ov';
    overlay.innerHTML = `
      <div class="fm-modal" id="flower-modal">
        <div class="fm-modal-header">
          <div class="fm-ledger-header-info">
            <div class="fm-modal-title">${isEdit ? '✏️ ' + App.i18n.t('edit') + ' ' + App.i18n.t('flower') : '🌼 ' + App.i18n.t('addNew') + ' ' + App.i18n.t('flower')}</div>
          </div>
          <button class="fm-modal-close" id="flower-modal-close">✕ ${App.i18n.t('close')}</button>
        </div>
        <div class="fm-modal-body">
          <form class="fm-form" id="flower-form">
            <div class="fm-field">
              <label class="fm-label">${App.i18n.t('name')} <span class="fm-req">*</span></label>
              <input type="text" id="flower-inp-name" class="fm-input" placeholder="${App.i18n.t('placeholderName')}" value="${isEdit ? flower.name : ''}" required>
            </div>
            <div id="flower-form-err" class="fm-form-err hidden"></div>
          </form>
        </div>
        <div class="fm-modal-footer">
          <button type="button" class="fm-btn-secondary ripple" id="flower-modal-cancel">${App.i18n.t('cancel')}</button>
          <button type="button" class="fm-btn-add ripple" id="flower-modal-save">${isEdit ? App.i18n.t('update') : App.i18n.t('register')} ${App.i18n.t('flower')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    
    // Animation
    requestAnimationFrame(() => {
        overlay.classList.add('fm-ov-show');
        document.getElementById('flower-modal')?.classList.add('fm-modal-show');
    });

    const inp = document.getElementById('flower-inp-name');
    inp.focus();

    const close = () => {
        overlay.classList.remove('fm-ov-show');
        document.getElementById('flower-modal')?.classList.remove('fm-modal-show');
        setTimeout(() => overlay.remove(), 300);
    };

    document.getElementById('flower-modal-close').addEventListener('click', close);
    document.getElementById('flower-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    const save = () => {
      const name = inp.value.trim();
      if (!name) return;

      const exists = flowers.some((f, i) => f.name.toLowerCase() === name.toLowerCase() && i !== index);
      if (exists) {
        const err = document.getElementById('flower-form-err');
        err.textContent = App.i18n.t('flowerExists');
        err.classList.remove('hidden');
        return;
      }

      if (isEdit) {
        flowers[index].name = name;
      } else {
        flowers.push({ name, createdAt: new Date().toISOString().split('T')[0] });
      }

      saveData();
      close();
    };

    document.getElementById('flower-modal-save').addEventListener('click', save);
    document.getElementById('flower-form').addEventListener('submit', (e) => {
        e.preventDefault();
        save();
    });
  }

  function confirmDelete(index) {
    const flower = flowers[index];
    if (confirm(`${App.i18n.t('deleteConfirm')} "${flower.name}"?`)) {
      flowers.splice(index, 1);
      saveData();
    }
  }

  return { init };
})();
