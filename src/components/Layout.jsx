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
    receivePayment: 'Receive Payment',
    date: 'Date',
    sNo: 'S.No',
    customerName: 'Customer Name',
    amountReceived: 'Amount Received',
    notes: 'Short Note',
    action: 'Action',
    givenAmount: 'Given Amount',
    closingBalance: 'Closing Balance',
    openingBalance: 'Opening Balance',
    selectCustomer: 'Select Customer',
    customerId: 'Cust ID',
    close: 'Close',
    newPurchaseEntry: 'New Sales Entry',
    saleDate: 'Sale Date',
    flowerVariety: 'Flower Name',
    weightQty: 'Weight / Qty',
    rate: 'Rate',
    addNew: 'Save',
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
    custom: 'Custom',
    apply: 'Apply',
    flowers: 'Flowers',
    paid: 'Paid',
    net: 'Net',
    dues: 'Dues',
    balance: 'Balance',
    oldBalance: 'Old Balance',
    cashRec: 'Cash Rec',
    cashLess: 'Cash Less',
    adjustments: 'Adjustments',
    todayTotal: "Today's Total",
    dailyReport: 'Daily Report',
    customerNo: 'Customer No',
    particulars: 'Particulars',
    weight: 'Weight',
    statementTitle: 'STATEMENT',
    totalSales: 'Total Sales',
    finalBalance: 'Final Balance',
    thankYou: 'Thank you!',
    transactionHistory: 'Transaction History',
    viewLedger: 'View Ledger',
    printLedger: 'Print Ledger',
    closeView: 'Close View',
    time: 'Time',
    todayLiveEntries: "Today's Live Entries",
    history: 'History',
    delete: 'Delete',
    outsideShop: 'Outside Shop',
    vendorName: 'Vendor Name',
    purchase: 'Purchase',
    vendorReport: 'Vendor Report',
    location: 'Location',
    outsidePurchase: 'Outside Purchase',
    cashPaid: 'Cash Paid',
    totalPurchase: 'Total Purchase',
    vendorId: 'Vendor ID',
    addVendor: 'Add Vendor',
    backToMenu: 'Back to Menu',
    todayPurchases: "Today's Purchases",
    recordVendorPayment: 'Record Vendor Payment',
    recentPayments: 'Recent Payments',
    fromDate: 'From Date',
    toDate: 'To Date',
    allVendors: 'All Vendors',
    statement: 'Statement',
    editVendor: 'Edit Vendor',
    englishName: 'English Name',
    tamilNameOptional: 'Tamil Name (Optional)',
    locationPlaceholder: 'City/Town',
    englishNamePlaceholder: 'Vendor name in English',
    paymentDetailsPlaceholder: 'Payment details...',
    amount: 'Amount',
    paymentReceipt: 'Payment Receipt',
    purchaseReceipt: 'Purchase Receipt',
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
    receivePayment: 'வரவு பதிவு செய்யவும்',
    date: 'தேதி',
    sNo: 'வ.எண்',
    customerName: 'வாடிக்கையாளர் பெயர்',
    amountReceived: 'பெறப்பட்ட தொகை',
    notes: 'சிறு குறிப்பு',
    action: 'செயல்',
    givenAmount: 'செலுத்தும் தொகை',
    closingBalance: 'நிகர நிலுவை',
    openingBalance: 'ஆரம்ப நிலுவை',
    selectCustomer: 'வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்',
    customerId: 'வாடிக்கையாளர் ஐடி',
    close: 'மூடு',
    newPurchaseEntry: 'புதிய விற்பனை பதிவு',
    saleDate: 'விற்பனை தேதி',
    flowerVariety: 'பூ',
    weightQty: 'எடை / அளவு',
    rate: 'விலை',
    addNew: 'சேமி',
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
    custom: 'விருப்ப தேதி',
    apply: 'பயன்படுத்து',
    flowers: 'பூக்கள்',
    paid: 'செலுத்தியது',
    net: 'நிகர்',
    dues: 'நிலுவை',
    balance: 'பாக்கி',
    oldBalance: 'முன் பாக்கி',
    cashRec: 'வரவு',
    cashLess: 'கழி',
    adjustments: 'சரிகட்டுதல்',
    todayTotal: 'இன்றைய மொத்தம்',
    dailyReport: 'தினசரி அறிக்கை',
    customerNo: 'வாடிக்கையாளர் எண்',
    particulars: 'விபரம்',
    weight: 'எடை',
    statementTitle: 'கணக்கு அறிக்கை',
    totalSales: 'மொத்த விற்பனை',
    finalBalance: 'இறுதி மீதி',
    thankYou: 'நன்றி!',
    transactionHistory: 'பரிவர்த்தனை வரலாறு',
    viewLedger: 'பேரேட்டைப் பார்க்க',
    printLedger: 'பேரேடு அச்சிடு',
    closeView: 'பார்வையை மூடு',
    time: 'நேரம்',
    todayLiveEntries: 'இன்றைய நேரடி பதிவுகள்',
    history: 'வரலாறு',
    delete: 'நீக்கு',
    outsideShop: 'வெளிக்கடை',
    vendorName: 'விற்பனையாளர் பெயர்',
    purchase: 'கொள்முதல்',
    vendorReport: 'விற்பனையாளர் அறிக்கை',
    location: 'இடம்',
    outsidePurchase: 'வெளிப்புற கொள்முதல்',
    cashPaid: 'செலுத்திய தொகை',
    totalPurchase: 'மொத்த கொள்முதல்',
    vendorId: 'விற்பனையாளர் ஐடி',
    addVendor: 'விற்பனையாளரைச் சேர்',
    backToMenu: 'மெனுவுக்குச் செல்',
    todayPurchases: 'இன்றைய கொள்முதல்',
    recordVendorPayment: 'கொடுப்பனவு பதிவு',
    recentPayments: 'சமீபத்திய கொடுப்பனவுகள்',
    fromDate: 'தொடக்க தேதி',
    toDate: 'முடிவு தேதி',
    allVendors: 'அனைத்து விற்பனையாளர்கள்',
    statement: 'அறிக்கை',
    editVendor: 'விற்பனையாளர் மாற்றம்',
    englishName: 'ஆங்கிலப் பெயர்',
    tamilNameOptional: 'தமிழ் பெயர் (தேவைப்பட்டால்)',
    locationPlaceholder: 'நகரம்/ஊர்',
    englishNamePlaceholder: 'ஆங்கிலத்தில் பெயர்',
    paymentDetailsPlaceholder: 'செலுத்திய விபரம்...',
    amount: 'தொகை',
    paymentReceipt: 'பணம் பெற்றுக் கொண்டமைக்கான ரசீது',
    purchaseReceipt: 'கொள்முதல் ரசீது',
  },
};

