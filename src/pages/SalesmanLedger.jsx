import React, { useState, useEffect, useMemo, useContext } from 'react';
import { subscribeToCollection } from '../utils/storage';
import { LangContext } from '../components/Layout';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { Search, Calendar, User, Printer, Download, FileText } from 'lucide-react';

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
    toolbar: {
        display: 'flex', alignItems: 'center', gap: '20px',
        padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: '12px', marginBottom: '24px', flexWrap: 'wrap',
    },
    filterGroup: {
        display: 'flex', flexDirection: 'column', gap: '4px',
    },
    label: {
        fontSize: '10px', fontWeight: 700, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.08em',
    },
    input: {
        padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
        fontSize: '13px', fontWeight: 600, color: '#374151', outline: 'none',
        background: '#fff',
    },
    toggleWrap: {
        display: 'flex', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '2px',
    },
    toggleBtn: {
        padding: '5px 12px', borderRadius: '6px', border: 'none',
        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
    },
    table: {
        width: '100%', borderCollapse: 'collapse',
    },
    th: {
        padding: '10px 14px', textAlign: 'left',
        fontSize: '11px', fontWeight: 700, color: '#d97706',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap',
        background: '#fff',
    },
    td: {
        padding: '13px 14px', fontSize: '14px',
        color: '#374151', borderBottom: '1px solid #f3f4f6',
        verticalAlign: 'middle',
    },
    idBadge: {
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 10px', borderRadius: '6px',
        background: '#fffbeb', border: '1px solid #fde68a',
        color: '#b45309', fontWeight: 700, fontSize: '12px',
    },
    emptyRow: {
        padding: '80px 16px', textAlign: 'center',
        color: '#9ca3af', fontStyle: 'italic', fontSize: '14px',
    }
};

