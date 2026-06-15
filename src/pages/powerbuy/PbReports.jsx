import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Search, MessageCircle, BarChart2, X, ChevronRight, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { subscribeToCollection, db } from '../../utils/storage';
import { useTenant } from '../../utils/TenantContext';
import { LangContext } from '../../components/Layout';
import { generateBuyerReceiptCanvas, generateLedgerCanvas } from '../../utils/receiptCanvas';
import WhatsAppIcon from '../../components/WhatsAppIcon';
import { jsPDF } from 'jspdf';

const PB = {
  primary: '#7c3aed',
  light: '#f5f3ff',
  border: '#c4b5fd',
  badge: '#ede9fe',
  badgeText: '#5b21b6',
  hover: '#6d28d9',
};

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

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
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const PbReports = () => {
  const { t, lang } = useContext(LangContext);
  const { tenantData } = useTenant();
  const today = toDateStr(new Date());

  const [sales, setSales] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [payments, setPayments] = useState([]);

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [appliedFrom, setAppliedFrom] = useState(today);
  const [appliedTo, setAppliedTo] = useState(today);
  const [search, setSearch] = useState('');
  const [activePreset, setActivePreset] = useState('today');
  const [detailBuyer, setDetailBuyer] = useState(null);
  const [showFullLedger, setShowFullLedger] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sharingRowId, setSharingRowId] = useState(null);
  const [downloadingRowId, setDownloadingRowId] = useState(null);
  const [mainTableSelectedIndex, setMainTableSelectedIndex] = useState(-1);
  const mainTableRowRefs = React.useRef([]);

  const bizInfo = tenantData || { motto: 'SRI RAMA JAYAM', name: 'S.V.M', type: 'SRI VALLI FLOWER MERCHANT', address: 'B-7, FLOWER MARKET, TINDIVANAM.', phone1: '9443247771', phone2: '9952535057' };

  useEffect(() => {
    const u1 = subscribeToCollection('pb_sales', setSales);
    const u2 = subscribeToCollection('pb_buyers', setBuyers);
    const u3 = subscribeToCollection('pb_payments', setPayments);
    return () => { u1(); u2(); u3(); };
  }, []);

  const applyPreset = (preset) => {
    if (preset === 'custom') { setActivePreset('custom'); return; }
    const now = new Date();
    let f = toDateStr(now), to = toDateStr(now);
    if (preset === 'month') {
      f = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
      to = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    }
    setFromDate(f); setToDate(to); setAppliedFrom(f); setAppliedTo(to); setActivePreset(preset);
  };

  const handleApply = () => { setAppliedFrom(fromDate); setAppliedTo(toDate); };

  // Helper: extract a YYYY-MM-DD string from a pb_payment document
  const getPaymentDate = (p) => {
    if (p.date && typeof p.date === 'string' && p.date.match(/^\d{4}-\d{2}-\d{2}/)) {
      return p.date.substring(0, 10);
    }
    if (p.timestamp) {
      if (typeof p.timestamp === 'string') return p.timestamp.substring(0, 10);
      if (p.timestamp.toDate) return toDateStr(p.timestamp.toDate());
      return toDateStr(new Date(p.timestamp));
    }
    if (p.createdAt?.toDate) return toDateStr(p.createdAt.toDate());
    return null;
  };

  const report = useMemo(() => {
    const rows = buyers.map(buyer => {
      const futureSales = sales.filter(s => {
        if (s.buyerId !== buyer.id) return false;
        const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
        return dt && dt >= appliedFrom;
      });
      const futurePayments = payments.filter(p => {
        if (p.entityId !== buyer.id) return false;
        const dt = getPaymentDate(p);
        return dt && dt >= appliedFrom;
      });
      const futureSalesAmt = futureSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
      const futurePayAmt = futurePayments.reduce((s, x) => s + (Number(x.amount) || 0) + (Number(x.cashLess) || 0), 0);
      const openingBal = (buyer.balance || 0) - futureSalesAmt + futurePayAmt;

      const periodSales = sales.filter(s => {
        if (s.buyerId !== buyer.id) return false;
        const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
        return dt && dt >= appliedFrom && dt <= appliedTo;
      });
      const periodPayments = payments.filter(p => {
        if (p.entityId !== buyer.id) return false;
        const dt = getPaymentDate(p);
        return dt && dt >= appliedFrom && dt <= appliedTo;
      });
      const salesAmt = periodSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
      const paidAmt = periodPayments.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const lessAmt = periodPayments.reduce((s, x) => s + (Number(x.cashLess) || 0), 0);

      return {
        id: buyer.id,
        name: buyer.name || 'Unknown',
        taName: buyer.taName || buyer.name || 'Unknown',
        displayId: buyer.displayId || '---',
        contact: buyer.contact || '---',
        opening: openingBal,
        sales: salesAmt,
        paid: paidAmt,
        less: lessAmt,
        balance: openingBal + salesAmt - paidAmt - lessAmt
      };
    });
    return rows.filter(r => r.sales > 0 || r.paid > 0 || r.less > 0 || r.opening !== 0 || r.balance !== 0).sort((a, b) => b.sales - a.sales);
  }, [sales, payments, buyers, appliedFrom, appliedTo]);

  const totalOpening = report.reduce((s, r) => s + r.opening, 0);
  const totalSales = report.reduce((s, r) => s + r.sales, 0);
  const totalPaid = report.reduce((s, r) => s + r.paid, 0);
  const totalLess = report.reduce((s, r) => s + r.less, 0);
  const totalDues = report.reduce((s, r) => s + Math.max(0, r.balance), 0);
  const filtered = report.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.displayId.toString().includes(search));

  const detailTransactions = useMemo(() => {
    if (!detailBuyer) return [];
    const res = [];
    sales.filter(s => s.buyerId === detailBuyer.id).forEach(s => {
      const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
      if (d && d >= appliedFrom && d <= appliedTo) res.push({ date: d, type: 'SALE', amount: s.grandTotal || 0 });
    });
    payments.filter(p => p.entityId === detailBuyer.id).forEach(p => {
      const d = getPaymentDate(p);
      if (d && d >= appliedFrom && d <= appliedTo) {
        if (p.amount > 0) res.push({ date: d, type: 'PAID', amount: p.amount || 0 });
        if (p.cashLess > 0) res.push({ date: d, type: 'LESS', amount: p.cashLess || 0 });
      }
    });
    return res.sort((a, b) => b.date.localeCompare(a.date));
  }, [detailBuyer, sales, payments, appliedFrom, appliedTo]);

  // Per-row WhatsApp receipt share
  const handleShareRow = async (row) => {
    setSharingRowId(row.id);
    try {
      const buyerSales = sales.filter(s => {
        if (s.buyerId !== row.id) return false;
        const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
        return d && d >= appliedFrom && d <= appliedTo;
      });
      const flatItems = buyerSales.flatMap(s => (s.items || []).map(item => {
        return { ...item, flowerTypeTa: item.flowerType, flowerType: item.flowerType };
      }));

      const buyerPayments = payments.filter(p => {
        if (p.entityId !== row.id) return false;
        const d = getPaymentDate(p);
        return d && d >= appliedFrom && d <= appliedTo;
      });
      const paymentsTotal = buyerPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const cashLessTotal = buyerPayments.reduce((s, p) => s + (p.cashLess || 0), 0);
      const prevBalance = row.opening;

      const dateLabel = appliedFrom === appliedTo 
        ? displayDate(appliedFrom)
        : `${displayDate(appliedFrom)} - ${displayDate(appliedTo)}`;

      const { blob, url } = await generateBuyerReceiptCanvas({
        buyer: { ...row, name: row.name },
        salesItems: flatItems,
        salesTotal: row.sales,
        paymentsTotal,
        cashLess: cashLessTotal,
        prevBalance,
        dateLabel,
        bizInfo,
        labels: {
          date: t('date'),
          nameLabel: t('name'),
          oldBalance: t('oldBalance'),
          dashName: t('cashRec'),
          cashRec: t('cashRec'),
          cashLess: t('cashLess'),
          balance: t('balance'),
          particulars: t('particulars'),
          weight: t('weight'),
          rate: t('rate'),
          total: t('total'),
          grandTotalLabel: t('finalBalance'),
          sNo: t('sNo'),
          salesLabel: t('sales'),
          totalSalesLabel: t('totalSales'),
        },
        lang: lang
      });

      const buyerContact = (row?.contact || '').replace(/\D/g, '');
      const whatsappNumber = buyerContact.length === 10 ? '91' + buyerContact : buyerContact;

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'receipt.png', { type: 'image/png' })] })) {
        await navigator.share({
          files: [new File([blob], 'receipt.png', { type: 'image/png' })],
          title: `Receipt – ${row.name}`,
        });
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${row.name.replace(/\s+/g,'_')}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);

        if (whatsappNumber) {
          setTimeout(() => {
            window.open(`https://wa.me/${whatsappNumber}`, '_blank');
          }, 500);
        }
      }
    } catch (err) {
      console.error('Receipt share error:', err);
      alert('❌ Could not share receipt: ' + err.message);
    } finally {
      setSharingRowId(null);
    }
  };

  // Download PDF Ledger
  const handleDownloadLedgerPDF = async (buyerRow) => {
    setDownloadingRowId(buyerRow.id);
    const buyer = buyers.find(b => b.id === buyerRow.id) || buyerRow;
    try {
      const futureSales = sales.filter(s => {
        if (s.buyerId !== buyer.id) return false;
        const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
        return dt && dt >= appliedFrom;
      });
      const futurePayments = payments.filter(p => {
        if (p.entityId !== buyer.id) return false;
        const dt = getPaymentDate(p);
        return dt && dt >= appliedFrom;
      });
      const futureSalesAmt = futureSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
      const futurePayAmt = futurePayments.reduce((s, x) => s + (Number(x.amount) || 0) + (Number(x.cashLess) || 0), 0);
      const openingBalance = (buyer.balance || 0) - futureSalesAmt + futurePayAmt;

      const periodSales = sales.filter(s => {
        if (s.buyerId !== buyer.id) return false;
        const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
        return d && d >= appliedFrom && d <= appliedTo;
      });
      const periodPayments = payments.filter(p => {
        if (p.entityId !== buyer.id) return false;
        const d = getPaymentDate(p);
        return d && d >= appliedFrom && d <= appliedTo;
      });

      const items = [];
      const displayDateStr = d => d ? d.split('-').reverse().join('/') : '';

      periodSales.forEach(s => {
        const dateIso = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '');
        (s.items || []).forEach(item => {
          items.push({ dateIso, date: displayDateStr(dateIso), particulars: item.flowerType, weight: parseFloat(item.quantity).toFixed(3), rate: item.price, total: item.total, cashRec: 0, cashLess: 0 });
        });
      });
      periodPayments.forEach(p => {
        const dateIso = getPaymentDate(p) || '';
        if (p.amount > 0) items.push({ dateIso, date: displayDateStr(dateIso), particulars: t('cashRec'), weight: '0.000', rate: 0, total: 0, cashRec: p.amount, cashLess: 0 });
        if (p.cashLess > 0) items.push({ dateIso, date: displayDateStr(dateIso), particulars: t('cashLess'), weight: '0.000', rate: 0, total: 0, cashRec: 0, cashLess: p.cashLess });
      });
      items.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
      
      const finalLedgerRows = items.map(({ dateIso, ...rest }) => rest);

      const summary = {
        sales: periodSales.reduce((s, x) => s + (x.grandTotal || 0), 0),
        paid: periodPayments.reduce((s, x) => s + (x.amount || 0), 0),
        less: periodPayments.reduce((s, x) => s + (x.cashLess || 0), 0)
      };

      const pages = await generateLedgerCanvas({
        buyer: { ...buyer, name: buyer.name },
        ledgerRows: finalLedgerRows,
        summary,
        openingBalance,
        bizInfo,
        startDate: appliedFrom,
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
        },
        lang: lang,
        multiPage: true
      });

      const blobToDataURL = (b) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(b);
        });
      };

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;

      for (let i = 0; i < pages.length; i++) {
        const base64data = await blobToDataURL(pages[i].blob);
        if (i > 0) {
          doc.addPage();
        }
        doc.addImage(base64data, 'PNG', 0, 0, pageWidth, pageHeight);
      }
      
      const fileName = `pb_statement_${buyer.name.replace(/\s+/g, '_')}_${appliedFrom}_to_${appliedTo}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('Ledger PDF Generation Error:', err);
      alert('❌ Failed to download PDF: ' + err.message);
    } finally {
      setDownloadingRowId(null);
    }
  };

  // WhatsApp Share general report info
  const handleWhatsAppShare = () => {
    if (report.length === 0) return;
    const rangeText = appliedFrom === appliedTo ? appliedFrom : `${appliedFrom} to ${appliedTo}`;
    let msg = `*VV CUSTOMER REPORT*\nPeriod: ${rangeText}\n\nOpening Balance: ${fmt(totalOpening)}\nSales: ${fmt(totalSales)}\nPaid: ${fmt(totalPaid)}\nCash Less: ${fmt(totalLess)}\nDues: ${fmt(totalDues)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // WhatsApp share statement/ledger from details modal
  const handleShareLedger = async (buyerRow) => {
    setSharingRowId(buyerRow.id);
    const buyer = buyers.find(b => b.id === buyerRow.id) || buyerRow;
    try {
      const futureSales = sales.filter(s => {
        if (s.buyerId !== buyer.id) return false;
        const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
        return dt && dt >= appliedFrom;
      });
      const futurePayments = payments.filter(p => {
        if (p.entityId !== buyer.id) return false;
        const dt = getPaymentDate(p);
        return dt && dt >= appliedFrom;
      });
      const futureSalesAmt = futureSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
      const futurePayAmt = futurePayments.reduce((s, x) => s + (Number(x.amount) || 0) + (Number(x.cashLess) || 0), 0);
      const openingBalance = (buyer.balance || 0) - futureSalesAmt + futurePayAmt;

      const periodSales = sales.filter(s => {
        if (s.buyerId !== buyer.id) return false;
        const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
        return d && d >= appliedFrom && d <= appliedTo;
      });
      const periodPayments = payments.filter(p => {
        if (p.entityId !== buyer.id) return false;
        const d = getPaymentDate(p);
        return d && d >= appliedFrom && d <= appliedTo;
      });

      const items = [];
      const displayDateStr = d => d ? d.split('-').reverse().join('/') : '';

      periodSales.forEach(s => {
        const dateIso = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '');
        (s.items || []).forEach(item => {
          items.push({ dateIso, date: displayDateStr(dateIso), particulars: item.flowerType, weight: parseFloat(item.quantity).toFixed(3), rate: item.price, total: item.total, cashRec: 0, cashLess: 0 });
        });
      });
      periodPayments.forEach(p => {
        const dateIso = getPaymentDate(p) || '';
        if (p.amount > 0) items.push({ dateIso, date: displayDateStr(dateIso), particulars: t('cashRec'), weight: '0.000', rate: 0, total: 0, cashRec: p.amount, cashLess: 0 });
        if (p.cashLess > 0) items.push({ dateIso, date: displayDateStr(dateIso), particulars: t('cashLess'), weight: '0.000', rate: 0, total: 0, cashRec: 0, cashLess: p.cashLess });
      });
      items.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
      
      const finalLedgerRows = items.map(({ dateIso, ...rest }) => rest);

      const summary = {
        sales: periodSales.reduce((s, x) => s + (x.grandTotal || 0), 0),
        paid: periodPayments.reduce((s, x) => s + (x.amount || 0), 0),
        less: periodPayments.reduce((s, x) => s + (x.cashLess || 0), 0)
      };

      const { blob, url } = await generateLedgerCanvas({
        buyer: { ...buyer, name: buyer.name },
        ledgerRows: finalLedgerRows,
        summary,
        openingBalance,
        bizInfo,
        startDate: appliedFrom,
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
        },
        lang: lang
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

  // Detailed ledger print from details modal
  const handlePrintDetailedReport = () => {
    if (!detailBuyer) return;
    const buyer = buyers.find(b => b.id === detailBuyer.id) || detailBuyer;
    const futureSales = sales.filter(s => { if (s.buyerId !== buyer.id) return false; const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null); return dt && dt >= appliedFrom; });
    const futurePayments = payments.filter(p => { if (p.entityId !== buyer.id) return false; const dt = getPaymentDate(p); return dt && dt >= appliedFrom; });
    const futureSalesAmt = futureSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
    const futurePayAmt = futurePayments.reduce((s, x) => s + (Number(x.amount) || 0) + (Number(x.cashLess) || 0), 0);
    const openingBalance = (buyer.balance || 0) - futureSalesAmt + futurePayAmt;
    const periodSales = sales.filter(s => { if (s.buyerId !== buyer.id) return false; const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null); return d && d >= appliedFrom && d <= appliedTo; });
    const periodPayments = payments.filter(p => { if (p.entityId !== buyer.id) return false; const d = getPaymentDate(p); return d && d >= appliedFrom && d <= appliedTo; });
    
    const ledgerItems = [];
    periodSales.forEach(s => {
      const date = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '');
      (s.items || []).forEach(item => ledgerItems.push({ date, type: 'SALE', desc: item.flowerType, qty: item.quantity, price: item.price, total: item.total, credit: 0 }));
    });
    periodPayments.forEach(p => {
      const date = getPaymentDate(p) || '';
      if (p.amount > 0) ledgerItems.push({ date, type: 'PAY', desc: t('cashRec'), qty: 0, price: 0, total: 0, credit: p.amount });
      if (p.cashLess > 0) ledgerItems.push({ date, type: 'LESS', desc: t('cashLess'), qty: 0, price: 0, total: 0, credit: p.cashLess });
    });
    ledgerItems.sort((a, b) => a.date.localeCompare(b.date));
    
    const totalSalesAmt = periodSales.reduce((s, x) => s + (x.grandTotal || 0), 0);
    const totalReceived = periodPayments.reduce((s, x) => s + (x.amount || 0), 0);
    const totalLessAmt = periodPayments.reduce((s, x) => s + (x.cashLess || 0), 0);
    const closingBalance = openingBalance + totalSalesAmt - totalReceived - totalLessAmt;
    const rangeText = appliedFrom === appliedTo ? displayDate(appliedFrom) : `${displayDate(appliedFrom)} - ${displayDate(appliedTo)}`;
    const printWindow = window.open('', '_blank');
    const content = `<html><head><title>PB Ledger - ${detailBuyer.name}</title>
      <style>@page { size: A4; margin: 0; } body { font-family: serif; line-height: 1.3; margin: 0; padding: 0; width: 100%; }
      .print-wrapper { padding: 15mm; box-sizing: border-box; width: 100%; }
      .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #7c3aed; padding-bottom: 12px; }
      .shop-name { font-size: 42px; font-weight: 900; }
      .pb-badge { display: inline-block; background: #f5f3ff; border: 1.5px solid #c4b5fd; color: #7c3aed; font-size: 18px; font-weight: 800; padding: 5px 16px; border-radius: 8px; margin: 6px 0; }
      .report-title { font-size: 26px; font-weight: 900; margin: 12px 0; color: #7c3aed; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th, td { border: 1.5px solid #000; padding: 10px 12px; font-size: 20px; font-weight: 700; }
      th { background: #f5f3ff; text-transform: uppercase; font-weight: 900; color: #7c3aed; }
      .summary { margin-top: 25px; border: 3px solid #7c3aed; padding: 15px; break-inside: avoid; }
      .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 22px; font-weight: 800; }
      </style></head>
      <body onload="window.print(); window.close();">
      <div class="print-wrapper">
        <div class="header">
          <div class="shop-name">${bizInfo.name || 'S.V.M'}</div>
          <div style="font-size: 22px; font-weight: 800;">${bizInfo.type || ''}</div>
          <div class="pb-badge">⚜️ VV</div>
          <div class="report-title">${t('statementTitle')}</div>
          <div style="text-align: left; font-size: 20px; font-weight: 800; display: flex; justify-content: space-between;">
            <div>${t('customerNo')} : ${detailBuyer.displayId}<br/>${t('name')} : ${detailBuyer.name}</div>
            <div style="text-align: right;">${t('date')} : ${rangeText}</div>
          </div>
        </div>
        <table><thead><tr><th style="width: 130px;">${t('date')}</th><th>${t('particulars')}</th><th style="text-align: center">${t('weight')}</th><th style="text-align: center">${t('rate')}</th><th style="text-align: right">${t('total')}</th><th style="text-align: right">${t('cashRec')}</th><th style="text-align: right">${t('cashLess')}</th></tr></thead>
        <tbody>
          <tr><td align="center"></td><td style="font-weight: 700; color: #78350f;">${t('openingBalance')}</td><td align="center">0.000</td><td align="center">0</td><td align="right" style="font-weight: 700; color: #78350f;">${openingBalance.toFixed(0)}</td><td align="right">0</td><td align="right">0</td></tr>
          ${(() => { let rBal = openingBalance; return ledgerItems.map((item, i, arr) => { rBal = rBal + (item.total || 0) - (item.credit || 0); const showDate = i === 0 || item.date !== arr[i-1].date; return `<tr><td align="center" style="font-weight: 700;">${showDate ? displayDate(item.date) : ''}</td><td>${item.desc}</td><td align="center">${item.type === 'SALE' ? parseFloat(item.qty).toFixed(3) : '0.000'}</td><td align="center">${item.type === 'SALE' ? item.price : '0'}</td><td align="right" style="font-weight: 700; color: ${item.total > 0 ? '#b91c1c' : '#000'}">${item.total > 0 ? item.total.toFixed(0) : '0'}</td><td align="right" style="font-weight: 700; color: #7c3aed">${item.type === 'PAY' ? item.credit.toFixed(0) : '0'}</td><td align="right" style="font-weight: 700; color: #b91c1c">${item.type === 'LESS' ? item.credit.toFixed(0) : '0'}</td></tr>`; }).join(''); })()}
        </tbody></table>
        <div class="summary">
          <div class="summary-row" style="color: #b91c1c"><span>${t('totalSales')} :</span> <span>${(openingBalance + totalSalesAmt).toFixed(2)}</span></div>
          <div class="summary-row" style="color: #7c3aed"><span>${t('cashRec')} :</span> <span>${totalReceived.toFixed(2)}</span></div>
          <div class="summary-row" style="color: #b91c1c"><span>${t('cashLess')} :</span> <span>${totalLessAmt.toFixed(2)}</span></div>
          <div class="summary-row" style="border-top: 2px solid #000; margin-top: 5px; padding-top: 6px; font-weight: 900; font-size: 28px;"><span>${t('finalBalance')} :</span> <span>${closingBalance.toFixed(2)}</span></div>
        </div>
        <div style="text-align: center; margin-top: 30px; font-size: 26px; font-weight: 800;">⚡ ${t('thankYou')} ⚡</div>
      </div></body></html>`;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleDownloadXLSX = async () => {
    if (report.length === 0) return alert('No data to download.');
    setIsDownloading(true);
    try {
      const data = report.map(r => ({ ID: r.displayId, Customer: r.name, 'Opening Balance': r.opening, Sales: r.sales, Paid: r.paid, 'Cash Less': r.less, Balance: r.balance }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PB Report');
      const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `PB_Report_${appliedFrom}_to_${appliedTo}.xlsx`;
      a.click();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setIsDownloading(false); }
  };

  const S = {
    page: { background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', padding: '24px 28px', minHeight: '70vh', fontFamily: 'var(--font-sans)' },
    toolbar: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' },
    th: { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap', background: '#fff' },
    td: { padding: '12px 14px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  };

  const STAT_CARDS = [
    { label: t('openingBalance'), value: totalOpening, accent: '#64748b', textColor: '#1e293b', bg: '#f8fafc' },
    { label: t('sales'), value: totalSales, accent: '#ef4444', textColor: '#b91c1c', bg: '#fef2f2' },
    { label: t('paid'), value: totalPaid, accent: '#10b981', textColor: '#15803d', bg: '#f0fdf4' },
    { label: t('cashLess'), value: totalLess, accent: '#ef4444', textColor: '#b91c1c', bg: '#fef2f2' },
    { label: t('purchase'), value: 0, accent: '#ef4444', textColor: '#b91c1c', bg: '#fef2f2' },
    { label: 'Vendor Paid', value: 0, accent: '#ef4444', textColor: '#b91c1c', bg: '#fef2f2' },
    { label: t('dues'), value: totalDues, accent: '#64748b', textColor: '#1e293b', bg: '#f8fafc' },
  ];

  return (
    <div style={S.page}>
      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
          <span style={{ fontSize: '20px' }}>📊</span>
          <span style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            {t('reports')}
          </span>
        </div>

        <div style={{ padding: '6px 14px', background: PB.light, borderRadius: '100px', border: `1px solid ${PB.border}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: PB.primary }} />
          <span style={{ fontSize: '12px', color: PB.primary, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>
            {appliedFrom === appliedTo ? displayDate(appliedFrom) : `${displayDate(appliedFrom)} — ${displayDate(appliedTo)}`}
          </span>
        </div>

        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: '2px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', marginLeft: '4px' }}>
          {['today', 'month', 'custom'].map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              style={{ padding: '6px 15px', borderRadius: '7px', border: 'none', background: activePreset === p ? '#fff' : 'transparent', color: activePreset === p ? PB.primary : '#64748b', boxShadow: activePreset === p ? '0 2px 6px rgba(0,0,0,0.08)' : 'none', fontSize: '11px', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-sans)', transition: 'all 0.2s' }}>
              {p === 'today' ? t('today') : p === 'month' ? t('month') : t('custom') || 'Custom'}
            </button>
          ))}
        </div>

        {activePreset === 'custom' && (
          <div className="animate-in slide-in-from-left-2 fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px', borderLeft: `1.5px solid ${PB.border}`, marginLeft: '6px' }}>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '5px 8px', borderRadius: '8px', border: `1.5px solid ${PB.border}`, fontSize: '12px', fontWeight: 600, color: '#374151', outline: 'none', fontFamily: 'var(--font-sans)', cursor: 'pointer' }} onFocus={e => e.target.style.borderColor = PB.primary} onBlur={e => e.target.style.borderColor = PB.border} />
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>To</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '5px 8px', borderRadius: '8px', border: `1.5px solid ${PB.border}`, fontSize: '12px', fontWeight: 600, color: '#374151', outline: 'none', fontFamily: 'var(--font-sans)', cursor: 'pointer' }} onFocus={e => e.target.style.borderColor = PB.primary} onBlur={e => e.target.style.borderColor = PB.border} />
            <button onClick={handleApply} style={{ padding: '6px 18px', borderRadius: '8px', background: PB.primary, border: 'none', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-sans)' }}>{t('apply')}</button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* WhatsApp Share */}
        <button onClick={handleWhatsAppShare} title="Share on WhatsApp"
          style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #22c55e', background: '#fff', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#22c55e'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#22c55e'; }}
        >
          <WhatsAppIcon size={16} />
        </button>

        {/* Excel */}
        <button onClick={handleDownloadXLSX} disabled={isDownloading} title="Download Excel"
          style={{ width: '34px', height: '34px', borderRadius: '8px', border: `1.5px solid ${PB.border}`, background: '#fff', color: PB.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = PB.light; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
        >
          {isDownloading
            ? <div style={{ width: '14px', height: '14px', border: '2px solid #e2e8f0', borderTopColor: PB.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            : <BarChart2 size={16} />
          }
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {STAT_CARDS.map(card => (
          <div key={card.label} style={{ flex: '1 1 auto', minWidth: '130px', borderRadius: '10px', border: `1.5px solid ${card.accent}22`, background: card.bg, padding: '12px 16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: card.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{card.label}</div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: card.textColor, wordBreak: 'break-word' }}>{fmt(card.value)}</div>
          </div>
        ))}
      </div>

      {/* Search Row */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '18px' }}>
        <Search size={14} style={{ position: 'absolute', left: '12px', color: '#9ca3af', pointerEvents: 'none' }} />
        <input type="text" placeholder="Search by name or ID..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', color: '#374151', background: '#fff', outline: 'none', fontFamily: 'var(--font-sans)' }}
          onFocus={e => e.target.style.borderColor = PB.primary}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />
      </div>

      {/* Table */}
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
              <tr><td colSpan={7} style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>{t('noRecords')}</td></tr>
            ) : (
              filtered.map((row, idx) => {
                const isHighlighted = mainTableSelectedIndex === idx;
                return (
                  <tr key={row.id}
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
                        setDetailBuyer(row);
                        setShowFullLedger(false);
                      }
                    }}
                    style={{ background: isHighlighted ? PB.primary : (idx % 2 === 0 ? '#fff' : '#fafafa'), color: isHighlighted ? '#fff' : '#374151', cursor: 'pointer', outline: 'none' }}
                    onMouseEnter={e => !isHighlighted && (e.currentTarget.style.background = PB.light)}
                    onMouseLeave={e => !isHighlighted && (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}
                  >
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: isHighlighted ? 'rgba(255,255,255,0.2)' : PB.badge, border: '1px solid ' + (isHighlighted ? 'rgba(255,255,255,0.4)' : PB.border), color: isHighlighted ? '#fff' : PB.badgeText, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' }}>
                          #{row.displayId}
                        </span>
                        <span style={{ fontWeight: 600, color: isHighlighted ? '#fff' : '#1e293b' }}>
                          {lang === 'ta' ? (row.taName || row.name) : row.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : '#1e293b' }}>{fmt(row.opening)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : '#dc2626' }}>{fmt(row.sales)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : '#15803d' }}>{fmt(row.paid)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : '#dc2626' }}>{fmt(row.less)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: isHighlighted ? '#fff' : (row.balance > 0 ? '#dc2626' : '#15803d'), fontSize: '15px' }}>{fmt(row.balance)}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button onClick={() => { setDetailBuyer(row); setShowFullLedger(false); }}
                          style={{ background: isHighlighted ? 'rgba(255,255,255,0.1)' : PB.light, border: '1px solid ' + (isHighlighted ? 'rgba(255,255,255,0.5)' : PB.border), color: isHighlighted ? '#fff' : PB.primary, fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-sans)' }}
                          onMouseEnter={e => { if(!isHighlighted) { e.currentTarget.style.background = PB.primary; e.currentTarget.style.color = '#fff'; }}}
                          onMouseLeave={e => { if(!isHighlighted) { e.currentTarget.style.background = PB.light; e.currentTarget.style.color = PB.primary; }}}
                        >
                          {t('view')} <ChevronRight size={13} />
                        </button>

                        <button onClick={() => handleShareRow(row)} disabled={sharingRowId === row.id} title="Share receipt on WhatsApp"
                          style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid ' + (isHighlighted ? 'rgba(255,255,255,0.5)' : '#22c55e'), background: isHighlighted ? 'rgba(255,255,255,0.1)' : '#fff', color: isHighlighted ? '#fff' : '#22c55e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: sharingRowId === row.id ? 'not-allowed' : 'pointer', opacity: sharingRowId === row.id ? 0.5 : 1, flexShrink: 0 }}
                          onMouseEnter={e => { if (!isHighlighted && sharingRowId !== row.id) { e.currentTarget.style.background='#22c55e'; e.currentTarget.style.color='#fff'; }}}
                          onMouseLeave={e => { if (!isHighlighted) { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#22c55e'; }}}
                        >
                          {sharingRowId === row.id
                            ? <div style={{ width:'14px', height:'14px', border:'2px solid ' + (isHighlighted ? '#fff' : '#22c55e33'), borderTopColor: isHighlighted ? '#fff' : '#22c55e', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
                            : <WhatsAppIcon size={14} />
                          }
                        </button>

                        <button onClick={() => handleDownloadLedgerPDF(row)} disabled={downloadingRowId === row.id} title="Download PDF Ledger"
                          style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid ' + (isHighlighted ? 'rgba(255,255,255,0.5)' : '#3b82f6'), background: isHighlighted ? 'rgba(255,255,255,0.1)' : '#fff', color: isHighlighted ? '#fff' : '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: downloadingRowId === row.id ? 'not-allowed' : 'pointer', opacity: downloadingRowId === row.id ? 0.5 : 1, flexShrink: 0 }}
                          onMouseEnter={e => { if (!isHighlighted && downloadingRowId !== row.id) { e.currentTarget.style.background='#3b82f6'; e.currentTarget.style.color='#fff'; }}}
                          onMouseLeave={e => { if (!isHighlighted) { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#3b82f6'; }}}
                        >
                          {downloadingRowId === row.id
                            ? <div style={{ width:'14px', height:'14px', border:'2px solid ' + (isHighlighted ? '#fff' : '#3b82f633'), borderTopColor: isHighlighted ? '#fff' : '#3b82f6', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
                            : <Download size={14} />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {detailBuyer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: showFullLedger ? '1000px' : '560px', transition: 'all 0.3s ease', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg, ${PB.primary}, ${PB.hover})` }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>{detailBuyer.name}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚡ Customer Ledger • #{detailBuyer.displayId}</div>
              </div>
              <button onClick={() => setDetailBuyer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', opacity: 0.8 }}><X size={20} /></button>
            </div>

            {/* Mini summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px', padding: '16px 24px 0' }}>
              {[
                { l: t('openingBalance'), v: detailBuyer.opening, c: '#64748b', bg: '#f8fafc' },
                { l: t('sales'), v: detailBuyer.sales, c: '#dc2626', bg: '#fef2f2' },
                { l: t('paid'), v: detailBuyer.paid, c: '#15803d', bg: '#f0fdf4' },
                { l: t('cashLess'), v: detailBuyer.less, c: '#dc2626', bg: '#fef2f2' },
                { l: t('balance'), v: detailBuyer.balance, c: PB.primary, bg: PB.light }
              ].map(x => (
                <div key={x.l} style={{ background: x.bg, borderRadius: '10px', padding: '10px 12px', border: `1px solid ${x.c}22` }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: x.c, textTransform: 'uppercase', marginBottom: '3px', whiteSpace: 'nowrap' }}>{x.l}</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{fmt(x.v)}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: '16px 24px', maxHeight: '50vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('transactionHistory')}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => setShowFullLedger(!showFullLedger)}
                    style={{ padding: '5px 12px', borderRadius: '7px', background: PB.light, border: `1px solid ${PB.border}`, color: PB.primary, fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {showFullLedger ? `✖️ ${t('closeView')}` : `👁️ ${t('viewLedger')}`}
                  </button>
                  <button onClick={() => handleShareLedger(detailBuyer)} disabled={sharingRowId === detailBuyer.id}
                    style={{ padding: '5px 12px', borderRadius: '7px', background: '#22c55e', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: sharingRowId === detailBuyer.id ? 0.7 : 1 }}>
                    {sharingRowId === detailBuyer.id
                      ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      : <><MessageCircle size={14} /> WhatsApp</>
                    }
                  </button>
                  <button onClick={() => handleDownloadLedgerPDF(detailBuyer)} disabled={downloadingRowId === detailBuyer.id}
                    style={{ padding: '5px 12px', borderRadius: '7px', background: '#3b82f6', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: downloadingRowId === detailBuyer.id ? 0.7 : 1 }}>
                    {downloadingRowId === detailBuyer.id
                      ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      : <><Download size={14} /> PDF</>
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
                        const d = detailBuyer;
                        const buyerObj = buyers.find(b => b.id === d.id) || d;
                        const futureSales = sales.filter(s => {
                          if (s.buyerId !== d.id) return false;
                          const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
                          return dt && dt >= appliedFrom;
                        });
                        const futurePayments = payments.filter(p => {
                          if (p.entityId !== d.id) return false;
                          const dt = getPaymentDate(p);
                          return dt && dt >= appliedFrom;
                        });
                        const futureSalesAmt = futureSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
                        const futurePayAmt = futurePayments.reduce((s, x) => s + (Number(x.amount) || 0) + (Number(x.cashLess) || 0), 0);
                        let runningBal = (buyerObj.balance || 0) - futureSalesAmt + futurePayAmt;

                        const periodSales = sales.filter(s => s.buyerId === d.id && (s.date || toDateStr(s.timestamp?.toDate ? s.timestamp.toDate() : new Date())) >= appliedFrom && (s.date || toDateStr(s.timestamp?.toDate ? s.timestamp.toDate() : new Date())) <= appliedTo);
                        const periodPayments = payments.filter(p => p.entityId === d.id && (getPaymentDate(p) || '') >= appliedFrom && (getPaymentDate(p) || '') <= appliedTo);

                        const sysItems = [];
                        periodSales.forEach(s => {
                          const date = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '');
                          (s.items || []).forEach(item => {
                            sysItems.push({ dateIso: date, date: displayDate(date), particulars: item.flowerType, weight: parseFloat(item.quantity).toFixed(3), rate: item.price, total: item.total, cashRec: 0, cashLess: 0 });
                          });
                        });
                        periodPayments.forEach(p => {
                          const dateIso = getPaymentDate(p) || '';
                          if (p.amount > 0) sysItems.push({ dateIso, date: displayDate(dateIso), particulars: t('cashRec'), weight: '0.000', rate: 0, total: 0, cashRec: p.amount, cashLess: 0 });
                          if (p.cashLess > 0) sysItems.push({ dateIso, date: displayDate(dateIso), particulars: t('cashLess'), weight: '0.000', rate: 0, total: 0, cashRec: 0, cashLess: p.cashLess });
                        });
                        sysItems.sort((a, b) => a.dateIso.localeCompare(b.dateIso));

                        let tempBal = runningBal;
                        return (
                          <>
                            <tr>
                              <td style={{ padding: '10px', color: '#64748b' }}>{displayDate(appliedFrom)}</td>
                              <td style={{ padding: '10px', fontWeight: 700, color: '#78350f' }}>{t('openingBalance')}</td>
                              <td align="right" style={{ padding: '10px' }}>0.000</td>
                              <td align="right" style={{ padding: '10px' }}>0</td>
                              <td align="right" style={{ padding: '10px', fontWeight: 700, color: '#78350f' }}>{Math.round(runningBal)}</td>
                              <td align="right" style={{ padding: '10px' }}>0</td>
                              <td align="right" style={{ padding: '10px' }}>0</td>
                              <td align="right" style={{ padding: '10px', fontWeight: 700, background: '#fffbeb' }}>{Math.round(runningBal)}</td>
                            </tr>
                            {sysItems.map((item, idx) => {
                              tempBal = tempBal + (item.total || 0) - (item.cashRec || 0) - (item.cashLess || 0);
                              return (
                                <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '10px' }}>{item.date}</td>
                                  <td style={{ padding: '10px' }}>{item.particulars}</td>
                                  <td align="right" style={{ padding: '10px' }}>{item.weight}</td>
                                  <td align="right" style={{ padding: '10px' }}>{item.rate > 0 ? Math.round(item.rate) : '0'}</td>
                                  <td align="right" style={{ padding: '10px', fontWeight: 700, color: item.total > 0 ? '#dc2626' : '#000' }}>{item.total > 0 ? Math.round(item.total) : '0'}</td>
                                  <td align="right" style={{ padding: '10px', fontWeight: 700, color: '#15803d' }}>{item.cashRec > 0 ? Math.round(item.cashRec) : '0'}</td>
                                  <td align="right" style={{ padding: '10px', fontWeight: 700, color: '#dc2626' }}>{item.cashLess > 0 ? Math.round(item.cashLess) : '0'}</td>
                                  <td align="right" style={{ padding: '10px', fontWeight: 800, background: '#fffbeb' }}>{Math.round(tempBal)}</td>
                                </tr>
                              );
                            })}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              ) : (
                detailTransactions.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>{t('noRecords')}</div>
                ) : (
                  detailTransactions.map((tx, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '10px', marginBottom: '6px', background: tx.type === 'SALE' ? '#f8fafc' : (tx.type === 'PAID' ? '#f0fdf4' : '#fff7f2') }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px' }}>{tx.type === 'SALE' ? '🛒' : tx.type === 'PAID' ? '✅' : '➖'}</span>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: tx.type === 'SALE' ? '#3b82f6' : (tx.type === 'PAID' ? '#15803d' : '#f97316'), textTransform: 'uppercase' }}>
                            {tx.type === 'SALE' ? t('sales') : tx.type === 'PAID' ? t('cashRec') : t('cashLess')}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{displayDate(tx.date)}</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: tx.type === 'SALE' ? '#1e293b' : (tx.type === 'PAID' ? '#15803d' : '#f97316') }}>
                        {tx.type === 'PAID' || tx.type === 'LESS' ? '-' : ''}{fmt(tx.amount)}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PbReports;
