import React, { useState, useEffect, useContext } from 'react';
import { Calendar, Printer, Search } from 'lucide-react';
import { subscribeToCollection, COLLECTIONS, db } from '../utils/storage';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';
import WhatsAppIcon from '../components/WhatsAppIcon';

const INPUT_S = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1.5px solid #e2e8f0', background: '#fff',
    fontSize: '14px', fontWeight: 600, color: '#1e293b',
    outline: 'none', fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
};
const LABEL_S = {
    display: 'block', fontSize: '10px', fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px',
};
const TH_S = { 
    padding: '12px 6px', textAlign: 'left', fontSize: '11px', 
    fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', 
    letterSpacing: '0.08em', borderBottom: '1.5px solid #e5e7eb',
    background: '#fff'
};
const TD_S = { 
    padding: '12px 6px', fontSize: '13px', verticalAlign: 'middle',
    color: '#374151', borderBottom: '1px solid #f3f4f6'
};

const S = {
    page: {
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        padding: '28px 16px',
        minHeight: '70vh',
        fontFamily: 'var(--font-sans)',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', gap: '16px', flexWrap: 'wrap',
    },
    titleRow: {
        display: 'flex', alignItems: 'center', gap: '10px',
    },
    title: {
        fontSize: '22px', fontWeight: 800, color: '#ea580c',
        letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0,
    },
};

