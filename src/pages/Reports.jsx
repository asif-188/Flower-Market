import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Search, MessageCircle, BarChart2, X, User, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { subscribeToCollection, db } from '../utils/storage';
import { doc, getDoc } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { generateBuyerReceiptCanvas, generateLedgerCanvas } from '../utils/receiptCanvas';

const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const displayDate = (iso) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const Reports = () => {
    const { t, lang } = useContext(LangContext);
    const today = toDateStr(new Date());

    const [sales, setSales]       = useState([]);
    const [buyers, setBuyers]     = useState([]);
    const [payments, setPayments] = useState([]);
    const [products, setProducts] = useState([]);

    const [fromDate, setFromDate]         = useState(today);
    const [toDate, setToDate]             = useState(today);
    const [appliedFrom, setAppliedFrom]   = useState(today);
    const [appliedTo, setAppliedTo]       = useState(today);
    const [search, setSearch]             = useState('');
    const [activePreset, setActivePreset] = useState('today');
    const [detailBuyer, setDetailBuyer]     = useState(null);
    const [showFullLedger, setShowFullLedger] = useState(false);
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
        const u4 = subscribeToCollection('products', setProducts);
        return () => { u1(); u2(); u3(); u4(); };
    }, []);

    const applyPreset = (preset) => {
        if (preset === 'custom') {
            setActivePreset('custom');
            return;
        }
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
        // 1. Calculate Opening Balance (Backward from current balance) for each buyer
        const rows = buyers.map(buyer => {
            // Future Transactions (from appliedFrom onwards)
            const futureSales = sales.filter(s => {
                if (s.buyerId !== buyer.id) return false;
                const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
                return dt && dt >= appliedFrom;
            });
            const futurePayments = payments.filter(p => {
                if (p.entityId !== buyer.id || p.type !== 'buyer') return false;
                const dt = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : null;
                return dt && dt >= appliedFrom;
            });
            const futureSalesAmt = futureSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
            const futurePayAmt   = futurePayments.reduce((s, x) => s + (Number(x.amount) || 0) + (Number(x.cashLess) || 0), 0);
            const openingBal     = (buyer.balance || 0) - futureSalesAmt + futurePayAmt;

            // Period Transactions (within [appliedFrom, appliedTo])
            const periodSales = sales.filter(s => {
                if (s.buyerId !== buyer.id) return false;
                const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
                return dt && dt >= appliedFrom && dt <= appliedTo;
            });
            const periodPayments = payments.filter(p => {
                if (p.entityId !== buyer.id || p.type !== 'buyer') return false;
                const dt = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : null;
                return dt && dt >= appliedFrom && dt <= appliedTo;
            });

            const salesAmt = periodSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
            const paidAmt  = periodPayments.reduce((s, x) => s + (Number(x.amount) || 0), 0);
            const lessAmt  = periodPayments.reduce((s, x) => s + (Number(x.cashLess) || 0), 0);

            return {
                id: buyer.id,
                name: buyer.name || 'Unknown',
                taName: buyer.taName || buyer.nameTa || buyer.name || 'Unknown',
                displayId: buyer.displayId || '---',
                opening: openingBal,
                sales: salesAmt,
                paid: paidAmt,
                less: lessAmt,
                balance: buyer.balance || 0
            };
        });

        // Only show buyers who have activity in the period OR a non-zero opening balance OR non-zero current balance
        return rows.filter(r => r.sales > 0 || r.paid > 0 || r.less > 0 || r.opening !== 0 || r.balance !== 0)
                   .sort((a, b) => b.sales - a.sales);
    }, [sales, payments, buyers, appliedFrom, appliedTo]);

    const totalOpening = report.reduce((s, r) => s + r.opening, 0);
    const totalSales   = report.reduce((s, r) => s + r.sales, 0);
    const totalPaid    = report.reduce((s, r) => s + r.paid, 0);
    const totalLess    = report.reduce((s, r) => s + r.less, 0);
    const totalDues    = report.reduce((s, r) => s + Math.max(0, r.balance), 0);

    const filtered = report.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.displayId.toString().includes(search)
    );

    const detailTransactionsForList = useMemo(() => {
        if (!detailBuyer) return [];
        const res = [];
        sales.filter(s => s.buyerId === detailBuyer.id).forEach(s => {
            const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
            if (d && d >= appliedFrom && d <= appliedTo) res.push({ date: d, type: 'SALE', amount: s.grandTotal || 0 });
        });
        payments.filter(p => p.entityId === detailBuyer.id && p.type === 'buyer').forEach(p => {
            const d = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : null;
            if (d && d >= appliedFrom && d <= appliedTo) {
                if (p.amount > 0) res.push({ date: d, type: 'PAID', amount: p.amount || 0 });
                if (p.cashLess > 0) res.push({ date: d, type: 'LESS', amount: p.cashLess || 0 });
            }
        });
        return res.sort((a, b) => b.date.localeCompare(a.date));
    }, [detailBuyer, sales, payments, appliedFrom, appliedTo]);

    // ── Per-row WhatsApp receipt share ──
    // ── Detailed Ledger Print ──
    const handlePrintDetailedReport = () => {
        if (!detailBuyer) return;

        // 1. Calculate Opening Balance (Backward from current balance)
        const futureSales = sales.filter(s => {
            if (s.buyerId !== detailBuyer.id) return false;
            const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
            return dt && dt >= appliedFrom;
        });
        const futurePayments = payments.filter(p => {
            if (p.entityId !== detailBuyer.id || p.type !== 'buyer') return false;
            const dt = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : null;
            return dt && dt >= appliedFrom;
        });
        const futureSalesAmt = futureSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
        const futurePayAmt   = futurePayments.reduce((s, x) => s + (Number(x.amount) || 0) + (Number(x.cashLess) || 0), 0);
        const openingBalance = (detailBuyer.balance || 0) - futureSalesAmt + futurePayAmt;

        // 2. Prepare Detailed Entries for period
        const periodSales = sales.filter(s => {
            if (s.buyerId !== detailBuyer.id) return false;
            const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
            return d && d >= appliedFrom && d <= appliedTo;
        });
        const periodPayments = payments.filter(p => {
            if (p.entityId !== detailBuyer.id || p.type !== 'buyer') return false;
            const d = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : null;
            return d && d >= appliedFrom && d <= appliedTo;
        });

        const ledgerItems = [];
        periodSales.forEach(s => {
            const date = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '');
            (s.items || []).forEach(item => {
                let descLocalized = item.flowerType;
                if (lang === 'ta') {
                    const foundFlower = products.find(f => f.name?.trim().toLowerCase() === item.flowerType?.trim().toLowerCase());
                    descLocalized = item.flowerTypeTa || foundFlower?.taName || item.flowerType;
                }
                ledgerItems.push({ date, type: 'SALE', desc: descLocalized, qty: item.quantity, price: item.price, total: item.total, credit: 0 });
            });
        });
        periodPayments.forEach(p => {
            const date = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : '';
            if (p.amount > 0) ledgerItems.push({ date, type: 'PAY', desc: t('cashRec'), qty: 0, price: 0, total: 0, credit: p.amount });
            if (p.cashLess > 0) ledgerItems.push({ date, type: 'LESS', desc: t('cashLess'), qty: 0, price: 0, total: 0, credit: p.cashLess });
        });

        ledgerItems.sort((a, b) => a.date.localeCompare(b.date));

        const totalSales    = periodSales.reduce((s, x) => s + (x.grandTotal || 0), 0);
        const totalReceived = periodPayments.reduce((s, x) => s + (x.amount || 0), 0);
        const totalLess     = periodPayments.reduce((s, x) => s + (x.cashLess || 0), 0);
        const closingBalance = openingBalance + totalSales - totalReceived - totalLess;

        // 3. Render and Print (Uses a temporary frame or hidden div)
        const printWindow = window.open('', '_blank');
        const rangeText = appliedFrom === appliedTo ? displayDate(appliedFrom) : `${displayDate(appliedFrom)} - ${displayDate(appliedTo)}`;
        
        const content = `
            <html>
            <head>
                <title>Ledger - ${detailBuyer.name}</title>
                <style>
                    @page { size: auto; margin: 0; }
                    body { font-family: serif; padding: 15mm; line-height: 1.2; margin: 0; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .shop-name { font-size: 32px; font-weight: 900; }
                    .report-title { font-size: 18px; font-weight: 800; margin: 10px 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #000; padding: 6px 8px; font-size: 14px; }
                    th { background: #f2f2f2; text-transform: uppercase; }
                    .summary { margin-top: 20px; border: 2px solid #000; padding: 10px; break-inside: avoid; }
                    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 16px; font-weight: 700; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="header">
                    <div class="shop-name">${bizInfo.name || 'S.V.M'}</div>
                    <div style="font-size: 16px; font-weight: 700;">${bizInfo.type || ''}</div>
                    <div style="font-size: 14px;">${bizInfo.address || ''}</div>
                    <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px;">
                        <span>CELL : ${bizInfo.phone1 || ''}</span>
                        <span>CELL : ${bizInfo.phone2 || ''}</span>
                    </div>
                    <div class="report-title">${t('statementTitle')}</div>
                    <div style="text-align: left; font-size: 16px; font-weight: 700; display: flex; justify-content: space-between;">
                        <div>
                            ${t('customerNo')} : ${detailBuyer.displayId}<br/>
                            ${t('name')} : ${lang === 'ta' ? (detailBuyer.nameTa || detailBuyer.name) : detailBuyer.name}
                        </div>
                        <div style="text-align: right;">
                            ${t('date')} : ${rangeText}
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 80px;">${t('sNo')}</th>
                            <th>${t('particulars')}</th>
                            <th style="text-align: center">${t('weight')}</th>
                            <th style="text-align: center">${t('rate')}</th>
                            <th style="text-align: right">${t('total')}</th>
                            <th style="text-align: right">${t('cashRec')}</th>
                            <th style="text-align: right">${t('cashLess')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td align="center"></td>
                            <td style="font-weight: 700">${t('openingBalance')}</td>
                            <td align="center">0.000</td>
                            <td align="center">0</td>
                            <td align="right" style="font-weight: 700">${openingBalance.toFixed(0)}</td>
                            <td align="right">0</td>
                            <td align="right">0</td>
                        </tr>
                        ${(() => {
                            let rBal = openingBalance;
                            return ledgerItems.map((item, i, arr) => {
                                rBal = rBal + (item.total || 0) - (item.credit || 0);
                                const showDate = i === 0 || item.date !== arr[i-1].date;
                                return `
                                    <tr>
                                        <td align="center">${i + 1}</td>
                                        <td>${item.desc}</td>
                                        <td align="center">${item.type === 'SALE' ? parseFloat(item.qty).toFixed(3) : '0.000'}</td>
                                        <td align="center">${item.type === 'SALE' ? item.price : '0'}</td>
                                        <td align="right" style="font-weight: 700">${item.total > 0 ? item.total.toFixed(0) : '0'}</td>
                                        <td align="right" style="font-weight: 700; color: #16a34a">${item.type === 'PAY' ? item.credit.toFixed(0) : '0'}</td>
                                        <td align="right" style="font-weight: 700; color: #f59e0b">${item.type === 'LESS' ? item.credit.toFixed(0) : '0'}</td>
                                    </tr>
                                `;
                            }).join('');
                        })()}
                    </tbody>
                </table>

                <div class="summary">
                    <div class="summary-row"><span>${t('totalSales')} :</span> <span>${totalSales.toFixed(2)}</span></div>
                    <div class="summary-row"><span>${t('cashRec')} :</span> <span>${totalReceived.toFixed(2)}</span></div>
                    <div class="summary-row"><span>${t('cashLess')} :</span> <span>${totalLess.toFixed(2)}</span></div>
                    <div class="summary-row" style="border-top: 1px solid #000; margin-top: 5px; padding-top: 5px; font-weight: 900; font-size: 18px;">
                        <span>${t('finalBalance')} :</span> <span>${closingBalance.toFixed(2)}</span>
                    </div>
                    <div style="font-size: 11px; text-align: center; margin-top: 10px; color: #666; font-weight: 700;">
                        [ ${t('openingBalance')} + ${t('totalSales')} - ${t('cashRec')} - ${t('cashLess')} ]
                    </div>
                </div>
                <div style="text-align: center; margin-top: 30px; font-size: 18px;">🌹 ${t('thankYou')} 🌹</div>
            </body>
            </html>
        `;

        printWindow.document.write(content);
        printWindow.document.close();
    };

    const handleShareLedger = async (buyerRow) => {
        setSharingRowId(buyerRow.id);
        const buyer = buyers.find(b => b.id === buyerRow.id) || buyerRow;
        try {
            // 1. Calculate Opening Balance (Backward from current balance)
            const futureSales = sales.filter(s => {
                if (s.buyerId !== buyer.id) return false;
                const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
                return dt && dt >= appliedFrom;
            });
            const futurePayments = payments.filter(p => {
                if (p.entityId !== buyer.id || p.type !== 'buyer') return false;
                const dt = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : null;
                return dt && dt >= appliedFrom;
            });
            const futureSalesAmt = futureSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
            const futurePayAmt   = futurePayments.reduce((s, x) => s + (Number(x.amount) || 0) + (Number(x.cashLess) || 0), 0);
            const openingBalance = (buyer.balance || 0) - futureSalesAmt + futurePayAmt;

            // 2. Period Rows
            const periodSales = sales.filter(s => {
                if (s.buyerId !== buyer.id) return false;
                const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
                return d && d >= appliedFrom && d <= appliedTo;
            });
            const periodPayments = payments.filter(p => {
                if (p.entityId !== buyer.id || p.type !== 'buyer') return false;
                const d = p.timestamp ? (p.timestamp.substring ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : null;
                return d && d >= appliedFrom && d <= appliedTo;
            });

            const ledgerRows = [];
            const displayDate = d => d ? d.split('-').reverse().join('/') : '';

            // Map and then sort properly by ISO date
            const items = [];
            periodSales.forEach(s => {
                const dateIso = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '');
                (s.items || []).forEach(item => {
                    let descLocalized = item.flowerType;
                    if (lang === 'ta') {
                        const foundFlower = products.find(f => f.name?.trim().toLowerCase() === item.flowerType?.trim().toLowerCase());
                        descLocalized = item.flowerTypeTa || foundFlower?.taName || item.flowerType;
                    }
                    items.push({ dateIso, date: displayDate(dateIso), particulars: descLocalized, weight: parseFloat(item.quantity).toFixed(3), rate: item.price, total: item.total, cashRec: 0, cashLess: 0 });
                });
            });
            periodPayments.forEach(p => {
                const dateIso = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : '';
                if (p.amount > 0) items.push({ dateIso, date: displayDate(dateIso), particulars: t('cashRec'), weight: '0.000', rate: 0, total: 0, cashRec: p.amount, cashLess: 0 });
                if (p.cashLess > 0) items.push({ dateIso, date: displayDate(dateIso), particulars: t('cashLess'), weight: '0.000', rate: 0, total: 0, cashRec: 0, cashLess: p.cashLess });
            });
            items.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
            
            // Clean up rows for canvas
            const finalLedgerRows = items.map(({ dateIso, ...rest }) => rest);

            const summary = {
                sales: periodSales.reduce((s, x) => s + (x.grandTotal || 0), 0),
                paid:  periodPayments.reduce((s, x) => s + (x.amount || 0), 0),
                less:  periodPayments.reduce((s, x) => s + (x.cashLess || 0), 0)
            };

            const { blob, url } = await generateLedgerCanvas({
                buyer: { ...buyer, name: lang === 'ta' ? (buyer.nameTa || buyer.name) : buyer.name },
                ledgerRows: finalLedgerRows,
                summary,
                openingBalance,
                bizInfo,
                labels: {
                    date: t('date'),
                    particulars: t('particulars'),
                    weight: t('weight'),
                    rate: t('rate'),
                    total: t('total'),
                    cashRec: t('cashRec'),
                    cashLess: t('cashLess'),
                    openingBalLabel: t('openingBalance'),
                    statementTitle: t('statementTitle'),
                    customerNoLabel: t('customerNo'),
                    nameLabel: t('name'),
                    totalSalesLabel: t('totalSales') + ' :',
                    cashRecLabel: t('cashRec') + ' :',
                    cashLessLabel: t('cashLess') + ' :',
                    finalBalLabel: t('finalBalance') + ' :',
                    thankYou: '🌹 ' + t('thankYou') + ' 🌹',
                    sNoLabel: t('sNo'),
                    dateLabel: appliedFrom === appliedTo ? displayDate(appliedFrom) : `${displayDate(appliedFrom)} - ${displayDate(appliedTo)}`,
                }
            });

            const buyerContact = (buyer?.contact || '').replace(/\D/g, '');
            const whatsappNumber = buyerContact.length === 10 ? '91' + buyerContact : buyerContact;

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'statement.png', { type: 'image/png' })] })) {
                await navigator.share({
                    files: [new File([blob], 'statement.png', { type: 'image/png' })],
                    title: `${buyer.name} - Statement`,
                });
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = `statement_${buyer.name.replace(/\s+/g,'_')}.png`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 30000);

                if (whatsappNumber) {
                    setTimeout(() => {
                        window.open(`https://wa.me/${whatsappNumber}`, '_blank');
                    }, 500);
                }
            }
        } catch (err) {
            console.error('Ledger Share Error:', err);
            alert('❌ Failed to share statement: ' + err.message);
        } finally {
            setSharingRowId(null);
        }
    };

    const handleShareRow = async (row) => {
        setSharingRowId(row.id);
        try {
            // Gather flat sales items for this buyer in applied period
            const buyerSales = sales.filter(s => {
                if (s.buyerId !== row.id) return false;
                const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
                return d && d >= appliedFrom && d <= appliedTo;
            });
            const flatItems = buyerSales.flatMap(s => (s.items || []).map(item => {
                const masterFlower = products.find(f => f.name?.trim().toLowerCase() === item.flowerType?.trim().toLowerCase());
                const localizedName = lang === 'ta'
                    ? (item.flowerTypeTa || masterFlower?.taName || item.flowerType)
                    : (masterFlower?.name || item.flowerType);
                return { ...item, flowerTypeTa: localizedName, flowerType: localizedName };
            }));

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
            const cashLessTotal  = buyerPayments.reduce((s, p) => s + (p.cashLess || 0), 0);

            // prevBalance = current DB balance - sales + payments + cashLess (reverse the period)
            const buyer = buyers.find(b => b.id === row.id);
            const prevBalance = (buyer?.balance || 0) - row.sales + paymentsTotal + cashLessTotal;

            const dateLabel = appliedFrom === appliedTo 
                ? displayDate(appliedFrom)
                : `${displayDate(appliedFrom)} - ${displayDate(appliedTo)}`;

            const { blob, url } = await generateBuyerReceiptCanvas({
                buyer: {
                    ...row,
                    name: lang === 'ta' ? (row.nameTa || row.taName || row.name) : row.name
                },
                salesItems:    flatItems,
                salesTotal:    row.sales,
                paymentsTotal,
                cashLess:      cashLessTotal,
                prevBalance,
                dateLabel,
                bizInfo,
                labels: {
                    date: t('date'),
                    nameLabel: t('name'),
                    oldBalance: t('oldBalance'),
                    cashRec: t('cashRec'),
                    cashLess: t('cashLess'),
                    balance: t('balance'),
                    particulars: t('particulars'),
                    weight: t('weight'),
                    rate: t('rate'),
                    total: t('total'),
                    grandTotalLabel: t('finalBalance'),
                    sNo: t('sNo'),
                }
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
        const rangeText = appliedFrom === appliedTo ? appliedFrom : `${appliedFrom} to ${appliedTo}`;
        let msg = `*CUSTOMER REPORT*\nPeriod: ${rangeText}\n\nOpening Balance: ${fmt(totalOpening)}\nSales: ${fmt(totalSales)}\nPaid: ${fmt(totalPaid)}\nCash Less: ${fmt(totalLess)}\nDues: ${fmt(totalDues)}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const handleDownloadXLSX = async () => {
        if (report.length === 0) return alert('No data to download.');
        setIsDownloading(true);
        try {
            const data = report.map(r => ({ 
                ID: r.displayId, 
                Customer: r.name, 
                'Opening Balance': r.opening,
                Sales: r.sales, 
                Paid: r.paid, 
                'Cash Less': r.less,
                Balance: r.balance 
            }));
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
        th: { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap', background: '#fff' },
        td: { padding: '12px 14px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
    };

    const STAT_CARDS = [
        { label: t('openingBalance'), value: totalOpening, accent: '#6366f1', textColor: '#4338ca', bg: '#eef2ff' },
        { label: t('sales'), value: totalSales, accent: '#3b82f6', textColor: '#1d4ed8', bg: '#eff6ff' },
        { label: t('paid'), value: totalPaid, accent: '#10b981', textColor: '#15803d', bg: '#f0fdf4' },
        { label: t('cashLess'), value: totalLess, accent: '#f59e0b', textColor: '#9a3412', bg: '#fff7ed' },
        { label: t('dues'), value: totalDues, accent: '#ef4444', textColor: '#991b1b', bg: '#fef2f2' },
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
                <div style={{ padding: '6px 14px', background: '#f8fafc', borderRadius: '100px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#16a34a' }} />
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>
                        {appliedFrom === appliedTo ? appliedFrom : `${appliedFrom} — ${appliedTo}`}
                    </span>
                </div>

                {/* Presets Segmented Control */}
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: '2px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', marginLeft: '4px' }}>
                    {['today', 'month', 'custom'].map(p => (
                        <button key={p} onClick={() => applyPreset(p)} style={{
                            padding: '6px 15px', borderRadius: '7px', border: 'none',
                            background: activePreset === p ? '#fff' : 'transparent',
                            color: activePreset === p ? '#16a34a' : '#64748b',
                            boxShadow: activePreset === p ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                            fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                            fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                        }}>
                            {p === 'today' ? t('today') : p === 'month' ? t('month') : t('custom') || 'Custom'}
                        </button>
                    ))}
                </div>

                {/* Custom range inputs (hidden by default) */}
                {activePreset === 'custom' && (
                    <div className="animate-in slide-in-from-left-2 fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px', borderLeft: '1.5px solid #e2e8f0', marginLeft: '6px' }}>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                            style={{ padding: '5px 8px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#374151', outline: 'none', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                            onFocus={e => e.target.style.borderColor = '#16a34a'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                        <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>To</span>
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                            style={{ padding: '5px 8px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#374151', outline: 'none', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                            onFocus={e => e.target.style.borderColor = '#16a34a'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                        <button onClick={handleApply} style={{
                            padding: '6px 18px', borderRadius: '8px', background: '#16a34a', border: 'none',
                            color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                            fontFamily: 'var(--font-sans)',
                        }}>
                            {t('apply')}
                        </button>
                    </div>
                )}

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
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('openingBalance')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('sales')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('paid')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('cashLess')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('balance')}</th>
                            <th style={{ ...S.th, textAlign: 'center' }}>{t('action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
                                    {t('noRecords')}
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
                                            <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                                {lang === 'ta' ? (row.taName || row.name) : row.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#6366f1' }}>{fmt(row.opening)}</td>
                                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>{fmt(row.sales)}</td>
                                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{fmt(row.paid)}</td>
                                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#f97316' }}>{fmt(row.less)}</td>
                                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: row.balance > 0 ? '#dc2626' : '#15803d' }}>{fmt(row.balance)}</td>
                                    <td style={{ ...S.td, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            {/* View detail */}
                                            <button onClick={() => { setDetailBuyer(row); setShowFullLedger(false); }}
                                                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-sans)' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#16a34a'; }}
                                            >
                                                {t('view')} <ChevronRight size={13} />
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
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: showFullLedger ? '1200px' : '560px', transition: 'all 0.3s ease', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-display)' }}>{detailBuyer.name}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Customer Ledger • #{detailBuyer.displayId}</div>
                            </div>
                            <button onClick={() => setDetailBuyer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={20} /></button>
                        </div>

                        {/* Mini summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px', padding: '16px 24px 0' }}>
                            {[
                                { l: t('openingBalance'), v: detailBuyer.opening, c: '#6366f1', bg: '#eef2ff' },
                                { l: t('sales'), v: detailBuyer.sales, c: '#1d4ed8', bg: '#eff6ff' },
                                { l: t('paid'), v: detailBuyer.paid, c: '#15803d', bg: '#f0fdf4' },
                                { l: t('cashLess'), v: detailBuyer.less, c: '#f97316', bg: '#fff7ed' },
                                { l: t('balance'), v: detailBuyer.balance, c: '#dc2626', bg: '#fef2f2' }
                            ].map(x => (
                                <div key={x.l} style={{ background: x.bg, borderRadius: '10px', padding: '10px 12px', border: `1px solid ${x.c}22` }}>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: x.c, textTransform: 'uppercase', marginBottom: '3px', whiteSpace: 'nowrap' }}>{x.l}</div>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{fmt(x.v)}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ padding: '16px 24px', maxHeight: '50vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('transactionHistory')}</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => setShowFullLedger(!showFullLedger)}
                                        style={{ padding: '5px 12px', borderRadius: '7px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {showFullLedger ? `✖️ ${t('closeView')}` : `👁️ ${t('viewLedger')}`}
                                    </button>
                                    <button onClick={() => handleShareLedger(detailBuyer)}
                                        disabled={sharingRowId === detailBuyer.id}
                                        style={{ padding: '5px 12px', borderRadius: '7px', background: '#22c55e', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {sharingRowId === detailBuyer.id
                                            ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                            : <><MessageCircle size={14} /> WhatsApp</>
                                        }
                                    </button>
                                    <button onClick={handlePrintDetailedReport}
                                        style={{ padding: '5px 12px', borderRadius: '7px', background: '#1e293b', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        🖨️ {t('printLedger')}
                                    </button>
                                </div>
                            </div>
                            {showFullLedger ? (
                                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                <th style={{ padding: '10px', textAlign: 'left' }}>{t('date')}</th>
                                                <th style={{ padding: '10px', textAlign: 'left' }}>{t('particulars')}</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>{t('weight')}</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>{t('rate')}</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>{t('total')}</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>{t('cashRec')}</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>{t('cashLess')}</th>
                                                <th style={{ padding: '10px', textAlign: 'right', background: '#fffbeb' }}>{t('balance')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                // Pre-calculate ledger logic for system view
                                                const d = detailBuyer;
                                                const futureSales = sales.filter(s => {
                                                    if (s.buyerId !== d.id) return false;
                                                    const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
                                                    return dt && dt >= appliedFrom;
                                                });
                                                const futurePayments = payments.filter(p => {
                                                    if (p.entityId !== d.id || p.type !== 'buyer') return false;
                                                    const dt = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : null;
                                                    return dt && dt >= appliedFrom;
                                                });
                                                const futureSalesAmt = futureSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
                                                const futurePayAmt   = futurePayments.reduce((s, x) => s + (Number(x.amount) || 0) + (Number(x.cashLess) || 0), 0);
                                                let runningBal = (d.balance || 0) - futureSalesAmt + futurePayAmt;

                                                // Interleave sales items and payments
                                                const periodSales = sales.filter(s => s.buyerId === d.id && (s.date || toDateStr(s.timestamp?.toDate ? s.timestamp.toDate() : new Date())) >= appliedFrom && (s.date || toDateStr(s.timestamp?.toDate ? s.timestamp.toDate() : new Date())) <= appliedTo);
                                                const periodPayments = payments.filter(p => p.entityId === d.id && p.type === 'buyer' && (p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : '') >= appliedFrom && (p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : '') <= appliedTo);

                                                const sysItems = [];
                                                periodSales.forEach(s => {
                                                    const date = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '');
                                                    (s.items || []).forEach(item => {
                                                        let descLocalized = item.flowerType;
                                                        if (lang === 'ta') {
                                                            const foundFlower = products.find(f => f.name?.trim().toLowerCase() === item.flowerType?.trim().toLowerCase());
                                                            descLocalized = item.flowerTypeTa || foundFlower?.taName || item.flowerType;
                                                        }
                                                        sysItems.push({ date, desc: descLocalized, qty: item.quantity, price: item.price, total: item.total, credit: 0, less: 0 });
                                                    });
                                                });
                                                periodPayments.forEach(p => {
                                                    const date = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : '';
                                                    if (p.amount > 0) sysItems.push({ date, desc: t('cashRec'), qty: 0, price: 0, total: 0, credit: p.amount, less: 0 });
                                                    if (p.cashLess > 0) sysItems.push({ date, desc: t('cashLess'), qty: 0, price: 0, total: 0, credit: 0, less: p.cashLess });
                                                });
                                                sysItems.sort((a,b) => a.date.localeCompare(b.date));

                                                return (
                                                    <>
                                                        <tr style={{ background: '#fef3c7', fontWeight: 700 }}>
                                                            <td style={{ padding: '8px' }}>—</td>
                                                            <td style={{ padding: '8px' }}>{t('openingBalance')}</td>
                                                            <td colSpan={5}></td>
                                                            <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(runningBal)}</td>
                                                        </tr>
                                                        {sysItems.map((it, idx) => {
                                                            runningBal = runningBal + it.total - it.credit - it.less;
                                                            return (
                                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                    <td style={{ padding: '8px' }}>{it.date.split('-').reverse().join('/')}</td>
                                                                    <td style={{ padding: '8px', fontWeight: 600 }}>{it.desc}</td>
                                                                    <td style={{ padding: '8px', textAlign: 'right' }}>{it.qty > 0 ? parseFloat(it.qty).toFixed(3) : '—'}</td>
                                                                    <td style={{ padding: '8px', textAlign: 'right' }}>{it.price > 0 ? it.price : '—'}</td>
                                                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{it.total > 0 ? fmt(it.total) : '—'}</td>
                                                                    <td style={{ padding: '8px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{it.credit > 0 ? fmt(it.credit) : '—'}</td>
                                                                    <td style={{ padding: '8px', textAlign: 'right', color: '#f59e0b', fontWeight: 700 }}>{it.less > 0 ? fmt(it.less) : '—'}</td>
                                                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, background: '#fffbeb' }}>{fmt(runningBal)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </>
                                                );
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            ) : detailTransactionsForList.length === 0 ? (
                                <div style={{ padding: '36px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>No transactions in this period.</div>
                            ) : (
                                <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                                    {detailTransactionsForList.map((tx, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < detailTransactionsForList.length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '40px', height: '32px', borderRadius: '7px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>
                                                    {tx.date.split('-').slice(1).reverse().join('/')}
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: tx.type === 'SALE' ? '#3b82f6' : tx.type === 'PAID' ? '#16a34a' : '#f59e0b' }}>
                                                    {tx.type}
                                                </span>
                                            </div>
                                            <span style={{ fontWeight: 700, fontSize: '14px', color: tx.type === 'SALE' ? '#1e293b' : tx.type === 'PAID' ? '#16a34a' : '#f59e0b' }}>
                                                {tx.type === 'SALE' ? '' : '-'}{fmt(tx.amount)}
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
