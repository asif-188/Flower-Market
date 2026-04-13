import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Search, BarChart3, MessageCircle, ChevronRight, TrendingUp, Download, X, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import { subscribeToCollection } from '../utils/storage';
import { LangContext } from '../components/Layout';

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
    const { t } = useContext(LangContext);
    const today = toDateStr(new Date());

    const [sales, setSales]   = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [payments, setPayments] = useState([]);

    const [fromDate, setFromDate] = useState(today);
    const [toDate,   setToDate]   = useState(today);
    const [appliedFrom, setAppliedFrom] = useState(today);
    const [appliedTo,   setAppliedTo]   = useState(today);
    const [search, setSearch] = useState('');
    const [activePreset, setActivePreset] = useState('today');
    const [detailBuyer, setDetailBuyer] = useState(null);

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
        setActivePreset(preset);
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
                displayId: buyer?.displayId || '---',
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
        r.name.toLowerCase().includes(search.toLowerCase()) || 
        r.displayId.toString().toLowerCase().includes(search.toLowerCase())
    );

    /* ── Detail Data for Modal ── */
    const detailTransactions = useMemo(() => {
        if (!detailBuyer) return [];
        
        const res = [];
        // Sales
        sales.filter(s => s.buyerId === detailBuyer.id).forEach(s => {
            const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '---');
            if (d >= appliedFrom && d <= appliedTo) {
                res.push({ date: d, type: 'SALE', amount: s.grandTotal || 0 });
            }
        });
        // Payments
        payments.filter(p => p.entityId === detailBuyer.id && p.type === 'buyer').forEach(p => {
            const d = p.timestamp
                ? (typeof p.timestamp === 'string'
                    ? p.timestamp.substring(0, 10)
                    : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp)))
                : null;
            if (d && d >= appliedFrom && d <= appliedTo) {
                res.push({ date: d, type: 'PAID', amount: p.amount || 0 });
            }
        });
        
        return res.sort((a,b) => b.date.localeCompare(a.date));
    }, [detailBuyer, sales, payments, appliedFrom, appliedTo]);

    /* ── Styles ── */
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState(null);

    const handleDownloadXLSX = async () => {
        if (report.length === 0) {
            alert("No data available to download.");
            return;
        }

        setIsDownloading(true);
        setDownloadUrl(null);
        try {
            await new Promise(r => setTimeout(r, 600));

            const data = report.map(r => ({
                'ID': r.displayId,
                'Customer_Name': r.name,
                'Total_Sales': r.sales,
                'Total_Paid': r.paid,
                'Balance': r.balance
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Sales_Report");

            // Generate the file as a buffer
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            
            // Set the URL so the user can click it if the auto-trigger fails
            setDownloadUrl({
                url,
                name: `Report_${appliedFrom}_to_${appliedTo}.xlsx`
            });

            // Auto-trigger
            const a = document.createElement('a');
            a.href = url;
            a.download = `Report_${appliedFrom}_to_${appliedTo}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Cleanup after 30 seconds
            setTimeout(() => {
                URL.revokeObjectURL(url);
                setDownloadUrl(null);
            }, 30000);
            
        } catch (error) {
            console.error(error);
            alert("Error generating file. Please try the WhatsApp share instead.");
        } finally {
            setIsDownloading(false);
        }
    };
    const handleWhatsAppShare = () => {
        if (report.length === 0) return;
        let message = `*CUSTOMER REPORT SUMMARY*\n`;
        message += `Period: ${appliedFrom} to ${appliedTo}\n`;
        message += `Total Sales: ${fmt(totalSales)}\n`;
        message += `Total Paid: ${fmt(totalPaid)}\n`;
        message += `Total Dues: ${fmt(totalDues)}\n\n`;
        message += `Thank you!`;
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    /* ── Styles ── */
    const thCls = "text-left text-[11px] font-black text-[#1e8a44] uppercase tracking-widest pb-3";
    const cardCls = "flex-1 min-w-[150px] rounded-xl px-5 py-4 shadow-sm border border-gray-100 flex flex-col justify-center transition-all hover:translate-y-[-2px]";

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-in fade-in duration-500">

            {/* ── Toolbar Header (Matches Screenshot) ── */}
            <div className="flex flex-wrap items-center gap-4 mb-8 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                
                {/* Title and Icon */}
                <div className="flex items-center gap-3 pr-4 border-r border-gray-100">
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
                        <TrendingUp size={22} />
                    </div>
                    <h2 className="text-xl font-black text-gray-800 tracking-tight">{t('reports')}</h2>
                </div>

                {/* Date Display */}
                <div className="text-sm font-bold text-gray-400 px-2 min-w-[200px]">
                    {displayDate(appliedFrom)} {t('to') || 'To'} {displayDate(appliedTo)}
                </div>

                {/* Today / Month Toggle */}
                <div className="bg-gray-100 p-1 rounded-xl flex items-center">
                    <button
                        onClick={() => applyPreset('today')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activePreset === 'today' ? 'bg-[#10b981] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t('today') || 'Today'}
                    </button>
                    <button
                        onClick={() => applyPreset('month')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activePreset === 'month' ? 'bg-[#10b981] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t('month') || 'month'}
                    </button>
                </div>

                {/* Date Inputs */}
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                    <input
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-gray-700 px-2 outline-none"
                    />
                    <span className="text-[10px] font-black text-gray-300 uppercase">{t('to') || 'To'}</span>
                    <input
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-gray-700 px-2 outline-none"
                    />
                    <button
                        onClick={handleApply}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg transition-all shadow-md ml-1"
                    >
                        {t('apply') || 'Apply'}
                    </button>
                </div>

                <div className="flex-1" />

                {/* Fast Actions */}
                <div className="flex items-center gap-3">
                {/* Fast Actions */}
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleWhatsAppShare}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border-2 border-emerald-300 bg-white text-emerald-500 hover:bg-emerald-50 transition-all"
                        title="Share Summary"
                    >
                        <MessageCircle size={20} />
                    </button>
                    <button 
                        onClick={handleDownloadXLSX}
                        disabled={isDownloading}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50"
                        title="Download Excel"
                    >
                        {isDownloading ? (
                            <div className="w-4 h-4 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
                        ) : (
                            <Download size={20} />
                        )}
                    </button>
                </div>
                </div>
            </div>

            {/* ── Summary stat cards (Matches Screenshot) ── */}
            <div className="flex gap-4 mb-8 flex-wrap items-stretch">
                <div className={`${cardCls} bg-[#f0f9ff]/50 border-l-[6px] border-l-blue-500`}>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">{t('sales')}</p>
                    <p className="text-xl font-black text-gray-800">{fmt(totalSales)}</p>
                </div>
                <div className={`${cardCls} bg-[#f0fdf4]/50 border-l-[6px] border-l-emerald-500`}>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">{t('paid') || 'Paid'}</p>
                    <p className="text-xl font-black text-gray-800">{fmt(totalPaid)}</p>
                </div>
                <div className={`${cardCls} bg-[#fff7ed]/50 border-l-[6px] border-l-orange-500`}>
                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">{t('net') || 'Net'}</p>
                    <p className="text-xl font-black text-gray-800">{fmt(totalNet)}</p>
                </div>
                <div className={`${cardCls} bg-[#fef2f2]/50 border-l-[6px] border-l-red-500`}>
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">{t('dues') || 'Dues'}</p>
                    <p className="text-xl font-black text-gray-800">{fmt(totalDues)}</p>
                </div>

                {/* Search Container */}
                <div className="flex-1 min-w-[280px] flex items-center">
                    <div className="relative w-full">
                        <input
                            type="text"
                            placeholder={t('search')}
                            className="w-full px-6 py-3.5 border-2 border-emerald-400/30 rounded-2xl text-sm font-bold text-gray-700 bg-white outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all placeholder:text-gray-300 shadow-sm"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* ── Download Status / Manual Link ── */}
            {downloadUrl && (
                <div className="mb-4 animate-in slide-in-from-top duration-300">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                                <Download size={16} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-emerald-800 uppercase tracking-tighter">Report Ready</p>
                                <p className="text-[10px] font-bold text-emerald-600/70">{downloadUrl.name}</p>
                            </div>
                        </div>
                        <a 
                            href={downloadUrl.url} 
                            download={downloadUrl.name}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black rounded-lg shadow-md transition-all flex items-center gap-2"
                        >
                            CLICK TO SAVE FILE
                        </a>
                    </div>
                </div>
            )}

            {/* ── Table (Matches Screenshot Exactly) ── */}
            <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                {/* Table header */}
                <div className="px-8 py-5 group-first:rounded-t-2xl border-b border-emerald-50">
                    <div className="grid grid-cols-5 gap-6">
                        <span className={thCls}>{t('customerName') || 'CustomerName'}</span>
                        <span className={`${thCls} text-right`}>{t('sales') || 'Sales'}</span>
                        <span className={`${thCls} text-right`}>{t('paid') || 'Paid'}</span>
                        <span className={`${thCls} text-right`}>{t('balance') || 'Balance'}</span>
                        <span className={`${thCls} text-right`}>{t('action') || 'Action'}</span>
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
                                <span className="text-sm font-semibold text-gray-800 truncate flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 font-black rounded text-[10px] tracking-tighter shadow-sm border border-gray-100">
                                        #{row.displayId}
                                    </span>
                                    {row.name}
                                </span>
                                <span className="text-sm font-bold text-blue-700 text-right">{fmt(row.sales)}</span>
                                <span className="text-sm font-bold text-emerald-600 text-right">{fmt(row.paid)}</span>
                                <span className={`text-sm font-black text-right ${row.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {fmt(row.balance)}
                                </span>
                                <div className="flex justify-end">
                                    <button 
                                        onClick={() => setDetailBuyer(row)}
                                        className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        View <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            {/* ── Detail Modal ── */}
            {detailBuyer && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 relative">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-100">
                                    <User size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-800 tracking-tight">{detailBuyer.name}</h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pt-0.5">Customer Ledger • #{detailBuyer.displayId}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setDetailBuyer(null)}
                                className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* Short Summary inside Modal */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                                    <p className="text-[9px] font-black text-blue-500 uppercase mb-1 tracking-widest">Sales</p>
                                    <p className="text-sm font-black text-gray-800">{fmt(detailBuyer.sales)}</p>
                                </div>
                                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase mb-1 tracking-widest">Paid</p>
                                    <p className="text-sm font-black text-gray-800">{fmt(detailBuyer.paid)}</p>
                                </div>
                                <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                                    <p className="text-[9px] font-black text-rose-500 uppercase mb-1 tracking-widest">Balance</p>
                                    <p className="text-sm font-black text-gray-800">{fmt(detailBuyer.balance)}</p>
                                </div>
                            </div>

                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Transaction History</h4>
                            
                            {detailTransactions.length === 0 ? (
                                <div className="py-12 text-center text-gray-300 italic text-sm">No transactions in this period.</div>
                            ) : (
                                <div className="divide-y divide-gray-50 border border-gray-100 rounded-2xl overflow-hidden">
                                    {detailTransactions.map((tx, idx) => (
                                        <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center text-[10px] font-black">
                                                    {tx.date.split('-').slice(1).reverse().join('/')}
                                                </div>
                                                <div>
                                                    <p className={`text-[10px] font-black uppercase tracking-widest ${tx.type === 'SALE' ? 'text-blue-500' : 'text-emerald-500'}`}>
                                                        {tx.type}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className={`text-sm font-black ${tx.type === 'SALE' ? 'text-gray-800' : 'text-emerald-500'}`}>
                                                {tx.type === 'PAID' ? '-' : ''}{fmt(tx.amount)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Footer */}
                        <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex justify-end">
                            <button 
                                onClick={() => setDetailBuyer(null)}
                                className="px-6 py-2 bg-gray-800 text-white text-[11px] font-black rounded-xl hover:bg-gray-700 transition-all shadow-lg"
                            >
                                CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
