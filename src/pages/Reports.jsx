import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Search, MessageCircle, BarChart2, X, User, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { subscribeToCollection, db } from '../utils/storage';
import { doc, getDoc } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { generateBuyerReceiptCanvas } from '../utils/receiptCanvas';

const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const Reports = () => {
    const { t } = useContext(LangContext);
    const today = toDateStr(new Date());

    const [sales, setSales]       = useState([]);
    const [buyers, setBuyers]     = useState([]);
    const [payments, setPayments] = useState([]);

    const [fromDate, setFromDate]         = useState(today);
    const [toDate, setToDate]             = useState(today);
    const [appliedFrom, setAppliedFrom]   = useState(today);
    const [appliedTo, setAppliedTo]       = useState(today);
    const [search, setSearch]             = useState('');
    const [activePreset, setActivePreset] = useState('today');
    const [detailBuyer, setDetailBuyer]     = useState(null);
    const [isDownloading, setIsDownloading]  = useState(false);
    const [sharingRowId, setSharingRowId]    = useState(null);
    const [bizInfo, setBizInfo]              = useState({ name: 'Poovanam Market', type: 'Flower Business', address: '', phones: '' });

    // Load business info once
    useEffect(() => {
        getDoc(doc(db, 'system', 'settings')).then(snap => {
            if (snap.exists()) setBizInfo(d => ({ ...d, ...snap.data() }));
        }).catch(() => {});
    }, []);

    useEffect(() => {
        const u1 = subscribeToCollection('sales',    setSales);
        const u2 = subscribeToCollection('buyers',   setBuyers);
        const u3 = subscribeToCollection('payments', setPayments);
        return () => { u1(); u2(); u3(); };
    }, []);

    const applyPreset = (preset) => {
        const now = new Date();
        let f = toDateStr(now), to = toDateStr(now);
        if (preset === 'month') {
            f  = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
            to = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        }
        setFromDate(f); setToDate(to);
        setAppliedFrom(f); setAppliedTo(to);
        setActivePreset(preset);
    };

    const handleApply = () => { setAppliedFrom(fromDate); setAppliedTo(toDate); };

    const report = useMemo(() => {
        const filteredSales = sales.filter(s => {
            const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
            return d && d >= appliedFrom && d <= appliedTo;
        });
        const filteredPayments = payments.filter(p => {
            const d = p.timestamp
                ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10)
                    : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp)))
                : null;
            return d && d >= appliedFrom && d <= appliedTo && p.type === 'buyer';
        });

        const salesByBuyer = {}, paidByBuyer = {};
        filteredSales.forEach(s => { salesByBuyer[s.buyerId] = (salesByBuyer[s.buyerId] || 0) + (s.grandTotal || 0); });
        filteredPayments.forEach(p => { paidByBuyer[p.entityId] = (paidByBuyer[p.entityId] || 0) + (p.amount || 0); });

        const allIds = new Set([...Object.keys(salesByBuyer), ...Object.keys(paidByBuyer)]);
        const rows = [];
        allIds.forEach(id => {
            const buyer = buyers.find(b => b.id === id);
            const salesAmt = salesByBuyer[id] || 0;
            const paidAmt  = paidByBuyer[id]  || 0;
            rows.push({ id, name: buyer?.name || 'Unknown', displayId: buyer?.displayId || '---', sales: salesAmt, paid: paidAmt, balance: buyer?.balance ?? (salesAmt - paidAmt) });
        });
        return rows.sort((a, b) => b.sales - a.sales);
    }, [sales, payments, buyers, appliedFrom, appliedTo]);

    const totalSales = report.reduce((s, r) => s + r.sales, 0);
    const totalPaid  = report.reduce((s, r) => s + r.paid, 0);
    const totalNet   = totalSales - totalPaid;
    const totalDues  = report.reduce((s, r) => s + Math.max(0, r.balance), 0);

    const filtered = report.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.displayId.toString().includes(search)
    );

    const detailTransactions = useMemo(() => {
        if (!detailBuyer) return [];
        const res = [];
        sales.filter(s => s.buyerId === detailBuyer.id).forEach(s => {
            const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
            if (d && d >= appliedFrom && d <= appliedTo) res.push({ date: d, type: 'SALE', amount: s.grandTotal || 0 });
        });
        payments.filter(p => p.entityId === detailBuyer.id && p.type === 'buyer').forEach(p => {
            const d = p.timestamp
                ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10)
                    : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp)))
                : null;
            if (d && d >= appliedFrom && d <= appliedTo) res.push({ date: d, type: 'PAID', amount: p.amount || 0 });
        });
        return res.sort((a, b) => b.date.localeCompare(a.date));
    }, [detailBuyer, sales, payments, appliedFrom, appliedTo]);

    // ── Per-row WhatsApp receipt share ──
    const handleShareRow = async (row) => {
        setSharingRowId(row.id);
        try {
            // Gather flat sales items for this buyer in applied period
            const buyerSales = sales.filter(s => {
                if (s.buyerId !== row.id) return false;
                const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
                return d && d >= appliedFrom && d <= appliedTo;
            });
            const flatItems = buyerSales.flatMap(s => s.items || []);

            // Payments in period
            const buyerPayments = payments.filter(p => {
                if (p.entityId !== row.id || p.type !== 'buyer') return false;
                const d = p.timestamp
                    ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10)
                        : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp)))
                    : null;
                return d && d >= appliedFrom && d <= appliedTo;
            });
            const paymentsTotal  = buyerPayments.reduce((s, p) => s + (p.amount || 0), 0);

            // prevBalance = current DB balance - sales + payments (reverse the period)
            const buyer = buyers.find(b => b.id === row.id);
            const prevBalance = (buyer?.balance || 0) - row.sales + paymentsTotal;

            const { blob, url } = await generateBuyerReceiptCanvas({
                buyer:         row,
                salesItems:    flatItems,
                salesTotal:    row.sales,
                paymentsTotal,
                prevBalance,
                fromDate:      appliedFrom,
                toDate:        appliedTo,
                bizInfo,
            });

            // Try native share (mobile) first, else open image
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'receipt.png', { type: 'image/png' })] })) {
                await navigator.share({
                    files: [new File([blob], 'receipt.png', { type: 'image/png' })],
                    title: `Receipt – ${row.name}`,
                });
            } else {
                // Fallback: open image in new tab (user can save & share manually)
                const a = document.createElement('a');
                a.href = url;
                a.download = `receipt_${row.name.replace(/\s+/g,'_')}.png`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 30000);
            }
        } catch (err) {
            console.error('Receipt error:', err);
            alert('❌ Could not generate receipt: ' + err.message);
        } finally {
            setSharingRowId(null);
        }
    };

    const handleWhatsAppShare = () => {
        if (report.length === 0) return;
        let msg = `*CUSTOMER REPORT*\nPeriod: ${appliedFrom} to ${appliedTo}\nSales: ${fmt(totalSales)}\nPaid: ${fmt(totalPaid)}\nDues: ${fmt(totalDues)}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const handleDownloadXLSX = async () => {
        if (report.length === 0) return alert('No data to download.');
        setIsDownloading(true);
        try {
            const data = report.map(r => ({ ID: r.displayId, Customer: r.name, Sales: r.sales, Paid: r.paid, Balance: r.balance }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Report');
            const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `Report_${appliedFrom}_to_${appliedTo}.xlsx`;
            a.click();
        } catch (e) { alert('Error: ' + e.message); }
        finally { setIsDownloading(false); }
    };

    // Style helpers (matching screenshot)
    const S = {
        page: { background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', padding: '24px 28px', minHeight: '70vh', fontFamily: 'var(--font-sans)' },
        toolbar: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' },
        th: { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap', background: '#fff' },
        td: { padding: '12px 14px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
    };

    const STAT_CARDS = [
        { label: 'SALES',   value: totalSales, accent: '#3b82f6', bg: '#eff6ff', textColor: '#1d4ed8' },
        { label: 'PAID',    value: totalPaid,  accent: '#16a34a', bg: '#f0fdf4', textColor: '#15803d' },
        { label: 'NET',     value: totalNet,   accent: '#f97316', bg: '#fff7ed', textColor: '#c2410c' },
        { label: 'DUES',    value: totalDues,  accent: '#ef4444', bg: '#fef2f2', textColor: '#dc2626' },
    ];

    return (
        <div style={S.page}>

            {/* ── Toolbar ── */}
            <div style={S.toolbar}>
                {/* Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
                    <span style={{ fontSize: '20px' }}>📊</span>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                        {t('reports')}
                    </span>
                </div>

                {/* Applied range label */}
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {appliedFrom} To {appliedTo}
                </span>

                {/* Today / Month pills */}
                {['today', 'month'].map(p => (
                    <button key={p} onClick={() => applyPreset(p)} style={{
                        padding: '5px 14px', borderRadius: '8px', border: 'none',
                        background: activePreset === p ? '#16a34a' : '#f1f5f9',
                        color: activePreset === p ? '#fff' : '#64748b',
                        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                    }}>
                        {p === 'today' ? t('today') : t('month')}
                    </button>
                ))}

                {/* Date inputs */}
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#374151', outline: 'none', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>To</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#374151', outline: 'none', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />

                {/* Apply */}
                <button onClick={handleApply} style={{
                    padding: '6px 18px', borderRadius: '8px', background: '#16a34a', border: 'none',
                    color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                }}>
                    {t('apply')}
                </button>

                <div style={{ flex: 1 }} />

                {/* WhatsApp */}
                <button onClick={handleWhatsAppShare} title="Share on WhatsApp"
                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #22c55e', background: '#fff', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#22c55e'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#22c55e'; }}
                >
                    <MessageCircle size={16} />
                </button>

                {/* Excel / Bar chart */}
                <button onClick={handleDownloadXLSX} disabled={isDownloading} title="Download Excel"
                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                    {isDownloading
                        ? <div style={{ width: '14px', height: '14px', border: '2px solid #e2e8f0', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        : <BarChart2 size={16} />
                    }
                </button>
            </div>

            {/* ── Stat Cards + Search Row ── */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'stretch' }}>
                {STAT_CARDS.map(card => (
                    <div key={card.label} style={{ flex: 1, minWidth: '120px', borderRadius: '10px', border: `1.5px solid ${card.accent}22`, background: card.bg, padding: '12px 16px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: card.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{card.label}</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: card.textColor }}>{fmt(card.value)}</div>
                    </div>
                ))}

                {/* Search */}
                <div style={{ flex: 1.5, minWidth: '220px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} style={{ position: 'absolute', left: '12px', color: '#9ca3af', pointerEvents: 'none' }} />
                    <input type="text" placeholder="Search by name or ID..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', color: '#374151', background: '#fff', outline: 'none', fontFamily: 'var(--font-sans)' }}
                        onFocus={e => e.target.style.borderColor = '#16a34a'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                </div>
            </div>

            {/* ── Table ── */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={S.th}>{t('customerName')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('sales')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>Paid</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>Balance</th>
                            <th style={{ ...S.th, textAlign: 'center' }}>{t('action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
                                    No records found.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((row, idx) => (
                                <tr key={row.id}
                                    style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa'}
                                >
                                    <td style={S.td}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' }}>
                                                #{row.displayId}
                                            </span>
                                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{row.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>{fmt(row.sales)}</td>
                                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{fmt(row.paid)}</td>
                                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: row.balance > 0 ? '#dc2626' : '#15803d' }}>{fmt(row.balance)}</td>
                                    <td style={{ ...S.td, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            {/* View detail */}
                                            <button onClick={() => setDetailBuyer(row)}
                                                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-sans)' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#16a34a'; }}
                                            >
                                                View <ChevronRight size={13} />
                                            </button>

                                            {/* WhatsApp receipt share */}
                                            <button
                                                onClick={() => handleShareRow(row)}
                                                disabled={sharingRowId === row.id}
                                                title="Share receipt on WhatsApp"
                                                style={{
                                                    width: '32px', height: '32px', borderRadius: '8px',
                                                    border: '1.5px solid #22c55e', background: '#fff',
                                                    color: '#22c55e', display: 'inline-flex',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    cursor: sharingRowId === row.id ? 'not-allowed' : 'pointer',
                                                    opacity: sharingRowId === row.id ? 0.5 : 1,
                                                    flexShrink: 0,
                                                }}
                                                onMouseEnter={e => { if (sharingRowId !== row.id) { e.currentTarget.style.background='#22c55e'; e.currentTarget.style.color='#fff'; }}}
                                                onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#22c55e'; }}
                                            >
                                                {sharingRowId === row.id
                                                    ? <div style={{ width:'14px', height:'14px', border:'2px solid #22c55e33', borderTopColor:'#22c55e', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
                                                    : <MessageCircle size={14} />
                                                }
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Detail Modal ── */}
            {detailBuyer && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-display)' }}>{detailBuyer.name}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Customer Ledger • #{detailBuyer.displayId}</div>
                            </div>
                            <button onClick={() => setDetailBuyer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={20} /></button>
                        </div>

                        {/* Mini summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', padding: '16px 24px 0' }}>
                            {[{ l: 'Sales', v: detailBuyer.sales, c: '#1d4ed8', bg: '#eff6ff' }, { l: 'Paid', v: detailBuyer.paid, c: '#15803d', bg: '#f0fdf4' }, { l: 'Balance', v: detailBuyer.balance, c: '#dc2626', bg: '#fef2f2' }].map(x => (
                                <div key={x.l} style={{ background: x.bg, borderRadius: '10px', padding: '10px 12px' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: x.c, textTransform: 'uppercase', marginBottom: '3px' }}>{x.l}</div>
                                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>{fmt(x.v)}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ padding: '16px 24px', maxHeight: '50vh', overflowY: 'auto' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Transaction History</div>
                            {detailTransactions.length === 0 ? (
                                <div style={{ padding: '36px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>No transactions in this period.</div>
                            ) : (
                                <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                                    {detailTransactions.map((tx, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < detailTransactions.length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '40px', height: '32px', borderRadius: '7px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>
                                                    {tx.date.split('-').slice(1).reverse().join('/')}
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: tx.type === 'SALE' ? '#3b82f6' : '#16a34a' }}>{tx.type}</span>
                                            </div>
                                            <span style={{ fontWeight: 700, fontSize: '14px', color: tx.type === 'SALE' ? '#1e293b' : '#16a34a' }}>
                                                {tx.type === 'PAID' ? '-' : ''}{fmt(tx.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setDetailBuyer(null)}
                                style={{ padding: '8px 20px', borderRadius: '9px', background: '#1e293b', color: '#fff', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-sans)' }}>
                                {t('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
