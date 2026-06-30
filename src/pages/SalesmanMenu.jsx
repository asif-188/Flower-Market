import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Calendar, User, ArrowLeft, ArrowRight, Settings, Info, CreditCard, DollarSign, List, Shield, HelpCircle, CheckCircle2, ChevronRight, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { 
  subscribeToCollection, 
  saveDailyCash, 
  deleteDailyCash, 
  saveFlowerPurchase, 
  deleteFlowerPurchase, 
  saveCreditTransfer, 
  deleteCreditTransfer,
  saveDailyLedger,
  db
} from '../utils/storage';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { LangContext } from '../components/Layout';

// ── Shared Styling Rules ──
const INPUT_S = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1.5px solid #cbd5e1',
  background: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  color: '#1e293b',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  transition: 'all 0.2s',
  boxSizing: 'border-box',
};

const LABEL_S = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
};

// Keyboard-navigable Searchable Dropdown for Vendors
const SearchSelect = ({ items, value, onChange, placeholder, lang, onClear }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const selectedItem = items.find(i => i.id === value || i.name === value);
  const selectedName = selectedItem ? (lang === 'ta' ? (selectedItem.nameTa || selectedItem.taName || selectedItem.name) : selectedItem.name) : '';

  const filtered = query.trim()
    ? items.filter(i => {
        const n = i.name?.toLowerCase() || '';
        const tn = i.taName?.toLowerCase() || '';
        const shop = i.shop_name?.toLowerCase() || '';
        const q = query.toLowerCase();
        return n.includes(q) || tn.includes(q) || shop.includes(q) || (i.displayId && String(i.displayId).includes(query));
      })
    : items;

  const choose = (item) => {
    onChange(item);
    setQuery(lang === 'ta' ? (item.nameTa || item.taName || item.name) : item.name);
    setOpen(false);
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[cursor]) {
        choose(filtered[cursor]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setQuery('');
    setOpen(true);
    setCursor(0);
    if (onClear) onClear();
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={open ? query : selectedName}
        onFocus={() => { setQuery(''); setOpen(true); setCursor(0); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onChange={e => { setQuery(e.target.value); setCursor(0); }}
        onKeyDown={handleKey}
        autoComplete="off"
        style={{ ...INPUT_S, paddingRight: (selectedItem && !open) ? '32px' : '14px' }}
      />
      {selectedItem && !open && (
        <button
          onMouseDown={handleClear}
          title="Clear & search again"
          style={{
            position: 'absolute', right: '10px', top: '50%',
            transform: 'translateY(-50%)',
            background: '#f1f5f9', border: 'none', borderRadius: '50%',
            width: '20px', height: '20px',
            display: 'flex', alignItems: 'center', justifyCenter: 'center',
            justifyContent: 'center',
            cursor: 'pointer', color: '#64748b',
            padding: 0,
          }}
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul ref={listRef} style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: '180px',
          overflowY: 'auto', listStyle: 'none', margin: '4px 0', padding: '4px',
        }}>
          {filtered.map((item, i) => (
            <li
              key={item.id}
              onMouseDown={() => choose(item)}
              style={{
                padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: i === cursor ? '#f0fdf4' : 'transparent',
                color: i === cursor ? '#166534' : '#334155',
              }}
              onMouseEnter={() => setCursor(i)}
            >
              <div>
                <span className="font-bold">{lang === 'ta' ? (item.nameTa || item.name) : item.name}</span>
                {item.shop_name && <span className="text-gray-400 text-xs ml-2">({item.shop_name})</span>}
              </div>
              <span className="text-xs text-gray-500 font-mono">₹{(item.balance || 0).toFixed(0)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const displayDate = (iso) => {
  if (!iso || typeof iso !== 'string') return '---';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const SalesmanMenu = () => {
  const navigate = useNavigate();
  const { lang } = useContext(LangContext);
  
  // Setup standard state hooks
  const [salesmen, setSalesmen] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [flowers, setFlowers] = useState([]);
  const [cashRecords, setCashRecords] = useState([]);
  const [flowerPurchases, setFlowerPurchases] = useState([]);
  const [creditTransfers, setCreditTransfers] = useState([]);
  const [dailyLedgers, setDailyLedgers] = useState([]);
  
  // UI selection states
  const [selectedSalesmanId, setSelectedSalesmanId] = useState(() => localStorage.getItem('fm_activeSalesmanId') || '');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [activeTab, setActiveTab] = useState('cash'); // 'cash', 'purchase', 'credit'
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Ledger History Filters
  const [historyFromDate, setHistoryFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toLocaleDateString('en-CA');
  });
  const [historyToDate, setHistoryToDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [selectedLedgerDetails, setSelectedLedgerDetails] = useState(null); // Row selected for details modal
  
  // Input fields state
  const [cashForm, setCashForm] = useState({ amount: '', ownerRef: '' });
  const [purchaseForm, setPurchaseForm] = useState({ vendorId: '', flowerType: '', quantity: '', rate: '', amountPaid: '' });
  const [creditForm, setCreditForm] = useState({ toSalesmanId: '', amount: '', note: '' });

  // Persistence of active salesman selection
  useEffect(() => {
    if (selectedSalesmanId) {
      localStorage.setItem('fm_activeSalesmanId', selectedSalesmanId);
    } else {
      localStorage.removeItem('fm_activeSalesmanId');
    }
  }, [selectedSalesmanId]);

  // Firestore Subscriptions
  useEffect(() => {
    const unsubSalesmen = subscribeToCollection('salesmen', (data) => {
      setSalesmen(data.filter(s => s.status === 'Active'));
    });
    const unsubVendors = subscribeToCollection('vendors', setVendors);
    const unsubProducts = subscribeToCollection('products', (data) => {
      setFlowers(data.length === 0
        ? [{ name: 'Rose', taName: 'ரோஜா' }, { name: 'Jasmine', taName: 'மல்லிகை' }, { name: 'Marigold', taName: 'சாமந்தி' }]
        : data);
    });
    const unsubDailyCash = subscribeToCollection('salesman_daily_cash', setCashRecords);
    const unsubPurchases = subscribeToCollection('salesman_flower_purchases', setFlowerPurchases);
    const unsubTransfers = subscribeToCollection('salesman_credit_transfers', setCreditTransfers);
    const unsubLedgers = subscribeToCollection('salesman_daily_ledgers', setDailyLedgers);

    return () => {
      unsubSalesmen();
      unsubVendors();
      unsubProducts();
      unsubDailyCash();
      unsubPurchases();
      unsubTransfers();
      unsubLedgers();
    };
  }, []);

  const activeSalesman = useMemo(() => {
    return salesmen.find(s => s.id === selectedSalesmanId);
  }, [salesmen, selectedSalesmanId]);

  // ── Dynamic Ledger Cascade calculation (Chronological in memory) ──
  const computedLedgers = useMemo(() => {
    if (!selectedSalesmanId) return [];

    const sCash = cashRecords.filter(r => r.salesman_id === selectedSalesmanId);
    const sPurchases = flowerPurchases.filter(p => p.salesman_id === selectedSalesmanId);
    const sCreditGiven = creditTransfers.filter(t => t.from_salesman_id === selectedSalesmanId);
    const sCreditRec = creditTransfers.filter(t => t.to_salesman_id === selectedSalesmanId);

    // Get all dates chronologically
    const dateSet = new Set();
    sCash.forEach(r => r.date && dateSet.add(r.date));
    sPurchases.forEach(p => p.date && dateSet.add(p.date));
    sCreditGiven.forEach(t => t.date && dateSet.add(t.date));
    sCreditRec.forEach(t => t.date && dateSet.add(t.date));
    
    // Always include selected entry date
    if (selectedDate) dateSet.add(selectedDate);

    const sortedDates = Array.from(dateSet).sort();
    const rows = [];
    let carryForward = 0;

    for (const date of sortedDates) {
      const dayCash = sCash.filter(r => r.date === date);
      const dayPurchases = sPurchases.filter(p => p.date === date);
      const dayCreditGiven = sCreditGiven.filter(t => t.date === date);
      const dayCreditRec = sCreditRec.filter(t => t.date === date);

      const cashRec = dayCash.reduce((sum, r) => sum + (r.amount || 0), 0);
      const spentFlowers = dayPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const paidVendors = dayPurchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
      const crGiven = dayCreditGiven.reduce((sum, t) => sum + (t.amount || 0), 0);
      const crRec = dayCreditRec.reduce((sum, t) => sum + (t.amount || 0), 0);

      const opening = carryForward;
      const closing = opening + cashRec - paidVendors - crGiven + crRec;

      rows.push({
        date,
        opening_balance: opening,
        cash_received: cashRec,
        total_spent_on_flowers: spentFlowers,
        total_paid_to_vendors: paidVendors,
        credit_given: crGiven,
        credit_received: crRec,
        closing_balance: closing,
        // Keep raw transaction lists to display in details view modal
        rawCash: dayCash,
        rawPurchases: dayPurchases,
        rawCreditGiven: dayCreditGiven,
        rawCreditRec: dayCreditRec
      });

      carryForward = closing;
    }

    return rows;
  }, [cashRecords, flowerPurchases, creditTransfers, selectedSalesmanId, selectedDate]);

  // Current day's statistics
  const todayStats = useMemo(() => {
    const todayRow = computedLedgers.find(l => l.date === selectedDate);
    if (todayRow) return todayRow;

    // Fallback if no transactions yet for today: carry forward from latest day prior to today
    const pastRows = computedLedgers.filter(l => l.date < selectedDate);
    const opening = pastRows.length > 0 ? pastRows[pastRows.length - 1].closing_balance : 0;
    return {
      date: selectedDate,
      opening_balance: opening,
      cash_received: 0,
      total_spent_on_flowers: 0,
      total_paid_to_vendors: 0,
      credit_given: 0,
      credit_received: 0,
      closing_balance: opening,
      rawCash: [],
      rawPurchases: [],
      rawCreditGiven: [],
      rawCreditRec: []
    };
  }, [computedLedgers, selectedDate]);

  // Vendor Outstanding Balances specifically owed by this salesman
  const vendorOwedBalances = useMemo(() => {
    if (!selectedSalesmanId) return [];
    
    // Group purchases by vendor to see history of outstanding debt
    const sPurchases = flowerPurchases.filter(p => p.salesman_id === selectedSalesmanId);
    const summary = {};
    
    sPurchases.forEach(p => {
      if (!summary[p.vendor_id]) {
        summary[p.vendor_id] = { vendor_name: p.vendor_name || 'Vendor', owed: 0 };
      }
      summary[p.vendor_id].owed += (p.total_amount || 0) - (p.amount_paid || 0);
    });

    return Object.keys(summary)
      .map(vid => ({ id: vid, ...summary[vid] }))
      .filter(v => v.owed > 0);
  }, [flowerPurchases, selectedSalesmanId]);

  // Inter-salesman balances (who owes who)
  const interSalesmanCreditBalances = useMemo(() => {
    if (!selectedSalesmanId) return [];

    const sCreditGiven = creditTransfers.filter(t => t.from_salesman_id === selectedSalesmanId);
    const sCreditRec = creditTransfers.filter(t => t.to_salesman_id === selectedSalesmanId);
    const summary = {};

    sCreditGiven.forEach(t => {
      if (!summary[t.to_salesman_id]) {
        const otherS = salesmen.find(s => s.id === t.to_salesman_id);
        summary[t.to_salesman_id] = { name: otherS?.name || 'Salesman', netBalance: 0 };
      }
      summary[t.to_salesman_id].netBalance += (t.amount || 0); // They owe us
    });

    sCreditRec.forEach(t => {
      if (!summary[t.from_salesman_id]) {
        const otherS = salesmen.find(s => s.id === t.from_salesman_id);
        summary[t.from_salesman_id] = { name: otherS?.name || 'Salesman', netBalance: 0 };
      }
      summary[t.from_salesman_id].netBalance -= (t.amount || 0); // We owe them
    });

    return Object.keys(summary)
      .map(sid => ({ id: sid, ...summary[sid] }))
      .filter(s => s.netBalance !== 0);
  }, [creditTransfers, selectedSalesmanId, salesmen]);

  // Automatically keep Firestore daily ledger collection updated for reporting
  useEffect(() => {
    if (!selectedSalesmanId || !todayStats) return;
    
    // Save to Firestore daily ledger (throttled/simple update)
    const syncDailyLedgerToDb = async () => {
      const ledgerId = `${selectedSalesmanId}_${selectedDate}`;
      try {
        await setDoc(doc(db, 'salesman_daily_ledgers', ledgerId), {
          salesman_id: selectedSalesmanId,
          salesman_name: activeSalesman?.name || 'Unknown',
          date: selectedDate,
          opening_balance: todayStats.opening_balance,
          cash_received: todayStats.cash_received,
          total_spent_on_flowers: todayStats.total_spent_on_flowers,
          total_paid_to_vendors: todayStats.total_paid_to_vendors,
          credit_given: todayStats.credit_given,
          credit_received: todayStats.credit_received,
          closing_balance: todayStats.closing_balance,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Failed to sync daily ledger doc:", err);
      }
    };

    const timer = setTimeout(syncDailyLedgerToDb, 1500);
    return () => clearTimeout(timer);
  }, [todayStats, selectedSalesmanId, selectedDate, activeSalesman]);

  // Form Submissions
  const handleAddCash = async (e) => {
    e.preventDefault();
    if (!selectedSalesmanId) return alert('Select active salesman profile first');
    const amt = parseFloat(cashForm.amount);
    if (isNaN(amt) || amt <= 0) return alert('Enter a valid amount greater than 0');

    setIsSubmitting(true);
    try {
      await saveDailyCash({
        salesman_id: selectedSalesmanId,
        date: selectedDate,
        amount: amt,
        owner_id: cashForm.ownerRef || 'Owner'
      });
      setCashForm({ amount: '', ownerRef: '' });
    } catch (err) {
      alert('Error logging cash: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPurchase = async (e) => {
    e.preventDefault();
    if (!selectedSalesmanId) return alert('Select active salesman profile first');
    const { vendorId, flowerType, quantity, rate, amountPaid } = purchaseForm;
    if (!vendorId || !flowerType) return alert('Please fill in Vendor and Flower Variety');
    
    const qty = parseFloat(quantity);
    const r = parseFloat(rate);
    const paid = parseFloat(amountPaid) || 0;
    if (isNaN(qty) || qty <= 0 || isNaN(r) || r <= 0) return alert('Enter valid quantity and rate');
    
    const tot = qty * r;
    const vendor = vendors.find(v => v.id === vendorId);

    setIsSubmitting(true);
    try {
      await saveFlowerPurchase({
        salesman_id: selectedSalesmanId,
        date: selectedDate,
        vendor_id: vendorId,
        vendor_name: vendor?.name || 'Vendor',
        flower_type: flowerType,
        quantity: qty,
        rate: r,
        total_amount: tot,
        amount_paid: paid,
        vendor_outstanding_after: (vendor?.balance || 0) + tot - paid
      });
      setPurchaseForm({ vendorId: '', flowerType: '', quantity: '', rate: '', amountPaid: '' });
    } catch (err) {
      alert('Error saving purchase: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to auto fill full payment on rate or quantity changes
  useEffect(() => {
    const qty = parseFloat(purchaseForm.quantity) || 0;
    const r = parseFloat(purchaseForm.rate) || 0;
    if (qty > 0 && r > 0) {
      setPurchaseForm(prev => ({ ...prev, amountPaid: (qty * r).toString() }));
    }
  }, [purchaseForm.quantity, purchaseForm.rate]);

  const handleAddCredit = async (e) => {
    e.preventDefault();
    if (!selectedSalesmanId) return alert('Select active salesman profile first');
    const { toSalesmanId, amount, note } = creditForm;
    if (!toSalesmanId) return alert('Please select a receiving salesman');
    if (toSalesmanId === selectedSalesmanId) return alert('Cannot give credit to yourself');

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return alert('Enter a valid amount greater than 0');

    const receiver = salesmen.find(s => s.id === toSalesmanId);

    setIsSubmitting(true);
    try {
      await saveCreditTransfer({
        from_salesman_id: selectedSalesmanId,
        from_salesman_name: activeSalesman?.name || 'Salesman',
        to_salesman_id: toSalesmanId,
        to_salesman_name: receiver?.name || 'Salesman',
        amount: amt,
        date: selectedDate,
        note: note || ''
      });
      setCreditForm({ toSalesmanId: '', amount: '', note: '' });
    } catch (err) {
      alert('Error logging credit: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Detailed modal row item delete handlers
  const handleDeleteCashItem = async (id) => {
    if (window.confirm("Delete this cash receipt record?")) {
      try {
        await deleteDailyCash(id);
        setSelectedLedgerDetails(prev => ({
          ...prev,
          rawCash: prev.rawCash.filter(c => c.id !== id)
        }));
      } catch (err) { alert(err.message); }
    }
  };

  const handleDeletePurchaseItem = async (id) => {
    if (window.confirm("Delete this vendor purchase record?")) {
      try {
        await deleteFlowerPurchase(id);
        setSelectedLedgerDetails(prev => ({
          ...prev,
          rawPurchases: prev.rawPurchases.filter(p => p.id !== id)
        }));
      } catch (err) { alert(err.message); }
    }
  };

  const handleDeleteTransferItem = async (id) => {
    if (window.confirm("Delete this credit transfer record?")) {
      try {
        await deleteCreditTransfer(id);
        setSelectedLedgerDetails(prev => ({
          ...prev,
          rawCreditGiven: prev.rawCreditGiven.filter(t => t.id !== id),
          rawCreditRec: prev.rawCreditRec.filter(t => t.id !== id)
        }));
      } catch (err) { alert(err.message); }
    }
  };

  // Filter ledger list for date range
  const filteredLedgerHistory = useMemo(() => {
    return computedLedgers
      .filter(l => l.date >= historyFromDate && l.date <= historyToDate)
      .reverse(); // Newest first
  }, [computedLedgers, historyFromDate, historyToDate]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4 p-4 lg:h-[calc(100vh-100px)] lg:overflow-hidden animate-in fade-in duration-300">
      
      {/* ── Top Control & Switch Panel ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Portal Overview</span>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            👤 Salesman Daily Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Salesman Select */}
          <div className="w-56">
            <label style={LABEL_S}>Active Salesman</label>
            <select
              value={selectedSalesmanId}
              onChange={e => setSelectedSalesmanId(e.target.value)}
              style={INPUT_S}
              className="bg-slate-50 border-slate-300 hover:border-indigo-400 focus:border-indigo-500 font-bold"
            >
              <option value="">-- Choose Profile --</option>
              {salesmen.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.location || 'No Location'})</option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="w-40">
            <label style={LABEL_S}>Working Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={INPUT_S}
              className="bg-slate-50 border-slate-300 font-bold"
            />
          </div>

          {/* Admin Gear Menu */}
          <div className="relative self-end mt-4 md:mt-0">
            <button
              onClick={() => setAdminMenuOpen(!adminMenuOpen)}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1.5 font-semibold text-xs"
              title="Admin options"
            >
              <Settings size={18} className="animate-spin-hover" /> Settings
            </button>
            {adminMenuOpen && (
              <div className="absolute right-0 top-[110%] w-56 bg-white border border-slate-200 shadow-xl rounded-2xl p-2 z-50 flex flex-col gap-1">
                <button
                  onClick={() => { setAdminMenuOpen(false); navigate('/app/salesman-master'); }}
                  className="w-full text-left p-2.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-sm font-bold transition-colors"
                >
                  👤 Salesman Directory (Master)
                </button>
                <button
                  onClick={() => { setAdminMenuOpen(false); navigate('/app/salesman-ledger'); }}
                  className="w-full text-left p-2.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-sm font-bold transition-colors"
                >
                  📈 Standard Ledger Audit
                </button>
                <button
                  onClick={() => { setAdminMenuOpen(false); navigate('/app/salesman-flower-summary'); }}
                  className="w-full text-left p-2.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-sm font-bold transition-colors"
                >
                  🌸 Flower Sale Summaries
                </button>
                <button
                  onClick={() => { setAdminMenuOpen(false); navigate('/app/salesman-reports'); }}
                  className="w-full text-left p-2.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-sm font-bold transition-colors"
                >
                  📂 Advanced Reports
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!selectedSalesmanId ? (
        /* ── Profile Not Selected State ── */
        <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-16 text-center shadow-sm flex flex-col items-center justify-center gap-6">
          <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-4xl shadow-inner animate-bounce">
            👤
          </div>
          <div className="max-w-md">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Profile Setup Required</h2>
            <p className="text-slate-500 text-sm mt-1">
              Select or register a Salesman profile from the dropdown at the top to display today's balances, perform actions, and review ledgers.
            </p>
          </div>
          <div className="flex gap-4">
            <select
              value={selectedSalesmanId}
              onChange={e => setSelectedSalesmanId(e.target.value)}
              className="bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-300 text-indigo-800 px-6 py-2.5 rounded-xl font-bold text-sm outline-none transition-all cursor-pointer"
            >
              <option value="">Select Salesman Profile</option>
              {salesmen.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={() => navigate('/app/salesman-master')}
              className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
            >
              Add New Profile
            </button>
          </div>
        </div>
      ) : (
        /* ── Selected Active Salesman State ── */
        <>
          {/* ── Section 1: Running Balance Dashboard ── */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm relative overflow-hidden">
            
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Ledger Summary</span>
                <span className="text-sm font-black text-slate-800 tracking-tight">{activeSalesman?.name}</span>
              </div>
              <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold border border-slate-200 text-slate-600">
                📅 {displayDate(selectedDate)}
              </span>
            </div>

            {/* Balances Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-4 text-xs font-bold">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Opening Bal</span>
                <span className="text-sm font-black text-slate-700">{formatCurrency(todayStats.opening_balance)}</span>
              </div>
              
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Cash Rec (+)</span>
                <span className="text-sm font-black text-emerald-600">+{formatCurrency(todayStats.cash_received)}</span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Spent Flowers</span>
                <span className="text-sm font-black text-slate-700">{formatCurrency(todayStats.total_spent_on_flowers)}</span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Paid Vendor (-)</span>
                <span className="text-sm font-black text-red-500">-{formatCurrency(todayStats.total_paid_to_vendors)}</span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Credit Given (-)</span>
                <span className="text-sm font-black text-amber-600">-{formatCurrency(todayStats.credit_given)}</span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Credit Rec (+)</span>
                <span className="text-sm font-black text-emerald-600">+{formatCurrency(todayStats.credit_received)}</span>
              </div>

              <div className="flex flex-col gap-0.5 bg-indigo-50 border border-indigo-150 rounded-xl p-2 flex items-center justify-center">
                <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider">Closing Bal</span>
                <span className="text-sm font-black text-indigo-700 mt-0.5">{formatCurrency(todayStats.closing_balance)}</span>
              </div>
            </div>

            {todayStats.closing_balance < 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-xl text-[10px] font-semibold">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                Warning: Cash flow is in deficit
              </div>
            )}
          </div>

          {/* ── Section 2: Lower Pane - Side by Side Grid ── */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Column 1: Daily Transaction Entry Forms (takes 4 columns) */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 lg:col-span-4 flex flex-col h-full min-h-0">
              
              {/* Tab Selector */}
              <div className="flex border-b border-slate-100 pb-2 gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('cash')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'cash' 
                      ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-100 shadow-sm' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  💰 Cash
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('purchase')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'purchase' 
                      ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-100 shadow-sm' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  🌸 Purchase
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('credit')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'credit' 
                      ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-100 shadow-sm' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  🔄 Credit
                </button>
              </div>

              {/* Scrollable form body */}
              <div className="flex-1 overflow-y-auto mt-3 pr-1 text-xs">
                {/* Tab 1: Owner Cash Received */}
                {activeTab === 'cash' && (
                  <form onSubmit={handleAddCash} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-xs font-black text-slate-800">Log Cash Received</h3>
                      <p className="text-slate-400 text-[10px]">Record cash from owner to serve as opening balance.</p>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <div>
                        <label style={LABEL_S}>Amount Received (₹) *</label>
                        <input
                          type="number"
                          placeholder="e.g. 5000"
                          value={cashForm.amount}
                          onChange={e => setCashForm({ ...cashForm, amount: e.target.value })}
                          style={INPUT_S}
                          required
                          min="1"
                          className="focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div>
                        <label style={LABEL_S}>Owner Reference (Notes)</label>
                        <input
                          type="text"
                          placeholder="e.g. Morning Batch Cash"
                          value={cashForm.ownerId}
                          onChange={e => setCashForm({ ...cashForm, ownerId: e.target.value })}
                          style={INPUT_S}
                          className="focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-colors shadow-md shadow-indigo-100 disabled:opacity-50 animate-in fade-in duration-200"
                    >
                      {isSubmitting ? 'Logging...' : 'Save Cash Log'}
                    </button>
                  </form>
                )}

                {/* Tab 2: Flower Purchase */}
                {activeTab === 'purchase' && (
                  <form onSubmit={handleAddPurchase} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-xs font-black text-slate-800">Buy Flowers from Vendor</h3>
                      <p className="text-slate-400 text-[10px]">Log purchase bills and payments made.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div>
                        <label style={LABEL_S}>Select Vendor *</label>
                        <SearchSelect
                          options={vendors.map(v => ({ value: v.id, label: `${v.name} (${v.shop_name || 'Vendor'})` }))}
                          value={purchaseForm.vendorId}
                          onChange={val => setPurchaseForm({ ...purchaseForm, vendorId: val })}
                          placeholder="Search / select vendor..."
                        />
                      </div>

                      {selectedVendor && (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[10px] font-semibold text-slate-600 flex justify-between">
                          <span>Current Vendor Balance:</span>
                          <span className="font-mono font-bold text-slate-800">{formatCurrency(selectedVendor.balance || 0)}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label style={LABEL_S}>Flower Variety *</label>
                          <select
                            value={purchaseForm.flowerType}
                            onChange={e => setPurchaseForm({ ...purchaseForm, flowerType: e.target.value })}
                            style={INPUT_S}
                            required
                            className="focus:ring-2 focus:ring-indigo-200 font-bold"
                          >
                            <option value="">Select</option>
                            {flowers.map(f => (
                              <option key={f.name} value={f.name}>{f.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={LABEL_S}>Quantity (kg) *</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="kg"
                            value={purchaseForm.quantity}
                            onChange={e => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                            style={INPUT_S}
                            required
                            min="0.01"
                            className="focus:ring-2 focus:ring-indigo-200"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label style={LABEL_S}>Rate (₹/unit) *</label>
                          <input
                            type="number"
                            placeholder="₹"
                            value={purchaseForm.rate}
                            onChange={e => setPurchaseForm({ ...purchaseForm, rate: e.target.value })}
                            style={INPUT_S}
                            required
                            min="1"
                            className="focus:ring-2 focus:ring-indigo-200"
                          />
                        </div>
                        <div>
                          <label style={LABEL_S}>Total Cost (₹)</label>
                          <input
                            type="number"
                            disabled
                            value={totalCostComputed}
                            style={{ ...INPUT_S, background: '#f8fafc', color: '#64748b' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={LABEL_S}>Amount Paid Today (₹) *</label>
                        <input
                          type="number"
                          placeholder="Include today + prior dues"
                          value={purchaseForm.amountPaid}
                          onChange={e => setPurchaseForm({ ...purchaseForm, amountPaid: e.target.value })}
                          style={INPUT_S}
                          required
                          min="0"
                          className="focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                    </div>

                    {parseFloat(purchaseForm.amountPaid) > todayStats.closing_balance && (
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl text-[10px] font-semibold">
                        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                        Amount exceeds current daily cash balance.
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-colors shadow-md shadow-indigo-100 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Logging...' : 'Save Purchase Log'}
                    </button>
                  </form>
                )}

                {/* Tab 3: Credit Transfer */}
                {activeTab === 'credit' && (
                  <form onSubmit={handleAddCredit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-xs font-black text-slate-800">Give Credit to Another Salesman</h3>
                      <p className="text-slate-400 text-[10px]">Deduct amount from your balance & transfer to ledger.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div>
                        <label style={LABEL_S}>Receiving Salesman *</label>
                        <select
                          value={creditForm.toSalesmanId}
                          onChange={e => setCreditForm({ ...creditForm, toSalesmanId: e.target.value })}
                          style={INPUT_S}
                          required
                          className="focus:ring-2 focus:ring-indigo-200 font-bold"
                        >
                          <option value="">-- Choose Salesman --</option>
                          {salesmen.filter(s => s.id !== selectedSalesmanId).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={LABEL_S}>Credit Amount (₹) *</label>
                        <input
                          type="number"
                          placeholder="e.g. 1000"
                          value={creditForm.amount}
                          onChange={e => setCreditForm({ ...creditForm, amount: e.target.value })}
                          style={INPUT_S}
                          required
                          min="1"
                          className="focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>

                      <div>
                        <label style={LABEL_S}>Short Note</label>
                        <input
                          type="text"
                          placeholder="e.g. For fuel / fees"
                          value={creditForm.note}
                          onChange={e => setCreditForm({ ...creditForm, note: e.target.value })}
                          style={INPUT_S}
                          className="focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                    </div>

                    {parseFloat(creditForm.amount) > todayStats.closing_balance && (
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl text-[10px] font-semibold">
                        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                        Credit exceeds current daily cash balance.
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-colors shadow-md shadow-indigo-100 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Logging...' : 'Save Credit Transfer'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Column 2: Side summary cards (takes 3 columns) */}
            <div className="lg:col-span-3 flex flex-col gap-4 h-full min-h-0">
              
              {/* Vendor Owed Balance summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col h-1/2 min-h-0">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 shrink-0 border-b border-slate-100 pb-1.5">
                  🏪 Outstanding Vendor Balances
                </h3>
                <div className="flex-1 overflow-y-auto mt-2 pr-1 flex flex-col gap-1.5 text-xs">
                  {vendorOwedBalances.length === 0 ? (
                    <p className="text-slate-400 text-[10px] italic py-2">No outstanding balances owed today.</p>
                  ) : (
                    vendorOwedBalances.map(v => (
                      <div key={v.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl p-2 text-[11px] font-bold">
                        <span className="text-slate-600 truncate mr-2">{v.vendor_name}</span>
                        <span className="text-slate-800 font-mono shrink-0">{formatCurrency(v.owed)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Inter-salesman balances */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col h-1/2 min-h-0">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 shrink-0 border-b border-slate-100 pb-1.5">
                  🤝 Inter-Salesman Credits
                </h3>
                <div className="flex-1 overflow-y-auto mt-2 pr-1 flex flex-col gap-1.5 text-xs">
                  {interSalesmanCreditBalances.length === 0 ? (
                    <p className="text-slate-400 text-[10px] italic py-2">No inter-salesman credits logged.</p>
                  ) : (
                    interSalesmanCreditBalances.map(s => (
                      <div key={s.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl p-2 text-[11px] font-bold">
                        <span className="text-slate-600 truncate mr-2">{s.name}</span>
                        {s.netBalance > 0 ? (
                          <span className="text-emerald-600 font-extrabold shrink-0">owes {formatCurrency(s.netBalance)}</span>
                        ) : (
                          <span className="text-red-500 font-extrabold shrink-0">owed {formatCurrency(Math.abs(s.netBalance))}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Column 3: Historical Ledger View (takes 5 columns) */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 lg:col-span-5 flex flex-col h-full min-h-0">
              
              {/* Filter Row */}
              <div className="flex flex-col border-b border-slate-100 pb-2 gap-2 shrink-0">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-black text-slate-800">Historical Ledger</h2>
                  <span className="text-[10px] text-slate-400">Statement breakdown</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">From</label>
                    <input
                      type="date"
                      value={historyFromDate}
                      onChange={e => setHistoryFromDate(e.target.value)}
                      style={{ ...INPUT_S, padding: '4px 8px', fontSize: '11px' }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">To</label>
                    <input
                      type="date"
                      value={historyToDate}
                      onChange={e => setHistoryToDate(e.target.value)}
                      style={{ ...INPUT_S, padding: '4px 8px', fontSize: '11px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Table Wrapper */}
              <div className="flex-1 overflow-y-auto min-h-0 mt-3 pr-1 text-xs">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="bg-slate-50 border-b border-slate-100 text-[9px] text-slate-400 uppercase tracking-wider font-extrabold">
                      <th className="p-2">Date</th>
                      <th className="p-2 text-right">In (+)</th>
                      <th className="p-2 text-right">Out (-)</th>
                      <th className="p-2 text-right">Closing</th>
                      <th className="p-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {filteredLedgerHistory.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-xs text-slate-400 italic">
                          No logs in selected range.
                        </td>
                      </tr>
                    ) : (
                      filteredLedgerHistory.map((row) => {
                        const inwardVal = (row.cash_received || 0) + (row.credit_received || 0);
                        const outwardVal = (row.total_paid_to_vendors || 0) + (row.credit_given || 0);
                        return (
                          <tr 
                            key={row.date} 
                            className={`hover:bg-slate-50/50 transition-colors text-[11px] ${
                              row.date === selectedDate ? 'bg-indigo-50/20' : ''
                            }`}
                          >
                            <td className="p-2 text-slate-850 whitespace-nowrap">{displayDate(row.date)}</td>
                            <td className="p-2 text-right text-emerald-600 font-mono">₹{inwardVal.toFixed(0)}</td>
                            <td className="p-2 text-right text-red-500 font-mono">₹{outwardVal.toFixed(0)}</td>
                            <td className="p-2 text-right text-slate-900 font-mono">₹{row.closing_balance.toFixed(0)}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedLedgerDetails(row)}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black transition-colors"
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      )}

      {/* ── Modal: Day Ledger Details ── */}
      {selectedLedgerDetails && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in duration-300">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Transaction Audit log</span>
                <h3 className="text-base font-black text-slate-800">
                  Transactions on {displayDate(selectedLedgerDetails.date)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLedgerDetails(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              
              {/* Section 1: Cash Receipts */}
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2 mb-3">
                  💰 Cash Received from Owner
                </h4>
                {selectedLedgerDetails.rawCash.length === 0 ? (
                  <p className="text-slate-400 text-xs italic">No cash logged on this day.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedLedgerDetails.rawCash.map(c => (
                      <div key={c.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-bold">
                        <div>
                          <span className="text-slate-800">{formatCurrency(c.amount)}</span>
                          <span className="text-gray-400 text-[10px] ml-2">Ref: {c.owner_id}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteCashItem(c.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Vendor Flower Purchases */}
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2 mb-3">
                  🌸 Flower Purchases from Vendors
                </h4>
                {selectedLedgerDetails.rawPurchases.length === 0 ? (
                  <p className="text-slate-400 text-xs italic">No vendor purchases logged on this day.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedLedgerDetails.rawPurchases.map(p => (
                      <div key={p.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-bold">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-800">{p.vendor_name} — {p.flower_type}</span>
                          <span className="text-gray-400 text-[10px]">
                            Qty: {p.quantity}kg @ ₹{p.rate}/kg | Total: {formatCurrency(p.total_amount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-600 font-bold">Paid: {formatCurrency(p.amount_paid)}</span>
                          <button
                            onClick={() => handleDeletePurchaseItem(p.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Credit Transfers */}
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2 mb-3">
                  🔄 Credit Transfers (Given & Received)
                </h4>
                
                {selectedLedgerDetails.rawCreditGiven.length === 0 && selectedLedgerDetails.rawCreditRec.length === 0 ? (
                  <p className="text-slate-400 text-xs italic">No transfers logged on this day.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Given */}
                    {selectedLedgerDetails.rawCreditGiven.map(t => (
                      <div key={t.id} className="flex justify-between items-center bg-red-50/40 border border-red-100 rounded-xl p-3 text-xs font-bold">
                        <div>
                          <span className="text-red-600">GIVEN: {formatCurrency(t.amount)}</span>
                          <span className="text-slate-600 ml-1">to {t.to_salesman_name}</span>
                          {t.note && <span className="text-gray-400 text-[10px] block mt-0.5">Note: {t.note}</span>}
                        </div>
                        <button
                          onClick={() => handleDeleteTransferItem(t.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}

                    {/* Received */}
                    {selectedLedgerDetails.rawCreditRec.map(t => (
                      <div key={t.id} className="flex justify-between items-center bg-emerald-50/40 border border-emerald-100 rounded-xl p-3 text-xs font-bold">
                        <div>
                          <span className="text-emerald-600">REC: {formatCurrency(t.amount)}</span>
                          <span className="text-slate-600 ml-1">from {t.from_salesman_name}</span>
                          {t.note && <span className="text-gray-400 text-[10px] block mt-0.5">Note: {t.note}</span>}
                        </div>
                        <button
                          onClick={() => handleDeleteTransferItem(t.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedLedgerDetails(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2 rounded-xl text-xs font-bold transition-all"
              >
                Close Audit details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesmanMenu;