const displayDate = (iso) => {
    if (!iso || typeof iso !== 'string') return '---';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const SalesmanLedger = () => {
    const { t } = useContext(LangContext);
    const [salesmen, setSalesmen] = useState([]);
    const [cashRecords, setCashRecords] = useState([]);
    const [purchaseRecords, setPurchaseRecords] = useState([]);

    const today = new Date().toLocaleDateString('en-CA');
    const [selectedSalesmanId, setSelectedSalesmanId] = useState('');
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [filterType, setFilterType] = useState('date'); // 'date' or 'month'

    useEffect(() => {
        const unsubSalesmen = subscribeToCollection('salesmen', setSalesmen);
        const unsubCash = subscribeToCollection('salesman_cash', setCashRecords);
        const unsubPurchases = subscribeToCollection('salesman_purchases', setPurchaseRecords);

        return () => {
            unsubSalesmen();
            unsubCash();
            unsubPurchases();
        };
    }, []);

    // Generate Ledger chronologically and filter afterwards
    const ledgerData = useMemo(() => {
        if (!selectedSalesmanId) return [];

        const sCash = cashRecords.filter(r => r.salesmanId === selectedSalesmanId);
        const sPurchases = purchaseRecords.filter(p => p.salesmanId === selectedSalesmanId);

        // Get all unique dates sorted chronologically
        const allDates = Array.from(new Set([
            ...sCash.map(r => r.date).filter(Boolean),
            ...sPurchases.map(p => p.date).filter(Boolean)
        ])).sort();

        const rows = [];
        let carryForward = 0;

        for (const date of allDates) {
            const dayCash = sCash.filter(r => r.date === date);
            const dayPurchases = sPurchases.filter(p => p.date === date);

            const issuedToday = dayCash.reduce((sum, r) => sum + (r.openingCash || 0), 0);
            const purchasesToday = dayPurchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0);

            const openingCash = carryForward + issuedToday;
            const balanceCash = openingCash - purchasesToday;

            rows.push({
                date,
                issuedCash: issuedToday,
                openingCash,
                purchaseAmount: purchasesToday,
                balanceCash,
                closingBalance: balanceCash,
                carryForwardBalance: balanceCash
            });

            carryForward = balanceCash;
        }

        // Apply filters
        return rows.filter(row => {
            if (filterType === 'month') {
                if (!selectedMonth) return true;
                return row.date.substring(0, 7) === selectedMonth;
            } else {
                if (fromDate && row.date < fromDate) return false;
                if (toDate && row.date > toDate) return false;
                return true;
            }
        });
    }, [cashRecords, purchaseRecords, selectedSalesmanId, fromDate, toDate, selectedMonth, filterType]);

    const activeSalesman = useMemo(() => {
        return salesmen.find(s => s.id === selectedSalesmanId);
    }, [salesmen, selectedSalesmanId]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const handlePrint = () => {
        if (!selectedSalesmanId || ledgerData.length === 0) return alert('No data to print.');

        const printWindow = window.open('', '_blank');
        const rangeText = filterType === 'month' 
            ? `Month: ${selectedMonth}`
            : `Period: ${displayDate(fromDate)} - ${displayDate(toDate)}`;

        const html = `
            <html>
            <head>
                <title>Ledger - ${activeSalesman?.name}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; line-height: 1.4; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .header h2 { margin: 0; font-size: 26px; }
                    .header p { margin: 5px 0 0; color: #555; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ccc; padding: 10px; text-align: left; font-size: 14px; }
                    th { background: #f2f2f2; font-weight: bold; }
                    .right { text-align: right; }
                    .bold { font-weight: bold; }
                    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #777; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="header">
                    <h2>SALESMAN LEDGER STATEMENT</h2>
                    <p>Salesman: <strong>${activeSalesman?.name}</strong> | ID: #${activeSalesman?.displayId}</p>
                    <p>${rangeText}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th class="right">Opening Cash</th>
                            <th class="right">Purchase Amount</th>
                            <th class="right">Balance Cash</th>
                            <th class="right">Closing Balance</th>
                            <th class="right">Carry Forward</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ledgerData.map(r => `
                            <tr>
                                <td>${displayDate(r.date)}</td>
                                <td class="right">${r.openingCash.toFixed(0)}</td>
                                <td class="right">${r.purchaseAmount.toFixed(0)}</td>
                                <td class="right">${r.balanceCash.toFixed(0)}</td>
                                <td class="right">${r.closingBalance.toFixed(0)}</td>
                                <td class="right bold">${r.carryForwardBalance.toFixed(0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">Generated on ${new Date().toLocaleString()}</div>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleExportExcel = () => {
        if (!selectedSalesmanId || ledgerData.length === 0) return alert('No data to export.');
        const data = ledgerData.map(r => ({
            'Date': displayDate(r.date),
            'Opening Cash (₹)': r.openingCash,
            'Purchase Amount (₹)': r.purchaseAmount,
            'Balance Cash (₹)': r.balanceCash,
            'Closing Balance (₹)': r.closingBalance,
            'Carry Forward Balance (₹)': r.carryForwardBalance
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
        XLSX.writeFile(wb, `SalesmanLedger_${activeSalesman?.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
    };

    const handleExportPDF = () => {
        if (!selectedSalesmanId || ledgerData.length === 0) return alert('No data to download.');
        
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(18);
            doc.text('SALESMAN LEDGER STATEMENT', 14, 20);
            
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(11);
            doc.text(`Salesman Name: ${activeSalesman?.name} (#${activeSalesman?.displayId})`, 14, 28);
            doc.text(`Location: ${activeSalesman?.location || 'N/A'} | Contact: ${activeSalesman?.contact || 'N/A'}`, 14, 34);
            
            const rangeText = filterType === 'month' 
                ? `Month: ${selectedMonth}`
                : `Period: ${displayDate(fromDate)} to ${displayDate(toDate)}`;
            doc.text(rangeText, 14, 40);
            
            let y = 50;
            doc.setFillColor(240, 240, 240);
            doc.rect(14, y, 182, 8, 'F');
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(9);
            
            doc.text('Date', 16, y + 5.5);
            doc.text('Opening Cash', 46, y + 5.5);
            doc.text('Purchase Amt', 81, y + 5.5);
            doc.text('Balance Cash', 116, y + 5.5);
            doc.text('Closing Bal', 151, y + 5.5);
            doc.text('Carry Forward', 182, y + 5.5, { align: 'right' });
            
            y += 8;
            doc.setFont('Helvetica', 'normal');
            ledgerData.forEach(r => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                    doc.setFillColor(240, 240, 240);
                    doc.rect(14, y, 182, 8, 'F');
                    doc.setFont('Helvetica', 'bold');
                    doc.text('Date', 16, y + 5.5);
                    doc.text('Opening Cash', 46, y + 5.5);
                    doc.text('Purchase Amt', 81, y + 5.5);
                    doc.text('Balance Cash', 116, y + 5.5);
                    doc.text('Closing Bal', 151, y + 5.5);
                    doc.text('Carry Forward', 182, y + 5.5, { align: 'right' });
                    y += 8;
                    doc.setFont('Helvetica', 'normal');
                }
                
                doc.line(14, y, 196, y);
                doc.text(displayDate(r.date), 16, y + 5.5);
                doc.text(`Rs ${r.openingCash.toFixed(0)}`, 46, y + 5.5);
                doc.text(`Rs ${r.purchaseAmount.toFixed(0)}`, 81, y + 5.5);
                doc.text(`Rs ${r.balanceCash.toFixed(0)}`, 116, y + 5.5);
                doc.text(`Rs ${r.closingBalance.toFixed(0)}`, 151, y + 5.5);
                doc.setFont('Helvetica', 'bold');
                doc.text(`Rs ${r.carryForwardBalance.toFixed(0)}`, 182, y + 5.5, { align: 'right' });
                doc.setFont('Helvetica', 'normal');
                
                y += 8;
            });
            
            doc.line(14, y, 196, y);
            const pdfName = `Ledger_${activeSalesman?.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
            doc.save(pdfName);
        } catch (e) {
            alert('PDF Generation Failed: ' + e.message);
        }
    };

    return (
        <div style={S.page}>
            {/* Header */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <User size={22} color="#d97706" />
                    <div style={S.titleCol}>
                        <h2 style={S.title}>Salesman Ledger</h2>
                        <span style={S.subtitle}>View running balances and statements</span>
                    </div>
                </div>

                {selectedSalesmanId && ledgerData.length > 0 && (
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

            {/* Filter Toolbar */}
            <div style={S.toolbar}>
                
                {/* Salesman Select */}
                <div style={S.filterGroup}>
                    <label style={S.label}>Select Salesman</label>
                    <select
                        style={{...S.input, minWidth: '200px'}}
                        value={selectedSalesmanId}
                        onChange={(e) => setSelectedSalesmanId(e.target.value)}
                    >
                        <option value="">Choose Salesman...</option>
                        {salesmen.map(s => (
                            <option key={s.id} value={s.id}>{s.name} (#{s.displayId || s.id.slice(-4)})</option>
                        ))}
                    </select>
                </div>

                {/* Filter Type Toggle */}
                <div style={S.filterGroup}>
                    <label style={S.label}>Filter Type</label>
                    <div style={S.toggleWrap}>
                        <button 
                            type="button"
                            onClick={() => setFilterType('date')}
                            style={{
                                ...S.toggleBtn,
                                background: filterType === 'date' ? '#d97706' : '#fff',
                                color: filterType === 'date' ? '#fff' : '#64748b'
                            }}
                        >
                            Date Range
                        </button>
                        <button 
                            type="button"
                            onClick={() => setFilterType('month')}
                            style={{
                                ...S.toggleBtn,
                                background: filterType === 'month' ? '#d97706' : '#fff',
                                color: filterType === 'month' ? '#fff' : '#64748b'
                            }}
                        >
                            Monthly
                        </button>
                    </div>
                </div>

                {/* Date Fields */}
                {filterType === 'date' ? (
                    <>
                        <div style={S.filterGroup}>
                            <label style={S.label}>From</label>
                            <input 
                                type="date"
                                style={S.input}
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>
                        <div style={S.filterGroup}>
                            <label style={S.label}>To</label>
                            <input 
                                type="date"
                                style={S.input}
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <div style={S.filterGroup}>
                        <label style={S.label}>Month</label>
                        <input 
                            type="month"
                            style={S.input}
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {/* Ledger Content */}
            {selectedSalesmanId ? (
                <div style={{ overflowX: 'auto' }}>
                    <table style={S.table}>
                        <thead>
                            <tr style={{ background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                                <th style={S.th}>Date</th>
                                <th style={{...S.th, textAlign: 'right'}}>Opening Cash</th>
                                <th style={{...S.th, textAlign: 'right'}}>Purchase Amount</th>
                                <th style={{...S.th, textAlign: 'right'}}>Balance Cash</th>
                                <th style={{...S.th, textAlign: 'right'}}>Closing Balance</th>
                                <th style={{...S.th, textAlign: 'right'}}>Carry Forward</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ledgerData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={S.emptyRow}>
                                        No ledger entries found for the selected parameters.
                                    </td>
                                </tr>
                            ) : (
                                ledgerData.map((row) => (
                                    <tr key={row.date} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{...S.td, fontWeight: 700, color: '#334155'}}>
                                            {displayDate(row.date)}
                                        </td>
                                        <td style={{...S.td, textAlign: 'right'}}>{formatCurrency(row.openingCash)}</td>
                                        <td style={{...S.td, textAlign: 'right', textColor: '#b91c1c', color: '#dc2626', fontWeight: 700}}>{formatCurrency(row.purchaseAmount)}</td>
                                        <td style={{...S.td, textAlign: 'right'}}>{formatCurrency(row.balanceCash)}</td>
                                        <td style={{...S.td, textAlign: 'right'}}>{formatCurrency(row.closingBalance)}</td>
                                        <td style={{...S.td, textAlign: 'right', fontStyle: 'italic', fontWeight: 900, color: '#b45309'}}>{formatCurrency(row.carryForwardBalance)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={S.emptyRow}>
                    Select a salesman from the filters above to load their ledger statement.
                </div>
            )}
        </div>
    );
};

export default SalesmanLedger;
