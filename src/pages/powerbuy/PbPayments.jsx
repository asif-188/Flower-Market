import React, { useState, useEffect } from 'react';
import { Plus, X, Edit2, Trash2 } from 'lucide-react';
import { subscribeToCollection, savePbPayment, db } from '../../utils/storage';
import { doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';

const PB = {
  primary: '#7c3aed',
  light: '#f5f3ff',
  border: '#c4b5fd',
  badge: '#ede9fe',
  badgeText: '#5b21b6',
};

const S = {
  page: {
    background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb',
    boxShadow: '0 2px 16px rgba(0,0,0,0.06)', padding: '28px 32px',
    minHeight: '70vh', fontFamily: 'var(--font-sans)',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
  titleRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  title: { fontSize: '22px', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0 },
  btnAdd: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px',
    borderRadius: '8px', border: `1.5px solid ${PB.primary}`, background: '#fff',
    color: PB.primary, fontSize: '13px', fontWeight: 700, cursor: 'pointer',
    transition: 'all 0.18s', fontFamily: 'var(--font-sans)',
  },
  th: {
    padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700,
    color: PB.primary, textTransform: 'uppercase', letterSpacing: '0.08em',
    borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap', background: '#fff',
  },
  td: { padding: '13px 14px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
};

const PbPayments = () => {
  const [payments, setPayments] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: new Date().toISOString().split('T')[0] });
  const [customerSearch, setCustomerSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dateRange, setDateRange] = useState('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [customerFilterId, setCustomerFilterId] = useState('all');
  const [customerFilterSearch, setCustomerFilterSearch] = useState('');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filterSelectedIndex, setFilterSelectedIndex] = useState(-1);
  const [mainTableSelectedIndex, setMainTableSelectedIndex] = useState(-1);
  const mainTableRowRefs = React.useRef([]);
  const dateRef = React.useRef(null);
  const customerRef = React.useRef(null);
  const amountRef = React.useRef(null);
  const cashLessRef = React.useRef(null);
  const saveRef = React.useRef(null);

  useEffect(() => {
    if (isModalOpen) { setTimeout(() => dateRef.current?.focus(), 100); }
  }, [isModalOpen]);

  useEffect(() => {
    const u1 = subscribeToCollection('pb_payments', (data) =>
      setPayments(data.sort((a, b) => {
        const dA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const dB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return dA - dB;
      })));
    const u2 = subscribeToCollection('pb_buyers', setBuyers);
    return () => { u1(); u2(); };
  }, []);

  const handleOpenModal = () => {
    setFormData({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: new Date().toISOString().split('T')[0] });
    setCustomerSearch('');
    setIsDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSaving || !formData.entityId || !formData.amount) return;
    setIsSaving(true);
    try {
      const amountNum = parseFloat(formData.amount || 0);
      const cashLessNum = parseFloat(formData.cashLess || 0);
      await savePbPayment({ ...formData, amount: amountNum, cashLess: cashLessNum, timestamp: new Date(formData.date).toISOString() });
      await updateDoc(doc(db, 'pb_buyers', formData.entityId), { balance: increment(-(amountNum + cashLessNum)) });
      setFormData(prev => ({ ...prev, entityId: '', amount: '', cashLess: '', note: '' }));
      setCustomerSearch('');
      setTimeout(() => customerRef.current?.focus(), 100);
    } catch (err) {
      alert('❌ Failed to record payment: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm('Delete this payment record?')) return;
    try {
      await deleteDoc(doc(db, 'pb_payments', p.id));
      await updateDoc(doc(db, 'pb_buyers', p.entityId), { balance: increment((p.amount || 0) + (p.cashLess || 0)) });
    } catch { alert('❌ Delete failed'); }
  };

  const handleEditNote = async (p) => {
    const newNote = window.prompt('Edit Note:', p.note || '');
    if (newNote === null) return;
    try { await updateDoc(doc(db, 'pb_payments', p.id), { note: newNote }); }
    catch (err) { alert('❌ Update failed: ' + err.message); }
  };

  const getName = (id) => buyers.find(x => x.id === id)?.name || '—';
  const getDisplayId = (id) => buyers.find(x => x.id === id)?.displayId || '—';
  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const selectedEntity = buyers.find(e => e.id === formData.entityId);
  const openingBalance = selectedEntity?.balance || 0;
  const closingBalance = openingBalance - (parseFloat(formData.amount) || 0) - (parseFloat(formData.cashLess) || 0);
  const filteredBuyers = buyers.filter(b => b.name.toLowerCase().includes(customerSearch.toLowerCase()) || b.displayId?.toString().includes(customerSearch));
  const handleKeyDown = (e, nextRef) => { if (e.key === 'Enter') { e.preventDefault(); nextRef?.current?.focus(); } };

  const getFilteredPayments = () => {
    let filtered = [...payments];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (dateRange === 'today') filtered = filtered.filter(p => p.timestamp?.split('T')[0] === todayStr);
    else if (dateRange === 'yesterday') filtered = filtered.filter(p => p.timestamp?.split('T')[0] === yesterdayStr);
    else if (dateRange === 'thisMonth') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      filtered = filtered.filter(p => p.timestamp >= startOfMonth);
    } else if (dateRange === 'thisYear') {
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
      filtered = filtered.filter(p => p.timestamp >= startOfYear);
    } else if (dateRange === 'custom' && customRange.start && customRange.end) {
      filtered = filtered.filter(p => { const date = p.timestamp?.split('T')[0]; return date >= customRange.start && date <= customRange.end; });
    }
    if (customerFilterId !== 'all') filtered = filtered.filter(p => p.entityId === customerFilterId);
    return filtered;
  };

  const buyerPayments = getFilteredPayments();
  const totalReceived = buyerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.titleRow}>
          <span style={{ fontSize: '22px' }}>💰</span>
          <h2 style={S.title}>Power Buy — Cash Receive</h2>
        </div>
        <button style={S.btnAdd} onClick={handleOpenModal}
          onMouseEnter={e => { e.currentTarget.style.background = PB.primary; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = PB.primary; }}
        >
          <Plus size={14} /> Receive Payment
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginRight: '5px' }}>Filter:</span>
        {['all', 'today', 'yesterday', 'thisMonth', 'thisYear', 'custom'].map(f => (
          <button key={f} onClick={() => setDateRange(f)}
            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: dateRange === f ? PB.primary : '#fff', color: dateRange === f ? '#fff' : '#64748b', boxShadow: dateRange === f ? `0 2px 8px ${PB.border}` : '0 1px 2px rgba(0,0,0,0.05)' }}
          >{f === 'thisMonth' ? 'This Month' : f === 'thisYear' ? 'This Year' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
        {dateRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px' }}>
            <input type="date" value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })} style={{ padding: '5px 8px', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '12px', outline: 'none' }} />
            <span style={{ color: '#94a3b8' }}>to</span>
            <input type="date" value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })} style={{ padding: '5px 8px', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '12px', outline: 'none' }} />
          </div>
        )}
        {/* Customer Filter */}
        <div style={{ position: 'relative', minWidth: '180px', marginLeft: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', cursor: 'pointer' }}
            onClick={() => { setIsFilterDropdownOpen(!isFilterDropdownOpen); setFilterSelectedIndex(-1); }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              {customerFilterId === 'all' ? 'All Customers' : buyers.find(b => b.id === customerFilterId)?.name || 'All'}
            </span>
          </div>
          {isFilterDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginTop: '5px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', minWidth: '220px' }}>
              <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                <input type="text" placeholder="Search customer..." value={customerFilterSearch} onChange={e => setCustomerFilterSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1.5px solid #f1f5f9', fontSize: '12px', outline: 'none' }} autoFocus />
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <div onClick={() => { setCustomerFilterId('all'); setIsFilterDropdownOpen(false); setCustomerFilterSearch(''); }}
                  style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', fontWeight: 700, color: customerFilterId === 'all' ? PB.primary : '#475569', background: customerFilterId === 'all' ? PB.light : 'transparent' }}>All</div>
                {buyers.filter(b => b.name.toLowerCase().includes(customerFilterSearch.toLowerCase()) || b.displayId?.toString().includes(customerFilterSearch)).map(b => (
                  <div key={b.id} onClick={() => { setCustomerFilterId(b.id); setIsFilterDropdownOpen(false); setCustomerFilterSearch(''); }}
                    style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: customerFilterId === b.id ? PB.primary : '#475569', background: customerFilterId === b.id ? PB.light : 'transparent' }}>
                    <span>{b.name}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>#{b.displayId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '6px 15px', borderRadius: '10px', border: `1.5px solid ${PB.primary}`, boxShadow: `0 2px 10px ${PB.border}` }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: PB.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total:</span>
          <span style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', fontFamily: 'var(--font-display)' }}>{fmt(totalReceived)}</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={S.th}>Date</th>
              <th style={S.th}>Customer Name</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Amount Received</th>
              <th style={S.th}>Notes</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {buyerPayments.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>No Power Buy payments recorded yet.</td></tr>
            ) : (
              buyerPayments.map((p, idx) => {
                const isHighlighted = mainTableSelectedIndex === idx;
                return (
                  <tr key={p.id}
                    ref={el => mainTableRowRefs.current[idx] = el}
                    tabIndex={0}
                    onClick={() => setMainTableSelectedIndex(idx)}
                    style={{ background: isHighlighted ? PB.primary : (idx % 2 === 0 ? '#fff' : '#fafafa'), color: isHighlighted ? '#fff' : '#374151', cursor: 'pointer', outline: 'none' }}
                    onMouseEnter={e => !isHighlighted && (e.currentTarget.style.background = PB.light)}
                    onMouseLeave={e => !isHighlighted && (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}
                  >
                    <td style={{ ...S.td, color: isHighlighted ? 'rgba(255,255,255,0.9)' : '#64748b', fontSize: '13px' }}>{formatDate(p.timestamp)}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: isHighlighted ? 'rgba(255,255,255,0.2)' : PB.badge, border: `1px solid ${isHighlighted ? 'rgba(255,255,255,0.4)' : PB.border}`, color: isHighlighted ? '#fff' : PB.badgeText, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' }}>
                          #{getDisplayId(p.entityId)}
                        </span>
                        {getName(p.entityId)}
                      </div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : PB.primary, fontSize: '15px' }}>
                      {fmt(p.amount)}
                      <div style={{ fontSize: '10px', fontWeight: 600, color: isHighlighted ? 'rgba(255,255,255,0.7)' : '#9ca3af', textTransform: 'uppercase' }}>{p.method}</div>
                    </td>
                    <td style={{ ...S.td, color: isHighlighted ? 'rgba(255,255,255,0.9)' : '#64748b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{p.note || '—'}</span>
                        <button onClick={() => handleEditNote(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isHighlighted ? 'rgba(255,255,255,0.6)' : '#cbd5e1', display: 'flex', padding: '2px' }}
                          onMouseEnter={e => { if (!isHighlighted) e.currentTarget.style.color = PB.primary; }}
                          onMouseLeave={e => { if (!isHighlighted) e.currentTarget.style.color = '#cbd5e1'; }}
                        ><Edit2 size={12} /></button>
                      </div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <button onClick={() => handleDelete(p)}
                        style={{ background: isHighlighted ? 'rgba(255,255,255,0.2)' : '#fff1f2', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isHighlighted ? '#fff' : '#f43f5e' }}
                        onMouseEnter={e => { if (!isHighlighted) { e.currentTarget.style.background = '#f43f5e'; e.currentTarget.style.color = '#fff'; } }}
                        onMouseLeave={e => { if (!isHighlighted) { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#f43f5e'; } }}
                      ><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Receive Payment Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '95%', maxWidth: '520px', maxHeight: '90vh', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: `linear-gradient(135deg, ${PB.primary}, #6d28d9)`, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>⚡ Power Buy — Cash Receive</span>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex' }}><X size={24} strokeWidth={2.5} /></button>
            </div>
            <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ width: '130px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>Date</label>
                  <input ref={dateRef} type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} onKeyDown={e => handleKeyDown(e, customerRef)} required
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none' }} />
                </div>
                {/* Customer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ width: '130px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>Customer</label>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input ref={customerRef} type="text" placeholder="Select PB Customer..."
                      value={formData.entityId ? buyers.find(b => b.id === formData.entityId)?.name || '' : customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setFormData({ ...formData, entityId: '' }); setIsDropdownOpen(true); setSelectedIndex(-1); }}
                      onFocus={() => setIsDropdownOpen(true)}
                      onKeyDown={e => {
                        if (isDropdownOpen && filteredBuyers.length > 0) {
                          if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % filteredBuyers.length); }
                          else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev - 1 + filteredBuyers.length) % filteredBuyers.length); }
                          else if (e.key === 'Enter' && selectedIndex >= 0) {
                            e.preventDefault();
                            const b = filteredBuyers[selectedIndex];
                            setFormData({ ...formData, entityId: b.id });
                            setCustomerSearch(''); setIsDropdownOpen(false); setSelectedIndex(-1);
                            setTimeout(() => amountRef.current?.focus(), 50);
                          }
                        }
                      }}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none' }} />
                    {isDropdownOpen && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 110, background: '#fff', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginTop: '4px', maxHeight: '250px', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
                        {filteredBuyers.length > 0 ? filteredBuyers.map((b, idx) => (
                          <div key={b.id} onClick={() => { setFormData({ ...formData, entityId: b.id }); setCustomerSearch(''); setIsDropdownOpen(false); setSelectedIndex(-1); setTimeout(() => amountRef.current?.focus(), 50); }}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            style={{ padding: '12px 14px', cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: selectedIndex === idx ? PB.primary : '#fff', color: selectedIndex === idx ? '#fff' : '#1e293b', fontWeight: 700 }}>
                            <span>{b.name}</span>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: selectedIndex === idx ? 'rgba(255,255,255,0.9)' : '#64748b', background: selectedIndex === idx ? 'rgba(255,255,255,0.2)' : '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>#{b.displayId}</span>
                          </div>
                        )) : <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No customers found</div>}
                      </div>
                    )}
                  </div>
                </div>
                {/* Opening Balance */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ width: '130px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>Opening Balance</label>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b', background: '#f8fafc', padding: '8px 16px', borderRadius: '10px', flex: 1, border: '1.5px solid #f1f5f9' }}>{fmt(openingBalance)}</div>
                </div>
                {/* Amount */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ width: '130px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>Given Amount</label>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input ref={amountRef} type="number" placeholder="0" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} onKeyDown={e => handleKeyDown(e, cashLessRef)} required min="1"
                      style={{ flex: 1, padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${PB.primary}`, fontSize: '18px', fontWeight: 900, color: PB.primary, outline: 'none' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: formData.method === 'UPI' ? PB.primary : '#64748b', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={formData.method === 'UPI'} onChange={e => setFormData({ ...formData, method: e.target.checked ? 'UPI' : 'Cash' })} style={{ accentColor: PB.primary, width: '18px', height: '18px' }} /> GPAY
                    </label>
                  </div>
                </div>
                {/* Cash Less */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ width: '130px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>Cash Less</label>
                  <input ref={cashLessRef} type="number" placeholder="0" value={formData.cashLess} onChange={e => setFormData({ ...formData, cashLess: e.target.value })} onKeyDown={e => handleKeyDown(e, saveRef)}
                    style={{ flex: 1, padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #f43f5e', fontSize: '18px', fontWeight: 900, color: '#f43f5e', outline: 'none' }} />
                </div>
                {/* Closing Balance */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ width: '130px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>Closing Balance</label>
                  <div style={{ fontSize: '22px', fontWeight: 950, color: closingBalance < 0 ? '#f43f5e' : PB.primary, background: closingBalance < 0 ? '#fff1f2' : PB.light, padding: '12px 16px', borderRadius: '12px', flex: 1, textAlign: 'center', border: `2px solid ${closingBalance < 0 ? '#fecdd3' : PB.border}` }}>
                    {fmt(closingBalance)}
                  </div>
                </div>
                {/* Note */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ width: '130px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>Note</label>
                  <input type="text" placeholder="Short note..." value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', color: '#1e293b', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setIsModalOpen(false)}
                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    Cancel
                  </button>
                  <button ref={saveRef} type="submit" disabled={isSaving || !formData.entityId || !formData.amount}
                    style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${PB.primary}, #6d28d9)`, color: '#fff', fontWeight: 800, fontSize: '15px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: (!formData.entityId || !formData.amount) ? 0.5 : 1, fontFamily: 'var(--font-display)', boxShadow: `0 6px 20px ${PB.border}` }}>
                    {isSaving ? 'Saving...' : '⚡ Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PbPayments;
