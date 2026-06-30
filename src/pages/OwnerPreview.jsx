import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ArrowLeft, Download, Send, Printer, FileText } from 'lucide-react';
import { subscribeToCollection } from '../utils/storage';

const displayDate = (iso) => {
  if (!iso || typeof iso !== 'string') return '---';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const OwnerPreview = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const type = searchParams.get('type'); // 'salesman' or 'vendor'
  const id = searchParams.get('id');
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');

  const [salesmen, setSalesmen] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [cashRecords, setCashRecords] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    const unsubSalesmen = subscribeToCollection('salesmen', setSalesmen);
    const unsubVendors = subscribeToCollection('vendors', setVendors);
    const unsubCash = subscribeToCollection('salesman_daily_cash', setCashRecords);
    const unsubPurchases = subscribeToCollection('salesman_flower_purchases', setPurchases);
    const unsubTransfers = subscribeToCollection('salesman_credit_transfers', setTransfers);

    return () => {
      unsubSalesmen();
      unsubVendors();
      unsubCash();
      unsubPurchases();
      unsubTransfers();
    };
  }, []);

  const entityName = useMemo(() => {
    if (type === 'salesman') {
      return salesmen.find(s => s.id === id)?.name || 'Salesman';
    } else {
      const v = vendors.find(v => v.id === id);
      return v ? `${v.name} (${v.shop_name || 'Vendor'})` : 'Vendor';
    }
  }, [type, id, salesmen, vendors]);

  const mobileNumber = useMemo(() => {
    if (type === 'salesman') {
      return salesmen.find(s => s.id === id)?.contact || '';
    } else {
      return vendors.find(v => v.id === id)?.mobile || '';
    }
  }, [type, id, salesmen, vendors]);

  // ── Compute chronological Statement Rows ──
  const statementData = useMemo(() => {
    if (!id) return { openingBalance: 0, rows: [], closingBalance: 0 };

    let openingBalance = 0;
    const rows = [];

    if (type === 'salesman') {
      // 1. Calculate prior balance
      const priorCash = cashRecords.filter(c => c.salesman_id === id && c.date < fromDate);
      const priorPurchases = purchases.filter(p => p.salesman_id === id && p.date < fromDate);
      const priorTransfersOut = transfers.filter(t => t.from_salesman_id === id && t.date < fromDate);
      const priorTransfersIn = transfers.filter(t => t.to_salesman_id === id && t.date < fromDate);

      const cashIn = priorCash.reduce((sum, c) => sum + (c.amount || 0), 0) + priorTransfersIn.reduce((sum, t) => sum + (t.amount || 0), 0);
      const cashOut = priorPurchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0) + priorTransfersOut.reduce((sum, t) => sum + (t.amount || 0), 0);
      openingBalance = cashIn - cashOut;

      // 2. Fetch current range logs
      const currCash = cashRecords.filter(c => c.salesman_id === id && c.date >= fromDate && c.date <= toDate);
      const currPurchases = purchases.filter(p => p.salesman_id === id && p.date >= fromDate && p.date <= toDate);
      const currTransfersOut = transfers.filter(t => t.from_salesman_id === id && t.date >= fromDate && t.date <= toDate);
      const currTransfersIn = transfers.filter(t => t.to_salesman_id === id && t.date >= fromDate && t.date <= toDate);

      // Create itemized transactions list
      currCash.forEach(c => {
        rows.push({
          date: c.date,
          particulars: `Cash Received from Owner (Ref: ${c.owner_id || 'N/A'})`,
          inAmount: c.amount || 0,
          outAmount: 0
        });
      });

      currPurchases.forEach(p => {
        rows.push({
          date: p.date,
          particulars: `Paid Vendor: ${p.vendor_name} for ${p.flower_type} (${p.quantity}kg @ ₹${p.rate})`,
          inAmount: 0,
          outAmount: p.amount_paid || 0
        });
      });

      currTransfersOut.forEach(t => {
        rows.push({
          date: t.date,
          particulars: `Credit Given to Salesman: ${t.to_salesman_name} (${t.note || 'No Note'})`,
          inAmount: 0,
          outAmount: t.amount || 0
        });
      });

      currTransfersIn.forEach(t => {
        rows.push({
          date: t.date,
          particulars: `Credit Received from Salesman: ${t.from_salesman_name} (${t.note || 'No Note'})`,
          inAmount: t.amount || 0,
          outAmount: 0
        });
      });

    } else {
      // Vendor logic: tracks Owed Balance
      const vendor = vendors.find(v => v.id === id);
      const initialBal = vendor?.initial_balance || 0;

      const priorPurchases = purchases.filter(p => p.vendor_id === id && p.date < fromDate);
      const priorOwed = priorPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const priorPaid = priorPurchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
      openingBalance = initialBal + priorOwed - priorPaid;

      const currPurchases = purchases.filter(p => p.vendor_id === id && p.date >= fromDate && p.date <= toDate);
      currPurchases.forEach(p => {
        rows.push({
          date: p.date,
          particulars: `Purchase: ${p.flower_type} (${p.quantity}kg @ ₹${p.rate})`,
          inAmount: p.total_amount || 0,  // increases owed balance
          outAmount: p.amount_paid || 0   // decreases owed balance
        });
      });
    }

    // Sort rows chronologically
    rows.sort((a, b) => a.date.localeCompare(b.date));

    // Compute running balances
    let running = openingBalance;
    const finalRows = rows.map(r => {
      running = running + r.inAmount - r.outAmount;
      return { ...r, runningBalance: running };
    });

    return {
      openingBalance,
      rows: finalRows,
      closingBalance: running
    };
  }, [type, id, fromDate, toDate, cashRecords, purchases, transfers, vendors]);

  const totals = useMemo(() => {
    const totalIn = statementData.rows.reduce((sum, r) => sum + r.inAmount, 0);
    const totalOut = statementData.rows.reduce((sum, r) => sum + r.outAmount, 0);
    return { totalIn, totalOut };
  }, [statementData.rows]);

  // Download Statement as PDF
  const handleDownloadPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header Style
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`${type === 'salesman' ? 'SALESMAN LEDGER' : 'VENDOR BILL STATEMENT'}`, 14, 20);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Statement For: ${entityName}`, 14, 28);
    doc.text(`Mobile Contact: ${mobileNumber || 'N/A'}`, 14, 34);
    doc.text(`Statement Period: ${displayDate(fromDate)} to ${displayDate(toDate)}`, 14, 40);
    
    // Build table structure
    const tableHeaders = [['Date', 'Particulars', 'Total In (+)', 'Total Out (-)', 'Running Bal']];
    const tableData = [
      [displayDate(fromDate), 'Opening Balance', '---', '---', `INR ${statementData.openingBalance.toFixed(0)}`]
    ];

    statementData.rows.forEach(r => {
      tableData.push([
        displayDate(r.date),
        r.particulars,
        r.inAmount > 0 ? `+₹${r.inAmount.toFixed(0)}` : '---',
        r.outAmount > 0 ? `-₹${r.outAmount.toFixed(0)}` : '---',
        `₹${r.runningBalance.toFixed(0)}`
      ]);
    });

    // Add totals row
    tableData.push([
      '---',
      'TOTAL ACTIVITY',
      `+₹${totals.totalIn.toFixed(0)}`,
      `-₹${totals.totalOut.toFixed(0)}`,
      `CF: ₹${statementData.closingBalance.toFixed(0)}`
    ]);

    doc.autoTable({
      head: tableHeaders,
      body: tableData,
      startY: 46,
      theme: 'grid',
      styles: { fontSize: 8, font: 'Helvetica' },
      headStyles: { fillColor: [126, 34, 206] } // Purple
    });

    doc.save(`Statement_${entityName.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}.pdf`);
  };

  // Download Statement as CSV
  const handleDownloadCSV = () => {
    const headers = ['Date', 'Particulars', 'Total In (₹)', 'Total Out (₹)', 'Running Balance (₹)'];
    const rows = [
      [displayDate(fromDate), 'Opening Balance', 0, 0, statementData.openingBalance]
    ];

    statementData.rows.forEach(r => {
      rows.push([
        displayDate(r.date),
        r.particulars,
        r.inAmount,
        r.outAmount,
        r.runningBalance
      ]);
    });

    // Add totals row
    rows.push([
      '---',
      'TOTALS',
      totals.totalIn,
      totals.totalOut,
      statementData.closingBalance
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Statement_${entityName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp statement share URL
  const handleSendWhatsApp = () => {
    if (!mobileNumber) {
      alert('No mobile contact number linked to this profile.');
      return;
    }
    
    // Build text summary
    let summaryText = `🌹 *Poovanam Billing Statement* 🌹\n`;
    summaryText += `*Statement For:* ${entityName}\n`;
    summaryText += `*Period:* ${displayDate(fromDate)} to ${displayDate(toDate)}\n\n`;
    summaryText += `• *Opening Balance:* ₹${statementData.openingBalance.toFixed(0)}\n`;
    
    if (type === 'salesman') {
      summaryText += `• *Cash Received:* ₹${totals.totalIn.toFixed(0)}\n`;
      summaryText += `• *Payments/Transfers:* ₹${totals.totalOut.toFixed(0)}\n`;
    } else {
      summaryText += `• *Total Purchases:* ₹${totals.totalIn.toFixed(0)}\n`;
      summaryText += `• *Payments Made:* ₹${totals.totalOut.toFixed(0)}\n`;
    }
    
    summaryText += `• *Closing Owed Balance:* ₹${statementData.closingBalance.toFixed(0)}\n\n`;
    summaryText += `_Thank you for your business!_ 🌿`;

    const cleanMobile = mobileNumber.replace(/[^0-9]/g, '');
    const formattedMobile = cleanMobile.startsWith('91') && cleanMobile.length === 12 ? cleanMobile : `91${cleanMobile}`;
    
    const waUrl = `https://wa.me/${formattedMobile}?text=${encodeURIComponent(summaryText)}`;
    window.open(waUrl, '_blank');
  };

  // System Print Command
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 flex flex-col gap-6 print:p-0">
      
      {/* ── Action Header (Hidden in Print) ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <button
          onClick={() => navigate('/app/owner-dashboard')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 transition-all font-bold text-xs"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition-all shadow-md shadow-purple-100"
          >
            <Download size={16} /> Download PDF
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs transition-all shadow-md shadow-slate-200"
          >
            <FileText size={16} /> Download CSV
          </button>
          <button
            onClick={handleSendWhatsApp}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-200"
          >
            <Send size={16} /> WhatsApp Bill
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-extrabold text-xs transition-all"
          >
            <Printer size={16} /> Print Statement
          </button>
        </div>
      </div>

      {/* ── Ledger Bill Document Container (Styled for Print and Preview) ── */}
      <div className="bg-white border border-slate-200 shadow-xl rounded-3xl p-8 print:border-none print:shadow-none print:p-0 flex flex-col gap-8">
        
        {/* Document Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-6">
          <div className="flex flex-col">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">POOVANAM MARKET</h2>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Premium Flower Merchant &bull; Tindivanam
            </span>
          </div>

          <div className="flex flex-col items-end text-right">
            <span className="text-xs bg-purple-50 text-purple-700 font-extrabold px-3.5 py-1.5 rounded-full border border-purple-100 uppercase">
              {type === 'salesman' ? 'Salesman Ledger' : 'Vendor Statement'}
            </span>
            <span className="text-[11px] font-bold text-slate-400 mt-2">
              Generated: {new Date().toLocaleDateString('en-CA')}
            </span>
          </div>
        </div>

        {/* Party Details */}
        <div className="grid grid-cols-2 gap-8 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded-2xl p-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Statement Issued For:</span>
            <span className="text-sm font-black text-slate-800">{entityName}</span>
            <span>Mobile: {mobileNumber || '---'}</span>
          </div>

          <div className="flex flex-col gap-1.5 items-end text-right">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Statement Period Range:</span>
            <span className="text-sm font-black text-slate-800">{displayDate(fromDate)} to {displayDate(toDate)}</span>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden border border-slate-100 rounded-2xl">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Transaction Particulars</th>
                  <th className="p-3.5 text-right">Total In (+)</th>
                  <th className="p-3.5 text-right">Total Out (-)</th>
                  <th className="p-3.5 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {/* Opening balance row */}
                <tr className="bg-slate-50/50">
                  <td className="p-3.5 text-slate-500">{displayDate(fromDate)}</td>
                  <td className="p-3.5 text-slate-800 font-extrabold">Carry Forward / Opening Balance</td>
                  <td className="p-3.5 text-right text-slate-400">---</td>
                  <td className="p-3.5 text-right text-slate-400">---</td>
                  <td className="p-3.5 text-right text-slate-900 font-mono">{formatCurrency(statementData.openingBalance)}</td>
                </tr>

                {statementData.rows.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-10 text-center text-slate-400 italic">
                      No transactions recorded within this timeframe.
                    </td>
                  </tr>
                ) : (
                  statementData.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/20">
                      <td className="p-3.5 text-slate-500">{displayDate(row.date)}</td>
                      <td className="p-3.5 text-slate-800">{row.particulars}</td>
                      <td className="p-3.5 text-right text-emerald-600 font-mono">
                        {row.inAmount > 0 ? `+${formatCurrency(row.inAmount)}` : '---'}
                      </td>
                      <td className="p-3.5 text-right text-red-500 font-mono">
                        {row.outAmount > 0 ? `-${formatCurrency(row.outAmount)}` : '---'}
                      </td>
                      <td className="p-3.5 text-right text-slate-950 font-mono">{formatCurrency(row.runningBalance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Statement Summaries */}
          <div className="flex justify-end gap-6 bg-slate-50 border border-slate-100 rounded-2xl p-5 text-xs font-bold text-slate-600 mt-2">
            <div className="flex flex-col gap-1 items-end">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Inward</span>
              <span className="text-sm font-black text-emerald-600">+{formatCurrency(totals.totalIn)}</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex flex-col gap-1 items-end">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Outward</span>
              <span className="text-sm font-black text-red-500">-{formatCurrency(totals.totalOut)}</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex flex-col gap-1 items-end">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Final Closing Balance</span>
              <span className="text-base font-black text-purple-700">{formatCurrency(statementData.closingBalance)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OwnerPreview;