import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

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
    if (p.includes('/flowers'))      return '/app/sales';
    if (p.includes('/settings'))     return '/app/dashboard';
    if (p.includes('/intake'))       return '/app/farmer';
    if (p.includes('/accounts'))     return '/app/dashboard';
    if (p.includes('/sales'))        return '/app/dashboard';
    if (p.includes('/farmer'))       return '/app/dashboard';
    if (p.includes('/outside-shop')) return '/app/dashboard';
    return '/app/dashboard';
  };

  // ── Page title ──
  const getTitle = () => {
    const p = location.pathname;
    if (p.includes('/buyer'))        return `☘️ Sales — ${t('customer')}`;
    if (p.includes('/payments'))     return `☘️ Sales — ${t('cashReceive')}`;
    if (p.includes('/direct-sales')) return `☘️ Sales — ${t('directSales')}`;
    if (p.includes('/sales-entry'))  return `☘️ Sales — ${t('sales')}`;
    if (p.includes('/reports'))      return `☘️ Sales — ${t('reports')}`;
    if (p.includes('/flowers'))      return `☘️ Sales — ${t('flowers')}`;
    if (p.includes('/settings'))     return `☘️ Business Settings`;
    if (p.includes('/intake'))       return `☘️ ${t('intake')}`;
    if (p.includes('/accounts'))     return `☘️ ${t('accounts')}`;
    if (p.includes('/sales'))        return `☘️ ${t('sales')}`;
    if (p.includes('/farmer'))       return `☘️ ${t('farmer')}`;
    if (p.includes('/daily-report')) return `☘️ Sales — ${t('dailyReport')}`;
    if (p.includes('/outside-shop')) return `☘️ ${t('outsideShop')}`;
    return '';
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.clear();
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <LangContext.Provider value={{ lang, t }}>
      <div className="page page-main flex flex-col min-h-screen">
        <Petals />

        {/* ── Premium Glassmorphic Top Bar ── */}
        <header style={{
          height: '68px', flexShrink: 0,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)',
          display: 'flex', alignItems: 'center', padding: '0 28px',
          position: 'sticky', top: 0, zIndex: 50
        }}>

          {/* Left: Back */}
          <div style={{width: '160px', flexShrink: 0}}>
            {!isDashboard && (
              <button
                onClick={() => navigate(getParentRoute())}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={{background:'#f8fafc', border:'1.5px solid #e2e8f0', color:'#64748b', fontFamily:'var(--font-sans)'}}
                onMouseEnter={e => Object.assign(e.currentTarget.style, {background:'#ecfdf5', borderColor:'#6ee7b7', color:'#047857'})}
                onMouseLeave={e => Object.assign(e.currentTarget.style, {background:'#f8fafc', borderColor:'#e2e8f0', color:'#64748b'})}
              >
                <ChevronLeft size={15} /> {t('back')}
              </button>
            )}
          </div>

          {/* Center */}
          <div style={{flex: 1, display:'flex', justifyContent:'center', alignItems:'center'}}>
            {getTitle() ? (
              <div style={{
                display:'flex', alignItems:'center', gap:'8px',
                padding:'7px 20px',
                background:'linear-gradient(135deg,#ecfdf5,#f0fdf4)',
                borderRadius:'100px', border:'1px solid #a7f3d0',
                boxShadow:'0 1px 3px rgba(16,185,129,0.1)'
              }}>
                <span style={{fontFamily:'var(--font-display)', fontWeight:700, fontSize:'14px', color:'#065f46', letterSpacing:'-0.01em'}}>
                  {getTitle()}
                </span>
              </div>
            ) : (
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                <span style={{fontSize:'22px'}}>🌿</span>
                <span style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', color:'#047857', letterSpacing:'-0.02em'}}>
                  Poovanam Market
                </span>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div style={{width:'220px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'8px'}}>
            {/* Language picker */}
            <div style={{
              display:'flex', alignItems:'center', gap:'5px',
              padding:'7px 11px', background:'#f8fafc',
              border:'1.5px solid #e2e8f0', borderRadius:'10px'
            }}>
              <Globe size={13} style={{color:'#10b981', flexShrink:0}} />
              <select
                value={lang}
                onChange={handleLangChange}
                style={{
                  background:'transparent', outline:'none', border:'none',
                  cursor:'pointer', color:'#475569', fontWeight:600,
                  fontFamily:'var(--font-sans)', fontSize:'12px',
                  padding:0, width:'auto'
                }}
              >
                <option value="en">EN</option>
                <option value="ta">தமிழ்</option>
              </select>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              style={{
                display:'flex', alignItems:'center', gap:'5px',
                padding:'7px 13px', background:'#fff1f2',
                border:'1.5px solid #fecdd3', borderRadius:'10px',
                color:'#f43f5e', fontFamily:'var(--font-sans)',
                fontWeight:700, fontSize:'12px', cursor:'pointer',
                letterSpacing:'0.04em', textTransform:'uppercase',
                transition:'all 0.2s'
              }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, {background:'#f43f5e', color:'white', borderColor:'#f43f5e', transform:'translateY(-1px)', boxShadow:'0 4px 12px rgba(244,63,94,0.3)'})}
              onMouseLeave={e => Object.assign(e.currentTarget.style, {background:'#fff1f2', color:'#f43f5e', borderColor:'#fecdd3', transform:'none', boxShadow:'none'})}
            >
              <LogOut size={13} />
              Logout
            </button>
          </div>
        </header>

        <main style={{flex:1, padding:'28px', position:'relative', zIndex:10, overflowX:'hidden'}}>
          <div style={{maxWidth:'1700px', margin:'0 auto', width:'100%'}}>
            <Outlet />
          </div>
        </main>
      </div>
    </LangContext.Provider>
  );
};

export default Layout;
