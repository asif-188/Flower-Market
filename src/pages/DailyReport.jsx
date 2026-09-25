import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FileText, Printer, Search, Download, Calculator } from 'lucide-react';
import { subscribeToCollection, db, savePayment } from '../utils/storage';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { Check, Edit3, Save } from 'lucide-react';
import { useTenant } from '../utils/TenantContext';
import { parseMottoLines } from '../utils/receiptCanvas';
import * as XLSX from 'xlsx';

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
    const { tenantData } = useTenant();
    const [fromDate, setFromDate] = useState(toDateStr(new Date()));
    const [toDate, setToDate]     = useState(toDateStr(new Date()));

    const [sales, setSales]       = useState([]);
    const [buyers, setBuyers]     = useState([]);
    const [payments, setPayments] = useState([]);
    const [outsidePurchases, setOutsidePurchases] = useState([]);
    const [search, setSearch]     = useState('');
    const [isEntryMode, setIsEntryMode] = useState(false);
    const [tempAmounts, setTempAmounts] = useState({});
    const [isSaving, setIsSaving]       = useState(false);

    useEffect(() => {
        const u1 = subscribeToCollection('sales',    setSales);
        const u2 = subscribeToCollection('buyers',   setBuyers);
        const u3 = subscribeToCollection('payments', setPayments);
        const u4 = subscribeToCollection('outside_purchases', setOutsidePurchases, true);
        return () => { u1(); u2(); u3(); u4(); };
    }, []);

    const reportData = useMemo(() => {
        return buyers.map(b => {
            const rangePayments = payments.filter(p => {
                const pDate = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date())) : '';
                return p.entityId === b.id && p.type === 'buyer' && pDate >= fromDate && pDate <= toDate;
            });
            const rangeSales = sales.filter(s => {
                const sDate = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '');
                return s.buyerId === b.id && sDate >= fromDate && sDate <= toDate;
            });

            const received = rangePayments.reduce((s, p) => s + (p.amount || 0), 0);
            const less     = rangePayments.reduce((s, p) => s + (p.cashLess || 0), 0);
            const salesAmt = rangeSales.reduce((s, x) => s + (x.grandTotal || 0), 0);

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
    }, [buyers, sales, payments, fromDate, toDate]);

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
        
        const pur = outsidePurchases
            .filter(pur => pur.date >= fromDate && pur.date <= toDate)
            .reduce((acc, p) => acc + (p.grandTotal || 0), 0);
        
        const vendorPaid = payments
            .filter(p => p.type === 'vendor' && p.date >= fromDate && p.date <= toDate)
            .reduce((acc, p) => acc + (p.amount || 0), 0);

        return { sales: s, paid: p, less: l, end: b, open: o, purchases: pur, vendorPaid };
    }, [reportData, outsidePurchases, payments, fromDate, toDate]);

    const closingSummary = useMemo(() => {
        const getPDate = (p) => {
            if (p.date && typeof p.date === 'string' && p.date.match(/^\d{4}-\d{2}-\d{2}/)) {
                return p.date.substring(0, 10);
            }
            if (p.timestamp) {
                if (typeof p.timestamp === 'string') return p.timestamp.substring(0, 10);
                if (p.timestamp.toDate) return toDateStr(p.timestamp.toDate());
                return toDateStr(new Date(p.timestamp));
            }
            if (p.createdAt?.toDate) return toDateStr(p.createdAt.toDate());
            return '';
        };

        const getSDate = (s) => {
            if (s.date && typeof s.date === 'string' && s.date.match(/^\d{4}-\d{2}-\d{2}/)) {
                return s.date.substring(0, 10);
            }
            if (s.timestamp?.toDate) return toDateStr(s.timestamp.toDate());
            if (typeof s.timestamp === 'string') return s.timestamp.substring(0, 10);
            return '';
        };

        const getPurDate = (p) => {
            if (p.date && typeof p.date === 'string' && p.date.match(/^\d{4}-\d{2}-\d{2}/)) {
                return p.date.substring(0, 10);
            }
            if (p.timestamp?.toDate) return toDateStr(p.timestamp.toDate());
            if (typeof p.timestamp === 'string') return p.timestamp.substring(0, 10);
            return '';
        };

        const isSearching = search.trim().length > 0;
        const targetBuyerIds = new Set(filtered.map(r => r.id));
        
        let searchedCustomerName = null;
        if (isSearching && filtered.length > 0) {
            searchedCustomerName = lang === 'ta' ? (filtered[0].nameTa || filtered[0].name) : filtered[0].name;
            if (filtered.length > 1) {
                searchedCustomerName += ` (${filtered.length} நபர்கள்)`;
            }
        }

        const priorBuyerPayments = payments.filter(p => {
            const dt = getPDate(p);
            return p.type === 'buyer' && targetBuyerIds.has(p.entityId) && dt && dt < fromDate;
        });
        const priorVendorPayments = isSearching ? [] : payments.filter(p => {
            const dt = getPDate(p);
            return (p.type === 'vendor' || p.type === 'farmer') && dt && dt < fromDate;
        });

        const priorCashReceived = priorBuyerPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const priorCashLess     = priorBuyerPayments.reduce((acc, p) => acc + (Number(p.cashLess) || 0), 0);
        const priorVendorPaid   = priorVendorPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

        const openingBalance = priorCashReceived - priorCashLess - priorVendorPaid;

        const rangeBuyerPayments = payments.filter(p => {
            const dt = getPDate(p);
            return p.type === 'buyer' && targetBuyerIds.has(p.entityId) && dt && dt >= fromDate && dt <= toDate;
        });
        const rangeVendorPayments = isSearching ? [] : payments.filter(p => {
            const dt = getPDate(p);
            return (p.type === 'vendor' || p.type === 'farmer') && dt && dt >= fromDate && dt <= toDate;
        });
        const rangeSales = sales.filter(s => {
            const dt = getSDate(s);
            return targetBuyerIds.has(s.buyerId) && dt && dt >= fromDate && dt <= toDate;
        });
        const rangePurchases = isSearching ? [] : outsidePurchases.filter(pur => {
            const dt = getPurDate(pur);
            return dt && dt >= fromDate && dt <= toDate;
        });

        const cashReceived   = rangeBuyerPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const cashLess       = rangeBuyerPayments.reduce((acc, p) => acc + (Number(p.cashLess) || 0), 0);
        const vendorPayments = rangeVendorPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const todaysSales    = rangeSales.reduce((acc, s) => acc + (Number(s.grandTotal) || 0), 0);
        const purchaseTotal  = rangePurchases.reduce((acc, pur) => acc + (Number(pur.grandTotal) || 0), 0);

        const todayStr = toDateStr(new Date());
        const totalLiveBuyerBalance = buyers
            .filter(b => targetBuyerIds.has(b.id))
            .reduce((acc, b) => acc + (Number(b.balance) || 0), 0);
        
        let customerBalance = totalLiveBuyerBalance;
        if (toDate < todayStr) {
            const futureSales = sales.filter(s => {
                const dt = getSDate(s);
                return targetBuyerIds.has(s.buyerId) && dt && dt > toDate;
            }).reduce((acc, s) => acc + (Number(s.grandTotal) || 0), 0);

            const futurePayments = payments.filter(p => {
                const dt = getPDate(p);
                return p.type === 'buyer' && targetBuyerIds.has(p.entityId) && dt && dt > toDate;
            }).reduce((acc, p) => acc + (Number(p.amount || 0) + Number(p.cashLess || 0)), 0);

            customerBalance = totalLiveBuyerBalance - futureSales + futurePayments;
        }

        const finalClosingBalance = openingBalance + cashReceived - cashLess - vendorPayments;

        return {
            isSearching,
            searchedCustomerName,
            openingBalance,
            cashReceived,
            cashLess,
            purchaseTotal,
            todaysSales,
            customerBalance,
            vendorPayments,
            finalClosingBalance
        };
    }, [sales, buyers, payments, outsidePurchases, fromDate, toDate, filtered, search, lang]);

    const handleDownloadExcel = () => {
        const rows = reportData.filter(r => r.sales > 0 || r.received > 0 || r.balance > 0).map(r => ({
            'Display ID': r.displayId,
            'Customer Name': lang === 'ta' ? (r.nameTa || r.name) : r.name,
            'Contact': r.contact,
            'Balance (₹)': r.balance,
            'Cash Received (₹)': r.received,
            'Cash Less (₹)': r.less,
            'Sales (₹)': r.sales
        }));

        const wb = XLSX.utils.book_new();

        const wsData = [
            [`தினசரி விற்பனை அறிக்கை (${fromDate} - ${toDate})`],
            [closingSummary.isSearching ? `தேடப்பட்ட வாடிக்கையாளர்: ${closingSummary.searchedCustomerName}` : 'அனைத்து வாடிக்கையாளர்கள்'],
            [],
            ['வ.எண்', 'வாடிக்கையாளர் பெயர்', 'தொடர்பு எண்', 'பாக்கி (₹)', 'வரவு (₹)', 'கழி (₹)', 'விற்பனை (₹)'],
            ...rows.map(r => [r['Display ID'], r['Customer Name'], r['Contact'], r['Balance (₹)'], r['Cash Received (₹)'], r['Cash Less (₹)'], r['Sales (₹)']]),
            [],
            ['தானியங்கி தினசரி இறுதி கணக்கு அறிக்கை'],
            ['விபரம்', 'தொகை (₹)'],
            ['ஆரம்ப நிலுவை (முந்தைய நாள்)', closingSummary.openingBalance],
            ['வரவு (+)', closingSummary.cashReceived],
            ['கழி / செலவு (-)', closingSummary.cashLess],
            ['கொள்முதல் மொத்தம்', closingSummary.purchaseTotal],
            ['இன்றைய விற்பனை', closingSummary.todaysSales],
            ['வாடிக்கையாளர் பாக்கி', closingSummary.customerBalance],
            ['விற்பனையாளர் செலுத்தியது (-)', closingSummary.vendorPayments],
            ['இறுதி பாக்கி', closingSummary.finalClosingBalance]
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'தினசரி அறிக்கை');
        XLSX.writeFile(wb, `Daily_Report_${fromDate}_to_${toDate}.xlsx`);
    };

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

                await savePayment({
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
        const biz = tenantData || { name: 'S.V.M', type: 'SRI VALLI FLOWER MERCHANT', address: 'B-7, FLOWER MARKET, TINDIVANAM.', phone1: '9443247771', phone2: '9952535057' };
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
            <head>
                <title>Sales Report - ${fromDate} to ${toDate}</title>
                <style>
                    @page { size: auto; margin: 0; }
                    body { font-family: serif; padding: 15mm; line-height: 1.4; margin: 0; font-size: 15pt; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #000; padding-bottom: 15px; }
                    .shop-name { font-size: 32px; font-weight: 900; }
                    .title { font-size: 24px; font-weight: 800; margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; }
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
                    ${parseMottoLines(biz.motto).map(line => `<div style="font-size: 14px; font-style: italic; margin-bottom: 2px;">${line}</div>`).join('')}
                    <div class="shop-name">${biz.name}</div>
                    <div style="font-size: 16px; font-weight: 700;">${biz.type || ''}</div>
                    <div style="font-size: 14px;">${biz.address || ''}</div>
                    <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px;">
                        <span>CELL : ${biz.phone1 || ''}</span>
                        <span>CELL : ${biz.phone2 || ''}</span>
                    </div>
                    <div class="title">SALES REPORT</div>
                    <div style="font-size: 16px; font-weight: 700;">Range: ${fromDate.split('-').reverse().join('/')} - ${toDate.split('-').reverse().join('/')}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th align="center">${t('sNo')}</th>
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
                </table>

                <div class="summary-box">
                    <div class="summary-row"><span>${t('openingBalance')} :</span> <span>${totals.open.toFixed(2)}</span></div>
                    <div class="summary-row" style="color: #16a34a"><span>${t('cashRec')} :</span> <span>${totals.paid.toFixed(2)}</span></div>
                    <div class="summary-row" style="color: #b91c1c"><span>${t('cashLess')} :</span> <span>${totals.less.toFixed(2)}</span></div>
                    <div class="summary-row" style="color: #b91c1c"><span>${t('todayTotal')} :</span> <span>${totals.sales.toFixed(2)}</span></div>
                    <div class="summary-row" style="color: #b91c1c; font-size: 18px;"><span>${t('outsidePurchase')} :</span> <span>${totals.purchases.toFixed(2)}</span></div>

                    <div class="summary-row grand" style="background: #f0f0f0; padding: 10px; color: #000">
                        <span>${t('grandTotal')} :</span> <span>${totals.end.toFixed(2)}</span>
                    </div>
                </div>

                <div class="summary-box" style="margin-top: 30px; border: 3px solid #1e293b; padding: 20px; border-radius: 12px; background: #fff;">
                    <div style="font-size: 20px; font-weight: 900; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-family: sans-serif;">
                        தானியங்கி தினசரி இறுதி கணக்கு அறிக்கை ${closingSummary.isSearching ? `(${closingSummary.searchedCustomerName})` : ''}
                    </div>
                    <div class="summary-row"><span>ஆரம்ப நிலுவை (முந்தைய நாள்) :</span> <span>${fmt(closingSummary.openingBalance)}</span></div>
                    <div class="summary-row" style="color: #16a34a"><span>வரவு (+) :</span> <span>+ ${fmt(closingSummary.cashReceived)}</span></div>
                    <div class="summary-row" style="color: #ea580c"><span>கழி / செலவு (-) :</span> <span>- ${fmt(closingSummary.cashLess)}</span></div>
                    ${!closingSummary.isSearching ? `<div class="summary-row" style="color: #7e22ce"><span>கொள்முதல் மொத்தம் :</span> <span>${fmt(closingSummary.purchaseTotal)}</span></div>` : ''}
                    <div class="summary-row" style="color: #1d4ed8"><span>இன்றைய விற்பனை :</span> <span>${fmt(closingSummary.todaysSales)}</span></div>
                    <div class="summary-row" style="color: #1e293b"><span>வாடிக்கையாளர் பாக்கி :</span> <span>${fmt(closingSummary.customerBalance)}</span></div>
                    ${!closingSummary.isSearching ? `<div class="summary-row" style="color: #dc2626"><span>விற்பனையாளர் செலுத்தியது (-) :</span> <span>- ${fmt(closingSummary.vendorPayments)}</span></div>` : ''}

                    <div class="summary-row grand" style="background: #1e293b; color: #fff; padding: 12px 16px; border-radius: 8px; margin-top: 15px; font-size: 24px; font-weight: 900;">
                        <span>இறுதி பாக்கி :</span> <span>${fmt(closingSummary.finalClosingBalance)}</span>
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

    const RANGE_INPUT_S = {
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1.5px solid #e2e8f0',
        fontSize: '13px',
        fontWeight: 700,
        color: '#1e293b',
        background: '#fff',
        outline: 'none'
    };

    return (
        <div style={S.page}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText className="text-emerald-600" /> {t('reports')}
                    </h1>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{t('fromDate')}:</span>
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={RANGE_INPUT_S} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{t('toDate')}:</span>
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={RANGE_INPUT_S} />
                        </div>
                        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                            {[
                                { label: t('today'), onClick: () => { const d = toDateStr(new Date()); setFromDate(d); setToDate(d); } },
                                { label: 'Weekly', onClick: () => { 
                                    const d = new Date(); 
                                    setToDate(toDateStr(d));
                                    d.setDate(d.getDate() - 7);
                                    setFromDate(toDateStr(d));
                                }},
                                { label: 'Monthly', onClick: () => { 
                                    const d = new Date(); 
                                    setToDate(toDateStr(d));
                                    d.setDate(1);
                                    setFromDate(toDateStr(d));
                                }},
                                { label: 'Yearly', onClick: () => { 
                                    const d = new Date(); 
                                    setToDate(toDateStr(d));
                                    d.setMonth(0, 1);
                                    setFromDate(toDateStr(d));
                                }}
                            ].map(btn => (
                                <button 
                                    key={btn.label} 
                                    onClick={btn.onClick}
                                    style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fff'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>
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
                            <button onClick={handleDownloadExcel} style={{ padding: '10px 20px', background: '#0284c7', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Download size={18} /> Export Excel
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
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444' }}>- {fmt(totals.less)}</div>
                    </div>
                    <div>
                        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{t('todayTotal')}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444' }}>+ {fmt(totals.sales)}</div>
                    </div>
                    <div>
                        <div style={{ color: '#f87171', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{t('purchase')}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444' }}>{fmt(totals.purchases)}</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Buyer Balance</div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff' }}>{fmt(totals.end)}</div>
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
                                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{fmt(row.balance)}</td>
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
                                        <div style={{ color: '#ef4444' }}>{row.less > 0 ? fmt(row.less) : '—'}</div> 
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* AUTOMATIC DAILY CLOSING SUMMARY */}
            <div style={{
                marginTop: '32px',
                background: '#ffffff',
                borderRadius: '20px',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
                padding: '24px',
                overflow: 'hidden'
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#2563eb' }}>
                            <Calculator size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                                தானியங்கி தினசரி இறுதி கணக்கு அறிக்கை
                                {closingSummary.isSearching && closingSummary.searchedCustomerName && (
                                    <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '13px', padding: '2px 10px', borderRadius: '12px', fontWeight: 700 }}>
                                        👤 {closingSummary.searchedCustomerName}
                                    </span>
                                )}
                            </h3>
                            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0', fontWeight: 500 }}>
                                {fromDate === toDate ? `தேதி: ${fromDate.split('-').reverse().join('/')}` : `தேதி வரம்பு: ${fromDate.split('-').reverse().join('/')} - ${toDate.split('-').reverse().join('/')}`}
                            </p>
                        </div>
                    </div>
                    <span style={{
                        background: '#f0fdf4',
                        color: '#16a34a',
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: '1px solid #bbf7d0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                        நேரடி கணக்கீடு
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    {/* Card 1: Opening Balance */}
                    <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#334155' }}>ஆரம்ப நிலுவை</div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>முந்தைய நாள் இறுதி இருப்பு</div>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>
                            {fmt(closingSummary.openingBalance)}
                        </div>
                    </div>

                    {/* Card 2: Cash Received */}
                    <div style={{ background: '#f0fdf4', padding: '18px 20px', borderRadius: '14px', border: '1px solid #dcfce7', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#166534' }}>வரவு (+)</div>
                            <div style={{ fontSize: '11px', color: '#15803d', marginTop: '3px' }}>வாடிக்கையாளர் வசூல்</div>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#15803d', textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>
                            + {fmt(closingSummary.cashReceived)}
                        </div>
                    </div>

                    {/* Card 3: Cash Less / Expenses */}
                    <div style={{ background: '#fff7ed', padding: '18px 20px', borderRadius: '14px', border: '1px solid #ffedd5', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#9a3412' }}>கழி / செலவு (-)</div>
                            <div style={{ fontSize: '11px', color: '#c2410c', marginTop: '3px' }}>தள்ளுபடி / கழிவுகள்</div>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#c2410c', textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>
                            - {fmt(closingSummary.cashLess)}
                        </div>
                    </div>

                    {/* Card 4: Purchase Total */}
                    {!closingSummary.isSearching && (
                        <div style={{ background: '#faf5ff', padding: '18px 20px', borderRadius: '14px', border: '1px solid #f3e8ff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#6b21a8' }}>கொள்முதல் மொத்தம்</div>
                                <div style={{ fontSize: '11px', color: '#7e22ce', marginTop: '3px' }}>வெளிக்கடை கொள்முதல்</div>
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: 900, color: '#7e22ce', textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>
                                {fmt(closingSummary.purchaseTotal)}
                            </div>
                        </div>
                    )}

                    {/* Card 5: Today's Sales */}
                    <div style={{ background: '#eff6ff', padding: '18px 20px', borderRadius: '14px', border: '1px solid #dbeafe', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e40af' }}>இன்றைய விற்பனை</div>
                            <div style={{ fontSize: '11px', color: '#1d4ed8', marginTop: '3px' }}>வாடிக்கையாளர் விற்பனை</div>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#1d4ed8', textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>
                            {fmt(closingSummary.todaysSales)}
                        </div>
                    </div>

                    {/* Card 6: Customer Balance */}
                    <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#334155' }}>வாடிக்கையாளர் பாக்கி</div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>மொத்த நிலுவை தொகை</div>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>
                            {fmt(closingSummary.customerBalance)}
                        </div>
                    </div>

                    {/* Card 7: Vendor Payments */}
                    {!closingSummary.isSearching && (
                        <div style={{ background: '#fef2f2', padding: '18px 20px', borderRadius: '14px', border: '1px solid #fee2e2', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#991b1b' }}>விற்பனையாளர் செலுத்தியது (-)</div>
                                <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '3px' }}>விற்பனையாளருக்கு கொடுத்தது</div>
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: 900, color: '#b91c1c', textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>
                                - {fmt(closingSummary.vendorPayments)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Final Closing Balance Banner */}
                <div style={{
                    marginTop: '20px',
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    padding: '24px 28px',
                    borderRadius: '16px',
                    color: '#ffffff',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justify: 'space-between',
                    gap: '16px',
                    boxShadow: '0 8px 25px -5px rgba(15, 23, 42, 0.3)'
                }}>
                    <div style={{ minWidth: '240px', flex: '1 1 300px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            இறுதி பாக்கி (FINAL CLOSING BALANCE)
                        </div>
                        <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>
                            அடுத்த நாளுக்கான ஆரம்ப நிலுவையாக தானாக எடுத்துக்கொள்ளப்படும்
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#38bdf8', letterSpacing: '-0.02em', minWidth: 0, wordBreak: 'break-word', textAlign: 'right' }}>
                        {fmt(closingSummary.finalClosingBalance)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyReport;
