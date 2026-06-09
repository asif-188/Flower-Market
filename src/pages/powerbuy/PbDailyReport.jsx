import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Printer, Search } from 'lucide-react';
import { subscribeToCollection, db, savePbPayment } from '../../utils/storage';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { Check, Edit3, Save } from 'lucide-react';
import { useTenant } from '../../utils/TenantContext';

const PB = {
  primary: '#7c3aed',
  light: '#f5f3ff',
  border: '#c4b5fd',
  badge: '#ede9fe',
  badgeText: '#5b21b6',
};

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

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

const PbDailyReport = () => {
  const { tenantData } = useTenant();
  const [fromDate, setFromDate] = useState(toDateStr(new Date()));
  const [toDate, setToDate] = useState(toDateStr(new Date()));
  const [sales, setSales] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [isEntryMode, setIsEntryMode] = useState(false);
  const [tempAmounts, setTempAmounts] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const u1 = subscribeToCollection('pb_sales', setSales);
    const u2 = subscribeToCollection('pb_buyers', setBuyers);
    const u3 = subscribeToCollection('pb_payments', setPayments);
    return () => { u1(); u2(); u3(); };
  }, []);

  const reportData = useMemo(() => {
    return buyers.map(b => {
      const rangePayments = payments.filter(p => {
        const pDate = getPaymentDate(p);
        return p.entityId === b.id && pDate && pDate >= fromDate && pDate <= toDate;
      });
      const rangeSales = sales.filter(s => {
        const sDate = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '');
        return s.buyerId === b.id && sDate >= fromDate && sDate <= toDate;
      });
      const received = rangePayments.reduce((s, p) => s + (p.amount || 0), 0);
      const less = rangePayments.reduce((s, p) => s + (p.cashLess || 0), 0);
      const salesAmt = rangeSales.reduce((s, x) => s + (x.grandTotal || 0), 0);
      return { id: b.id, displayId: b.displayId || '---', name: b.name, contact: b.contact || '---', balance: b.balance || 0, received, less, sales: salesAmt };
    }).sort((a, b) => (parseInt(a.displayId) || 0) - (parseInt(b.displayId) || 0));
  }, [buyers, sales, payments, fromDate, toDate]);

  const filtered = reportData.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.displayId.toString().includes(search));
  const totals = useMemo(() => {
    const s = reportData.reduce((acc, r) => acc + r.sales, 0);
    const p = reportData.reduce((acc, r) => acc + r.received, 0);
    const l = reportData.reduce((acc, r) => acc + r.less, 0);
    const b = reportData.reduce((acc, r) => acc + r.balance, 0);
    const o = b - s + (p + l);
    return { sales: s, paid: p, less: l, end: b, open: o };
  }, [reportData]);

  const handleSaveCollections = async () => {
    const entries = Object.entries(tempAmounts).filter(([_, data]) => Number(data?.received || 0) > 0 || Number(data?.less || 0) > 0);
    if (entries.length === 0) return setIsEntryMode(false);
    setIsSaving(true);
    try {
      for (const [bid, data] of entries) {
        const rec = Number(data.received || 0);
        const les = Number(data.less || 0);
        await savePbPayment({ entityId: bid, amount: rec, cashLess: les, notes: 'Sync from PB Daily Report', date: fromDate, timestamp: new Date().toISOString() });
        await updateDoc(doc(db, 'pb_buyers', bid), { balance: increment(-(rec + les)) });
      }
      alert('✅ Power Buy collections synced!');
      setTempAmounts({});
      setIsEntryMode(false);
    } catch (e) {
      alert('Failed to sync: ' + e.message);
    } finally { setIsSaving(false); }
  };

  const handlePrint = () => {
    const biz = tenantData || { name: 'S.V.M', type: 'SRI VALLI FLOWER MERCHANT', address: 'B-7, FLOWER MARKET, TINDIVANAM.', phone1: '9443247771', phone2: '9952535057' };
    const printWindow = window.open('', '_blank');
    const content = `<html><head><title>Power Buy Report - ${fromDate} to ${toDate}</title>
      <style>@page { size: auto; margin: 0; } body { font-family: serif; padding: 15mm; line-height: 1.4; margin: 0; font-size: 15pt; }
      .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #000; padding-bottom: 15px; }
      .shop-name { font-size: 32px; font-weight: 900; }
      .pb-badge { display: inline-block; background: #f5f3ff; border: 1.5px solid #c4b5fd; color: #7c3aed; font-size: 16px; font-weight: 800; padding: 4px 14px; border-radius: 8px; margin-top: 6px; }
      .title { font-size: 24px; font-weight: 800; margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th, td { border: 2px solid #000; padding: 10px 12px; font-size: 16px; font-weight: 500; }
      th { background: #f2f2f2; font-weight: 900; text-transform: uppercase; font-size: 14px; }
      .summary-box { margin-top: 40px; border: 4px solid #7c3aed; padding: 20px; }
      .summary-row { display: flex; justify-content: space-between; font-size: 22px; font-weight: 800; padding: 8px 0; }
      .grand { font-size: 32px; border-top: 3px solid #000; margin-top: 15px; padding-top: 15px; background: #f5f3ff; }</style>
    </head>
    <body onload="window.print(); window.close();">
    <div class="header">
      <div class="shop-name">${biz.name}</div>
      <div style="font-size: 16px; font-weight: 700;">${biz.type || ''}</div>
      <div class="pb-badge">⚡ POWER BUY</div>
      <div class="title">POWER BUY REPORT</div>
      <div style="font-size: 16px; font-weight: 700;">Range: ${fromDate.split('-').reverse().join('/')} - ${toDate.split('-').reverse().join('/')}</div>
    </div>
    <table><thead><tr><th align="center">S.No</th><th align="left">Name</th><th align="center">Contact</th><th align="right">Balance</th><th align="right" style="width: 100px;">Cash Rec</th><th align="right" style="width: 100px;">Cash Less</th></tr></thead><tbody>
    ${reportData.filter(r => r.sales > 0 || r.received > 0 || r.balance > 0).map(r => `<tr><td align="center">${r.displayId}</td><td align="left">${r.name}</td><td align="center">${r.contact}</td><td align="right">${r.balance.toFixed(0)}</td><td align="right" style="height: 32px;"></td><td align="right" style="height: 32px;"></td></tr>`).join('')}
    </tbody></table>
    <div class="summary-box">
      <div class="summary-row"><span>Opening Balance :</span> <span>${totals.open.toFixed(2)}</span></div>
      <div class="summary-row" style="color: #7c3aed"><span>Cash Received :</span> <span>${totals.paid.toFixed(2)}</span></div>
      <div class="summary-row" style="color: #b91c1c"><span>Cash Less :</span> <span>${totals.less.toFixed(2)}</span></div>
      <div class="summary-row" style="color: #b91c1c"><span>Today's Sales :</span> <span>${totals.sales.toFixed(2)}</span></div>
      <div class="summary-row grand"><span>Grand Total :</span> <span>${totals.end.toFixed(2)}</span></div>
    </div></body></html>`;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const S = {
    page: { padding: '24px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'var(--font-sans)' },
    card: { background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #e2e8f0' },
    th: { padding: '12px 16px', background: '#f8fafc', color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e2e8f0' },
    td: { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '14px', color: '#1e293b' },
    summaryCard: { background: '#1e293b', borderRadius: '16px', padding: '24px', color: '#fff', marginBottom: '24px', border: '1px solid #334155' },
  };

  const RANGE_INPUT_S = { padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', fontWeight: 700, color: '#1e293b', background: '#fff', outline: 'none' };

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: PB.primary }}>⚡</span>
            <span>Power Buy Daily Report</span>
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>From:</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={RANGE_INPUT_S} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>To:</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={RANGE_INPUT_S} />
            </div>
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
              {[
                { label: 'Today', onClick: () => { const d = toDateStr(new Date()); setFromDate(d); setToDate(d); } },
                { label: 'Weekly', onClick: () => { const d = new Date(); setToDate(toDateStr(d)); d.setDate(d.getDate() - 7); setFromDate(toDateStr(d)); } },
                { label: 'Monthly', onClick: () => { const d = new Date(); setToDate(toDateStr(d)); d.setDate(1); setFromDate(toDateStr(d)); } },
              ].map(btn => (
                <button key={btn.label} onClick={btn.onClick}
                  style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{btn.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {!isEntryMode ? (
            <>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                  style={{ padding: '10px 16px 10px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', width: '200px', fontSize: '14px' }} />
              </div>
              <button onClick={() => setIsEntryMode(true)}
                style={{ padding: '10px 20px', background: PB.primary, color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} /> Batch Entry
              </button>
              <button onClick={handlePrint}
                style={{ padding: '10px 20px', background: '#10b981', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} /> Print
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEntryMode(false)} style={{ padding: '10px 20px', background: '#f1f5f9', color: '#64748b', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveCollections} disabled={isSaving} style={{ padding: '10px 20px', background: '#10b981', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: isSaving ? 0.7 : 1 }}>
                {isSaving ? 'Saving...' : <><Save size={18} /> Save Collections</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={S.summaryCard}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '24px' }}>
          {[
            { label: 'Opening Balance', val: totals.open, color: '#fff' },
            { label: 'Cash Received', val: totals.paid, color: '#a78bfa' },
            { label: 'Cash Less', val: totals.less, color: '#ef4444' },
            { label: "Today's Sales", val: totals.sales, color: '#ef4444' },
            { label: 'PB Balance', val: totals.end, color: '#fff', large: true },
          ].map(item => (
            <div key={item.label}>
              <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{item.label}</div>
              <div style={{ fontSize: item.large ? '28px' : '24px', fontWeight: item.large ? 900 : 800, color: item.color }}>{fmt(item.val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={S.card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...S.th, textAlign: 'center' }}>ID</th>
              <th style={{ ...S.th, textAlign: 'left' }}>Name</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Contact</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Balance</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Cash Rec</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Cash Less</th>
            </tr>
          </thead>
          <tbody>
            {filtered.filter(r => r.sales > 0 || r.received > 0 || r.balance > 0).map((row, i) => (
              <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={{ ...S.td, textAlign: 'center' }}><span style={{ background: PB.badge, border: `1px solid ${PB.border}`, color: PB.badgeText, padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>#{row.displayId}</span></td>
                <td style={S.td}><span style={{ fontWeight: 600 }}>{row.name}</span></td>
                <td style={{ ...S.td, textAlign: 'center' }}>{row.contact}</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{fmt(row.balance)}</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, minWidth: '100px' }}>
                  {isEntryMode ? (
                    <input type="number" placeholder="0" value={tempAmounts[row.id]?.received || ''}
                      onChange={e => setTempAmounts(prev => ({ ...prev, [row.id]: { ...prev[row.id], received: e.target.value } }))}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: `2px solid ${PB.primary}`, textAlign: 'right', fontWeight: 800, color: PB.primary, fontSize: '14px', outline: 'none' }} />
                  ) : <div style={{ color: '#10b981' }}>{row.received > 0 ? fmt(row.received) : '—'}</div>}
                </td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, minWidth: '100px' }}>
                  {isEntryMode ? (
                    <input type="number" placeholder="0" value={tempAmounts[row.id]?.less || ''}
                      onChange={e => setTempAmounts(prev => ({ ...prev, [row.id]: { ...prev[row.id], less: e.target.value } }))}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '2px solid #f97316', textAlign: 'right', fontWeight: 800, color: '#f97316', fontSize: '14px', outline: 'none' }} />
                  ) : <div style={{ color: '#ef4444' }}>{row.less > 0 ? fmt(row.less) : '—'}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PbDailyReport;
