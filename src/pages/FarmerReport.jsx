import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Search, Calendar, FileText, Download, Printer, MessageCircle, X, ChevronRight, BarChart2 } from 'lucide-react';
import { subscribeToCollection, getTenant, COLLECTIONS, db } from '../utils/storage';
import { collection, query, where, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';

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
const S = {
    page: {
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        padding: '28px 32px',
        minHeight: '70vh',
        fontFamily: 'var(--font-sans)',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '24px',
    },
    titleRow: { display: 'flex', alignItems: 'center', gap: '10px' },
    title: {
        fontSize: '22px', fontWeight: 800, color: '#ea580c',
        letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0,
    },
    th: {
        padding: '12px 14px', textAlign: 'left', fontSize: '11px', 
        fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', 
        letterSpacing: '0.08em', borderBottom: '1.5px solid #e5e7eb',
        background: '#fff', whiteSpace: 'nowrap'
    },
    td: {
        padding: '13px 14px', fontSize: '14px',
        color: '#374151', borderBottom: '1px solid #f3f4f6',
        verticalAlign: 'middle',
    },
};

const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const displayDate = (iso) => {
    if (!iso) return '';
    return iso.split('-').reverse().join('/');
};

const FarmerReport = () => {
    const { t, lang } = useContext(LangContext);
    const { tenantData } = useTenant();
    const today = toDateStr(new Date());

    const [farmers, setFarmers] = useState([]);
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // First of month
        return d.toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState(today);
    const [appliedFrom, setAppliedFrom] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [appliedTo, setAppliedTo] = useState(today);
    
    const [search, setSearch] = useState('');
    const [activePreset, setActivePreset] = useState('month');
    const [reportRows, setReportRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [mainTableSelectedIndex, setMainTableSelectedIndex] = useState(-1);
    const mainTableRowRefs = React.useRef([]);

    // Detailed Ledger modal state
    const [ledgerFarmer, setLedgerFarmer] = useState(null);
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);

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

    const fetchReportData = async () => {
        setIsLoading(true);
        try {
            const tenantId = getTenant();
            
            // 1. Fetch purchases
            const qPurchases = query(
                collection(db, COLLECTIONS.F_PURCHASES),
                where('tenantId', '==', tenantId)
            );
            const purchasesSnap = await getDocs(qPurchases);
            const allPurchases = purchasesSnap.docs.map(doc => doc.data());

            // 2. Fetch payments
            const qPayments = query(
                collection(db, COLLECTIONS.F_PAYMENTS),
                where('tenantId', '==', tenantId)
            );
            const paymentsSnap = await getDocs(qPayments);
            const allPayments = paymentsSnap.docs.map(doc => doc.data());

            // 3. Fetch bill closings
            const qCloses = query(
                collection(db, COLLECTIONS.F_BILL_CLOSINGS),
                where('tenantId', '==', tenantId)
            );
            const closesSnap = await getDocs(qCloses);
            const allCloses = closesSnap.docs.map(doc => doc.data());

            const rows = farmers.map(farmer => {
                const fid = farmer.id;
                const opBal = farmer.openingBalance || 0;
                
                const prevPurchases = allPurchases
                    .filter(p => p.farmerId === fid && p.date < appliedFrom)
                    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

                const prevPayments = allPayments
                    .filter(p => p.farmerId === fid && p.date < appliedFrom)
                    .reduce((sum, p) => sum + (p.amount || 0), 0);

                const prevCommissions = allCloses
                    .filter(c => c.farmerId === fid && c.toDate < appliedFrom)
                    .reduce((sum, c) => sum + (c.commissionAmount || 0) + (c.otherCharges || 0), 0);

                const openingBalance = opBal + prevPurchases - prevPayments - prevCommissions;

                // Activity in period
                const debitPurchase = allPurchases
                    .filter(p => p.farmerId === fid && p.date >= appliedFrom && p.date <= appliedTo)
                    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

                const creditCashPaid = allPayments
                    .filter(p => p.farmerId === fid && p.date >= appliedFrom && p.date <= appliedTo)
                    .reduce((sum, p) => sum + (p.amount || 0), 0);

                const commission = allCloses
                    .filter(c => c.farmerId === fid && c.toDate >= appliedFrom && c.toDate <= appliedTo)
                    .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

                const otherCharges = allCloses
                    .filter(c => c.farmerId === fid && c.toDate >= appliedFrom && c.toDate <= appliedTo)
                    .reduce((sum, c) => sum + (c.otherCharges || 0), 0);

                const closingBalance = openingBalance + debitPurchase - creditCashPaid - commission - otherCharges;

                return {
                    farmerId: farmer.displayId || '—',
                    rawFarmerId: fid,
                    farmerName: farmer.name,
                    contact: farmer.contact || '',
                    openingBalance,
                    debitPurchase,
                    creditCashPaid,
                    commission,
                    closingBalance
                };
            });

            setReportRows(rows.filter(r => r.debitPurchase > 0 || r.creditCashPaid > 0 || r.openingBalance !== 0 || r.closingBalance !== 0));
        } catch (err) {
            console.error("Error generating report:", err);
            addToast('Failed to load report data.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (farmers.length > 0) {
            fetchReportData();
        }
    }, [farmers, appliedFrom, appliedTo]);

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

    const handleApply = () => {
        setAppliedFrom(fromDate);
        setAppliedTo(toDate);
    };

    const handleOpenLedgerModal = async (row) => {
        setLedgerFarmer(row);
        setIsLedgerOpen(true);
        try {
            const tenantId = getTenant();
            const qP = query(
                collection(db, COLLECTIONS.F_PURCHASES),
                where('tenantId', '==', tenantId),
                where('farmerId', '==', row.rawFarmerId)
            );
            const pSnap = await getDocs(qP);
            const pData = pSnap.docs.map(d => ({ ...d.data(), type: 'purchase' }));

            const qPay = query(
                collection(db, COLLECTIONS.F_PAYMENTS),
                where('tenantId', '==', tenantId),
                where('farmerId', '==', row.rawFarmerId)
            );
            const paySnap = await getDocs(qPay);
            const payData = paySnap.docs.map(d => ({ ...d.data(), type: 'payment' }));

            const allTx = [...pData, ...payData]
                .filter(x => x.date >= appliedFrom && x.date <= appliedTo)
                .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

            let runningBal = row.openingBalance;
            const entries = allTx.map((tx, idx) => {
                if (tx.type === 'purchase') {
                    runningBal += (tx.totalAmount || 0);
                    return {
                        id: tx.id || idx,
                        date: tx.date,
                        description: lang === 'ta' ? `கொள்முதல் (${tx.flowerName || 'பூக்கள்'})` : `Purchase (${tx.flowerName || 'Flowers'})`,
                        debit: 0,
                        credit: tx.totalAmount || 0,
                        balance: runningBal
                    };
                } else {
                    runningBal -= (tx.amount || 0);
                    return {
                        id: tx.id || idx,
                        date: tx.date,
                        description: lang === 'ta' ? `பணம் செலுத்தியது${tx.remarks ? ' - ' + tx.remarks : ''}` : `Cash Payment${tx.remarks ? ' - ' + tx.remarks : ''}`,
                        debit: tx.amount || 0,
                        credit: 0,
                        balance: runningBal
                    };
                }
            });
            setLedgerEntries(entries);
        } catch (err) {
            console.error("Error fetching ledger entries:", err);
            setLedgerEntries([]);
        }
    };

    const handleExportExcel = () => {
        try {
            const data = reportRows.map(r => ({
                'Supplier Code': r.farmerId,
                'Supplier Name': r.farmerName,
                'Advance (₹)': r.openingBalance,
                'Plants Amt (₹)': r.debitPurchase,
                'Credit Amount (₹)': r.creditCashPaid,
                'Debit Amount (₹)': r.closingBalance
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Farmer Final Report');
            XLSX.writeFile(wb, `SupplierFinalReport_${appliedFrom}_to_${appliedTo}.xlsx`);
            addToast('Excel downloaded successfully!');
        } catch (error) {
            addToast('Excel export failed.', 'error');
        }
    };

    const generateFarmerReportCanvas = ({ reportRows, grandTotals, appliedFrom, appliedTo, tenantData, lang }) => {
        const isTa = lang === 'ta';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const colWidths = [100, 160, 90, 110, 110, 90, 110];
        const tableWidth = colWidths.reduce((a, b) => a + b, 0); // 770px
        const paddingX = 30;
        const canvasWidth = tableWidth + paddingX * 2; // 830px

        const rowHeight = 28;
        const headerHeight = 160;
        const tableHeaderHeight = 32;
        const totalRows = reportRows.length + 1; // +1 for grand total
        const canvasHeight = headerHeight + tableHeaderHeight + totalRows * rowHeight + 40;

        canvas.width = canvasWidth * 2; // 2x DPI
        canvas.height = canvasHeight * 2;
        ctx.scale(2, 2);

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Header - Letterhead
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px "Noto Sans Tamil", "Latha", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('CELL : 9952535057', paddingX, 25);

        ctx.textAlign = 'right';
        ctx.fillText('CELL : 9952535057', canvasWidth - paddingX, 25);

        ctx.textAlign = 'center';
        ctx.font = 'bold 10px "Noto Sans Tamil", "Latha", Arial, sans-serif';
        ctx.fillText(isTa ? 'ஸ்ரீ ராம ஜெயம்' : 'SRI RAMA JAYAM', canvasWidth / 2, 20);

        ctx.font = 'bold 22px "Noto Sans Tamil", "Latha", Arial, sans-serif';
        ctx.fillStyle = '#ea580c';
        ctx.fillText(tenantData?.name || 'SVM Flowers', canvasWidth / 2, 45);

        ctx.font = 'bold 12px "Noto Sans Tamil", "Latha", Arial, sans-serif';
        ctx.fillStyle = '#374151';
        ctx.fillText(tenantData?.type || 'Sri Valli Flower Merchant', canvasWidth / 2, 63);

        ctx.font = 'normal 10px "Noto Sans Tamil", "Latha", Arial, sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.fillText(tenantData?.address || 'B-7, Flower Market, Tindivanam.', canvasWidth / 2, 78);

        // Divider Line
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(paddingX, 90);
        ctx.lineTo(canvasWidth - paddingX, 90);
        ctx.stroke();

        // Report Title & Period
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px "Noto Sans Tamil", "Latha", Arial, sans-serif';
        ctx.textAlign = 'left';
        const displayFrom = appliedFrom.split('-').reverse().join('/');
        const displayTo = appliedTo.split('-').reverse().join('/');
        ctx.fillText(isTa ? `கால அளவு: ${displayFrom} முதல் ${displayTo}` : `Month of: ${displayFrom} to ${displayTo}`, paddingX, 115);

        ctx.textAlign = 'right';
        ctx.fillText(isTa ? 'இறுதி அறிக்கை' : 'Final Report', canvasWidth - paddingX, 115);

        // Table Headers
        const startY = 135;
        const headers = isTa 
            ? ['விவசாயி கோடு', 'விவசாயி பெயர்', 'முன்பணம்', 'கொள்முதல் தொகை', 'வரவு தொகை', 'கமிஷன்', 'நிலுவை தொகை']
            : ['FARMER CODE', 'FARMER NAME', 'ADVANCE', 'PURCHASE AMOUNT', 'CREDIT AMOUNT', 'COMMISSION', 'DEBIT AMOUNT'];

        ctx.fillStyle = '#ea580c';
        ctx.fillRect(paddingX, startY, tableWidth, tableHeaderHeight);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(paddingX, startY, tableWidth, tableHeaderHeight);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px "Noto Sans Tamil", "Latha", Arial, sans-serif';
        let currentX = paddingX;

        headers.forEach((h, idx) => {
            const w = colWidths[idx];
            ctx.strokeStyle = '#ffffff';
            if (idx > 0) {
                ctx.beginPath();
                ctx.moveTo(currentX, startY);
                ctx.lineTo(currentX, startY + tableHeaderHeight);
                ctx.stroke();
            }
            if (idx === 0) {
                ctx.textAlign = 'center';
                ctx.fillText(h, currentX + w / 2, startY + 20);
            } else if (idx === 1) {
                ctx.textAlign = 'left';
                ctx.fillText(h, currentX + 8, startY + 20);
            } else {
                ctx.textAlign = 'right';
                ctx.fillText(h, currentX + w - 8, startY + 20);
            }
            currentX += w;
        });

        // Table Rows
        let currentY = startY + tableHeaderHeight;
        reportRows.forEach((row, rIdx) => {
            ctx.fillStyle = rIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
            ctx.fillRect(paddingX, currentY, tableWidth, rowHeight);

            ctx.strokeStyle = '#e5e7eb';
            ctx.strokeRect(paddingX, currentY, tableWidth, rowHeight);

            ctx.fillStyle = '#1e293b';
            ctx.font = '11px "Noto Sans Tamil", "Latha", Arial, sans-serif';

            const values = [
                row.farmerId || '—',
                row.farmerName || '',
                row.openingBalance !== 0 ? row.openingBalance.toFixed(2) : '',
                row.debitPurchase !== 0 ? row.debitPurchase.toFixed(2) : '',
                row.creditCashPaid !== 0 ? row.creditCashPaid.toFixed(2) : '',
                row.commission !== 0 ? row.commission.toFixed(2) : '',
                row.closingBalance !== 0 ? row.closingBalance.toFixed(2) : ''
            ];

            let rx = paddingX;
            values.forEach((v, idx) => {
                const w = colWidths[idx];
                if (idx === 0) {
                    ctx.textAlign = 'center';
                    ctx.fillText(v, rx + w / 2, currentY + 18);
                } else if (idx === 1) {
                    ctx.textAlign = 'left';
                    ctx.font = 'bold 11px "Noto Sans Tamil", "Latha", Arial, sans-serif';
                    ctx.fillText(v, rx + 8, currentY + 18);
                    ctx.font = '11px "Noto Sans Tamil", "Latha", Arial, sans-serif';
                } else {
                    ctx.textAlign = 'right';
                    ctx.fillText(v, rx + w - 8, currentY + 18);
                }
                rx += w;
            });

            currentY += rowHeight;
        });

        // Grand Total Row
        ctx.fillStyle = '#fff7ed';
        ctx.fillRect(paddingX, currentY, tableWidth, rowHeight);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(paddingX, currentY, tableWidth, rowHeight);

        ctx.fillStyle = '#c2410c';
        ctx.font = 'bold 11px "Noto Sans Tamil", "Latha", Arial, sans-serif';

        const grandValues = [
            isTa ? 'மொத்த கூட்டுத்தொகை' : 'GRAND TOTAL',
            '',
            grandTotals.openingBalance !== 0 ? grandTotals.openingBalance.toFixed(2) : '',
            grandTotals.debitPurchase !== 0 ? grandTotals.debitPurchase.toFixed(2) : '',
            grandTotals.creditCashPaid !== 0 ? grandTotals.creditCashPaid.toFixed(2) : '',
            grandTotals.commission !== 0 ? grandTotals.commission.toFixed(2) : '',
            grandTotals.closingBalance !== 0 ? grandTotals.closingBalance.toFixed(2) : ''
        ];

        let gX = paddingX;
        ctx.textAlign = 'left';
        ctx.fillText(grandValues[0], gX + 8, currentY + 18);
        gX += colWidths[0] + colWidths[1];

        for (let idx = 2; idx < grandValues.length; idx++) {
            const w = colWidths[idx];
            ctx.textAlign = 'right';
            ctx.fillText(grandValues[idx], gX + w - 8, currentY + 18);
            gX += w;
        }

        return canvas;
    };

    const handlePDFDownload = () => {
        try {
            const canvas = generateFarmerReportCanvas({ 
                reportRows: filtered, 
                grandTotals, 
                appliedFrom, 
                appliedTo, 
                tenantData, 
                lang 
            });
            const imgData = canvas.toDataURL('image/png');
            const doc = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            doc.save(`FarmerFinalReport_${appliedFrom}_to_${appliedTo}.pdf`);
            addToast('PDF downloaded successfully!');
        } catch (error) {
            addToast('PDF download failed: ' + error.message, 'error');
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        const isTa = lang === 'ta';
        
        const rowsHtml = filtered.map(row => `
            <tr>
                <td style="text-align: center; padding: 6px; border: 1px solid #000;">${row.farmerId}</td>
                <td style="text-align: left; padding: 6px; border: 1px solid #000; font-weight: bold;">${row.farmerName}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${row.openingBalance !== 0 ? row.openingBalance.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${row.debitPurchase !== 0 ? row.debitPurchase.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${row.creditCashPaid !== 0 ? row.creditCashPaid.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${row.commission !== 0 ? row.commission.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000; font-weight: bold;">${row.closingBalance !== 0 ? row.closingBalance.toFixed(2) : ''}</td>
            </tr>
        `).join('');

        const grandTotalsHtml = `
            <tr style="font-weight: bold;">
                <td colSpan="2" style="text-align: left; padding: 6px; border: 1px solid #000;">${isTa ? 'மொத்த கூட்டுத்தொகை' : 'GRAND TOTAL'}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${grandTotals.openingBalance !== 0 ? grandTotals.openingBalance.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${grandTotals.debitPurchase !== 0 ? grandTotals.debitPurchase.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${grandTotals.creditCashPaid !== 0 ? grandTotals.creditCashPaid.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${grandTotals.commission !== 0 ? grandTotals.commission.toFixed(2) : ''}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #000;">${grandTotals.closingBalance !== 0 ? grandTotals.closingBalance.toFixed(2) : ''}</td>
            </tr>
        `;

        printWindow.document.write(`
            <html>
                <head>
                    <title>${isTa ? 'விவசாயி இறுதி அறிக்கை' : 'Farmer Final Report'}</title>
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
                                <div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">${isTa ? 'ஸ்ரீ ராம ஜெயம்' : 'SRI RAMA JAYAM'}</div>
                                <div class="shop-title">${tenantData?.name || 'SVM Flowers'}</div>
                                <div class="shop-subtitle">${tenantData?.type || 'Sri Valli Flower Merchant'}</div>
                                <div class="shop-details">${tenantData?.address || 'B-7, Flower Market, Tindivanam.'}</div>
                                <div style="font-size: 15px; font-weight: bold; margin-top: 8px;">${isTa ? 'இறுதி அறிக்கை' : 'Final Report'}</div>
                            </td>
                            <td style="width: 25%; text-align: right; font-weight: bold; font-size: 11px; vertical-align: top;">CELL : 9952535057</td>
                        </tr>
                    </table>
                    
                    <hr style="border: 0; border-top: 1.5px solid #000; margin-bottom: 15px;" />

                    <table class="report-title-row">
                        <tr>
                            <td style="width: 100%; text-align: left;">${isTa ? `கால அளவு: ${appliedFrom.split('-').reverse().join('/')} முதல் ${appliedTo.split('-').reverse().join('/')}` : `Month of ${appliedFrom.split('-').reverse().join('/')} to ${appliedTo.split('-').reverse().join('/')}`}</td>
                        </tr>
                    </table>

                    <table class="report-table">
                        <thead>
                            <tr>
                                <th style="width: 10%; text-align: center;">${isTa ? 'விவசாயி கோடு' : 'FARMER CODE'}</th>
                                <th style="text-align: left;">${isTa ? 'விவசாயி பெயர்' : 'FARMER NAME'}</th>
                                <th style="width: 12%; text-align: right;">${isTa ? 'முன்பணம்' : 'ADVANCE'}</th>
                                <th style="width: 14%; text-align: right;">${isTa ? 'கொள்முதல் தொகை' : 'PURCHASE AMOUNT'}</th>
                                <th style="width: 14%; text-align: right;">${isTa ? 'வரவு தொகை' : 'CREDIT AMOUNT'}</th>
                                <th style="width: 12%; text-align: right;">${isTa ? 'கமிஷன்' : 'COMMISSION'}</th>
                                <th style="width: 14%; text-align: right;">${isTa ? 'நிலுவை தொகை' : 'DEBIT AMOUNT'}</th>
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
        if (!row.contact) {
            addToast('Farmer contact missing.', 'error');
            return;
        }

        const isTa = lang === 'ta';
        const msg = isTa ? `*விவசாயி இறுதி அறிக்கை*
*விவசாயி கோடு:* ${row.farmerId}
*விவசாயி பெயர்:* ${row.farmerName}
*கால அளவு:* ${appliedFrom.split('-').reverse().join('/')} முதல் ${appliedTo.split('-').reverse().join('/')}
----------------------------------
*முன்பணம்:* ₹${row.openingBalance !== 0 ? row.openingBalance.toFixed(2) : '0.00'}
*கொள்முதல் தொகை:* ₹${row.debitPurchase !== 0 ? row.debitPurchase.toFixed(2) : '0.00'}
*வரவு தொகை:* ₹${row.creditCashPaid !== 0 ? row.creditCashPaid.toFixed(2) : '0.00'}
----------------------------------
*நிலுவை தொகை:* ₹${row.closingBalance !== 0 ? row.closingBalance.toFixed(2) : '0.00'}`
        : `*FARMER FINAL REPORT*
*Farmer Code:* ${row.farmerId}
*Farmer Name:* ${row.farmerName}
*Period:* ${appliedFrom.split('-').reverse().join('/')} to ${appliedTo.split('-').reverse().join('/')}
----------------------------------
*Advance:* ₹${row.openingBalance !== 0 ? row.openingBalance.toFixed(2) : '0.00'}
*Purchase Amount:* ₹${row.debitPurchase !== 0 ? row.debitPurchase.toFixed(2) : '0.00'}
*Credit Amount:* ₹${row.creditCashPaid !== 0 ? row.creditCashPaid.toFixed(2) : '0.00'}
----------------------------------
*Debit Amount:* ₹${row.closingBalance !== 0 ? row.closingBalance.toFixed(2) : '0.00'}`;

        const num = row.contact.replace(/\D/g, '');
        const formattedNum = num.length === 10 ? '91' + num : num;
        window.open(`https://wa.me/${formattedNum}?text=${encodeURIComponent(msg)}`, '_blank');
        addToast('WhatsApp shared!');
    };

    const grandTotals = reportRows.reduce((acc, row) => ({
        openingBalance: acc.openingBalance + row.openingBalance,
        debitPurchase: acc.debitPurchase + row.debitPurchase,
        creditCashPaid: acc.creditCashPaid + row.creditCashPaid,
        commission: acc.commission + row.commission,
        closingBalance: acc.closingBalance + row.closingBalance
    }), { openingBalance: 0, debitPurchase: 0, creditCashPaid: 0, commission: 0, closingBalance: 0 });

    const filtered = reportRows.filter(r =>
        r.farmerName.toLowerCase().includes(search.toLowerCase()) ||
        r.farmerId.toString().includes(search)
    );

    const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

    const STAT_CARDS = [
        { label: lang === 'ta' ? 'முன்பணம்' : 'Advance', value: grandTotals.openingBalance, accent: '#ea580c', bg: '#fff7ed', textColor: '#c2410c' },
        { label: lang === 'ta' ? 'கொள்முதல் தொகை' : 'Purchase Amount', value: grandTotals.debitPurchase, accent: '#16a34a', bg: '#f0fdf4', textColor: '#15803d' },
        { label: lang === 'ta' ? 'வரவு தொகை' : 'Credit Amount', value: grandTotals.creditCashPaid, accent: '#ef4444', bg: '#fef2f2', textColor: '#b91c1c' },
        { label: lang === 'ta' ? 'கமிஷன்/கட்டணம்' : 'Commission/Chgs', value: grandTotals.commission, accent: '#ea580c', bg: '#fff7ed', textColor: '#c2410c' },
        { label: lang === 'ta' ? 'நிலுவை தொகை' : 'Debit Amount', value: grandTotals.closingBalance, accent: '#ea580c', bg: '#fff7ed', textColor: '#c2410c' }
    ];

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', boxSizing: 'border-box' }} className="no-print">
                <span style={{ fontSize: '24px' }}>📊</span>
                <span style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>
                    {lang === 'ta' ? 'விவசாயி அறிக்கைகள்' : 'Farmer Reports'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fdf8f6', border: '1px solid #fed7aa', padding: '6px 12px', borderRadius: '20px', marginLeft: '6px' }}>
                    <Calendar size={13} style={{ color: '#ea580c' }} />
                    <span style={{ fontSize: '12px', color: '#ea580c', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>
                        {appliedFrom === appliedTo ? displayDate(appliedFrom) : `${displayDate(appliedFrom)} — ${displayDate(appliedTo)}`}
                    </span>
                </div>

                {/* Presets Segmented Control */}
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: '2px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', marginLeft: '4px' }}>
                    {['today', 'month', 'custom'].map(p => (
                        <button key={p} onClick={() => applyPreset(p)} style={{
                            padding: '6px 15px', borderRadius: '7px', border: 'none',
                            background: activePreset === p ? '#fff' : 'transparent',
                            color: activePreset === p ? '#ea580c' : '#64748b',
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
                    <div className="animate-in slide-in-from-left-2 fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px', borderLeft: '1.5px solid #fed7aa', marginLeft: '6px' }}>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                            style={{ padding: '5px 8px', borderRadius: '8px', border: '1.5px solid #fed7aa', fontSize: '12px', fontWeight: 600, color: '#374151', outline: 'none', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: 700, textTransform: 'uppercase' }}>To</span>
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                            style={{ padding: '5px 8px', borderRadius: '8px', border: '1.5px solid #fed7aa', fontSize: '12px', fontWeight: 600, color: '#374151', outline: 'none', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                        />
                        <button onClick={handleApply} style={{
                            padding: '6px 18px', borderRadius: '8px', background: '#ea580c', border: 'none',
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
                <button onClick={() => {
                    const isTa = lang === 'ta';
                    const msg = isTa 
                        ? `*விவசாயிகள் மொத்த இறுதி அறிக்கை*\n*கால அளவு:* ${displayDate(appliedFrom)} முதல் ${displayDate(appliedTo)}\n-------------------\n*மொத்த முன்பணம்:* ${fmt(grandTotals.openingBalance)}\n*மொத்த கொள்முதல் தொகை:* ${fmt(grandTotals.debitPurchase)}\n*மொத்த வரவு தொகை:* ${fmt(grandTotals.creditCashPaid)}\n-------------------\n*மொத்த நிலுவை தொகை:* ${fmt(grandTotals.closingBalance)}`
                        : `*SUPPLIER FINAL REPORT*\n*Period:* ${displayDate(appliedFrom)} to ${displayDate(appliedTo)}\n-------------------\n*Total Advance:* ${fmt(grandTotals.openingBalance)}\n*Total Purchase Amount:* ${fmt(grandTotals.debitPurchase)}\n*Total Credit Amount:* ${fmt(grandTotals.creditCashPaid)}\n-------------------\n*Total Debit Amount:* ${fmt(grandTotals.closingBalance)}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }} title="Share Summary on WhatsApp"
                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #22c55e', background: '#fff', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                    <WhatsAppIcon size={16} />
                </button>

                {/* PDF */}
                <button onClick={handlePDFDownload} title="Download PDF"
                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                    <FileText size={16} />
                </button>

                {/* Print */}
                <button onClick={handlePrint} title="Print Report"
                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #ea580c', background: '#fff', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                    <Printer size={16} />
                </button>
            </div>

            {/* ── Stat Cards + Search Row ── */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'stretch', boxSizing: 'border-box' }} className="no-print">
                {STAT_CARDS.map(card => (
                    <div key={card.label} style={{ flex: '1 1 auto', minWidth: '130px', borderRadius: '10px', border: `1.5px solid ${card.accent}22`, background: card.bg, padding: '12px 16px', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: card.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{card.label}</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: card.textColor, wordBreak: 'break-word' }}>{fmt(card.value)}</div>
                    </div>
                ))}

                {/* Search */}
                <div style={{ flex: '1 1 220px', minWidth: '220px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} style={{ position: 'absolute', left: '12px', color: '#9ca3af', pointerEvents: 'none' }} />
                    <input type="text" placeholder={lang === 'ta' ? 'பெயர் அல்லது எண் மூலம் தேடுக...' : 'Search by name or ID...'}
                        value={search} onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', color: '#374151', background: '#fff', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
                        onFocus={e => e.target.style.borderColor = '#ea580c'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                </div>
            </div>

            {/* ── Table ── */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '16px' }} className="print-area">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ ...S.th, width: '12%', textAlign: 'center' }}>{lang === 'ta' ? 'விவசாயி கோடு' : 'Farmer Code'}</th>
                            <th style={S.th}>{lang === 'ta' ? 'விவசாயி பெயர்' : 'Farmer Name'}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{lang === 'ta' ? 'முன்பணம்' : 'Advance'}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{lang === 'ta' ? 'கொள்முதல் தொகை' : 'Purchase Amount'}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{lang === 'ta' ? 'வரவு தொகை' : 'Credit Amount'}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{lang === 'ta' ? 'கமிஷன்' : 'Commission'}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{lang === 'ta' ? 'நிலுவை தொகை' : 'Debit Amount'}</th>
                            <th style={{ ...S.th, textAlign: 'center' }} className="no-print">{lang === 'ta' ? 'செயல்கள்' : 'Actions'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
                                    {t('noRecords')}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((row, idx) => {
                                const isHighlighted = mainTableSelectedIndex === idx;
                                return (
                                    <tr key={row.rawFarmerId}
                                        ref={el => mainTableRowRefs.current[idx] = el}
                                        tabIndex={0}
                                        onClick={() => setMainTableSelectedIndex(idx)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                const nextIdx = Math.min(idx + 1, filtered.length - 1);
                                                setMainTableSelectedIndex(nextIdx);
                                                mainTableRowRefs.current[nextIdx]?.focus();
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                const prevIdx = Math.max(idx - 1, 0);
                                                setMainTableSelectedIndex(prevIdx);
                                                mainTableRowRefs.current[prevIdx]?.focus();
                                            } else if (e.key === 'Enter') {
                                                handleOpenLedgerModal(row);
                                            }
                                        }}
                                        style={{ 
                                            background: isHighlighted ? '#ea580c' : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                                            color: isHighlighted ? '#fff' : '#374151',
                                            cursor: 'pointer',
                                            outline: 'none'
                                        }}
                                        onMouseEnter={e => !isHighlighted && (e.currentTarget.style.background = '#fff7ed')}
                                        onMouseLeave={e => !isHighlighted && (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}
                                    >
                                        <td style={{ ...S.td, textAlign: 'center' }}>
                                            <span style={{ 
                                                background: isHighlighted ? 'rgba(255,255,255,0.2)' : '#fff7ed', 
                                                border: '1px solid ' + (isHighlighted ? 'rgba(255,255,255,0.4)' : '#fed7aa'), 
                                                color: isHighlighted ? '#fff' : '#ea580c', 
                                                fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' 
                                            }}>
                                                #{row.farmerId}
                                            </span>
                                        </td>
                                        <td style={S.td}>
                                            <span style={{ fontWeight: 600, color: isHighlighted ? '#fff' : '#1e293b' }}>
                                                {row.farmerName}
                                            </span>
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : '#1e293b' }}>
                                            {row.openingBalance !== 0 ? fmt(row.openingBalance) : '—'}
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : '#16a34a' }}>
                                            {row.debitPurchase !== 0 ? fmt(row.debitPurchase) : '—'}
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : '#ef4444' }}>
                                            {row.creditCashPaid !== 0 ? fmt(row.creditCashPaid) : '—'}
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : '#ea580c' }}>
                                            {row.commission !== 0 ? fmt(row.commission) : '—'}
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: isHighlighted ? '#fff' : '#ea580c' }}>
                                            {row.closingBalance !== 0 ? fmt(row.closingBalance) : '—'}
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'center' }} className="no-print">
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <button onClick={() => handleOpenLedgerModal(row)}
                                                    style={{ 
                                                        background: isHighlighted ? 'rgba(255,255,255,0.1)' : '#fff7ed', 
                                                        border: '1px solid ' + (isHighlighted ? 'rgba(255,255,255,0.5)' : '#fed7aa'), 
                                                        color: isHighlighted ? '#fff' : '#ea580c', 
                                                        fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-sans)' 
                                                    }}
                                                    onMouseEnter={e => { if(!isHighlighted) { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = '#fff'; }}}
                                                    onMouseLeave={e => { if(!isHighlighted) { e.currentTarget.style.background = '#fff7ed'; e.currentTarget.style.color = '#ea580c'; }}}
                                                >
                                                    {t('view')} <ChevronRight size={13} />
                                                </button>
                                                {row.contact && (
                                                    <button
                                                        onClick={() => handleShareWhatsApp(row)}
                                                        title="Share on WhatsApp"
                                                        style={{
                                                            width: '32px', height: '32px', borderRadius: '8px',
                                                            border: '1.5px solid ' + (isHighlighted ? 'rgba(255,255,255,0.5)' : '#22c55e'), 
                                                            background: isHighlighted ? 'rgba(255,255,255,0.1)' : '#fff',
                                                            color: isHighlighted ? '#fff' : '#22c55e', display: 'inline-flex',
                                                            alignItems: 'center', justifyContent: 'center',
                                                            cursor: 'pointer', flexShrink: 0,
                                                        }}
                                                        onMouseEnter={e => { if (!isHighlighted) { e.currentTarget.style.background='#22c55e'; e.currentTarget.style.color='#fff'; }}}
                                                        onMouseLeave={e => { if (!isHighlighted) { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#22c55e'; }}}
                                                    >
                                                        <WhatsAppIcon size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        {/* Grand Total Row */}
                        {filtered.length > 0 && (
                            <tr style={{ background: '#fff7ed', fontWeight: 800, borderTop: '2.5px solid #fed7aa' }}>
                                <td style={{ ...S.td, textAlign: 'center' }}></td>
                                <td style={{ ...S.td, fontWeight: 900, color: '#c2410c' }}>{lang === 'ta' ? 'மொத்த கூட்டுத்தொகை' : 'GRAND TOTAL'}</td>
                                <td style={{ ...S.td, textAlign: 'right', fontWeight: 900, color: '#1e293b' }}>
                                    {grandTotals.openingBalance !== 0 ? fmt(grandTotals.openingBalance) : '—'}
                                </td>
                                <td style={{ ...S.td, textAlign: 'right', fontWeight: 900, color: '#16a34a' }}>
                                    {grandTotals.debitPurchase !== 0 ? fmt(grandTotals.debitPurchase) : '—'}
                                </td>
                                <td style={{ ...S.td, textAlign: 'right', fontWeight: 900, color: '#ef4444' }}>
                                    {grandTotals.creditCashPaid !== 0 ? fmt(grandTotals.creditCashPaid) : '—'}
                                </td>
                                <td style={{ ...S.td, textAlign: 'right', fontWeight: 900, color: '#ea580c' }}>
                                    {grandTotals.commission !== 0 ? fmt(grandTotals.commission) : '—'}
                                </td>
                                <td style={{ ...S.td, textAlign: 'right', fontWeight: 950, color: '#ea580c', fontSize: '15px' }}>
                                    {grandTotals.closingBalance !== 0 ? fmt(grandTotals.closingBalance) : '—'}
                                </td>
                                <td style={S.td} className="no-print"></td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Detailed Ledger Modal */}
            {isLedgerOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }} className="no-print">
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '720px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-display)' }}>{ledgerFarmer?.farmerName}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{lang === 'ta' ? 'விவசாயி கணக்கு ஏடு' : 'Farmer Ledger'} • #{ledgerFarmer?.farmerId}</div>
                            </div>
                            <button onClick={() => setIsLedgerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={20} /></button>
                        </div>

                        {/* Mini summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px', padding: '16px 24px 0', width: '100%', boxSizing: 'border-box' }}>
                            {[
                                { l: lang === 'ta' ? 'முன்பணம்' : 'Advance', v: ledgerFarmer?.openingBalance, c: '#64748b', bg: '#f8fafc' },
                                { l: lang === 'ta' ? 'கொள்முதல்' : 'Plants Amt', v: ledgerFarmer?.debitPurchase, c: '#16a34a', bg: '#f0fdf4' },
                                { l: lang === 'ta' ? 'வரவு தொகை' : 'Credit Amount', v: ledgerFarmer?.creditCashPaid, c: '#ef4444', bg: '#fef2f2' },
                                { l: lang === 'ta' ? 'கமிஷன்' : 'Commission', v: ledgerFarmer?.commission, c: '#64748b', bg: '#f8fafc' },
                                { l: lang === 'ta' ? 'நிலுவை' : 'Debit Amount', v: ledgerFarmer?.closingBalance, c: '#ea580c', bg: '#fff7ed' }
                            ].map(x => (
                                <div key={x.l} style={{ background: x.bg, borderRadius: '10px', padding: '10px 12px', border: `1px solid ${x.c}22` }}>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: x.c, textTransform: 'uppercase', marginBottom: '3px', whiteSpace: 'nowrap' }}>{x.l}</div>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{fmt(x.v || 0)}</div>
                                </div>
                            ))}
                        </div>

                        {/* Transactions table container */}
                        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, width: '100%', boxSizing: 'border-box' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>{lang === 'ta' ? 'பரிவர்த்தனை வரலாறு' : 'Transaction History'}</div>
                            
                            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ background: '#fff7ed', borderBottom: '2px solid #fed7aa' }}>
                                            <th style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: '#ea580c' }}>{lang === 'ta' ? 'தேதி' : 'Date'}</th>
                                            <th style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: '#ea580c' }}>{lang === 'ta' ? 'விவரம்' : 'Description'}</th>
                                            <th style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>{lang === 'ta' ? 'வரவு (கொடுத்தது)' : 'Debit (Paid)'}</th>
                                            <th style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>{lang === 'ta' ? 'செலவு (வாங்கியது)' : 'Credit (Purch)'}</th>
                                            <th style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>{lang === 'ta' ? 'இருப்பு' : 'Balance'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '8px 10px', color: '#94a3b8' }}>---</td>
                                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>{lang === 'ta' ? 'ஆரம்ப இருப்பு' : 'Opening Balance'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#374151' }}>{fmt(ledgerFarmer?.openingBalance || 0)}</td>
                                        </tr>
                                        {ledgerEntries.map((entry, i) => (
                                            <tr key={entry.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '8px 10px' }}>{displayDate(entry.date)}</td>
                                                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{entry.description}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>{entry.debit ? fmt(entry.debit) : '—'}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{entry.credit ? fmt(entry.credit) : '—'}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#ea580c' }}>{fmt(entry.balance || 0)}</td>
                                            </tr>
                                        ))}
                                        {ledgerEntries.length === 0 && (
                                            <tr>
                                                <td colSpan={5} style={{ padding: '40px 10px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                                    {lang === 'ta' ? 'இந்தக் காலத்தில் கணக்கு விவரங்கள் இல்லை.' : 'No ledger activity in this period.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', width: '100%', boxSizing: 'border-box' }}>
                            <button onClick={() => setIsLedgerOpen(false)}
                                style={{ padding: '8px 20px', borderRadius: '9px', background: '#ea580c', color: '#fff', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-sans)' }}>
                                {t('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FarmerReport;
