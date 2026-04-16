import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FileText, Printer, Search } from 'lucide-react';
import { subscribeToCollection, db } from '../utils/storage';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { Check, Edit3, Save } from 'lucide-react';

const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const DailyReport = () => {
    const { t, lang } = useContext(LangContext);
    const today = toDateStr(new Date());

    const [sales, setSales]       = useState([]);
    const [buyers, setBuyers]     = useState([]);
    const [payments, setPayments] = useState([]);
    const [search, setSearch]     = useState('');
    const [isEntryMode, setIsEntryMode] = useState(false);
    const [tempAmounts, setTempAmounts] = useState({});
    const [isSaving, setIsSaving]       = useState(false);

    useEffect(() => {
        const u1 = subscribeToCollection('sales',    setSales);
        const u2 = subscribeToCollection('buyers',   setBuyers);
        const u3 = subscribeToCollection('payments', setPayments);
        return () => { u1(); u2(); u3(); };
    }, []);

    const reportData = useMemo(() => {
        return buyers.map(b => {
            const dayPayments = payments.filter(p => 
                p.entityId === b.id && p.type === 'buyer' && 
                (p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date())) : '') === today
            );
            const daySales = sales.filter(s => 
                s.buyerId === b.id && 
                (s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '')) === today
            );

            const received = dayPayments.reduce((s, p) => s + (p.amount || 0), 0);
            const less     = dayPayments.reduce((s, p) => s + (p.cashLess || 0), 0);
            const salesAmt = daySales.reduce((s, x) => s + (x.grandTotal || 0), 0);

            return {
                id: b.id,
                displayId: b.displayId || '---',
                name: b.name,
                nameTa: b.nameTa,
                contact: b.contact || '---',
                balance: b.balance || 0,
                received,
                less,
                sales: salesAmt
            };
        }).sort((a, b) => (parseInt(a.displayId) || 0) - (parseInt(b.displayId) || 0));
    }, [buyers, sales, payments, today]);

    const filtered = reportData.filter(r => 
        r.name.toLowerCase().includes(search.toLowerCase()) || 
        r.displayId.toString().includes(search)
    );

    const totals = useMemo(() => {
        const s = reportData.reduce((acc, r) => acc + r.sales, 0);
        const p = reportData.reduce((acc, r) => acc + r.received, 0);
        const l = reportData.reduce((acc, r) => acc + r.less, 0);
        const b = reportData.reduce((acc, r) => acc + r.balance, 0);
        const o = b - s + (p + l);
        return { sales: s, paid: p, less: l, end: b, open: o };
    }, [reportData]);

    const handleSaveCollections = async () => {
        const entries = Object.entries(tempAmounts).filter(([_, data]) => 
            Number(data?.received || 0) > 0 || Number(data?.less || 0) > 0
        );
        if (entries.length === 0) return setIsEntryMode(false);

        setIsSaving(true);
        try {
            for (const [bid, data] of entries) {
                const rec = Number(data.received || 0);
                const les = Number(data.less || 0);

                await addDoc(collection(db, 'payments'), {
                    entityId: bid,
                    type: 'buyer',
                    amount: rec,
                    cashLess: les,
                    notes: 'Sync from Daily Report',
                    timestamp: new Date().toISOString()
                });
                const bRef = doc(db, 'buyers', bid);
                await updateDoc(bRef, {
                    balance: increment(-(rec + les))
                });
            }
            alert('Collections synced successfully!');
            setTempAmounts({});
            setIsEntryMode(false);
        } catch (e) {
            console.error(e);
            alert('Failed to sync. Please check connection.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
            <head>
                <title>Daily Report - ${today}</title>
                <style>
                    @page { size: auto; margin: 0; }
                    body { font-family: serif; padding: 15mm; line-height: 1.4; margin: 0; font-size: 15pt; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #000; padding-bottom: 15px; }
                    .title { font-size: 32px; font-weight: 900; letter-spacing: 1px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 2px solid #000; padding: 10px 12px; font-size: 16px; font-weight: 500; }
                    th { background: #f2f2f2; font-weight: 900; text-transform: uppercase; font-size: 14px; }
                    .summary-box { margin-top: 40px; border: 4px solid #000; padding: 20px; }
                    .summary-row { display: flex; justify-content: space-between; font-size: 22px; font-weight: 800; padding: 8px 0; }
                    .grand { font-size: 32px; border-top: 3px solid #000; margin-top: 15px; padding-top: 15px; background: #eee; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="header">
                    <div class="title">DAILY REPORT</div>
                    <div style="font-size: 16px; font-weight: 700;">Date: ${today.split('-').reverse().join('/')}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th align="center">${t('customerNo')}</th>
                            <th align="left">${t('name')}</th>
                            <th align="center">Contact No</th>
                            <th align="right">${t('balance')}</th>
                            <th align="right" style="width: 100px;">${t('cashRec')}</th>
                            <th align="right" style="width: 100px;">${t('cashLess')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.filter(r => r.sales > 0 || r.received > 0 || r.balance > 0).map(r => `
                            <tr>
                                <td align="center">${r.displayId}</td>
                                <td align="left">${lang === 'ta' ? (r.nameTa || r.name) : r.name}</td>
                                <td align="center">${r.contact}</td>
                                <td align="right">${r.balance.toFixed(0)}</td>
                                <td align="right" style="height: 32px;"></td>
                                <td align="right" style="height: 32px;"></td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: 900; background: #eee;">
                            <td colspan="3" align="right">TOTAL</td>
                            <td align="right">${totals.end.toFixed(0)}</td>
                            <td align="right"></td>
                            <td align="right"></td>
                        </tr>
                    </tfoot>
                </table>

                <div class="summary-box">
                    <div class="summary-row"><span>${t('openingBalance')} :</span> <span>${totals.open.toFixed(2)}</span></div>
                    <div class="summary-row"><span>${t('cashRec')} :</span> <span>${totals.paid.toFixed(2)}</span></div>
                    <div class="summary-row"><span>${t('cashLess')} :</span> <span>${totals.less.toFixed(2)}</span></div>
                    <div class="summary-row"><span>${t('todayTotal')} :</span> <span>${totals.sales.toFixed(2)}</span></div>
                    <div class="summary-row grand" style="background: #f0f0f0; padding: 10px;">
                        <span>${t('grandTotal')} :</span> <span>${totals.end.toFixed(2)}</span>
                    </div>
                    <div style="font-size: 12px; margin-top: 10px; font-style: italic; color: #666;">
                        * Formula: Opening Balance - Cash Receive + Today's Sales = Grand Total
                    </div>
                </div>
            </body>
            </html>
        `;
        printWindow.document.write(content);
        printWindow.document.close();
    };

    const S = {
        page: { padding: '24px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'var(--font-sans)' },
        card: { background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #e2e8f0' },
        th: { padding: '12px 16px', background: '#f8fafc', color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e2e8f0' },
        td: { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '14px', color: '#1e293b' },
        summaryCard: { background: '#1e293b', borderRadius: '16px', padding: '24px', color: '#fff', marginBottom: '24px', border: '1px solid #334155' }
    };

    return (
        <div style={S.page}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText className="text-emerald-600" /> {t('dailyReport')}
                    </h1>
                    <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>{t('date')}: {today.split('-').reverse().join('/')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {!isEntryMode ? (
                        <>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input 
                                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder={t('search')}
                                    style={{ padding: '10px 16px 10px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', width: '200px', fontSize: '14px' }}
                                />
                            </div>
                            <button onClick={() => setIsEntryMode(true)} style={{ padding: '10px 20px', background: '#4f46e5', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Edit3 size={18} /> Batch Entry
                            </button>
                            <button onClick={handlePrint} style={{ padding: '10px 20px', background: '#10b981', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Printer size={18} /> {t('view')} & Print
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setIsEntryMode(false)} style={{ padding: '10px 20px', background: '#f1f5f9', color: '#64748b', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={handleSaveCollections} disabled={isSaving} style={{ padding: '10px 20px', background: '#10b981', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: isSaving ? 0.7 : 1 }}>
                                {isSaving ? 'Saving...' : <><Save size={18} /> Save Collections</>}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div style={S.summaryCard}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
                    <div>
                        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{t('openingBalance')}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800 }}>{fmt(totals.open)}</div>
                    </div>
                    <div>
                        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{t('cashRec')}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>- {fmt(totals.paid)}</div>
                    </div>
                    <div>
                        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{t('cashLess')}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>- {fmt(totals.less)}</div>
                    </div>
                    <div>
                        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{t('todayTotal')}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#3b82f6' }}>+ {fmt(totals.sales)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{t('grandTotal')}</div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: '#fbbf24' }}>{fmt(totals.end)}</div>
                    </div>
                </div>
            </div>

            <div style={S.card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ ...S.th, textAlign: 'center' }}>{t('id')}</th>
                            <th style={{ ...S.th, textAlign: 'left' }}>{t('name')}</th>
                            <th style={{ ...S.th, textAlign: 'center' }}>{t('contact')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('balance')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('cashRec')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('cashLess')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.filter(r => r.sales > 0 || r.received > 0 || r.balance > 0).map((row, i) => (
                            <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                <td style={{ ...S.td, textAlign: 'center' }}><span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>#{row.displayId}</span></td>
                                <td style={S.td}>
                                    <span style={{ fontWeight: 600 }}>
                                        {lang === 'ta' ? (row.nameTa || row.name) : row.name}
                                    </span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>{row.contact}</td>
                                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: row.balance > 0 ? '#ef4440' : '#10b981' }}>{fmt(row.balance)}</td>
                                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, minWidth: '100px' }}>
                                    {isEntryMode ? (
                                        <input 
                                            type="number" 
                                            placeholder="0"
                                            value={tempAmounts[row.id]?.received || ''}
                                            onChange={e => setTempAmounts(prev => ({ ...prev, [row.id]: { ...prev[row.id], received: e.target.value } }))}
                                            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '2px solid #3b82f6', textAlign: 'right', fontWeight: 800, color: '#3b82f6', fontSize: '14px' }}
                                        />
                                    ) : (
                                        <div style={{ color: '#10b981' }}>{row.received > 0 ? fmt(row.received) : '—'}</div>
                                    )}
                                </td>
                                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, minWidth: '100px' }}>
                                    {isEntryMode ? (
                                        <input 
                                            type="number" 
                                            placeholder="0"
                                            value={tempAmounts[row.id]?.less || ''}
                                            onChange={e => setTempAmounts(prev => ({ ...prev, [row.id]: { ...prev[row.id], less: e.target.value } }))}
                                            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '2px solid #f97316', textAlign: 'right', fontWeight: 800, color: '#f97316', fontSize: '14px' }}
                                        />
                                    ) : (
                                        <div style={{ color: '#f59e0b' }}>{row.less > 0 ? fmt(row.less) : '—'}</div> 
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DailyReport;
