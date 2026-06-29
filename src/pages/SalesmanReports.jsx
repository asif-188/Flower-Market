import React, { useState, useEffect, useMemo, useContext } from 'react';
import { subscribeToCollection } from '../utils/storage';
import { LangContext } from '../components/Layout';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { FileText, Calendar, User, Printer, Download, BarChart2 } from 'lucide-react';

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
        marginBottom: '20px', gap: '16px', flexWrap: 'wrap',
    },
    titleRow: { display: 'flex', alignItems: 'center', gap: '10px' },
    titleCol: { display: 'flex', flexDirection: 'column' },
    title: {
        fontSize: '22px', fontWeight: 800, color: '#1e293b',
        letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0,
    },
    subtitle: {
        fontSize: '11px', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px',
    },
    actions: {
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
    },
    btnAction: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '8px',
        border: '1.5px solid #d1d5db', background: '#f9fafb',
        color: '#374151', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    tabBar: {
        display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0',
        paddingBottom: '10px', marginBottom: '20px', flexWrap: 'wrap',
    },
    tabBtn: {
        padding: '6px 14px', borderRadius: '8px', border: 'none',
        fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
    },
    toolbar: {
        display: 'flex', alignItems: 'center', gap: '20px',
        padding: '20px', background: '#f0fdfa', border: '1px solid #99f6e4',
        borderRadius: '12px', marginBottom: '24px', flexWrap: 'wrap',
    },
    filterGroup: {
        display: 'flex', flexDirection: 'column', gap: '4px',
    },
    label: {
        fontSize: '10px', fontWeight: 700, color: '#0d9488',
        textTransform: 'uppercase', letterSpacing: '0.08em',
    },
    input: {
        padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #99f6e4',
        fontSize: '13px', fontWeight: 600, color: '#374151', outline: 'none',
        background: '#fff',
    },
    table: {
        width: '100%', borderCollapse: 'collapse',
    },
    th: {
        padding: '10px 14px', textAlign: 'left',
        fontSize: '11px', fontWeight: 700, color: '#0f766e',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap',
        background: '#fff',
    },
    td: {
        padding: '13px 14px', fontSize: '14px',
        color: '#374151', borderBottom: '1px solid #f3f4f6',
        verticalAlign: 'middle',
    },
    emptyRow: {
        padding: '80px 16px', textAlign: 'center',
        color: '#9ca3af', fontStyle: 'italic', fontSize: '14px',
    }
};

const TD_S = S.td;

