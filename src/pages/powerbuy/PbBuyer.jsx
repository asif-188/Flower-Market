import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, X, User, FileText, Upload } from 'lucide-react';
import { savePbBuyer, deletePbBuyer, subscribeToCollection, db } from '../../utils/storage';
import { deleteDoc, doc } from 'firebase/firestore';

// ── Accent palette for Power Buy ──
const PB = {
  primary: '#7c3aed',
  light: '#f5f3ff',
  border: '#c4b5fd',
  badge: '#ede9fe',
  badgeText: '#5b21b6',
  hover: '#6d28d9',
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
    marginBottom: '20px', gap: '16px', flexWrap: 'wrap',
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  title: {
    fontSize: '22px', fontWeight: 800, color: '#1e293b',
    letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0,
  },
  actions: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  btnTemplate: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', borderRadius: '8px',
    border: '1.5px solid #d1d5db', background: '#f9fafb',
    color: '#374151', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'var(--font-sans)',
  },
  btnImport: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', borderRadius: '8px',
    border: '1.5px solid #d1d5db', background: '#f9fafb',
    color: '#374151', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'var(--font-sans)',
  },
  btnAdd: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 18px', borderRadius: '8px',
    border: `1.5px solid ${PB.primary}`, background: '#ffffff',
    color: PB.primary, fontSize: '13px', fontWeight: 700,
    cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'var(--font-sans)',
  },
  searchWrap: { position: 'relative', marginBottom: '24px', maxWidth: '380px' },
  searchInput: {
    width: '100%', padding: '10px 16px 10px 40px',
    border: `1.5px solid ${PB.border}`, borderRadius: '100px',
    background: '#fff', outline: 'none', fontSize: '14px',
    color: '#374151', fontFamily: 'var(--font-sans)', transition: 'border-color 0.2s',
  },
  searchIcon: {
    position: 'absolute', left: '14px', top: '50%',
    transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '10px 14px', textAlign: 'left',
    fontSize: '11px', fontWeight: 700, color: PB.primary,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap', background: '#fff',
  },
  td: {
    padding: '13px 14px', fontSize: '14px',
    color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle',
  },
  idBadge: {
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 10px', borderRadius: '6px',
    background: PB.badge, border: `1px solid ${PB.border}`,
    color: PB.badgeText, fontWeight: 700, fontSize: '12px',
  },
  emptyRow: { padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' },
  viewBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '5px 12px', borderRadius: '8px',
    border: '1px solid #e5e7eb', background: '#fff',
    color: '#6b7280', fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'var(--font-sans)',
  },
  editBtn: {
    width: '32px', height: '32px', borderRadius: '8px',
    border: 'none', background: '#eff6ff', color: '#3b82f6',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.18s',
  },
  deleteBtn: {
    width: '32px', height: '32px', borderRadius: '8px',
    border: 'none', background: '#fff1f2', color: '#f43f5e',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.18s',
  },
};