const FarmerMonthReport = () => {
    const { t } = useContext(LangContext);
    const { tenantData } = useTenant();
    const [farmers, setFarmers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // First of month
        return d.toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportRows, setReportRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const unsubscribe = subscribeToCollection(COLLECTIONS.F_FARMERS, setFarmers);
        return () => unsubscribe();
    }, []);

    const addToast = (message, type = 'success') => {
        const id = Date.now() + Math.random().toString();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const fetchMonthlyReport = async () => {
        setIsLoading(true);
        try {
            const tenantId = sessionStorage.getItem('fm_tenantId') || 'default';

            // 1. Fetch purchases in range
            const qPurchases = query(
                collection(db, COLLECTIONS.F_PURCHASES),
                where('tenantId', '==', tenantId)
            );
            const purchasesSnap = await getDocs(qPurchases);
            const allPurchases = purchasesSnap.docs.map(doc => doc.data());

            // 2. Fetch payments in range
            const qPayments = query(
                collection(db, COLLECTIONS.F_PAYMENTS),
                where('tenantId', '==', tenantId)
            );
            const paymentsSnap = await getDocs(qPayments);
            const allPayments = paymentsSnap.docs.map(doc => doc.data());

            // 3. Fetch bill closes in range
            const qCloses = query(
                collection(db, COLLECTIONS.F_BILL_CLOSINGS),
                where('tenantId', '==', tenantId)
            );
            const closesSnap = await getDocs(qCloses);
            const allCloses = closesSnap.docs.map(doc => doc.data());

            const rows = farmers.map(farmer => {
                const fid = farmer.id;
                const opBal = farmer.openingBalance || 0;

                // Adjust opening balance (prior transaction calculations)
                const prevPurchases = allPurchases
                    .filter(p => p.farmerId === fid && p.date < fromDate)
                    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

                const prevPayments = allPayments
                    .filter(p => p.farmerId === fid && p.date < fromDate)
                    .reduce((sum, p) => sum + (p.amount || 0), 0);

                const prevCommissions = allCloses
                    .filter(c => c.farmerId === fid && c.toDate < fromDate)
                    .reduce((sum, c) => sum + (c.commissionAmount || 0) + (c.otherCharges || 0), 0);

                const openingBalance = opBal + prevPurchases - prevPayments - prevCommissions;

                // Activity in period
                const purchase = allPurchases
                    .filter(p => p.farmerId === fid && p.date >= fromDate && p.date <= toDate)
                    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

                const cashPaid = allPayments
                    .filter(p => p.farmerId === fid && p.date >= fromDate && p.date <= toDate)
                    .reduce((sum, p) => sum + (p.amount || 0), 0);

                const commission = allCloses
                    .filter(c => c.farmerId === fid && c.toDate >= fromDate && c.toDate <= toDate)
                    .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

                const otherCharges = allCloses
                    .filter(c => c.farmerId === fid && c.toDate >= fromDate && c.toDate <= toDate)
                    .reduce((sum, c) => sum + (c.otherCharges || 0), 0);

                const closingBalance = openingBalance + purchase - cashPaid - commission - otherCharges;

                return {
                    id: farmer.id,
                    displayId: farmer.displayId || '',
                    farmerName: farmer.name,
                    contact: farmer.contact || '',
                    openingBalance,
                    purchase,
                    cashPaid,
                    commission,
                    closingBalance
                };
            });

            setReportRows(rows);
        } catch (error) {
            console.error("Month report calculations failed:", error);
            addToast('Failed to generate month report.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (farmers.length > 0) {
            fetchMonthlyReport();
        }
    }, [farmers, fromDate, toDate]);

    const filteredRows = reportRows.filter(row => {
        const term = searchTerm.toLowerCase();
        return (
            row.farmerName?.toLowerCase().includes(term) ||
            row.displayId?.toLowerCase().includes(term)
        );
    });

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Popup blocked! Please allow popups for printing.');
            return;
        }
        
        const rowsHtml = filteredRows.map(row => `
            <tr>
                <td style="text-align: center; padding: 6px; border: 1px solid #000;">${row.displayId || '—'}</td>
                <td style="text-align: left; padding: 6px; border: 1px solid #000; font-weight: bold;">${row.farmerName}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${row.openingBalance !== 0 ? row.openingBalance.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${row.purchase !== 0 ? row.purchase.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${row.cashPaid !== 0 ? row.cashPaid.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${row.commission !== 0 ? row.commission.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000; font-weight: bold;">${row.closingBalance !== 0 ? row.closingBalance.toFixed(2) : ''}</td>
            </tr>
        `).join('');

        const grandTotalsHtml = `
            <tr style="font-weight: bold;">
                <td colSpan="2" style="text-align: left; padding: 6px; border: 1px solid #000;">GRAND TOTAL</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${grandTotals.openingBalance !== 0 ? grandTotals.openingBalance.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${grandTotals.purchase !== 0 ? grandTotals.purchase.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${grandTotals.cashPaid !== 0 ? grandTotals.cashPaid.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${grandTotals.commission !== 0 ? grandTotals.commission.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${grandTotals.closingBalance !== 0 ? grandTotals.closingBalance.toFixed(2) : ''}</td>
            </tr>
        `;

        const displayFrom = fromDate.split('-').reverse().join('/');
        const displayTo = toDate.split('-').reverse().join('/');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Farmer Month Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
                        .letterhead { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                        .letterhead td { border: none; padding: 2px; }
                        .shop-title { font-size: 28px; font-weight: bold; text-align: center; margin-bottom: 2px; }
                        .shop-subtitle { font-size: 13px; text-align: center; font-weight: bold; margin-bottom: 2px; }
                        .shop-details { font-size: 11px; text-align: center; margin-bottom: 4px; }
                        .report-title-row { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; }
                        .report-title-row td { border: none; padding: 2px; font-weight: bold; font-size: 14px; }
                        table.report-table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        table.report-table th { border: 1px solid #000; padding: 8px; background: #fff; font-weight: bold; text-transform: uppercase; text-align: center; }
                        table.report-table td { border: 1px solid #000; }
                    </style>
                </head>
                <body>
                    <table class="letterhead">
                        <tr>
                            <td style="width: 25%; font-weight: bold; font-size: 11px; vertical-align: top;">CELL : 9952535057</td>
                            <td style="width: 50%; text-align: center;">
                                <div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">SRI RAMA JAYAM</div>
                                <div class="shop-title">${tenantData?.name || 'SVM Flowers'}</div>
                                <div class="shop-subtitle">${tenantData?.type || 'Sri Valli Flower Merchant'}</div>
                                <div class="shop-details">${tenantData?.address || 'B-7, Flower Market, Tindivanam.'}</div>
                                <div style="font-size: 15px; font-weight: bold; margin-top: 8px;">Final Report</div>
                            </td>
                            <td style="width: 25%; text-align: right; font-weight: bold; font-size: 11px; vertical-align: top;">CELL : 9952535057</td>
                        </tr>
                    </table>
                    
                    <hr style="border: 0; border-top: 1.5px solid #000; margin-bottom: 15px;" />

                    <table class="report-title-row">
                        <tr>
                            <td style="width: 100%; text-align: left;">Month of ${displayFrom} to ${displayTo}</td>
                        </tr>
                    </table>

                    <table class="report-table">
                        <thead>
                            <tr>
                                <th style="width: 12%; text-align: center;">FARMER CODE</th>
                                <th style="text-align: left;">FARMER NAME</th>
                                <th style="width: 13%; text-align: right;">ADVANCE</th>
                                <th style="width: 13%; text-align: right;">PURCHASE AMOUNT</th>
                                <th style="width: 13%; text-align: right;">CREDIT AMOUNT</th>
                                <th style="width: 13%; text-align: right;">COMMISSION</th>
                                <th style="width: 13%; text-align: right;">DEBIT AMOUNT</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                            ${grandTotalsHtml}
                        </tbody>
                    </table>

                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleShareWhatsApp = (row) => {
        const msg = `*STATEMENT FOR ${row.farmerName}*\n*Period:* ${fromDate.split('-').reverse().join('/')} to ${toDate.split('-').reverse().join('/')}\n-------------------\n*Opening Balance:* ₹${row.openingBalance.toLocaleString('en-IN')}\n*Purchases:* ₹${row.purchase.toLocaleString('en-IN')}\n*Cash Paid:* ₹${row.cashPaid.toLocaleString('en-IN')}\n*Commission:* ₹${row.commission.toLocaleString('en-IN')}\n-------------------\n*Closing Balance:* ₹${row.closingBalance.toLocaleString('en-IN')}`;
        window.open(`https://wa.me/${row.contact || ''}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const handlePrintSingleRow = (row) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Popup blocked! Please allow popups for printing.');
            return;
        }

        const displayFrom = fromDate.split('-').reverse().join('/');
        const displayTo = toDate.split('-').reverse().join('/');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Farmer Statement - ${row.farmerName}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 30px; color: #000; }
                        .letterhead { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                        .letterhead td { border: none; padding: 2px; }
                        .shop-title { font-size: 28px; font-weight: bold; text-align: center; margin-bottom: 2px; }
                        .shop-subtitle { font-size: 13px; text-align: center; font-weight: bold; margin-bottom: 2px; }
                        .shop-details { font-size: 11px; text-align: center; margin-bottom: 4px; }
                        .invoice-title { font-size: 18px; font-weight: bold; text-align: center; margin-top: 15px; margin-bottom: 20px; text-transform: uppercase; }
                        .meta-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
                        .meta-table td { border: none; padding: 4px 0; font-size: 13px; }
                        table.report-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
                        table.report-table th { border: 1px solid #000; padding: 8px; background: #fff; font-weight: bold; text-transform: uppercase; text-align: center; }
                        table.report-table td { border: 1px solid #000; padding: 10px; }
                    </style>
                </head>
                <body>
                    <table class="letterhead">
                        <tr>
                            <td style="width: 25%; font-weight: bold; font-size: 11px; vertical-align: top;">CELL : 9952535057</td>
                            <td style="width: 50%; text-align: center;">
                                <div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">SRI RAMA JAYAM</div>
                                <div class="shop-title">${tenantData?.name || 'SVM Flowers'}</div>
                                <div class="shop-subtitle">${tenantData?.type || 'Sri Valli Flower Merchant'}</div>
                                <div class="shop-details">${tenantData?.address || 'B-7, Flower Market, Tindivanam.'}</div>
                            </td>
                            <td style="width: 25%; text-align: right; font-weight: bold; font-size: 11px; vertical-align: top;">CELL : 9952535057</td>
                        </tr>
                    </table>
                    
                    <hr style="border: 0; border-top: 1.5px solid #000; margin-bottom: 15px;" />

                    <div class="invoice-title">FARMER STATEMENT</div>

                    <table class="meta-table">
                        <tr>
                            <td style="width: 50%;"><strong>Farmer Code:</strong> #${row.displayId || '—'}</td>
                            <td style="width: 50%; text-align: right;"><strong>From Date:</strong> ${displayFrom}</td>
                        </tr>
                        <tr>
                            <td style="width: 50%;"><strong>Farmer Name:</strong> ${row.farmerName}</td>
                            <td style="width: 50%; text-align: right;"><strong>To Date:</strong> ${displayTo}</td>
                        </tr>
                    </table>

                    <table class="report-table">
                        <thead>
                            <tr>
                                <th style="text-align: right;">ADVANCE (OP. BAL)</th>
                                <th style="text-align: right;">PURCHASES</th>
                                <th style="text-align: right;">CREDIT AMOUNT (CASH PAID)</th>
                                <th style="text-align: right;">COMMISSION</th>
                                <th style="text-align: right;">DEBIT AMOUNT (CLOSING BAL)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="text-align: right;">₹${row.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style="text-align: right; font-weight: bold; color: #16a34a;">₹${row.purchase.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style="text-align: right; font-weight: bold; color: #ef4444;">₹${row.cashPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style="text-align: right;">₹${row.commission.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style="text-align: right; font-weight: bold;">₹${row.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        </tbody>
                    </table>

                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const grandTotals = filteredRows.reduce((acc, row) => ({
        openingBalance: acc.openingBalance + row.openingBalance,
        purchase: acc.purchase + row.purchase,
        cashPaid: acc.cashPaid + row.cashPaid,
        commission: acc.commission + row.commission,
        closingBalance: acc.closingBalance + row.closingBalance
    }), { openingBalance: 0, purchase: 0, cashPaid: 0, commission: 0, closingBalance: 0 });

    return (
        <div style={S.page}>
            {/* Toasts */}
            <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2">
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        className={`px-6 py-4 rounded-xl shadow-lg text-white font-bold text-sm transform transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
                            t.type === 'error' ? 'bg-red-500' : 'bg-green-500'
                        }`}
                    >
                        {t.message}
                    </div>
                ))}
            </div>

            {/* Header */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <span style={{ fontSize: '22px' }}>📆</span>
                    <h2 style={S.title}>{t('farmerMonthReport')}</h2>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#fff7ed', padding: '16px 20px', borderRadius: '16px', border: '1px solid #fed7aa', marginBottom: '24px', flexWrap: 'wrap' }} className="no-print">
                {/* Search Farmer */}
                <div style={{ width: '220px' }}>
                    <label style={LABEL_S}>{t('searchFarmer') || 'Search Farmer'}</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', color: '#ea580c' }} />
                        <input 
                            type="text"
                            placeholder={t('searchPlaceholderShort') || 'Name or ID...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ ...INPUT_S, paddingLeft: '32px' }}
                        />
                    </div>
                </div>

                {/* From Date */}
                <div style={{ width: '190px' }}>
                    <label style={LABEL_S}>From Date</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Calendar size={14} style={{ position: 'absolute', left: '10px', color: '#ea580c' }} />
                        <input 
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            style={{ ...INPUT_S, paddingLeft: '32px' }}
                        />
                    </div>
                </div>

                {/* To Date */}
                <div style={{ width: '190px' }}>
                    <label style={LABEL_S}>To Date</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Calendar size={14} style={{ position: 'absolute', left: '10px', color: '#ea580c' }} />
                        <input 
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            style={{ ...INPUT_S, paddingLeft: '32px' }}
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* Print Button */}
                    <button 
                        onClick={handlePrint}
                        style={{
                            height: '42px', padding: '0 16px', borderRadius: '10px', border: '1.5px solid #ea580c',
                            background: '#fff', color: '#ea580c', fontWeight: 800, fontSize: '11px',
                            textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#ea580c'; }}
                    >
                        <Printer size={13} />
                        Print
                    </button>
                </div>
            </div>

            {/* ── Report Table Card ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', padding: '24px 16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#374151', margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('statement') || 'Statement'}
                </h3>
                
                <div style={{ overflowX: 'auto' }} className="print-area">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ ...TH_S, whiteSpace: 'nowrap' }}>{t('farmerId') || 'Farmer ID'}</th>
                                <th style={{ ...TH_S, whiteSpace: 'nowrap' }}>{t('farmerName') || 'Farmer Name'}</th>
                                <th style={{ ...TH_S, textAlign: 'right', whiteSpace: 'nowrap' }}>Opening Bal</th>
                                <th style={{ ...TH_S, textAlign: 'right', whiteSpace: 'nowrap' }}>Purchases</th>
                                <th style={{ ...TH_S, textAlign: 'right', whiteSpace: 'nowrap' }}>Cash Paid</th>
                                <th style={{ ...TH_S, textAlign: 'right', whiteSpace: 'nowrap' }}>Commission</th>
                                <th style={{ ...TH_S, textAlign: 'right', whiteSpace: 'nowrap' }}>Closing Bal</th>
                                <th style={{ ...TH_S, textAlign: 'center', whiteSpace: 'nowrap' }}>{t('actions') || 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
                                        No records found for the selected period.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row, idx) => (
                                    <tr key={row.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                        <td style={{ ...TD_S, fontWeight: 700, color: '#ea580c', whiteSpace: 'nowrap' }}>
                                            #{row.displayId || '—'}
                                        </td>
                                        <td style={{ ...TD_S, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            {row.farmerName}
                                        </td>
                                        <td style={{ ...TD_S, textAlign: 'right', fontWeight: 600, color: '#64748b' }}>₹{row.openingBalance.toLocaleString('en-IN')}</td>
                                        <td style={{ ...TD_S, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>₹{row.purchase.toLocaleString('en-IN')}</td>
                                        <td style={{ ...TD_S, textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>₹{row.cashPaid.toLocaleString('en-IN')}</td>
                                        <td style={{ ...TD_S, textAlign: 'right', fontWeight: 600, color: '#64748b' }}>₹{row.commission.toLocaleString('en-IN')}</td>
                                        <td style={{ ...TD_S, textAlign: 'right', fontWeight: 800, color: row.closingBalance < 0 ? '#ef4444' : '#ea580c', fontSize: '14px' }}>₹{row.closingBalance.toLocaleString('en-IN')}</td>
                                        <td style={{ ...TD_S, textAlign: 'center' }} className="no-print">
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                {/* WhatsApp button */}
                                                <button
                                                    onClick={() => handleShareWhatsApp(row)}
                                                    title="Share Statement on WhatsApp"
                                                    style={{
                                                        width: '32px', height: '32px', borderRadius: '8px',
                                                        border: '1.5px solid #22c55e', background: '#fff',
                                                        color: '#22c55e', display: 'inline-flex',
                                                        alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', transition: 'all 0.15s'
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#22c55e'; e.currentTarget.style.color = '#fff'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#22c55e'; }}
                                                >
                                                    <WhatsAppIcon size={14} />
                                                </button>

                                                {/* Print button */}
                                                <button
                                                    onClick={() => handlePrintSingleRow(row)}
                                                    title="Print Statement"
                                                    style={{
                                                        width: '32px', height: '32px', borderRadius: '8px',
                                                        border: '1.5px solid #ea580c', background: '#fff',
                                                        color: '#ea580c', display: 'inline-flex',
                                                        alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', transition: 'all 0.15s'
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = '#fff'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#ea580c'; }}
                                                >
                                                    <Printer size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}

                            {/* Grand Total Row */}
                            {filteredRows.length > 0 && (
                                <tr style={{ background: '#fff7ed', fontWeight: 800, borderTop: '2px solid #fed7aa' }}>
                                    <td style={{ ...TD_S, fontWeight: 900, color: '#c2410c' }} colSpan={2}>GRAND TOTAL</td>
                                    <td style={{ ...TD_S, textAlign: 'right', fontWeight: 900, color: '#64748b' }}>₹{grandTotals.openingBalance.toLocaleString('en-IN')}</td>
                                    <td style={{ ...TD_S, textAlign: 'right', fontWeight: 900, color: '#16a34a' }}>₹{grandTotals.purchase.toLocaleString('en-IN')}</td>
                                    <td style={{ ...TD_S, textAlign: 'right', fontWeight: 900, color: '#ef4444' }}>₹{grandTotals.cashPaid.toLocaleString('en-IN')}</td>
                                    <td style={{ ...TD_S, textAlign: 'right', fontWeight: 900, color: '#64748b' }}>₹{grandTotals.commission.toLocaleString('en-IN')}</td>
                                    <td style={{ ...TD_S, textAlign: 'right', fontWeight: 950, color: grandTotals.closingBalance < 0 ? '#ef4444' : '#ea580c', fontSize: '14px' }}>₹{grandTotals.closingBalance.toLocaleString('en-IN')}</td>
                                    <td style={TD_S} className="no-print"></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FarmerMonthReport;
