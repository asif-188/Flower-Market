// ==========================================
// FLOWER MARKET BILLING - CORE APP
// Multi-Tenant | Light Green Theme | Keyboard Nav
// ==========================================

const App = (() => {

  // ── Multi-Tenant Database ──────────────────────────────────────────────────
  const DB = {
    tenants: {
      shop001: {
        id: 'shop001', name: 'Sakura Flower Market', logo: '🌸',
        username: 'sakura', password: 'shop123',
        data: { farmers: [], sales: [], expenses: [], purchases: [] }
      },
      shop002: {
        id: 'shop002', name: 'Lotus Flower Hub', logo: '🪷',
        username: 'lotus', password: 'shop456',
        data: { farmers: [], sales: [], expenses: [], purchases: [] }
      },
      shop003: {
        id: 'shop003', name: 'Yuki Bloom Store', logo: '🌷',
        username: 'yuki', password: 'shop789',
        data: { farmers: [], sales: [], expenses: [], purchases: [] }
      }
    },
    currentTenant: null, currentUser: null,
    getTenantData(key) {
      if (!this.currentTenant) return null;
      return this.tenants[this.currentTenant].data[key];
    },
    authenticate(username, password) {
      for (const id in this.tenants) {
        const t = this.tenants[id];
        if (t.username === username && t.password === password) {
          this.currentTenant = id;
          this.currentUser = { username, tenantId: id, tenantName: t.name, logo: t.logo };
          // Persist session
          sessionStorage.setItem('fmb_session', JSON.stringify(this.currentUser));
          return true;
        }
      }
      return false;
    },
    logout() {
      this.currentTenant = null;
      this.currentUser = null;
      sessionStorage.removeItem('fmb_session');
      sessionStorage.removeItem('fmb_page');
    },
    restoreSession() {
      try {
        const saved = sessionStorage.getItem('fmb_session');
        if (saved) {
          this.currentUser = JSON.parse(saved);
          this.currentTenant = this.currentUser.tenantId;
          return true;
        }
      } catch(e) {}
      return false;
    }
  };

  // ── Language / i18n ───────────────────────────────────────────────────────
  const i18n = {
    lang: 'en',
    strings: {
      en: {
        login: 'Login', username: 'Username', password: 'Password',
        farmer: 'Farmer', sales: 'Sales', exit: 'Exit / Logout',
        addFarmer: 'Farmer', absentFarmer: 'Absent Farmer',
        flower: 'Flower', purchase: 'Purchase', cashPay: 'Cash Pay',
        expenses: 'Expenses', dayAccount: 'Day Account', monthAccount: 'Month Account',
        customer: 'Customer', cashReceive: 'Cash Receive',
        customerReport: 'Customer Report', back: 'BACK',
        welcome: 'Welcome', invalidCreds: 'Invalid credentials. Please try again.',
        loginTitle: 'Flower Market Billing', loginSubtitle: 'Manage your floral empire',
        selectLanguage: 'Language', comingSoon: 'Feature coming soon!',
        tenantHint: 'Hint: Try sakura/shop123, lotus/shop456, yuki/shop789',
        keyNav: '↑↓ Navigate  •  Enter Select  •  Esc Back',
        // Shared
        template: 'Template', import: 'Import', addNew: 'Add New',
        search: 'Search', searchHint: 'Search by name or ID...',
        total: 'Total', shown: 'Shown', totalDue: 'Total Due',
        id: 'ID', name: 'Name', contact: 'Contact', location: 'Location',
        amountDue: 'Amount Due (₹)',
        status: 'Status', actions: 'Actions', view: 'View', edit: 'Edit', delete: 'Delete',
        cancel: 'Cancel', save: 'Save', close: 'Close', register: 'Register', update: 'Update',
        date: 'Date', ledger: 'Ledger', initialDues: 'Initial Dues (₹)',
        // Module Specific
        farmerMgmt: 'Farmer Management', absentMgmt: 'Absent Farmer',
        flowerMgmt: 'Flower Management', communication: 'Communication',
        absent: 'Absent', viewRange: 'Viewing range',
        // Farmer Specific
        addFarmerBtn: '+ Add Farmer',
        farmerNameReq: 'Farmer Name is required.',
        contactNumReq: 'Contact Number is required.',
        farmerIdReq: 'Farmer ID is required.',
        farmerIdExists: 'Farmer ID already exists.',
        deleteConfirm: 'Are you sure you want to delete',
        deleteActionUndone: 'This action cannot be undone.',
        yesDelete: 'Yes, Delete', updateFarmer: 'Update Farmer', registerFarmer: 'Register Farmer',
        placeholderName: 'Full name', placeholderMobile: 'Mobile number', placeholderLocation: 'City / Village',
        placeholderAuto: 'Auto-generated',
        // Purchase / Sales
        purchase: 'Purchase', addPurchase: 'Add Purchase', qty: 'Qty', rate: 'Rate', total: 'Total',
        netAmount: 'Total',
        noPurchases: 'No purchases found today.', newPurchaseEntry: 'New Purchase Entry',
        selectFarmer: 'Select Farmer', selectFlower: 'Select Flower', savePurchase: 'Save Purchase',
        customerMaster: 'Customer Master', addCustomer: 'Add Customer', creditLimit: 'Credit Limit', currentDues: 'Current Dues',
        invNo: 'Inv #', totalAmount: 'Total Amount', noSales: 'No sales recorded.', generateInvoice: 'Generate Invoice',
        batchId: 'Batch ID', flowerType: 'Flower Type', totalFlowerCost: 'Total Flower Cost', outstanding: 'Outstanding', balanceAmount: 'Balance Amount',
        directCustomer: 'Direct Customer', saleDate: 'Sale Date', flowerVariety: 'Flower Variety', weightQty: 'Weight / Qty', submitSales: 'Submit Sales',
        noItemsAdded: 'No items added yet.', fillAllFields: 'Please fill all item fields!', fillRequiredFields: 'Please select a farmer and add at least one item.',
        noFlowers: "No flowers found. Click 'Add Flower' to start!", flowerExists: '⚠️ This flower name already exists!',
        allPresent: 'All farmers are present for this chosen range!', noAbsentFound: 'No absent farmers found to message.',
        addExpense: 'Add Expense', expenseType: 'Expense Type', amount: 'Amount', notes: 'Notes', recordExpense: 'Record Expense', noExpenses: 'No expenses recorded.',
        typeRent: 'Rent', typeElectricity: 'Electricity', typeTea: 'Tea/Snacks', typeTransport: 'Transport', typeLabour: 'Labour', typeStationary: 'Stationary', typeOther: 'Other',
        amountPaid: 'Amount Paid', noPaymentsMade: 'No payments made recently.', newCashPayment: 'New Cash Payment', savePayment: 'Save Payment', addPayment: 'Add Payment',
        dayAccountTitle: 'Day Account', monthAccountTitle: 'Month Account', filterDate: 'Filter Date', totalPurchase: 'Total Purchase', cashPaid: 'Cash Paid', netBalance: 'Net Balance', detailedEntries: 'Detailed Entries', debit: 'Debit', credit: 'Credit', noTransactions: 'No transactions for this date.',
        selectMonth: 'Select Month', print: 'Print', download: 'Download', monthFarmerReport: 'Month-wise Farmer Report', sNo: 'S.No', noTransactionsMonth: 'No transaction data found for this month.',
        // Common Flowers
        rose: 'Rose', jasmine: 'Jasmine', marigold: 'Marigold', crossandra: 'Crossandra', nerium: 'Nerium', lilly: 'Lilly', lotus: 'Lotus', sampangi: 'Sampangi', mullai: 'Mullai', jathimalli: 'Jathi Malli',
        // Common Locations
        salem: 'Salem', villupuram: 'Villupuram', dharmapuri: 'Dharmapuri', krishnagiri: 'Krishnagiri', erode: 'Erode', namakkal: 'Namakkal', trichy: 'Trichy', madurai: 'Madurai', coimbatore: 'Coimbatore', chennai: 'Chennai',
        // Date Presets
        today: 'Today', thisWeek: 'This Week', thisMonth: 'This Month', lastMonth: 'Last Month', thisYear: 'This Year', customDate: 'Custom Date'
      },
      ta: {
        login: 'உள்நுழை', username: 'பயனர்பெயர்', password: 'கடவுச்சொல்',
        farmer: 'விவசாயி', sales: 'விற்பனை', exit: 'வெளியேறு',
        addFarmer: 'விவசாயி', absentFarmer: 'வராத விவசாயி',
        flower: 'பூ', purchase: 'கொள்முதல்', cashPay: 'பண கட்டணம்',
        expenses: 'செலவுகள்', dayAccount: 'நாள் கணக்கு', monthAccount: 'மாத கணக்கு',
        customer: 'வாடிக்கையாளர்', cashReceive: 'பண முறை',
        customerReport: 'வாடிக்கையாளர் அறிக்கை', back: 'பின்செல்',
        welcome: 'வரவேற்கிறோம்', invalidCreds: 'தவறான நற்சான்றிதழ்கள். மீண்டும் முயற்சிக்கவும்.',
        loginTitle: 'பூக்கடை பில்லிங்', loginSubtitle: 'உங்கள் பூ வணிகத்தை நிர்வகிக்கவும்',
        selectLanguage: 'மொழி', comingSoon: 'விரைவில் வரும்!',
        tenantHint: 'குறிப்பு: sakura/shop123, lotus/shop456, yuki/shop789 முயற்சிக்கவும்',
        keyNav: '↑↓ நகர்வு  •  Enter தேர்வு  •  Esc திரும்பு',
        // Shared
        template: 'மாதிரி', import: 'இறக்குமதி', addNew: 'புதியதைச் சேர்',
        search: 'தேடு', searchHint: 'பெயர் அல்லது ஐடி மூலம் தேடு...',
        total: 'மொத்தம்', shown: 'காட்டப்படுவது', totalDue: 'மொத்த நிலுவை',
        id: 'ஐடி', name: 'பெயர்', contact: 'தொடர்பு', location: 'இடம்',
        amountDue: 'நிலுவைத் தொகை (₹)',
        status: 'நிலை', actions: 'செயல்கள்', view: 'காண்க', edit: 'திருத்து', delete: 'அழி',
        cancel: 'ரத்து செய்', save: 'சேமி', close: 'மூடு', register: 'பதிவு செய்', update: 'புதுப்பி',
        date: 'தேதி', ledger: 'பேரேடு', initialDues: 'ஆரம்ப நிலுவை (₹)',
        // Module Specific
        farmerMgmt: 'விவசாயி மேலாண்மை', absentMgmt: 'வராத விவசாயி',
        flowerMgmt: 'பூக்கள் மேலாண்மை', communication: 'தொடர்பு',
        absent: 'இல்லை', viewRange: 'பார்க்கும் காலம்',
        // Farmer Specific
        addFarmerBtn: '+ விவசாயியைச் சேர்',
        farmerNameReq: 'விவசாயி பெயர் தேவை.',
        contactNumReq: 'தொடர்பு எண் தேவை.',
        farmerIdReq: 'விவசாயி ஐடி தேவை.',
        farmerIdExists: 'விவசாயி ஐடி ஏற்கனவே உள்ளது.',
        deleteConfirm: 'நிச்சயமாக நீங்கள் அழிக்க விரும்புகிறீர்களா?',
        deleteActionUndone: 'இந்த செயலை மாற்ற முடியாது.',
        yesDelete: 'ஆம், அழி', updateFarmer: 'விவசாயியைப் புதுப்பி', registerFarmer: 'விவசாயியைப் பதிவு செய்',
        placeholderName: 'முழு பெயர்', placeholderMobile: 'கைபேசி எண்', placeholderLocation: 'நகரம் / கிராமம்',
        placeholderAuto: 'தானாக உருவானது',
        // Purchase / Sales
        purchase: 'கொள்முதல்', addPurchase: 'கொள்முதலைச் சேர்', qty: 'அளவு', rate: 'விலை', total: 'மொத்தம்',
        netAmount: 'மொத்தம்',
        noPurchases: 'இன்று கொள்முதல் ஏதும் இல்லை.', newPurchaseEntry: 'புதிய கொள்முதல் பதிவு',
        selectFarmer: 'விவசாயியைத் தேர்ந்தெடுக்கவும்', selectFlower: 'பூவைத் தேர்ந்தெடுக்கவும்', savePurchase: 'கொள்முதலைச் சேமி',
        customerMaster: 'வாடிக்கையாளர் பட்டியல்', addCustomer: 'வாடிக்கையாளரைச் சேர்', creditLimit: 'கடன் வரம்பு', currentDues: 'நடப்பு நிலுவை',
        invNo: 'விலைப்பட்டியல் எண்', totalAmount: 'மொத்த தொகை', noSales: 'விற்பனை ஏதும் இல்லை.', generateInvoice: 'விலைப்பட்டியல் உருவாக்கு',
        batchId: 'தொகுப்பு ஐடி', flowerType: 'பூ வகை', totalFlowerCost: 'மொத்த பூ செலவு', outstanding: 'நிலுவை', balanceAmount: 'நிச்சய நிலுவைத் தொகை',
        directCustomer: 'நேரடி வாடிக்கையாளர்', saleDate: 'விற்பனை தேதி', flowerVariety: 'மலர் வகை', weightQty: 'எடை / அளவு', submitSales: 'விற்பனையைச் சமர்ப்பிக்கவும்',
        noItemsAdded: 'இன்னும் உருப்படிகள் எதுவும் சேர்க்கப்படவில்லை.', fillAllFields: 'தயவுசெய்து அனைத்து பொருட்களையும் நிரப்பவும்!', fillRequiredFields: 'தயவுசெய்து ஒரு விவசாயியைத் தேர்ந்தெடுத்து குறைந்தபட்சம் ஒரு பொருளைச் சேர்க்கவும்.',
        noFlowers: 'பூக்கள் எதுவும் இல்லை. தொடங்க "புதியதைச் சேர்" என்பதைக் கிளிக் செய்யவும்!', flowerExists: '⚠️ இந்தப் பூ ஏற்கனவே உள்ளது!',
        allPresent: 'தேர்ந்தெடுக்கப்பட்ட காலப்பகுதியில் அனைத்து விவசாயிகளும் வந்துள்ளனர்!', noAbsentFound: 'செய்தி அனுப்ப வராத விவசாயிகள் யாரும் இல்லை.',
        addExpense: 'செலவுச் சேர்', expenseType: 'செலவு வகை', amount: 'தொகை', notes: 'குறிப்புகள்', recordExpense: 'செலவைப் பதிவு செய்', noExpenses: 'செலவுகள் எதுவும் பதிவு செய்யப்படவில்லை.',
        typeRent: 'வாடகை', typeElectricity: 'மின்சாரம்', typeTea: 'தேநீர்/சிற்றுண்டி', typeTransport: 'போக்குவரத்து', typeLabour: 'கூலி', typeStationary: 'எழுதுபொருட்கள்', typeOther: 'மற்றவை',
        amountPaid: 'செலுத்தப்பட்ட தொகை', noPaymentsMade: 'சமீபத்தில் எந்தக் கொடுப்பனவுகளும் செய்யப்படவில்லை.', newCashPayment: 'புதிய பணப் பட்டுவாடா', savePayment: 'கொடுப்பனவைச் சேமி', addPayment: 'கொடுப்பனவைச் சேர்',
        dayAccountTitle: 'நாள் கணக்கு', monthAccountTitle: 'மாத கணக்கு', filterDate: 'தேதியை வடிகட்டு', totalPurchase: 'மொத்த கொள்முதல்', cashPaid: 'பணம் செலுத்தப்பட்டது', netBalance: 'நிகர நிலுவை', detailedEntries: 'விரிவான பதிவுகள்', debit: 'பற்று', credit: 'வரவு', noTransactions: 'இந்தத் தேதியில் பரிவர்த்தனைகள் இல்லை.',
        selectMonth: 'மாதத்தைத் தேர்ந்தெடுக்கவும்', print: 'அச்சிடுக', download: 'பதிவிறக்கம்', monthFarmerReport: 'மாதாந்திர விவசாயி அறிக்கை', sNo: 'வ.எண்', noTransactionsMonth: 'இந்த மாதத்தில் பரிவர்த்தனை தரவு எதுவும் இல்லை.',
        // Common Flowers
        rose: 'ரோஜா', jasmine: 'மல்லிகை', marigold: 'சாமந்தி', crossandra: 'கனகாம்பரம்', nerium: 'அரளி', lilly: 'அல்லி', lotus: 'தாமரை', sampangi: 'சம்பங்கி', mullai: 'முல்லை', jathimalli: 'ஜாதி மல்லி',
        // Common Locations
        salem: 'சேலம்', villupuram: 'விழுப்புரம்', dharmapuri: 'தர்மபுரி', krishnagiri: 'கிருஷ்ணகிரி', erode: 'ஈரோடு', namakkal: 'நாமக்கல்', trichy: 'திருச்சி', madurai: 'மதுரை', coimbatore: 'கோயம்புத்தூர்', chennai: 'சென்னை',
        // Date Presets
        today: 'இன்று', thisWeek: 'இந்த வாரம்', thisMonth: 'இந்த மாதம்', lastMonth: 'கடந்த மாதம்', thisYear: 'இந்த ஆண்டு', customDate: 'குறிப்பிட்ட தேதி'
      }
    },
    t(key) { return this.strings[this.lang][key] || key; },
    setLang(l) { this.lang = l; }
  };

  // ── Router / State ─────────────────────────────────────────────────────────
  let currentPage = 'login';
  let focusIndex = 0;

  function navigate(page) {
    currentPage = page;
    focusIndex = 0;
    // Persist current page (only save authenticated pages)
    if (page !== 'login') {
      sessionStorage.setItem('fmb_page', page);
    } else {
      sessionStorage.removeItem('fmb_page');
    }
    render();
  }

  // ── Render Engine ──────────────────────────────────────────────────────────
  function render() {
    const root = document.getElementById('app');
    root.innerHTML = '';
    switch (currentPage) {
      case 'login':  root.appendChild(renderLogin());  break;
      case 'main':   root.appendChild(renderMain());   break;
      case 'farmer': root.appendChild(renderFarmer()); break;
      case 'sales':  root.appendChild(renderSales());  break;
      default:       root.appendChild(renderLogin());
    }
    // Entrance animation
    requestAnimationFrame(() => {
      const page = root.firstChild;
      if (page) {
        page.style.opacity = '0';
        page.style.transform = 'translateY(18px)';
        requestAnimationFrame(() => {
          page.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
          page.style.opacity = '1';
          page.style.transform = 'translateY(0)';
        });
      }
    });
  }

  // ── Language Selector ──────────────────────────────────────────────────────
  function renderLangSelector() {
    const wrap = el('div', 'lang-selector-wrap');
    const label = el('span', 'lang-label', '🌐 ' + i18n.t('selectLanguage') + ':');
    const sel = document.createElement('select');
    sel.className = 'lang-select';
    sel.setAttribute('aria-label', 'Select Language');
    sel.innerHTML = `<option value="en" ${i18n.lang === 'en' ? 'selected' : ''}>English</option>
                     <option value="ta" ${i18n.lang === 'ta' ? 'selected' : ''}>தமிழ்</option>`;
    sel.addEventListener('change', e => { i18n.setLang(e.target.value); render(); });
    wrap.appendChild(label); wrap.appendChild(sel);
    return wrap;
  }

  // ── Petals ─────────────────────────────────────────────────────────────────
  function addPetals(container) {
    const emojis = ['🌿', '🌱', '🍃', '🌾', '🌻', '🌼', '🌸'];
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('div');
      p.className = 'petal';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.left = Math.random() * 100 + 'vw';
      p.style.animationDuration = (5 + Math.random() * 7) + 's';
      p.style.animationDelay = (Math.random() * 9) + 's';
      p.style.fontSize = (14 + Math.random() * 16) + 'px';
      p.style.opacity = 0.4 + Math.random() * 0.4;
      container.appendChild(p);
    }
  }



  // ── LOGIN PAGE ─────────────────────────────────────────────────────────────
  function renderLogin() {
    const page = el('div', 'page page-login');
    addPetals(page);

    const card = el('div', 'login-card glass-card');
    const logoWrap = el('div', 'login-logo-wrap');
    logoWrap.innerHTML = `<div class="login-logo-icon">🌿</div>
      <h1 class="login-title">${i18n.t('loginTitle')}</h1>
      <p class="login-subtitle">${i18n.t('loginSubtitle')}</p>`;
    card.appendChild(logoWrap);

    const form = document.createElement('form');
    form.className = 'login-form';
    form.setAttribute('id', 'login-form');
    form.innerHTML = `
      <div class="field-group">
        <span class="field-icon">👤</span>
        <input id="inp-user" type="text" class="field-input" placeholder="${i18n.t('username')}" autocomplete="off" aria-label="${i18n.t('username')}" />
      </div>
      <div class="field-group">
        <span class="field-icon">🔒</span>
        <input id="inp-pass" type="password" class="field-input" placeholder="${i18n.t('password')}" aria-label="${i18n.t('password')}" />
      </div>
      <div id="login-error" class="login-error hidden"></div>
      <button id="login-btn" type="submit" class="btn-primary btn-full ripple">
        <span class="btn-icon">✨</span> ${i18n.t('login')}
      </button>
      <p class="hint-text">${i18n.t('tenantHint')}</p>
    `;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const u = document.getElementById('inp-user').value.trim();
      const p = document.getElementById('inp-pass').value.trim();
      if (DB.authenticate(u, p)) {
        navigate('main');
      } else {
        const err = document.getElementById('login-error');
        err.textContent = i18n.t('invalidCreds');
        err.classList.remove('hidden');
        err.classList.add('shake');
        setTimeout(() => err.classList.remove('shake'), 600);
      }
    });
    card.appendChild(form);

    const langWrap = el('div', 'login-lang');
    langWrap.appendChild(renderLangSelector());
    card.appendChild(langWrap);

    page.appendChild(card);

    // ── Login Keyboard Nav ──
    // Tab naturally works. Enter on button submits. Arrow keys move between fields.
    setTimeout(() => {
      const userInput = document.getElementById('inp-user');
      if (userInput) userInput.focus();

      page.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const inputs = ['inp-user', 'inp-pass', 'login-btn'];
          const cur = document.activeElement?.id;
          const idx = inputs.indexOf(cur);
          const next = document.getElementById(inputs[Math.min(idx + 1, inputs.length - 1)]);
          if (next) next.focus();
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const inputs = ['inp-user', 'inp-pass', 'login-btn'];
          const cur = document.activeElement?.id;
          const idx = inputs.indexOf(cur);
          const prev = document.getElementById(inputs[Math.max(idx - 1, 0)]);
          if (prev) prev.focus();
        }
      });
    }, 100);

    return page;
  }

  // ── MAIN MENU ──────────────────────────────────────────────────────────────
  function renderMain() {
    const page = el('div', 'page page-main');
    addPetals(page);

    // Top Bar
    const topBar = el('div', 'top-bar glass');
    const tenantInfo = el('div', 'tenant-info');
    tenantInfo.innerHTML = `<span class="tenant-logo">${DB.currentUser.logo}</span>
      <div><div class="tenant-name">${DB.currentUser.tenantName}</div>
      <div class="tenant-user">@${DB.currentUser.username}</div></div>`;
    topBar.appendChild(tenantInfo);
    const topRight = el('div', 'top-right');
    topRight.appendChild(renderLangSelector());
    topBar.appendChild(topRight);
    page.appendChild(topBar);

    // Center buttons
    const center = el('div', 'main-center');
    const welcomeTitle = el('div', 'main-welcome-title');
    welcomeTitle.innerHTML = `<span class="welcome-emoji">🌿</span> ${i18n.t('welcome')}, ${DB.currentUser.tenantName}!`;
    center.appendChild(welcomeTitle);

    const mainBtns = el('div', 'main-buttons');
    const farmerBtn = makeMenuBtn('👨‍🌾', i18n.t('farmer'), 'btn-farmer', 'main-btn-farmer', () => navigate('farmer'));
    const salesBtn  = makeMenuBtn('🧾', i18n.t('sales'),  'btn-sales',  'main-btn-sales',  () => navigate('sales'));

    mainBtns.appendChild(farmerBtn);
    mainBtns.appendChild(salesBtn);
    center.appendChild(mainBtns);
    page.appendChild(center);

    // Bottom row: Exit + key hint
    const bottomBar = el('div', 'bottom-bar');
    const exitBtn = document.createElement('button');
    exitBtn.className = 'btn-exit ripple'; exitBtn.id = 'main-btn-exit';
    exitBtn.innerHTML = `<span>🚪</span> ${i18n.t('exit')}`;
    exitBtn.addEventListener('click', () => { DB.logout(); navigate('login'); });
    bottomBar.appendChild(exitBtn);
    page.appendChild(bottomBar);

    // ── Main Menu Keyboard Nav ──
    const btnIds = ['main-btn-farmer', 'main-btn-sales', 'main-btn-exit'];
    setTimeout(() => {
      document.getElementById(btnIds[focusIndex])?.focus();
      page.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          focusIndex = (focusIndex + 1) % btnIds.length;
          document.getElementById(btnIds[focusIndex])?.focus();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          focusIndex = (focusIndex - 1 + btnIds.length) % btnIds.length;
          document.getElementById(btnIds[focusIndex])?.focus();
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          document.getElementById(btnIds[focusIndex])?.click();
        }
        if (e.key === 'F' || e.key === 'f') navigate('farmer');
        if (e.key === 'S' || e.key === 's') navigate('sales');
      });
    }, 100);

    return page;
  }

  // ── FARMER SECTION ─────────────────────────────────────────────────────────
  function renderFarmer() {
    return renderSectionPage('farmer', [
      { icon: '👨‍🌾', key: 'addFarmer' },
      { icon: '📋', key: 'absentFarmer' },
      { icon: '🌸', key: 'flower' },
      { icon: '🛒', key: 'purchase' },
      { icon: '💵', key: 'cashPay' },
      { icon: '📊', key: 'expenses' },
      { icon: '📅', key: 'dayAccount' },
      { icon: '📆', key: 'monthAccount' },
    ], '🌿', i18n.t('farmer'));
  }

  // ── SALES SECTION ── (no "Back" item in sidebar — only top bar has it) ─────
  function renderSales() {
    return renderSectionPage('sales', [
      { icon: '🧑‍💼', key: 'customer' },
      { icon: '💰', key: 'cashReceive' },
      { icon: '🧾', key: 'sales' },
      { icon: '📈', key: 'customerReport' },
    ], '💐', i18n.t('sales'));
  }

  // ── Generic Section Page ───────────────────────────────────────────────────
  function renderSectionPage(section, items, emoji, title) {
    const page = el('div', 'page page-section');
    addPetals(page);

    let isDashboard = true; // Start with the Dashboard Grid

    function renderActiveLayout() {
      page.innerHTML = '';
      addPetals(page);

      // Top bar
      const topBar = el('div', 'top-bar glass');
      const backBtn = document.createElement('button');
      backBtn.className = 'btn-back ripple'; 
      backBtn.id = 'sec-back-btn';
      
      if (isDashboard) {
        backBtn.innerHTML = `← ${i18n.t('back')}`;
        backBtn.addEventListener('click', () => navigate('main'));
      } else {
        backBtn.innerHTML = `← ${i18n.t('back')}`;
        backBtn.addEventListener('click', () => { isDashboard = true; renderActiveLayout(); });
      }
      
      topBar.appendChild(backBtn);
      const pageTitle = el('div', 'section-page-title');
      pageTitle.innerHTML = `${emoji} ${title}${isDashboard ? '' : ' — ' + (i18n.t(items[activeSidebarIdx].key) || items[activeSidebarIdx].key)}`;
      topBar.appendChild(pageTitle);
      const topRight = el('div', 'top-right');
      const versionTag = el('span', 'version-tag', 'v2.7');
      topRight.appendChild(versionTag);
      topRight.appendChild(renderLangSelector());
      topBar.appendChild(topRight);
      page.appendChild(topBar);

      if (isDashboard) {
        renderDashboard();
      } else {
        renderFullLayout();
      }
    }

    function renderDashboard() {
      const grid = el('div', 'fm-dashboard-grid');
      items.forEach((item, idx) => {
        const card = el('div', 'fm-dashboard-card ripple');
        card.setAttribute('tabindex', idx === activeSidebarIdx ? '0' : '-1');
        card.dataset.idx = idx;

        const themes = ['card-theme-green', 'card-theme-purple', 'card-theme-blue', 'card-theme-orange', 'card-theme-red'];
        const theme = themes[idx % themes.length];
        if (theme) card.classList.add(theme);

        card.innerHTML = `
          <div class="card-icon">${item.icon}</div>
          <div class="card-label">${i18n.t(item.key) || item.key}</div>
        `;
        card.addEventListener('click', () => {
          activeSidebarIdx = idx;
          isDashboard = false;
          renderActiveLayout();
        });
        grid.appendChild(card);
      });
      page.appendChild(grid);

      // Focus management
      setTimeout(() => {
        grid.querySelectorAll('.fm-dashboard-card')[activeSidebarIdx]?.focus();
      }, 100);
    }

    function renderFullLayout() {
      const layout = el('div', 'section-layout layout-focused');

      // Content Panel
      const content = el('div', 'content-panel glass-card');
      content.id = 'content-panel';
      updateContentPanel(items[activeSidebarIdx], content);
      layout.appendChild(content);

      page.appendChild(layout);

      // Focus management
      setTimeout(() => {
        document.getElementById('content-panel')?.focus();
      }, 100);
    }

    // ── Section Keyboard Nav ──
    page.addEventListener('keydown', e => {
      const isCard = document.activeElement?.classList.contains('fm-dashboard-card');

      if (e.key === 'Escape') {
        if (!isDashboard) {
           isDashboard = true;
           renderActiveLayout();
        } else {
           navigate('main');
        }
        return;
      }

      // Numeric shortcuts 1-8 (Ignore if user is typing in an input)
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      const num = parseInt(e.key);
      if (!isInput && !isNaN(num) && num >= 1 && num <= items.length) {
        e.preventDefault();
        activeSidebarIdx = num - 1;
        isDashboard = false;
        renderActiveLayout();
        return;
      }

      if (isDashboard && isCard) {
        // Dashboard arrows
        const cols = window.innerWidth > 1000 ? 3 : window.innerWidth > 600 ? 2 : 1;
        let next = activeSidebarIdx;
        if (e.key === 'ArrowRight') next = Math.min(items.length - 1, activeSidebarIdx + 1);
        if (e.key === 'ArrowLeft')  next = Math.max(0, activeSidebarIdx - 1);
        if (e.key === 'ArrowDown')  next = Math.min(items.length - 1, activeSidebarIdx + cols);
        if (e.key === 'ArrowUp')    next = Math.max(0, activeSidebarIdx - cols);
        
        if (next !== activeSidebarIdx) {
          e.preventDefault();
          activeSidebarIdx = next;
          const cards = page.querySelectorAll('.fm-dashboard-card');
          cards.forEach((c, i) => c.setAttribute('tabindex', i === next ? '0' : '-1'));
          cards[next]?.focus();
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          isDashboard = false;
          renderActiveLayout();
        }
      }
    });

    let activeSidebarIdx = 0;
    renderActiveLayout();

    return page;
  }


  function updateContentPanel(item, panel) {
    const cp = panel || document.getElementById('content-panel');
    if (!cp) return;

    // ── Route Farmer module ──
    if (currentPage === 'farmer') {
      if (item.key === 'addFarmer')      { FarmerModule.render(cp, DB); return; }
      if (item.key === 'absentFarmer')   { AbsentFarmerModule.init(cp, DB); return; }
      if (item.key === 'flower')         { FlowerModule.init(cp, DB); return; }
      if (item.key === 'purchase')       { PurchaseModule.init(cp, DB); return; }
      if (item.key === 'cashPay')        { CashPayModule.init(cp, DB); return; }
      if (item.key === 'expenses')       { ExpensesModule.init(cp, DB); return; }
      if (item.key === 'dayAccount')     { AccountsModule.init(cp, DB, 'day'); return; }
      if (item.key === 'monthAccount')   { AccountsModule.init(cp, DB, 'month'); return; }
    }

    // ── Route Sales module ──
    if (currentPage === 'sales') {
      if (item.key === 'customer')       { CustomerModule.init(cp, DB); return; }
      if (item.key === 'cashReceive')    { CashReceiveModule.init(cp, DB); return; }
      if (item.key === 'sales')          { SalesModule.init(cp, DB); return; }
      if (item.key === 'customerReport') { CustomerReportModule.init(cp, DB); return; }
      if (item.key === 'salesReport')    { SalesReportModule.init(cp, DB); return; }
    }

    // ── Default: Coming Soon ──
    cp.setAttribute('tabindex', '0');
    cp.innerHTML = `
      <div class="content-header">
        <div class="content-icon-lg">${item.icon}</div>
        <h2 class="content-title">${i18n.t(item.key) || item.key}</h2>
      </div>
      <div class="coming-soon-wrap">
        <div class="coming-soon-anime">
          <div class="anime-circle">🌿</div>
          <div class="anime-circle delay1">🌸</div>
          <div class="anime-circle delay2">🌼</div>
        </div>
        <p class="coming-soon-text">${i18n.t('comingSoon')}</p>
        <p class="coming-soon-sub">This feature is being crafted with ❤️</p>
      </div>`;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function el(tag, cls = '', text = '') {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function makeMenuBtn(icon, label, cls, id, onClick) {
    const btn = document.createElement('button');
    btn.className = `main-menu-btn ${cls} ripple`;
    btn.id = id;
    btn.innerHTML = `<span class="main-btn-icon">${icon}</span><span class="main-btn-label">${label}</span>`;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // Ripple effect
  document.addEventListener('click', e => {
    const btn = e.target.closest('.ripple');
    if (!btn) return;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    const rect = btn.getBoundingClientRect();
    ripple.style.left = (e.clientX - rect.left) + 'px';
    ripple.style.top  = (e.clientY - rect.top)  + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });

  function init() {
    // Restore session from sessionStorage on page load / refresh
    if (DB.restoreSession()) {
      const savedPage = sessionStorage.getItem('fmb_page') || 'main';
      currentPage = savedPage;
    }

    // Global Keyboard Handler
    window.addEventListener('keydown', e => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      
      // Global Search Shortcut (/ or F1) - if not typing in an input
      if (!isInput && (e.key === '/' || e.key === 'F1')) {
        e.preventDefault();
        const searchBox = document.querySelector('input[id*="search"], input[id*="rep-search"], input[id*="c-search"]');
        if (searchBox) searchBox.focus();
      }

      // Close Modals (Esc)
      if (e.key === 'Escape') {
        const modalOverlay = document.querySelector('.fm-overlay, .fm-modal-overlay');
        if (modalOverlay) modalOverlay.remove();
      }
    });

    render();
  }
  return { init, i18n };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
