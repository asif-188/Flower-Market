import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, ShoppingCart, DollarSign, Edit, AlertCircle, Trash2, ArrowRight, UserCheck, ShieldAlert, Plus, CheckCircle, ChevronDown } from 'lucide-react';
import { subscribeToCollection, saveDailyCash, saveFlowerPurchase, deleteFlowerPurchase, db } from '../utils/storage';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, writeBatch } from 'firebase/firestore';

const INPUT_S = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1.5px solid #cbd5e1',
  background: '#ffffff',
  fontSize: '13px',
  fontWeight: 600,
  color: '#1e293b',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL_S = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '4px',
};

const displayDate = (iso) => {
  if (!iso || typeof iso !== 'string') return '---';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const OwnerDashboard = () => {
  const navigate = useNavigate();
  
  // Data subscriptions
  const [salesmen, setSalesmen] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [cashRecords, setCashRecords] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [flowers, setFlowers] = useState([]);
  
  // UI Tabs & Filters
  const [activeTab, setActiveTab] = useState('cash'); // 'cash', 'audit', 'ledgers'
  const [dateFilterPreset, setDateFilterPreset] = useState('today'); // 'today', 'yesterday', 'week', 'month', 'custom'
  
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
  }, []);

  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);

  // Set date ranges based on presets
  useEffect(() => {
    if (dateFilterPreset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (dateFilterPreset === 'yesterday') {
      setFromDate(yesterdayStr);
      setToDate(yesterdayStr);
    } else if (dateFilterPreset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setFromDate(d.toLocaleDateString('en-CA'));
      setToDate(todayStr);
    } else if (dateFilterPreset === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFromDate(d.toLocaleDateString('en-CA'));
      setToDate(todayStr);
    }
  }, [dateFilterPreset, todayStr, yesterdayStr]);

  // Bulk cash given fields state
  const [bulkCashInputs, setBulkCashInputs] = useState({}); // { salesmanId: { amount: '', notes: '' } }
  const [bulkSaving, setBulkSaving] = useState(false);

  // Purchase audit fields state & modal
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState({
    id: '',
    salesmanId: '',
    vendorId: '',
    flowerType: '',
    quantity: '',
    rate: '',
    amountPaid: '',
    date: todayStr
  });
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);

  // Subscribe to Firestore collections
  useEffect(() => {
    const unsubSalesmen = subscribeToCollection('salesmen', (data) => {
      setSalesmen(data.filter(s => s.status === 'Active'));
    });
    const unsubVendors = subscribeToCollection('vendors', (data) => {
      setVendors(data.filter(v => v.status !== 'removed'));
    });
    const unsubProducts = subscribeToCollection('products', (data) => {
      setFlowers(data.length === 0
        ? [{ name: 'Rose', taName: 'ரோஜா' }, { name: 'Jasmine', taName: 'மல்லிகை' }, { name: 'Marigold', taName: 'சாமந்தி' }]
        : data);
    });
    const unsubCash = subscribeToCollection('salesman_daily_cash', setCashRecords);
    const unsubPurchases = subscribeToCollection('salesman_flower_purchases', setPurchases);
    const unsubTransfers = subscribeToCollection('salesman_credit_transfers', setTransfers);

    return () => {
      unsubSalesmen();
      unsubVendors();
      unsubProducts();
      unsubCash();
      unsubPurchases();
      unsubTransfers();
    };
  }, []);

  // Initialize bulk cash input form rows
  useEffect(() => {
    const inputs = {};
    salesmen.forEach(s => {
      inputs[s.id] = { amount: '', notes: '' };
    });
    setBulkCashInputs(inputs);
  }, [salesmen]);

  // ── Calculation engine: Range filtered totals ──
  const rangeStats = useMemo(() => {
    const rCash = cashRecords.filter(c => c.date >= fromDate && c.date <= toDate);
    const rPurchases = purchases.filter(p => p.date >= fromDate && p.date <= toDate);
    
    const cashGiven = rCash.reduce((sum, c) => sum + (c.amount || 0), 0);
    const flowerCost = rPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const vendorPaid = rPurchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    
    // Global sums of current balances from master records
    const salesmanOutstanding = salesmen.reduce((sum, s) => sum + (s.current_balance || 0), 0);
    const vendorOutstanding = vendors.reduce((sum, v) => sum + (v.balance || 0), 0);

    return {
      cashGiven,
      flowerCost,
      vendorPaid,
      salesmanOutstanding,
      vendorOutstanding
    };
  }, [cashRecords, purchases, salesmen, vendors, fromDate, toDate]);

  // Bulk cash submission
  const handleBulkCashSubmit = async (e) => {
    e.preventDefault();
    const recordsToSave = [];
    
    Object.keys(bulkCashInputs).forEach(sid => {
      const { amount, notes } = bulkCashInputs[sid];
      const amt = parseFloat(amount);
      if (!isNaN(amt) && amt > 0) {
        recordsToSave.push({
          salesman_id: sid,
          amount: amt,
          owner_id: 'Owner',
          notes: notes || '',
          date: todayStr,
          entered_by: 'owner'
        });
      }
    });

    if (recordsToSave.length === 0) return alert('Enter cash amount for at least one salesman');

    setBulkSaving(true);
    try {
      // Execute saves sequentially or via batch
      for (const rec of recordsToSave) {
        await saveDailyCash(rec);
      }
      
      // Clear inputs
      const cleared = {};
      salesmen.forEach(s => {
        cleared[s.id] = { amount: '', notes: '' };
      });
      setBulkCashInputs(cleared);
      alert('Successfully recorded cash issues!');
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  // Open Edit Purchase Modal
  const handleOpenPurchaseModal = (p = null) => {
    if (p) {
      setEditingPurchase(p);
      setPurchaseForm({
        id: p.id,
        salesmanId: p.salesman_id || '',
        vendorId: p.vendor_id || '',
        flowerType: p.flower_type || '',
        quantity: p.quantity || '',
        rate: p.rate || '',
        amountPaid: p.amount_paid || '',
        date: p.date || todayStr
      });
    } else {
      setEditingPurchase(null);
      setPurchaseForm({
        id: '',
        salesmanId: '',
        vendorId: '',
        flowerType: '',
        quantity: '',
        rate: '',
        amountPaid: '',
        date: todayStr
      });
    }
    setShowPurchaseModal(true);
  };

  // Helper to auto fill full payment in modal on rate or quantity changes
  useEffect(() => {
    const qty = parseFloat(purchaseForm.quantity) || 0;
    const r = parseFloat(purchaseForm.rate) || 0;
    if (qty > 0 && r > 0 && !purchaseForm.id) {
      setPurchaseForm(prev => ({ ...prev, amountPaid: (qty * r).toString() }));
    }
  }, [purchaseForm.quantity, purchaseForm.rate, purchaseForm.id]);

  // Handle saving purchase (adds/edits transaction record and triggers ledger changes)
  const handleSavePurchase = async (e) => {
    e.preventDefault();
    const { salesmanId, vendorId, flowerType, quantity, rate, amountPaid, date } = purchaseForm;
    if (!salesmanId || !vendorId || !flowerType) return alert('Fill in all fields');
    
    const qty = parseFloat(quantity);
    const r = parseFloat(rate);
    const paid = parseFloat(amountPaid) || 0;
    if (isNaN(qty) || qty <= 0 || isNaN(r) || r <= 0) return alert('Enter valid quantity and rate');

    setIsSavingPurchase(true);
    try {
      const salesman = salesmen.find(s => s.id === salesmanId);
      const vendor = vendors.find(v => v.id === vendorId);
      const tot = qty * r;

      await saveFlowerPurchase({
        id: purchaseForm.id || null,
        salesman_id: salesmanId,
        date: date,
        vendor_id: vendorId,
        vendor_name: vendor?.name || 'Vendor',
        flower_type: flowerType,
        quantity: qty,
        rate: r,
        total_amount: tot,
        amount_paid: paid,
        vendor_outstanding_after: (vendor?.balance || 0) + tot - paid,
        entered_by: 'owner'
      });

      setShowPurchaseModal(false);
    } catch (err) {
      alert('Error saving purchase record: ' + err.message);
    } finally {
      setIsSavingPurchase(false);
    }
  };

  const handleDeletePurchase = async (p) => {
    if (window.confirm("Permanently delete this purchase record? Outstanding balances will be auto-reconciled.")) {
      try {
        await deleteFlowerPurchase(p.id);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Filter purchase list for current range
  const filteredPurchases = useMemo(() => {
    return purchases
      .filter(p => p.date >= fromDate && p.date <= toDate)
      .sort((a,b) => b.date.localeCompare(a.date));
  }, [purchases, fromDate, toDate]);

  // ── Calculation of Dynamic Carry-Forwards for Ledgers view ──
  
  // Salesmen Carry Forward calculations
  const salesmenLedgers = useMemo(() => {
    return salesmen.map(s => {
      // 1. Prior balances calculations
      const priorCash = cashRecords.filter(c => c.salesman_id === s.id && c.date < fromDate);
      const priorPurchases = purchases.filter(p => p.salesman_id === s.id && p.date < fromDate);
      const priorTransfersOut = transfers.filter(t => t.from_salesman_id === s.id && t.date < fromDate);
      const priorTransfersIn = transfers.filter(t => t.to_salesman_id === s.id && t.date < fromDate);

      const cashIn = priorCash.reduce((sum, c) => sum + (c.amount || 0), 0) + priorTransfersIn.reduce((sum, t) => sum + (t.amount || 0), 0);
      const cashOut = priorPurchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0) + priorTransfersOut.reduce((sum, t) => sum + (t.amount || 0), 0);
      const openingBalance = cashIn - cashOut;

      // 2. Current range activity calculations
      const currCash = cashRecords.filter(c => c.salesman_id === s.id && c.date >= fromDate && c.date <= toDate);
      const currPurchases = purchases.filter(p => p.salesman_id === s.id && p.date >= fromDate && p.date <= toDate);
      const currTransfersOut = transfers.filter(t => t.from_salesman_id === s.id && t.date >= fromDate && t.date <= toDate);
      const currTransfersIn = transfers.filter(t => t.to_salesman_id === s.id && t.date >= fromDate && t.date <= toDate);

      const rangeIn = currCash.reduce((sum, c) => sum + (c.amount || 0), 0) + currTransfersIn.reduce((sum, t) => sum + (t.amount || 0), 0);
      const rangeOut = currPurchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0) + currTransfersOut.reduce((sum, t) => sum + (t.amount || 0), 0);
      
      const closingBalance = openingBalance + rangeIn - rangeOut;

      return {
        id: s.id,
        name: s.name,
        openingBalance,
        rangeIn,
        rangeOut,
        closingBalance
      };
    });
  }, [salesmen, cashRecords, purchases, transfers, fromDate, toDate]);

  // Vendors Carry Forward calculations
  const vendorsLedgers = useMemo(() => {
    return vendors.map(v => {
      // 1. Prior balances calculations
      const priorPurchases = purchases.filter(p => p.vendor_id === v.id && p.date < fromDate);
      const priorOwed = priorPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const priorPaid = priorPurchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
      const openingBalance = (v.initial_balance || 0) + priorOwed - priorPaid;

      // 2. Current range activity calculations
      const currPurchases = purchases.filter(p => p.vendor_id === v.id && p.date >= fromDate && p.date <= toDate);
      const rangeIn = currPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0); // items purchased
      const rangeOut = currPurchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0); // cash paid

      const closingBalance = openingBalance + rangeIn - rangeOut;

      return {
        id: v.id,
        name: v.name,
        shopName: v.shop_name,
        openingBalance,
        rangeIn,
        rangeOut,
        closingBalance
      };
    });
  }, [vendors, purchases, fromDate, toDate]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4 p-4 lg:h-[calc(100vh-100px)] lg:overflow-hidden animate-in fade-in duration-300">
      
      {/* ── Top Header Controls ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Business Control Panel</span>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            👑 Owner Command Center
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/app/owner-vendors')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-purple-700 hover:border-purple-300 font-extrabold text-xs transition-all shadow-sm"
          >
            🏪 Vendor Registry
          </button>
        </div>
      </div>

      {/* ── Summary Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cash Given Today</span>
          <span className="text-2xl font-black text-purple-700">
            ₹{rangeStats.cashGiven.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Flower Purchases</span>
          <span className="text-2xl font-black text-indigo-700">
            ₹{rangeStats.flowerCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Salesmen Balance Owed</span>
          <span className="text-2xl font-black text-emerald-600">
            ₹{rangeStats.salesmanOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Outstanding Vendor Debt</span>
          <span className="text-2xl font-black text-red-500">
            ₹{rangeStats.vendorOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* ── Reusable Date Filter Picker ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0 flex-wrap">
          {['today', 'yesterday', 'week', 'month', 'custom'].map(preset => (
            <button
              key={preset}
              onClick={() => setDateFilterPreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black capitalize transition-all ${
                dateFilterPreset === preset 
                  ? 'bg-purple-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        {dateFilterPreset === 'custom' && (
          <div className="flex items-center gap-2 animate-in slide-in-from-left duration-250">
            <div>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                style={{ ...INPUT_S, width: '135px' }}
              />
            </div>
            <span className="text-slate-400 font-bold text-xs">to</span>
            <div>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                style={{ ...INPUT_S, width: '135px' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Working Section Tabs ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Main interactive cockpit */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 lg:col-span-8 flex flex-col h-full min-h-0">
          <div className="flex border-b border-slate-100 pb-2 gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('cash')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'cash' 
                  ? 'bg-purple-50 text-purple-700 border-2 border-purple-100 shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              💸 Bulk Cash Issue
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'audit' 
                  ? 'bg-purple-50 text-purple-700 border-2 border-purple-100 shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              🔍 Purchase Auditing
            </button>
            <button
              onClick={() => setActiveTab('ledgers')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'ledgers' 
                  ? 'bg-purple-50 text-purple-700 border-2 border-purple-100 shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              📊 Balances Ledgers
            </button>
          </div>

          {/* Scrollable tab content body */}
          <div className="flex-1 overflow-y-auto mt-3 pr-1">

          {/* Tab 1: Bulk Cash Issue */}
          {activeTab === 'cash' && (
            <form onSubmit={handleBulkCashSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-black text-slate-800">Issue Daily cash to salesmen</h3>
                <p className="text-slate-400 text-xs">Enter amounts next to each salesman to log their daily cash opening balances.</p>
              </div>

              {salesmen.length === 0 ? (
                <p className="text-slate-400 text-xs italic py-6 text-center">No active salesman profiles registered.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {salesmen.map(s => (
                    <div key={s.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                      <div className="sm:col-span-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">👤</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">{s.name}</span>
                          <span className="text-[10px] text-slate-400">{s.location || 'No Location'}</span>
                        </div>
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="number"
                          placeholder="Amount (₹)"
                          value={bulkCashInputs[s.id]?.amount || ''}
                          onChange={e => setBulkCashInputs({
                            ...bulkCashInputs,
                            [s.id]: { ...bulkCashInputs[s.id], amount: e.target.value }
                          })}
                          style={INPUT_S}
                          min="1"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          placeholder="Notes/Reference (e.g. Owner Ref)"
                          value={bulkCashInputs[s.id]?.notes || ''}
                          onChange={e => setBulkCashInputs({
                            ...bulkCashInputs,
                            [s.id]: { ...bulkCashInputs[s.id], notes: e.target.value }
                          })}
                          style={INPUT_S}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="submit"
                    disabled={bulkSaving}
                    className="w-full md:w-auto self-end px-8 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition-colors shadow-lg shadow-purple-100 disabled:opacity-50 mt-2"
                  >
                    {bulkSaving ? 'Saving cash given entries...' : 'Submit Cash Issues'}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Tab 2: Purchase Auditing */}
          {activeTab === 'audit' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-sm font-black text-slate-800">Reconcile & Audit Flower Purchases</h3>
                  <p className="text-slate-400 text-xs">Review purchases logged by salesmen, make corrections, or enter new records.</p>
                </div>
                <button
                  onClick={() => handleOpenPurchaseModal()}
                  className="px-3.5 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-black flex items-center gap-1 transition-colors"
                >
                  <Plus size={14} /> Log Purchase
                </button>
              </div>

              {/* Purchases List */}
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">
                      <th className="p-3">Date</th>
                      <th className="p-3">Salesman</th>
                      <th className="p-3">Vendor</th>
                      <th className="p-3">Flower</th>
                      <th className="p-3">Qty/Rate</th>
                      <th className="p-3">Total</th>
                      <th className="p-3">Paid</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold">
                    {filteredPurchases.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-slate-400 italic">
                          No purchases found in range.
                        </td>
                      </tr>
                    ) : (
                      filteredPurchases.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="p-3 text-slate-500">{displayDate(p.date)}</td>
                          <td className="p-3 text-slate-800">{salesmen.find(s => s.id === p.salesman_id)?.name || 'Unknown'}</td>
                          <td className="p-3 text-slate-800">{p.vendor_name}</td>
                          <td className="p-3 text-indigo-700">{p.flower_type}</td>
                          <td className="p-3 text-slate-600 font-mono">{p.quantity}kg @ ₹{p.rate}</td>
                          <td className="p-3 text-slate-900 font-mono">₹{(p.total_amount || 0).toFixed(0)}</td>
                          <td className="p-3 text-emerald-600 font-mono">₹{(p.amount_paid || 0).toFixed(0)}</td>
                          <td className="p-3 text-center flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenPurchaseModal(p)}
                              className="text-purple-600 hover:bg-purple-50 p-1.5 rounded-lg transition-all"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeletePurchase(p)}
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Balances Ledgers */}
          {activeTab === 'ledgers' && (
            <div className="flex flex-col gap-6">
              
              {/* Salesmen section */}
              <div>
                <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2 mb-3">
                  👤 Salesmen Daily Activity & Balances
                </h3>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">
                        <th className="p-3">Salesman Name</th>
                        <th className="p-3">Opening Bal</th>
                        <th className="p-3">Total In (+)</th>
                        <th className="p-3">Total Out (-)</th>
                        <th className="p-3">Closing Bal</th>
                        <th className="p-3 text-center">Statement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold">
                      {salesmenLedgers.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/50">
                          <td className="p-3 text-slate-800">{row.name}</td>
                          <td className="p-3 font-mono text-slate-600">₹{row.openingBalance.toFixed(0)}</td>
                          <td className="p-3 font-mono text-emerald-600">+₹{row.rangeIn.toFixed(0)}</td>
                          <td className="p-3 font-mono text-red-500">-₹{row.rangeOut.toFixed(0)}</td>
                          <td className={`p-3 font-mono ${row.closingBalance >= 0 ? 'text-slate-900' : 'text-amber-600'}`}>
                            ₹{row.closingBalance.toFixed(0)}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => navigate(`/app/owner-preview?type=salesman&id=${row.id}&from=${fromDate}&to=${toDate}`)}
                              className="text-purple-600 hover:text-purple-800"
                            >
                              View Statement &rarr;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Vendors section */}
              <div>
                <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2 mb-3">
                  🏪 Vendors Daily Activity & Debt Owed
                </h3>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">
                        <th className="p-3">Vendor Name</th>
                        <th className="p-3">Shop Name</th>
                        <th className="p-3">Opening Owed</th>
                        <th className="p-3">Purchased Today (+)</th>
                        <th className="p-3">Paid Today (-)</th>
                        <th className="p-3">Closing Owed</th>
                        <th className="p-3 text-center">Statement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold">
                      {vendorsLedgers.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/50">
                          <td className="p-3 text-slate-800">{row.name}</td>
                          <td className="p-3 text-slate-500">{row.shopName || '---'}</td>
                          <td className="p-3 font-mono text-slate-600">₹{row.openingBalance.toFixed(0)}</td>
                          <td className="p-3 font-mono text-red-500">+₹{row.rangeIn.toFixed(0)}</td>
                          <td className="p-3 font-mono text-emerald-600">-₹{row.rangeOut.toFixed(0)}</td>
                          <td className="p-3 font-mono text-slate-900">₹{row.closingBalance.toFixed(0)}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => navigate(`/app/owner-preview?type=vendor&id=${row.id}&from=${fromDate}&to=${toDate}`)}
                              className="text-purple-600 hover:text-purple-800"
                            >
                              View Statement &rarr;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          </div>
        </div>

        {/* Side panels */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full min-h-0">
          {/* Calendar presets / info */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3 h-full overflow-y-auto">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-1.5 shrink-0">
              💡 Dashboard Presets Range Info
            </h3>
            <div className="text-xs text-slate-500 leading-relaxed flex flex-col gap-2">
              <p>&bull; <strong>Grand Totals</strong> update live based on date filters.</p>
              <p>&bull; <strong>Opening Balances</strong> are dynamically calculated as of the day *before* your selected date range.</p>
              <p>&bull; <strong>Closing Balances</strong> carry forward to subsequent days automatically.</p>
            </div>
          </div>
        </div>

      </div>

      {/* ── Edit Purchase Modal ── */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <form
            onSubmit={handleSavePurchase}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in duration-300 overflow-hidden flex flex-col"
          >
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">
                {purchaseForm.id ? 'Edit Purchase Audit Record' : 'Record New Flower Purchase'}
              </h3>
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={LABEL_S}>Date *</label>
                  <input
                    type="date"
                    value={purchaseForm.date}
                    onChange={e => setPurchaseForm({ ...purchaseForm, date: e.target.value })}
                    style={INPUT_S}
                    required
                  />
                </div>
                <div>
                  <label style={LABEL_S}>Salesman *</label>
                  <select
                    value={purchaseForm.salesmanId}
                    onChange={e => setPurchaseForm({ ...purchaseForm, salesmanId: e.target.value })}
                    style={INPUT_S}
                    required
                    className="font-bold"
                  >
                    <option value="">-- Select --</option>
                    {salesmen.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={LABEL_S}>Vendor *</label>
                  <select
                    value={purchaseForm.vendorId}
                    onChange={e => setPurchaseForm({ ...purchaseForm, vendorId: e.target.value })}
                    style={INPUT_S}
                    required
                    className="font-bold"
                  >
                    <option value="">-- Select --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={LABEL_S}>Flower Variety *</label>
                  <select
                    value={purchaseForm.flowerType}
                    onChange={e => setPurchaseForm({ ...purchaseForm, flowerType: e.target.value })}
                    style={INPUT_S}
                    required
                    className="font-bold"
                  >
                    <option value="">-- Select --</option>
                    {flowers.map(f => (
                      <option key={f.name} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label style={LABEL_S}>Qty (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchaseForm.quantity}
                    onChange={e => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                    style={INPUT_S}
                    required
                  />
                </div>
                <div>
                  <label style={LABEL_S}>Rate (₹/kg)</label>
                  <input
                    type="number"
                    value={purchaseForm.rate}
                    onChange={e => setPurchaseForm({ ...purchaseForm, rate: e.target.value })}
                    style={INPUT_S}
                    required
                  />
                </div>
                <div>
                  <label style={LABEL_S}>Paid (₹)</label>
                  <input
                    type="number"
                    value={purchaseForm.amountPaid}
                    onChange={e => setPurchaseForm({ ...purchaseForm, amountPaid: e.target.value })}
                    style={INPUT_S}
                    required
                  />
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl font-bold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingPurchase}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-extrabold text-xs transition-all shadow-md shadow-purple-100"
              >
                {isSavingPurchase ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default OwnerDashboard;
