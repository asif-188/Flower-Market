
import React, { useState, useEffect, useMemo } from 'react';
import { Search, BarChart3, MessageCircle, ChevronRight } from 'lucide-react';
import { subscribeToCollection } from '../utils/storage';

const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const toDateStr = (d) => {
    // Returns YYYY-MM-DD in local time
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const displayDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

const Reports = () => {
    const today = toDateStr(new Date());

    const [sales, setSales]   = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [payments, setPayments] = useState([]);

    const [fromDate, setFromDate] = useState(today);
    const [toDate,   setToDate]   = useState(today);
    const [appliedFrom, setAppliedFrom] = useState(today);
    const [appliedTo,   setAppliedTo]   = useState(today);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const u1 = subscribeToCollection('sales',    setSales);
        const u2 = subscribeToCollection('buyers',   setBuyers);
        const u3 = subscribeToCollection('payments', setPayments);
        return () => { u1(); u2(); u3(); };
    }, []);

    /* ── Date preset helpers ── */
    const applyPreset = (preset) => {
        const now = new Date();
        let f = toDateStr(now);
        let t = toDateStr(now);
        if (preset === 'month') {
            f = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
            t = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        }
        setFromDate(f); setToDate(t);
        setAppliedFrom(f); setAppliedTo(t);
    };

    const handleApply = () => {
        setAppliedFrom(fromDate);
        setAppliedTo(toDate);
    };

    /* ── Build per-buyer summary ── */
    const report = useMemo(() => {
        // Filter sales by date range
        const filteredSales = sales.filter(s => {
            const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
            if (!d) return false;
            return d >= appliedFrom && d <= appliedTo;
        });

        // Filter payments by date range
        const filteredPayments = payments.filter(p => {
            const d = p.timestamp
                ? (typeof p.timestamp === 'string'
                    ? p.timestamp.substring(0, 10)
                    : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp)))
                : null;
            if (!d) return false;
            return d >= appliedFrom && d <= appliedTo && p.type === 'buyer';
        });

        // Group sales by buyerId
        const salesByBuyer = {};
        filteredSales.forEach(s => {
            if (!salesByBuyer[s.buyerId]) salesByBuyer[s.buyerId] = 0;
            salesByBuyer[s.buyerId] += s.grandTotal || 0;
        });

        // Group payments by buyerId
        const paidByBuyer = {};
        filteredPayments.forEach(p => {
            if (!paidByBuyer[p.entityId]) paidByBuyer[p.entityId] = 0;
            paidByBuyer[p.entityId] += p.amount || 0;
        });

        // Merge with buyers list
        const allBuyerIds = new Set([
            ...Object.keys(salesByBuyer),
            ...Object.keys(paidByBuyer)
        ]);

        const rows = [];
        allBuyerIds.forEach(id => {
            const buyer = buyers.find(b => b.id === id);
            const salesAmt = salesByBuyer[id] || 0;
            const paidAmt  = paidByBuyer[id]  || 0;
            const balance  = buyer?.balance ?? (salesAmt - paidAmt);
            rows.push({
                id,
                name: buyer?.name || 'Unknown',
                sales: salesAmt,
                paid: paidAmt,
                balance,
            });
        });

        return rows.sort((a, b) => b.sales - a.sales);
    }, [sales, payments, buyers, appliedFrom, appliedTo]);

    /* ── Summary totals ── */
    const totalSales   = report.reduce((s, r) => s + r.sales, 0);
    const totalPaid    = report.reduce((s, r) => s + r.paid, 0);
    const totalNet     = totalSales - totalPaid;
    const totalDues    = report.reduce((s, r) => s + Math.max(0, r.balance), 0);

    /* ── Filtered rows ── */
    const filtered = report.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase())
    );

    /* ── Styles ── */
    const thCls = "text-left text-[10px] font-black text-emerald-700 uppercase tracking-widest pb-3";

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-in fade-in duration-500">

            {/* ── Top toolbar row ── */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                {/* Title */}
                <div className="flex items-center gap-2 mr-2">
                    <span className="text-xl">📊</span>
                    <h2 className="text-xl font-black text-gray-800 whitespace-nowrap">Customer Report</h2>
                </div>

                {/* Date range display */}
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap hidden sm:inline">
                    {displayDate(appliedFrom)} To {displayDate(appliedTo)}
                </span>

                {/* Today / Month presets */}
                <button
                    onClick={() => applyPreset('today')}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-md hover:bg-emerald-700 transition-all"
                >
                    Today
                </button>
                <button
                    onClick={() => applyPreset('month')}
                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 text-xs font-black rounded-md hover:bg-gray-50 transition-all"
                >
                    Month
                </button>

                {/* Date pickers */}
                <input
                    type="date"
                    value={fromDate}
                    onChange={e => setFromDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-gray-400 font-bold">To</span>
                <input
                    type="date"
                    value={toDate}
                    onChange={e => setToDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-emerald-500"
                />

                {/* Apply */}
                <button
                    onClick={handleApply}
                    className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-md hover:bg-emerald-700 transition-all shadow-sm"
                >
                    Apply
                </button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* WhatsApp icon */}
                <button className="w-9 h-9 flex items-center justify-center rounded-xl border-2 border-emerald-300 bg-white text-emerald-500 hover:bg-emerald-50 transition-all">
                    <MessageCircle size={18} />
                </button>
                {/* Chart icon */}
                <button className="w-9 h-9 flex items-center justify-center rounded-xl border-2 border-blue-200 bg-white text-blue-500 hover:bg-blue-50 transition-all">
                    <BarChart3 size={18} />
                </button>
            </div>

            {/* ── Summary stat cards ── */}
            <div className="flex gap-3 mb-5 flex-wrap">
                <div className="flex-1 min-w-[120px] bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Sales</p>
                    <p className="text-lg font-black text-blue-800">{fmt(totalSales)}</p>
                </div>
                <div className="flex-1 min-w-[120px] bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Paid</p>
                    <p className="text-lg font-black text-emerald-800">{fmt(totalPaid)}</p>
                </div>
                <div className="flex-1 min-w-[120px] bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                    <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-1">Net</p>
                    <p className="text-lg font-black text-orange-800">{fmt(totalNet)}</p>
                </div>
                <div className="flex-1 min-w-[120px] bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1">Dues</p>
                    <p className="text-lg font-black text-red-800">{fmt(totalDues)}</p>
                </div>

                {/* Search on the right */}
                <div className="flex-shrink-0 flex items-center">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={14} />
                        <input
                            type="text"
                            placeholder="Search by name or ID..."
                            className="pl-9 pr-4 py-2 border-2 border-emerald-400 rounded-full text-xs font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-gray-400 w-56"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="px-5 py-3 bg-white border-b border-gray-100">
                    <div className="grid grid-cols-5 gap-4">
                        <span className={thCls}>CustomerName</span>
                        <span className={`${thCls} text-right`}>Sales</span>
                        <span className={`${thCls} text-right`}>Paid</span>
                        <span className={`${thCls} text-right`}>Balance</span>
                        <span className={`${thCls} text-right`}>Action</span>
                    </div>
                </div>

                {/* Table body */}
                <div className="divide-y divide-gray-50">
                    {filtered.length === 0 ? (
                        <p className="py-12 text-center text-sm text-gray-300 italic font-medium">
                            No records found.
                        </p>
                    ) : (
                        filtered.map(row => (
                            <div key={row.id} className="px-5 py-4 grid grid-cols-5 gap-4 items-center hover:bg-gray-50 transition-colors group">
                                <span className="text-sm font-semibold text-gray-800 truncate">{row.name}</span>
                                <span className="text-sm font-bold text-blue-700 text-right">{fmt(row.sales)}</span>
                                <span className="text-sm font-bold text-emerald-600 text-right">{fmt(row.paid)}</span>
                                <span className={`text-sm font-black text-right ${row.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {fmt(row.balance)}
                                </span>
                                <div className="flex justify-end">
                                    <button className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 opacity-0 group-hover:opacity-100 transition-all">
                                        View <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Reports;