const displayDate = (iso) => {
    if (!iso || typeof iso !== 'string') return '---';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const SalesmanReports = () => {
    const { lang } = useContext(LangContext);
    const [salesmen, setSalesmen] = useState([]);
    const [cashRecords, setCashRecords] = useState([]);
    const [purchaseRecords, setPurchaseRecords] = useState([]);
    const [flowers, setFlowers] = useState([]);

    const today = new Date().toLocaleDateString('en-CA');
    const [activeTab, setActiveTab] = useState('cash'); // 'cash', 'purchase', 'ledger', 'flower', 'daily', 'monthly'
    const [selectedSalesmanId, setSelectedSalesmanId] = useState('');
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);

    useEffect(() => {
        const unsubSalesmen = subscribeToCollection('salesmen', setSalesmen);
        const unsubCash = subscribeToCollection('salesman_cash', setCashRecords);
        const unsubPurchases = subscribeToCollection('salesman_purchases', setPurchaseRecords);
        const unsubProducts = subscribeToCollection('products', (data) => {
            setFlowers(data.length === 0
                ? [{ name: 'Rose', taName: 'ரோஜா' }, { name: 'Jasmine', taName: 'மல்லிகை' }, { name: 'Marigold', taName: 'சாமந்தி' }]
                : data);
        });

        return () => {
            unsubSalesmen();
            unsubCash();
            unsubPurchases();
            unsubProducts();
        };
    }, []);

    // Filter Helper
    const isWithinDateRange = (dateStr) => {
        if (!dateStr) return false;
        return dateStr >= fromDate && dateStr <= toDate;
    };

    // Report Data Calculators
    const reportsData = useMemo(() => {
        const cashFiltered = cashRecords.filter(r => 
            isWithinDateRange(r.date) && (!selectedSalesmanId || r.salesmanId === selectedSalesmanId)
        ).sort((a, b) => b.date.localeCompare(a.date));

        const purchaseFiltered = purchaseRecords.filter(p => 
            isWithinDateRange(p.date) && (!selectedSalesmanId || p.salesmanId === selectedSalesmanId)
        ).sort((a, b) => b.date.localeCompare(a.date));

        // Ledger calculation
        let ledgerRows = [];
        if (selectedSalesmanId) {
            const sCash = cashRecords.filter(r => r.salesmanId === selectedSalesmanId);
            const sPurchases = purchaseRecords.filter(p => p.salesmanId === selectedSalesmanId);
            const allDates = Array.from(new Set([
                ...sCash.map(r => r.date).filter(Boolean),
                ...sPurchases.map(p => p.date).filter(Boolean)
            ])).sort();

            let carryForward = 0;
            for (const d of allDates) {
                const issuedToday = sCash.filter(r => r.date === d).reduce((sum, r) => sum + (r.openingCash || 0), 0);
                const purchasesToday = sPurchases.filter(p => p.date === d).reduce((sum, p) => sum + (p.grandTotal || 0), 0);
                const openingCash = carryForward + issuedToday;
                const balanceCash = openingCash - purchasesToday;

                if (isWithinDateRange(d)) {
                    ledgerRows.push({
                        date: d,
                        openingCash,
                        purchaseAmount: purchasesToday,
                        balanceCash,
                        closingBalance: balanceCash,
                        carryForwardBalance: balanceCash
                    });
                }
                carryForward = balanceCash;
            }
            ledgerRows.reverse();
        }

        // Flower-wise summary
        const flowerSummary = {};
        purchaseRecords.filter(p => isWithinDateRange(p.date)).forEach(p => {
            (p.items || []).forEach(item => {
                const name = item.flowerType;
                if (!flowerSummary[name]) flowerSummary[name] = { name, quantity: 0, amount: 0 };
                flowerSummary[name].quantity += Number(item.quantity) || 0;
                flowerSummary[name].amount += Number(item.total) || 0;
            });
        });
        const flowerRows = Object.values(flowerSummary).sort((a, b) => b.quantity - a.quantity);

        // Daily Summary
        const dailySummary = {};
        cashRecords.forEach(r => {
            if (!r.date) return;
            if (!dailySummary[r.date]) dailySummary[r.date] = { date: r.date, cashIssued: 0, purchases: 0 };
            dailySummary[r.date].cashIssued += Number(r.openingCash) || 0;
        });
        purchaseRecords.forEach(p => {
            if (!p.date) return;
            if (!dailySummary[p.date]) dailySummary[p.date] = { date: p.date, cashIssued: 0, purchases: 0 };
            dailySummary[p.date].purchases += Number(p.grandTotal) || 0;
        });
        const dailyRows = Object.values(dailySummary)
            .filter(r => isWithinDateRange(r.date))
            .map(r => ({ ...r, netBalance: r.cashIssued - r.purchases }))
            .sort((a, b) => b.date.localeCompare(a.date));

        // Monthly Summary
        const monthlySummary = {};
        cashRecords.forEach(r => {
            if (!r.date || typeof r.date !== 'string') return;
            const m = r.date.substring(0, 7); // 'YYYY-MM'
            if (!monthlySummary[m]) monthlySummary[m] = { month: m, cashIssued: 0, purchases: 0 };
            monthlySummary[m].cashIssued += Number(r.openingCash) || 0;
        });
        purchaseRecords.forEach(p => {
            if (!p.date || typeof p.date !== 'string') return;
            const m = p.date.substring(0, 7); // 'YYYY-MM'
            if (!monthlySummary[m]) monthlySummary[m] = { month: m, cashIssued: 0, purchases: 0 };
            monthlySummary[m].purchases += Number(p.grandTotal) || 0;
        });
        const monthlyRows = Object.values(monthlySummary)
            .map(r => ({ ...r, netBalance: r.cashIssued - r.purchases }))
            .sort((a, b) => b.month.localeCompare(a.month));

        return {
            cash: cashFiltered,
            purchase: purchaseFiltered,
            ledger: ledgerRows,
            flower: flowerRows,
            daily: dailyRows,
            monthly: monthlyRows
        };
    }, [cashRecords, purchaseRecords, fromDate, toDate, selectedSalesmanId]);

    const activeData = useMemo(() => {
        return reportsData[activeTab] || [];
    }, [reportsData, activeTab]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Export Excel
    const handleExportExcel = () => {
        if (activeData.length === 0) return alert('No data to export.');
        
        let wsData = [];
        let filename = `Salesman_${activeTab}_Report_${Date.now()}.xlsx`;

        if (activeTab === 'cash') {
            wsData = activeData.map(r => ({
                'Date': displayDate(r.date),
                'Salesman Name': r.salesmanName,
                'Cash Issued (₹)': r.openingCash,
                'Remarks': r.remarks || '---'
            }));
        } else if (activeTab === 'purchase') {
            wsData = activeData.map(p => ({
                'Date': displayDate(p.date),
                'Salesman Name': p.salesmanName,
                'Farmer Name': p.farmerName,
                'Bill Number': p.billNumber,
                'Grand Total (₹)': p.grandTotal,
                'Remarks': p.remarks || '---'
            }));
        } else if (activeTab === 'ledger') {
            wsData = activeData.map(r => ({
                'Date': displayDate(r.date),
                'Opening Cash (₹)': r.openingCash,
                'Purchase Amount (₹)': r.purchaseAmount,
                'Balance Cash (₹)': r.balanceCash,
                'Closing Balance (₹)': r.closingBalance
            }));
        } else if (activeTab === 'flower') {
            wsData = activeData.map(r => ({
                'Flower Name': r.name,
                'Total Qty (KG)': r.quantity,
                'Total Value (₹)': r.amount
            }));
        } else if (activeTab === 'daily') {
            wsData = activeData.map(r => ({
                'Date': displayDate(r.date),
                'Total Cash Issued (₹)': r.cashIssued,
                'Total Purchases (₹)': r.purchases,
                'Net Balance (₹)': r.netBalance
            }));
        } else if (activeTab === 'monthly') {
            wsData = activeData.map(r => ({
                'Month': r.month,
                'Total Cash Issued (₹)': r.cashIssued,
                'Total Purchases (₹)': r.purchases,
                'Net Balance (₹)': r.netBalance
            }));
        }

        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, filename);
    };

    // Print Report
    const handlePrint = () => {
        if (activeData.length === 0) return alert('No data to print.');

        const printWindow = window.open('', '_blank');
        const rangeText = `Period: ${displayDate(fromDate)} - ${displayDate(toDate)}`;
        const salesman = salesmen.find(s => s.id === selectedSalesmanId);

        let tableHeader = '';
        let tableBody = '';

        if (activeTab === 'cash') {
            tableHeader = '<tr><th>Date</th><th>Salesman</th><th class="right">Cash Issued</th><th>Remarks</th></tr>';
            tableBody = activeData.map(r => `
                <tr>
                    <td>${displayDate(r.date)}</td>
                    <td>${r.salesmanName}</td>
                    <td class="right">${formatCurrency(r.openingCash)}</td>
                    <td>${r.remarks || '---'}</td>
                </tr>
            `).join('');
        } else if (activeTab === 'purchase') {
            tableHeader = '<tr><th>Date</th><th>Salesman</th><th>Farmer</th><th>Bill Number</th><th class="right">Grand Total</th></tr>';
            tableBody = activeData.map(p => `
                <tr>
                    <td>${displayDate(p.date)}</td>
                    <td>${p.salesmanName}</td>
                    <td>${p.farmerName}</td>
                    <td>${p.billNumber}</td>
                    <td class="right">${formatCurrency(p.grandTotal)}</td>
                </tr>
            `).join('');
        } else if (activeTab === 'ledger') {
            tableHeader = '<tr><th>Date</th><th class="right">Opening Cash</th><th class="right">Purchase Amount</th><th class="right">Balance Cash</th><th class="right">Closing Balance</th></tr>';
            tableBody = activeData.map(r => `
                <tr>
                    <td>${displayDate(r.date)}</td>
                    <td class="right">${formatCurrency(r.openingCash)}</td>
                    <td class="right">${formatCurrency(r.purchaseAmount)}</td>
                    <td class="right">${formatCurrency(r.balanceCash)}</td>
                    <td class="right">${formatCurrency(r.closingBalance)}</td>
                </tr>
            `).join('');
        } else if (activeTab === 'flower') {
            tableHeader = '<tr><th>Flower Name</th><th class="right">Total Qty (KG)</th><th class="right">Total Value</th></tr>';
            tableBody = activeData.map(r => {
                const fl = flowers.find(f => f.name === r.name);
                const nameLocalized = lang === 'ta' ? (fl?.taName || r.name) : r.name;
                return `
                    <tr>
                        <td>${nameLocalized}</td>
                        <td class="right">${r.quantity.toFixed(3)}</td>
                        <td class="right">${formatCurrency(r.amount)}</td>
                    </tr>
                `;
            }).join('');
        } else if (activeTab === 'daily') {
            tableHeader = '<tr><th>Date</th><th class="right">Total Cash Issued</th><th class="right">Total Purchases</th><th class="right">Net Balance</th></tr>';
            tableBody = activeData.map(r => `
                <tr>
                    <td>${displayDate(r.date)}</td>
                    <td class="right">${formatCurrency(r.cashIssued)}</td>
                    <td class="right">${formatCurrency(r.purchases)}</td>
                    <td class="right">${formatCurrency(r.netBalance)}</td>
                </tr>
            `).join('');
        } else if (activeTab === 'monthly') {
            tableHeader = '<tr><th>Month</th><th class="right">Total Cash Issued</th><th class="right">Total Purchases</th><th class="right">Net Balance</th></tr>';
            tableBody = activeData.map(r => `
                <tr>
                    <td>${r.month}</td>
                    <td class="right">${formatCurrency(r.cashIssued)}</td>
                    <td class="right">${formatCurrency(r.purchases)}</td>
                    <td class="right">${formatCurrency(r.netBalance)}</td>
                </tr>
            `).join('');
        }

        const html = `
            <html>
            <head>
                <title>Report - ${activeTab.toUpperCase()}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; line-height: 1.4; }
                    .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .header h2 { margin: 0; font-size: 24px; text-transform: uppercase; }
                    .header p { margin: 5px 0 0; color: #555; font-size: 14px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #ccc; padding: 8px 10px; font-size: 13px; text-align: left; }
                    th { background: #f9f9f9; font-weight: bold; }
                    .right { text-align: right; }
                    .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #888; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="header">
                    <h2>SALESMAN ${activeTab.toUpperCase()} REPORT</h2>
                    ${salesman ? `<p>Salesman: <strong>${salesman.name}</strong></p>` : ''}
                    <p>${rangeText}</p>
                </div>
                <table>
                    <thead>${tableHeader}</thead>
                    <tbody>${tableBody}</tbody>
                </table>
                <div class="footer">Generated on ${new Date().toLocaleString()}</div>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    // PDF Download
    const handleExportPDF = () => {
        if (activeData.length === 0) return alert('No data to export.');

        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(`SALESMAN ${activeTab.toUpperCase()} REPORT`, 14, 20);

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Period: ${displayDate(fromDate)} to ${displayDate(toDate)}`, 14, 27);

            const salesman = salesmen.find(s => s.id === selectedSalesmanId);
            if (salesman) {
                doc.text(`Salesman: ${salesman.name}`, 14, 33);
            }

            let y = 40;
            doc.setFillColor(240, 240, 240);
            doc.setFont('Helvetica', 'bold');

            if (activeTab === 'cash') {
                doc.rect(14, y, 182, 8, 'F');
                doc.text('Date', 16, y + 5.5);
                doc.text('Salesman Name', 50, y + 5.5);
                doc.text('Cash Issued', 110, y + 5.5);
                doc.text('Remarks', 150, y + 5.5);
                y += 8;
                doc.setFont('Helvetica', 'normal');
                activeData.forEach(r => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.line(14, y, 196, y);
                    doc.text(displayDate(r.date), 16, y + 5.5);
                    doc.text(r.salesmanName, 50, y + 5.5);
                    doc.text(`Rs ${r.openingCash.toFixed(0)}`, 110, y + 5.5);
                    doc.text(r.remarks || '---', 150, y + 5.5);
                    y += 8;
                });
            } else if (activeTab === 'purchase') {
                doc.rect(14, y, 182, 8, 'F');
                doc.text('Date', 16, y + 5.5);
                doc.text('Salesman', 45, y + 5.5);
                doc.text('Farmer', 85, y + 5.5);
                doc.text('Bill No.', 125, y + 5.5);
                doc.text('Total', 160, y + 5.5);
                y += 8;
                doc.setFont('Helvetica', 'normal');
                activeData.forEach(p => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.line(14, y, 196, y);
                    doc.text(displayDate(p.date), 16, y + 5.5);
                    doc.text(p.salesmanName, 45, y + 5.5);
                    doc.text(p.farmerName, 85, y + 5.5);
                    doc.text(p.billNumber || '---', 125, y + 5.5);
                    doc.text(`Rs ${p.grandTotal.toFixed(0)}`, 160, y + 5.5);
                    y += 8;
                });
            } else if (activeTab === 'ledger') {
                doc.rect(14, y, 182, 8, 'F');
                doc.text('Date', 16, y + 5.5);
                doc.text('Opening Cash', 50, y + 5.5);
                doc.text('Purchase Amt', 90, y + 5.5);
                doc.text('Balance Cash', 130, y + 5.5);
                doc.text('Closing Bal', 165, y + 5.5);
                y += 8;
                doc.setFont('Helvetica', 'normal');
                activeData.forEach(r => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.line(14, y, 196, y);
                    doc.text(displayDate(r.date), 16, y + 5.5);
                    doc.text(`Rs ${r.openingCash.toFixed(0)}`, 50, y + 5.5);
                    doc.text(`Rs ${r.purchaseAmount.toFixed(0)}`, 90, y + 5.5);
                    doc.text(`Rs ${r.balanceCash.toFixed(0)}`, 130, y + 5.5);
                    doc.text(`Rs ${r.closingBalance.toFixed(0)}`, 165, y + 5.5);
                    y += 8;
                });
            } else if (activeTab === 'flower') {
                doc.rect(14, y, 182, 8, 'F');
                doc.text('Flower Name', 16, y + 5.5);
                doc.text('Total Qty (KG)', 80, y + 5.5);
                doc.text('Total Value', 140, y + 5.5);
                y += 8;
                doc.setFont('Helvetica', 'normal');
                activeData.forEach(r => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    const fl = flowers.find(f => f.name === r.name);
                    const nameLocalized = lang === 'ta' ? (fl?.taName || r.name) : r.name;
                    doc.line(14, y, 196, y);
                    doc.text(nameLocalized, 16, y + 5.5);
                    doc.text(r.quantity.toFixed(3), 80, y + 5.5);
                    doc.text(`Rs ${r.amount.toFixed(0)}`, 140, y + 5.5);
                    y += 8;
                });
            } else if (activeTab === 'daily' || activeTab === 'monthly') {
                doc.rect(14, y, 182, 8, 'F');
                doc.text(activeTab === 'daily' ? 'Date' : 'Month', 16, y + 5.5);
                doc.text('Total Cash Issued', 60, y + 5.5);
                doc.text('Total Purchases', 110, y + 5.5);
                doc.text('Net Balance', 160, y + 5.5);
                y += 8;
                doc.setFont('Helvetica', 'normal');
                activeData.forEach(r => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.line(14, y, 196, y);
                    doc.text(activeTab === 'daily' ? displayDate(r.date) : r.month, 16, y + 5.5);
                    doc.text(`Rs ${r.cashIssued.toFixed(0)}`, 60, y + 5.5);
                    doc.text(`Rs ${r.purchases.toFixed(0)}`, 110, y + 5.5);
                    doc.text(`Rs ${r.netBalance.toFixed(0)}`, 160, y + 5.5);
                    y += 8;
                });
            }

            doc.line(14, y, 196, y);
            doc.save(`Salesman_${activeTab}_report_${Date.now()}.pdf`);
        } catch (e) {
            alert('PDF Generation Failed: ' + e.message);
        }
    };

    return (
        <div style={S.page}>
            {/* Title & Exports */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <BarChart2 size={22} color="#0d9488" />
                    <div style={S.titleCol}>
                        <h2 style={S.title}>Salesman Reports</h2>
                        <span style={S.subtitle}>Generate and export operations logs</span>
                    </div>
                </div>

                {activeData.length > 0 && (
                    <div style={S.actions}>
                        <button style={S.btnAction} onClick={handlePrint}
                            onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                            onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                        >
                            <Printer size={14} /> Print
                        </button>
                        <button style={S.btnAction} onClick={handleExportPDF}
                            onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                            onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                        >
                            <FileText size={14} color="#ef4444" /> PDF
                        </button>
                        <button style={S.btnAction} onClick={handleExportExcel}
                            onMouseEnter={e => e.currentTarget.style.background='#ecfdf5'}
                            onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                        >
                            <Download size={14} color="#10b981" /> Excel
                        </button>
                    </div>
                )}
            </div>

            {/* Sub Tabs */}
            <div style={S.tabBar}>
                {[
                    { id: 'cash', label: 'Cash Report' },
                    { id: 'purchase', label: 'Purchase Report' },
                    { id: 'ledger', label: 'Ledger' },
                    { id: 'flower', label: 'Flower Purchases' },
                    { id: 'daily', label: 'Daily Summary' },
                    { id: 'monthly', label: 'Monthly Summary' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id);
                            if (tab.id !== 'ledger' && tab.id !== 'cash' && tab.id !== 'purchase') {
                                setSelectedSalesmanId('');
                            }
                        }}
                        style={{
                            ...S.tabBtn,
                            background: activeTab === tab.id ? '#0d9488' : '#fff',
                            color: activeTab === tab.id ? '#fff' : '#64748b',
                            border: '1px solid ' + (activeTab === tab.id ? '#0d9488' : '#e2e8f0'),
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filters Toolbar */}
            <div style={S.toolbar}>
                
                {/* Date Selection */}
                {activeTab !== 'monthly' && (
                    <>
                        <div style={S.filterGroup}>
                            <label style={S.label}>From Date</label>
                            <input 
                                type="date"
                                style={S.input}
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>
                        <div style={S.filterGroup}>
                            <label style={S.label}>To Date</label>
                            <input 
                                type="date"
                                style={S.input}
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>
                    </>
                )}

                {/* Salesman Filter */}
                {(activeTab === 'cash' || activeTab === 'purchase' || activeTab === 'ledger') && (
                    <div style={S.filterGroup}>
                        <label style={S.label}>Filter Salesman</label>
                        <select
                            style={{...S.input, minWidth: '200px'}}
                            value={selectedSalesmanId}
                            onChange={(e) => setSelectedSalesmanId(e.target.value)}
                        >
                            <option value="">All Salesmen...</option>
                            {salesmen.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Output Grid/Table */}
            {activeTab === 'ledger' && !selectedSalesmanId ? (
                <div style={S.emptyRow}>
                    Select a salesman from the filters above to load the ledger report.
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={S.table}>
                        <thead>
                            <tr style={{ background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                                {activeTab === 'cash' && (
                                    <>
                                        <th style={S.th}>Date</th>
                                        <th style={S.th}>Salesman Name</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Cash Issued</th>
                                        <th style={S.th}>Remarks</th>
                                    </>
                                )}
                                {activeTab === 'purchase' && (
                                    <>
                                        <th style={S.th}>Date</th>
                                        <th style={S.th}>Salesman Name</th>
                                        <th style={S.th}>Farmer Name</th>
                                        <th style={S.th}>Bill Number</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Grand Total</th>
                                    </>
                                )}
                                {activeTab === 'ledger' && (
                                    <>
                                        <th style={S.th}>Date</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Opening Cash</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Purchase Amount</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Balance Cash</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Closing Balance</th>
                                    </>
                                )}
                                {activeTab === 'flower' && (
                                    <>
                                        <th style={S.th}>Flower Name</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Total Quantity</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Total Purchase Value</th>
                                    </>
                                )}
                                {activeTab === 'daily' && (
                                    <>
                                        <th style={S.th}>Date</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Total Cash Issued</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Total Purchases</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Net Day Balance</th>
                                    </>
                                )}
                                {activeTab === 'monthly' && (
                                    <>
                                        <th style={S.th}>Month</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Total Cash Issued</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Total Purchases</th>
                                        <th style={{...S.th, textAlign: 'right'}}>Net Month Balance</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {activeData.length === 0 ? (
                                <tr>
                                    <td colSpan={10} style={S.emptyRow}>
                                        No records found matching the selected filters.
                                    </td>
                                </tr>
                            ) : (
                                activeTab === 'cash' && activeData.map(r => (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={TD_S}>{displayDate(r.date)}</td>
                                        <td style={{...TD_S, fontWeight: 700}}>{r.salesmanName}</td>
                                        <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#16a34a'}}>{formatCurrency(r.openingCash)}</td>
                                        <td style={TD_S}>{r.remarks || '---'}</td>
                                    </tr>
                                ))
                            )}
                            {activeTab === 'purchase' && activeData.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={TD_S}>{displayDate(p.date)}</td>
                                    <td style={{...TD_S, fontWeight: 700}}>{p.salesmanName}</td>
                                    <td style={TD_S}>{p.farmerName}</td>
                                    <td style={TD_S}>{p.billNumber}</td>
                                    <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#ea580c'}}>{formatCurrency(p.grandTotal)}</td>
                                </tr>
                            ))}
                            {activeTab === 'ledger' && activeData.map(r => (
                                <tr key={r.date} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={TD_S}>{displayDate(r.date)}</td>
                                    <td style={{...TD_S, textAlign: 'right'}}>{formatCurrency(r.openingCash)}</td>
                                    <td style={{...TD_S, textAlign: 'right', color: '#dc2626', fontWeight: 700}}>{formatCurrency(r.purchaseAmount)}</td>
                                    <td style={{...TD_S, textAlign: 'right'}}>{formatCurrency(r.balanceCash)}</td>
                                    <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#0d9488'}}>{formatCurrency(r.closingBalance)}</td>
                                </tr>
                            ))}
                            {activeTab === 'flower' && activeData.map(r => {
                                const fl = flowers.find(f => f.name === r.name);
                                const localizedName = lang === 'ta' ? (fl?.taName || r.name) : r.name;
                                return (
                                    <tr key={r.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{...TD_S, fontWeight: 700}}>{localizedName}</td>
                                        <td style={{...TD_S, textAlign: 'right'}}>{r.quantity.toFixed(3)} KG</td>
                                        <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#0d9488'}}>{formatCurrency(r.amount)}</td>
                                    </tr>
                                );
                            })}
                            {activeTab === 'daily' && activeData.map(r => (
                                <tr key={r.date} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={TD_S}>{displayDate(r.date)}</td>
                                    <td style={{...TD_S, textAlign: 'right', color: '#16a34a'}}>{formatCurrency(r.cashIssued)}</td>
                                    <td style={{...TD_S, textAlign: 'right', color: '#dc2626'}}>{formatCurrency(r.purchases)}</td>
                                    <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#0d9488'}}>{formatCurrency(r.netBalance)}</td>
                                </tr>
                            ))}
                            {activeTab === 'monthly' && activeData.map(r => (
                                <tr key={r.month} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={TD_S}>{r.month}</td>
                                    <td style={{...TD_S, textAlign: 'right', color: '#16a34a'}}>{formatCurrency(r.cashIssued)}</td>
                                    <td style={{...TD_S, textAlign: 'right', color: '#dc2626'}}>{formatCurrency(r.purchases)}</td>
                                    <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#0d9488'}}>{formatCurrency(r.netBalance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SalesmanReports;
