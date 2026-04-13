import React, { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ChevronLeft, Globe, User } from 'lucide-react';
import Petals from './Petals';

// ── Language Context ──────────────────────────────────────────────────────────
export const LangContext = createContext({ lang: 'en', t: (k) => k });

const strings = {
  en: {
    back: 'Back',
    sales: 'Sales',
    customer: 'Customer',
    cashReceive: 'Cash Receive',
    salesEntry: 'Sales Entry',
    directSales: 'Direct Sales',
    reports: 'Customer Report',
    intake: 'Intake',
    farmer: 'Farmer',
    accounts: 'Accounts',
    buyer: 'Customer Master',
    language: 'Language',
    template: 'Template',
    import: 'Import',
    addCustomer: 'Add Customer',
    id: 'ID',
    name: 'Name',
    contact: 'Contact',
    amountDue: 'Amount Due (₹)',
    ledger: 'Ledger',
    actions: 'Actions',
    register: 'Register',
    cancel: 'Cancel',
    update: 'Update',
    initialDues: 'Initial Dues (₹)',
    search: 'Search by ID and Name...',
    noRecords: 'No records found.',
    view: 'View',
    cashReceive: 'Cash Receive',
    receivePayment: 'Receive Payment',
    date: 'Date',
    customerName: 'Customer Name',
    amountReceived: 'Amount Received',
    notes: 'Short Note',
    action: 'Action',
    givenAmount: 'Given Amount',
    closingBalance: 'Closing Balance',
    openingBalance: 'Opening Balance',
    selectCustomer: 'Select Customer',
    customerId: 'Cust ID',
    farmer: 'Farmer',
    customer: 'Customer',
    close: 'Close',
    newPurchaseEntry: 'New Sales Entry',
    saleDate: 'Sale Date',
    flowerVariety: 'Flower Variety',
    weightQty: 'Weight / Qty',
    rate: 'Rate',
    addNew: 'Add New',
    totalQuantity: 'Total Quantity',
    grandTotal: 'Grand Total',
    submitSales: 'Submit Sales',
    selectFlower: 'Select Flower',
    items: 'Items',
    noItemsYet: 'No items added yet.',
    billSavedSuccess: 'Bill Saved & Balance Updated!',
    billSaveFailed: 'Failed to save bill.',
    logSalesSubtext: 'Log details of flowers sold to customers.',
    currentBatchItems: 'Current Batch Items',
    flower: 'Flower',
    qty: 'Qty',
    total: 'Total',
    to: 'To',
    today: 'Today',
    month: 'Month',
    apply: 'Apply',
  },
  ta: {
    back: 'பின்',
    sales: 'விற்பனை',
    customer: 'வாடிக்கையாளர்',
    cashReceive: 'பண வரவு',
    salesEntry: 'விற்பனை பதிவு',
    directSales: 'நேரடி விற்பனை',
    reports: 'வாடிக்கையாளர் அறிக்கை',
    intake: 'உள்வருதல்',
    farmer: 'விவசாயி',
    accounts: 'கணக்குகள்',
    buyer: 'வாடிக்கையாளர் பட்டியல்',
    language: 'மொழி',
    template: 'மாதிரி',
    import: 'இறக்குமதி',
    addCustomer: 'வாடிக்கையாளரைச் சேர்',
    id: 'ஐடி',
    name: 'பெயர்',
    contact: 'தொடர்பு',
    amountDue: 'நிலுவைத் தொகை (₹)',
    ledger: 'பேரேடு',
    actions: 'செயல்கள்',
    register: 'பதிவு செய்',
    cancel: 'ரத்து செய்',
    update: 'புதுப்பி',
    initialDues: 'ஆரம்ப நிலுவை (₹)',
    search: 'ஐடி அல்லது பெயர் மூலம் தேடு...',
    noRecords: 'பதிவுகள் எதுவும் இல்லை.',
    view: 'காண்க',
    cashReceive: 'பண வரவு',
    receivePayment: 'வரவு பதிவு செய்யவும்',
    date: 'தேதி',
    customerName: 'வாடிக்கையாளர் பெயர்',
    amountReceived: 'பெறப்பட்ட தொகை',
    notes: 'சிறு குறிப்பு',
    action: 'செயல்',
    givenAmount: 'செலுத்தும் தொகை',
    closingBalance: 'நிகர நிலுவை',
    openingBalance: 'ஆரம்ப நிலுவை',
    selectCustomer: 'வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்',
    customerId: 'வாடிக்கையாளர் ஐடி',
    farmer: 'விவசாயி',
    customer: 'வாடிக்கையாளர்',
    close: 'மூடு',
    newPurchaseEntry: 'புதிய விற்பனை பதிவு',
    saleDate: 'விற்பனை தேதி',
    flowerVariety: 'பூ வகை',
    weightQty: 'எடை / அளவு',
    rate: 'விலை',
    addNew: 'புதியதைச் சேர்',
    totalQuantity: 'மொத்த அளவு',
    grandTotal: 'மொத்த தொகை',
    submitSales: 'பதிவு செய்',
    selectFlower: 'பூவைத் தேர்ந்தெடுக்கவும்',
    items: 'உருப்படிகள்',
    noItemsYet: 'இன்னும் சேர்க்கப்படவில்லை.',
    billSavedSuccess: 'பில் சேமிக்கப்பட்டு நிலுவை புதுப்பிக்கப்பட்டது!',
    billSaveFailed: 'பில் சேமிக்கத் தவறிவிட்டது.',
    logSalesSubtext: 'வாடிக்கையாளர்களுக்கு விற்ற பூக்களின் விவரங்களை இங்கே பதிவு செய்யவும்.',
    currentBatchItems: 'தற்போதைய பட்டியல்',
    flower: 'பூ',
    qty: 'அளவு',
    total: 'மொத்தம்',
    to: 'To',
    today: 'இன்று',
    month: 'மாதம்',
    apply: 'பயன்படுத்து',
  },
};

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Language state (persisted) ──
  const [lang, setLang] = useState(() => sessionStorage.getItem('fm_lang') || 'en');

  const t = (key) => strings[lang]?.[key] ?? strings['en']?.[key] ?? key;

  const handleLangChange = (e) => {
    const selected = e.target.value;
    setLang(selected);
    sessionStorage.setItem('fm_lang', selected);
  };

  const isDashboard = location.pathname.includes('/dashboard');

  // ── Smart Back Navigation ──
  const getParentRoute = () => {
    const p = location.pathname;
    if (p.includes('/buyer'))        return '/app/sales';
    if (p.includes('/payments'))     return '/app/sales';
    if (p.includes('/direct-sales')) return '/app/sales';
    if (p.includes('/sales-entry'))  return '/app/sales';
    if (p.includes('/reports'))      return '/app/sales';
    if (p.includes('/intake'))       return '/app/farmer';
    if (p.includes('/accounts'))     return '/app/dashboard';
    if (p.includes('/sales'))        return '/app/dashboard';
    if (p.includes('/farmer'))       return '/app/dashboard';
    return '/app/dashboard';
  };

  // ── Page title ──
  const getTitle = () => {
    const p = location.pathname;
    if (p.includes('/buyer'))        return `☘️ ${t('buyer')}`;
    if (p.includes('/payments'))     return `☘️ ${t('cashReceive')}`;
    if (p.includes('/direct-sales')) return `☘️ ${t('directSales')}`;
    if (p.includes('/sales-entry'))  return `☘️ ${t('salesEntry')}`;
    if (p.includes('/reports'))      return `☘️ ${t('reports')}`;
    if (p.includes('/intake'))       return `☘️ ${t('intake')}`;
    if (p.includes('/accounts'))     return `☘️ ${t('accounts')}`;
    if (p.includes('/sales'))        return `☘️ ${t('sales')}`;
    if (p.includes('/farmer'))       return `☘️ ${t('farmer')}`;
    return '';
  };

  const handleLogout = () => {
    sessionStorage.removeItem('fm_logged_in');
    sessionStorage.removeItem('fm_tenant');
    sessionStorage.removeItem('fm_tenant_name');
    sessionStorage.clear();
    navigate('/');
  };

  return (
    <LangContext.Provider value={{ lang, t }}>
      <div className="page page-main bg-gray-50 flex flex-col min-h-screen">
        <Petals />

        {/* ── Fixed Premium Top Bar ── */}
        <div className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center px-6 sticky top-0 z-50">

          {/* Left: Back Action */}
          <div className="w-48 flex items-center">
            {!isDashboard && (
              <button
                onClick={() => navigate(getParentRoute())}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 font-black text-sm hover:bg-gray-50 transition-all shadow-sm active:scale-95"
              >
                <ChevronLeft size={18} /> {t('back')}
              </button>
            )}
          </div>

          {/* Center: Title */}
          <div className="flex-1 flex justify-center">
            {getTitle() && (
              <div className="flex items-center gap-2.5 px-6 py-2 bg-emerald-50/50 rounded-full border border-emerald-100/50 shadow-inner">
                <h1 className="text-xl font-black text-emerald-800 tracking-tight">{getTitle()}</h1>
              </div>
            )}
          </div>

          {/* Right: User Actions */}
          <div className="w-64 flex items-center justify-end gap-5">
            <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest hidden lg:block">v2.8</div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 cursor-help">
              <User size={18} className="text-blue-500" />
            </div>

            <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs font-bold text-gray-600">
              <Globe size={14} className="text-blue-400" />
              <span className="hidden sm:inline">{t('language')}:</span>
              <select
                value={lang}
                onChange={handleLangChange}
                className="bg-transparent outline-none border-none pr-4 cursor-pointer"
              >
                <option value="en">English</option>
                <option value="ta">தமிழ்</option>
              </select>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95 font-black text-xs group"
              title="End Session"
            >
              <LogOut size={16} className="group-hover:rotate-12 transition-transform" />
              <span className="tracking-tighter uppercase">Logout</span>
            </button>
          </div>
        </div>

        <main className="flex-1 p-8 relative z-10 bg-gray-50/30 overflow-x-hidden">
          <div className="max-w-[1700px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </LangContext.Provider>
  );
};

export default Layout;