const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const PbBuyer = () => {
  const [buyers, setBuyers] = useState([]);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [viewingBuyer, setViewingBuyer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentBuyer, setCurrentBuyer] = useState({ id: '', name: '', nameTa: '', contact: '', balance: 0, balanceDate: toDateStr(new Date()) });
  const [isSaving, setIsSaving] = useState(false);
  const [tableSelectedIndex, setTableSelectedIndex] = useState(-1);
  const importRef = useRef(null);
  const rowRefs = useRef([]);

  useEffect(() => {
    const u1 = subscribeToCollection('pb_buyers', setBuyers);
    const u2 = subscribeToCollection('pb_sales', setSales);
    const u3 = subscribeToCollection('pb_payments', setPayments);
    return () => { u1(); u2(); u3(); };
  }, []);

  useEffect(() => {
    if (isModalOpen || viewingBuyer) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [isModalOpen, viewingBuyer]);

  const [isTranslating, setIsTranslating] = useState(false);
  const transTimeout = useRef(null);
  const [touched, setTouched] = useState({ name: false, nameTa: false });

  const translate = async (text, from, to) => {
    if (!text || text.length < 2) return '';
    try {
      const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await resp.json();
      return data[0][0][0];
    } catch { return ''; }
  };

  const handleAutoTranslate = (val, source) => {
    const target = source === 'name' ? 'nameTa' : 'name';
    const fromLang = source === 'name' ? 'en' : 'ta';
    const toLang = source === 'name' ? 'ta' : 'en';
    setCurrentBuyer(prev => ({ ...prev, [source]: val }));
    if (!touched[target] && val.trim().length > 2) {
      if (transTimeout.current) clearTimeout(transTimeout.current);
      transTimeout.current = setTimeout(async () => {
        setIsTranslating(true);
        const translated = await translate(val, fromLang, toLang);
        if (translated && !touched[target]) {
          setCurrentBuyer(prev => ({ ...prev, [target]: translated }));
        }
        setIsTranslating(false);
      }, 800);
    }
  };

  const buyerTransactions = React.useMemo(() => {
    if (!viewingBuyer) return [];
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const startDate = toDateStr(oneMonthAgo);
    const res = [];
    sales.filter(s => s.buyerId === viewingBuyer.id).forEach(s => {
      const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
      if (d && d >= startDate) res.push({ date: d, type: 'SALE', amount: s.grandTotal || 0 });
    });
    payments.filter(p => p.entityId === viewingBuyer.id).forEach(p => {
      const d = p.timestamp
        ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10)
          : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp)))
        : null;
      if (d && d >= startDate) res.push({ date: d, type: 'PAID', amount: p.amount || 0 });
    });
    const balDate = viewingBuyer.balanceDate;
    if (viewingBuyer.balance && balDate && balDate >= startDate) {
      res.push({ date: balDate, type: 'OLD BALANCE', amount: viewingBuyer.balance });
    }
    return res.sort((a, b) => b.date.localeCompare(a.date));
  }, [viewingBuyer, sales, payments]);

  const handleOpenModal = (buyer = null) => {
    setTouched({ name: false, nameTa: false });
    if (!buyer) {
      const nextId = buyers.length > 0 ? Math.max(...buyers.map(b => parseInt(b.displayId) || 0)) + 1 : 101;
      setCurrentBuyer({ id: '', name: '', nameTa: '', contact: '', balance: 0, balanceDate: toDateStr(new Date()), displayId: nextId });
    } else {
      setCurrentBuyer({ ...buyer, balanceDate: buyer.balanceDate || toDateStr(new Date()) });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const buyerToSave = {
        ...currentBuyer,
        balance: parseFloat(currentBuyer.balance) || 0,
        balanceDate: currentBuyer.balance ? (currentBuyer.balanceDate || toDateStr(new Date())) : '',
        nameTa: currentBuyer.nameTa || currentBuyer.name
      };
      if (!buyerToSave.id) delete buyerToSave.id;
      await savePbBuyer(buyerToSave);
      setIsModalOpen(false);
      setCurrentBuyer({ id: '', name: '', nameTa: '', contact: '', balance: 0, balanceDate: toDateStr(new Date()) });
    } catch (err) {
      alert('❌ Failed to save: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this Power Buy customer?')) return;
    try { await deletePbBuyer(id); }
    catch (err) { alert('❌ Delete failed: ' + err.message); }
  };

  const handleDownloadTemplate = () => {
    const csv = [['ID', 'Name', 'Contact', 'Balance'], ['101', 'Sample Customer', '9876543210', '0'], ['102', 'Another Customer', '9123456780', '500']]
      .map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'pb_customer_template.csv';
    a.click();
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const lines = ev.target.result.trim().split('\n');
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      let imported = 0, failed = 0;
      let currentMax = buyers.length > 0 ? Math.max(...buyers.map(b => parseInt(b.displayId) || 0)) : 100;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 2) continue;
        const row = {};
        header.forEach((h, idx) => { row[h] = cols[idx] || ''; });
        try {
          const rowId = parseInt(row.id) || (currentMax + 1);
          if (rowId > currentMax) currentMax = rowId;
          await savePbBuyer({ name: row.name || '', contact: row.contact || '', balance: parseFloat(row.balance) || 0, balanceDate: row.balance ? toDateStr(new Date()) : '', displayId: rowId });
          imported++;
        } catch { failed++; }
      }
      alert(`✅ Import complete: ${imported} added${failed ? `, ${failed} failed` : ''}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredBuyers = buyers.filter(b => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return true;
    return (b.name || '').toLowerCase().includes(s) || (b.contact || '').includes(s) || String(b.displayId || '').includes(s);
  }).sort((a, b) => (parseInt(a.displayId) || 0) - (parseInt(b.displayId) || 0));

  useEffect(() => {
    if (tableSelectedIndex >= 0 && rowRefs.current[tableSelectedIndex]) {
      rowRefs.current[tableSelectedIndex].focus();
    }
  }, [tableSelectedIndex]);

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.titleRow}>
          <span style={{ fontSize: '22px' }}>⚡</span>
          <h2 style={S.title}>Power Buy — Customer Master</h2>
        </div>
        <div style={S.actions}>
          <button style={S.btnTemplate} onClick={handleDownloadTemplate}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = '#f9fafb'}
          >
            <FileText size={14} /> Template
          </button>
          <button style={S.btnImport} onClick={() => importRef.current?.click()}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = '#f9fafb'}
          >
            <Upload size={14} color="#3b82f6" /> Import
            <input type="file" ref={importRef} hidden accept=".csv" onChange={handleImportCSV} />
          </button>
          <button style={S.btnAdd} onClick={() => handleOpenModal()}
            onMouseEnter={e => { e.currentTarget.style.background = PB.primary; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = PB.primary; }}
          >
            <Plus size={14} /> Add Customer
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div style={S.searchWrap}>
        <Search size={15} style={S.searchIcon} />
        <input
          type="text"
          placeholder="Search by ID and Name..."
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setTableSelectedIndex(-1); }}
          style={S.searchInput}
          onFocus={e => e.target.style.borderColor = PB.primary}
          onBlur={e => e.target.style.borderColor = PB.border}
          onKeyDown={e => { if (e.key === 'ArrowDown' && filteredBuyers.length > 0) { e.preventDefault(); setTableSelectedIndex(0); } }}
        />
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>ID</th>
              <th style={S.th}>Name</th>
              <th style={S.th}>Contact</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Amount Due (₹)</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Ledger</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBuyers.length === 0 ? (
              <tr><td colSpan={6} style={S.emptyRow}>No Power Buy customers found.</td></tr>
            ) : (
              filteredBuyers.map((buyer, idx) => {
                const isHighlighted = tableSelectedIndex === idx;
                return (
                  <tr key={buyer.id}
                    ref={el => rowRefs.current[idx] = el}
                    tabIndex={0}
                    onClick={() => setTableSelectedIndex(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setTableSelectedIndex(prev => Math.min(prev + 1, filteredBuyers.length - 1)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setTableSelectedIndex(prev => Math.max(prev - 1, 0)); }
                      else if (e.key === 'Enter') { setViewingBuyer(buyer); }
                    }}
                    style={{
                      background: isHighlighted ? PB.primary : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                      cursor: 'pointer', outline: 'none', transition: 'all 0.1s'
                    }}
                    onMouseEnter={e => !isHighlighted && (e.currentTarget.style.background = PB.light)}
                    onMouseLeave={e => !isHighlighted && (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}
                  >
                    <td style={S.td}>
                      <span style={{ ...S.idBadge, background: isHighlighted ? 'rgba(255,255,255,0.2)' : PB.badge, color: isHighlighted ? '#fff' : PB.badgeText, borderColor: isHighlighted ? 'rgba(255,255,255,0.4)' : PB.border }}>
                        #{buyer.displayId}
                      </span>
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, color: isHighlighted ? '#fff' : '#1e293b' }}>{buyer.name}</td>
                    <td style={{ ...S.td, color: isHighlighted ? 'rgba(255,255,255,0.9)' : '#6b7280' }}>{buyer.contact || '—'}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : (buyer.balance > 0 ? '#f43f5e' : '#16a34a') }}>
                      {fmt(buyer.balance)}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <button style={{ ...S.viewBtn, background: isHighlighted ? 'rgba(255,255,255,0.1)' : '#fff', color: isHighlighted ? '#fff' : '#6b7280', borderColor: isHighlighted ? 'rgba(255,255,255,0.5)' : '#e5e7eb' }}
                        onClick={() => setViewingBuyer(buyer)}
                        onMouseEnter={e => { if (!isHighlighted) { e.currentTarget.style.borderColor = PB.primary; e.currentTarget.style.color = PB.primary; } }}
                        onMouseLeave={e => { if (!isHighlighted) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; } }}
                      >
                        <FileText size={13} /> View
                      </button>
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button style={{ ...S.editBtn, background: isHighlighted ? 'rgba(255,255,255,0.2)' : '#eff6ff', color: isHighlighted ? '#fff' : '#3b82f6' }}
                          onClick={() => handleOpenModal(buyer)}
                          onMouseEnter={e => { if (!isHighlighted) { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; } }}
                          onMouseLeave={e => { if (!isHighlighted) { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#3b82f6'; } }}
                        ><Edit2 size={13} /></button>
                        <button style={{ ...S.deleteBtn, background: isHighlighted ? 'rgba(255,255,255,0.2)' : '#fff1f2', color: isHighlighted ? '#fff' : '#f43f5e' }}
                          onClick={() => handleDelete(buyer.id)}
                          onMouseEnter={e => { if (!isHighlighted) { e.currentTarget.style.background = '#f43f5e'; e.currentTarget.style.color = '#fff'; } }}
                          onMouseLeave={e => { if (!isHighlighted) { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#f43f5e'; } }}
                        ><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add/Edit Modal ── */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '460px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
            <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: PB.light, borderRadius: '10px', padding: '6px' }}>
                  <span style={{ fontSize: '20px' }}>⚡</span>
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-display)' }}>
                  {currentBuyer.id ? 'Edit PB Customer' : 'Add PB Customer'}
                </span>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', flex: 1 }}>
                {[
                  { label: 'ID', key: 'displayId', type: 'text', disabled: true },
                  { label: 'Name (English) *', key: 'name', type: 'text', required: true, autoFocus: true },
                  { label: 'பெயர் (தமிழ்)', key: 'nameTa', type: 'text' },
                  { label: 'WhatsApp Number *', key: 'contact', type: 'tel', required: true, maxLength: 10, pattern: '[0-9]{10}' },
                  { label: 'Opening Balance', key: 'balance', type: 'number' },
                  { label: 'Balance Date', key: 'balanceDate', type: 'date' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{f.label}</label>
                    <input
                      type={f.type}
                      disabled={f.disabled}
                      required={f.required}
                      autoFocus={f.autoFocus}
                      maxLength={f.maxLength}
                      pattern={f.pattern}
                      value={currentBuyer[f.key] ?? ''}
                      onChange={e => {
                        let val = e.target.value;
                        if (f.key === 'contact') {
                          val = val.replace(/\D/g, '').slice(0, 10);
                          setCurrentBuyer({ ...currentBuyer, [f.key]: val });
                        } else if (f.key === 'name' || f.key === 'nameTa') {
                          setTouched(prev => ({ ...prev, [f.key]: true }));
                          handleAutoTranslate(val, f.key);
                        } else {
                          setCurrentBuyer({ ...currentBuyer, [f.key]: val });
                        }
                      }}
                      min={f.type === 'number' ? '0' : undefined}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                        border: '1.5px solid #e2e8f0', background: f.disabled ? '#f8fafc' : '#fff',
                        fontSize: '14px', fontWeight: 600, color: '#1e293b',
                        outline: 'none', fontFamily: 'var(--font-sans)',
                      }}
                      onFocus={e => !f.disabled && (e.target.style.borderColor = PB.primary)}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                ))}
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
                <button type="button" onClick={() => setIsModalOpen(false)}
                  style={{ padding: '9px 20px', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}
                  style={{ padding: '9px 22px', borderRadius: '9px', border: `1.5px solid ${PB.primary}`, background: '#fff', color: PB.primary, fontWeight: 700, fontSize: '13px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1, fontFamily: 'var(--font-sans)' }}>
                  {isSaving ? 'Saving...' : (currentBuyer.id ? 'Update' : 'Register')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Ledger Modal ── */}
      {viewingBuyer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-display)' }}>{viewingBuyer.name}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ⚡ Power Buy • Last 30 Days • #{viewingBuyer.displayId}
                </div>
              </div>
              <button onClick={() => setViewingBuyer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '16px 24px', maxHeight: '55vh', overflowY: 'auto' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Transaction History</div>
              {buyerTransactions.length === 0 ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>No transactions in the last 30 days.</div>
              ) : (
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                  {buyerTransactions.map((tx, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < buyerTransactions.length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '44px', height: '36px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                          {tx.date.split('-').slice(1).reverse().join('/')}
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: tx.type === 'SALE' ? '#3b82f6' : (tx.type === 'OLD BALANCE' ? '#64748b' : PB.primary) }}>
                          {tx.type === 'SALE' ? 'SALE' : (tx.type === 'PAID' ? 'PAID' : 'OLD BALANCE')}
                        </span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: tx.type === 'SALE' ? '#1e293b' : (tx.type === 'OLD BALANCE' ? '#e11d48' : PB.primary) }}>
                        {tx.type === 'PAID' ? '-' : ''}{fmt(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setViewingBuyer(null)}
                style={{ padding: '8px 20px', borderRadius: '9px', background: PB.primary, color: '#fff', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PbBuyer;
