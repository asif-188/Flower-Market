import React, { useState, useEffect, useContext } from 'react';
import { Plus, X, Edit2, Trash2, CheckCircle2, User } from 'lucide-react';
import { subscribeToCollection, db, savePayment } from '../utils/storage';
import { doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { LangContext } from '../components/Layout';

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
        fontSize: '22px', fontWeight: 800, color: '#1e293b',
        letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0,
    },
    btnAdd: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 18px', borderRadius: '8px',
        border: '1.5px solid #16a34a', background: '#fff',
        color: '#16a34a', fontSize: '13px', fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    th: {
        padding: '10px 14px', textAlign: 'left',
        fontSize: '11px', fontWeight: 700, color: '#16a34a',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap',
        background: '#fff',
    },
    td: {
        padding: '13px 14px', fontSize: '14px',
        color: '#374151', borderBottom: '1px solid #f3f4f6',
        verticalAlign: 'middle',
    },
};

const Payments = () => {
    const { t } = useContext(LangContext);
    const [payments, setPayments] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [farmers, setFarmers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [paymentType] = useState('buyer');

    const [formData, setFormData] = useState({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: new Date().toISOString().split('T')[0] });
    const [customerSearch, setCustomerSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dateRange, setDateRange] = useState('all'); // 'today', 'yesterday', 'month', 'year', 'prevYear', 'custom', 'all'
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [customerFilterId, setCustomerFilterId] = useState('all');
    const [customerFilterSearch, setCustomerFilterSearch] = useState('');
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [filterSelectedIndex, setFilterSelectedIndex] = useState(-1);
    const [mainTableSelectedIndex, setMainTableSelectedIndex] = useState(-1);
    const mainTableRowRefs = React.useRef([]);

    // Refs for focus management
    const dateRef = React.useRef(null);
    const customerRef = React.useRef(null);
    const amountRef = React.useRef(null);
    const cashLessRef = React.useRef(null);
    const saveRef = React.useRef(null);

    useEffect(() => {
        if (isModalOpen) {
            setTimeout(() => dateRef.current?.focus(), 100);
        }
    }, [isModalOpen]);

    useEffect(() => {
        const u1 = subscribeToCollection('payments', (data) =>
            setPayments(data.sort((a, b) => {
                const dA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                const dB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                return dA - dB;
            })));
        const u2 = subscribeToCollection('buyers', setBuyers);
        const u3 = subscribeToCollection('farmers', setFarmers);
        return () => { u1(); u2(); u3(); };
    }, []);

    const handleOpenModal = () => {
        setFormData({ 
            entityId: '', 
            amount: '', 
            cashLess: '', 
            method: 'Cash', 
            note: '', 
            date: new Date().toISOString().split('T')[0] 
        });
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
            const entityRef = doc(db, paymentType === 'farmer' ? 'farmers' : 'buyers', formData.entityId);
            await savePayment({
                ...formData,
                amount: amountNum,
                cashLess: cashLessNum,
                type: paymentType,
                timestamp: new Date(formData.date).toISOString()
            });
            await updateDoc(entityRef, { balance: increment(-(amountNum + cashLessNum)) });
            
            // Keep modal open and reset to fresh page
            setFormData(prev => ({ 
                ...prev, 
                entityId: '', 
                amount: '', 
                cashLess: '', 
                note: '' 
            }));
            setCustomerSearch('');
            
            // Re-focus customer search for next entry
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
            await deleteDoc(doc(db, 'payments', p.id));
            // Reverse the balance adjustment so the buyer's balance is correct
            const entityRef = doc(db, p.type === 'farmer' ? 'farmers' : 'buyers', p.entityId);
            await updateDoc(entityRef, { balance: increment((p.amount || 0) + (p.cashLess || 0)) });
        } catch {
            alert('❌ Delete failed');
        }
    };

    const handleEditNote = async (p) => {
        const newNote = window.prompt('Edit Note:', p.note || '');
        if (newNote === null) return;
        try { await updateDoc(doc(db, 'payments', p.id), { note: newNote }); }
        catch (err) { alert('❌ Update failed: ' + err.message); }
    };

    const getName = (id, type) => (type === 'farmer' ? farmers : buyers).find(x => x.id === id)?.name || '—';
    const getDisplayId = (id, type) => (type === 'farmer' ? farmers : buyers).find(x => x.id === id)?.displayId || '—';

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

    const filteredBuyers = buyers.filter(b => 
        b.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
        b.displayId?.toString().toLowerCase().includes(customerSearch.toLowerCase())
    );

    const handleKeyDown = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef?.current?.focus();
        }
    };

    const getFilteredPayments = () => {
        let filtered = payments.filter(p => p.type === 'buyer');
        
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (dateRange === 'today') {
            filtered = filtered.filter(p => p.timestamp?.split('T')[0] === todayStr);
        } else if (dateRange === 'yesterday') {
            filtered = filtered.filter(p => p.timestamp?.split('T')[0] === yesterdayStr);
        } else if (dateRange === 'thisMonth') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            filtered = filtered.filter(p => p.timestamp >= startOfMonth);
        } else if (dateRange === 'thisYear') {
            const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
            filtered = filtered.filter(p => p.timestamp >= startOfYear);
        } else if (dateRange === 'prevYear') {
            const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1).toISOString();
            const endOfPrevYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59).toISOString();
            filtered = filtered.filter(p => p.timestamp >= startOfPrevYear && p.timestamp <= endOfPrevYear);
        } else if (dateRange === 'custom' && customRange.start && customRange.end) {
            filtered = filtered.filter(p => {
                const date = p.timestamp?.split('T')[0];
                return date >= customRange.start && date <= customRange.end;
            });
        }
        if (customerFilterId !== 'all') {
            filtered = filtered.filter(p => p.entityId === customerFilterId);
        }

        return filtered;
    };

    const buyerPayments = getFilteredPayments();
    const totalReceived = buyerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return (
        <div style={S.page}>
            {/* ── Header ── */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <span style={{ fontSize: '22px' }}>💰</span>
                    <h2 style={S.title}>{t('cashReceive')}</h2>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        style={S.btnAdd}
                        onClick={handleOpenModal}
                        onMouseEnter={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#16a34a'; }}
                    >
                        <Plus size={14} /> {t('receivePayment')}
                    </button>
                </div>
            </div>

            {/* ── Date Filters ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginRight: '5px' }}>{t('filter')}:</span>
                {[
                    { id: 'all' },
                    { id: 'today' },
                    { id: 'yesterday' },
                    { id: 'thisMonth' },
                    { id: 'thisYear' },
                    { id: 'prevYear' },
                    { id: 'custom' }
                ].map(f => (
                    <button
                        key={f.id}
                        onClick={() => setDateRange(f.id)}
                        style={{
                            padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                            background: dateRange === f.id ? '#16a34a' : '#fff',
                            color: dateRange === f.id ? '#fff' : '#64748b',
                            boxShadow: dateRange === f.id ? '0 2px 8px rgba(22,163,74,0.3)' : '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >{t(f.id)}</button>
                ))}

                {dateRange === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px', animation: 'fadeIn 0.3s ease' }}>
                        <input type="date" value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '12px', outline: 'none' }} />
                        <span style={{ color: '#94a3b8' }}>to</span>
                        <input type="date" value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '12px', outline: 'none' }} />
                    </div>
                )}

                {/* Customer Filter */}
                <div style={{ position: 'relative', minWidth: '180px', marginLeft: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', cursor: 'pointer' }}
                        onClick={() => {
                            setIsFilterDropdownOpen(!isFilterDropdownOpen);
                            setFilterSelectedIndex(-1);
                        }}>
                        <User size={14} style={{ color: '#16a34a' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                            {customerFilterId === 'all' ? t('all') : buyers.find(b => b.id === customerFilterId)?.name || t('all')}
                        </span>
                    </div>
                    {isFilterDropdownOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginTop: '5px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', minWidth: '220px' }}>
                            <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                <input 
                                    type="text" 
                                    placeholder={t('search')} 
                                    value={customerFilterSearch} 
                                    onChange={e => {
                                        setCustomerFilterSearch(e.target.value);
                                        setFilterSelectedIndex(-1);
                                    }}
                                    onKeyDown={(e) => {
                                        const results = buyers.filter(b => b.name.toLowerCase().includes(customerFilterSearch.toLowerCase()) || b.displayId?.toString().includes(customerFilterSearch));
                                        const totalOptions = results.length + 1; // +1 for "All"
                                        
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setFilterSelectedIndex(prev => (prev + 1) % totalOptions);
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setFilterSelectedIndex(prev => (prev - 1 + totalOptions) % totalOptions);
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (filterSelectedIndex === 0) {
                                                setCustomerFilterId('all');
                                                setIsFilterDropdownOpen(false);
                                                setCustomerFilterSearch('');
                                            } else if (filterSelectedIndex > 0) {
                                                const selected = results[filterSelectedIndex - 1];
                                                setCustomerFilterId(selected.id);
                                                setIsFilterDropdownOpen(false);
                                                setCustomerFilterSearch('');
                                            }
                                        }
                                    }}
                                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1.5px solid #f1f5f9', fontSize: '12px', outline: 'none' }} 
                                    autoFocus 
                                />
                            </div>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                <div onClick={() => { setCustomerFilterId('all'); setIsFilterDropdownOpen(false); setCustomerFilterSearch(''); }}
                                    onMouseEnter={() => setFilterSelectedIndex(0)}
                                    style={{ 
                                        padding: '8px 12px', 
                                        fontSize: '13px', 
                                        cursor: 'pointer', 
                                        fontWeight: 700, 
                                        color: filterSelectedIndex === 0 ? '#fff' : (customerFilterId === 'all' ? '#16a34a' : '#475569'), 
                                        background: filterSelectedIndex === 0 ? '#16a34a' : (customerFilterId === 'all' ? '#f0fdf4' : 'transparent') 
                                    }}>
                                    {t('all')}
                                </div>
                                {buyers.filter(b => b.name.toLowerCase().includes(customerFilterSearch.toLowerCase()) || b.displayId?.toString().includes(customerFilterSearch)).map((b, idx) => {
                                    const optionIdx = idx + 1;
                                    const isHighlighted = filterSelectedIndex === optionIdx;
                                    const isSelected = customerFilterId === b.id;
                                    return (
                                        <div key={b.id} onClick={() => { setCustomerFilterId(b.id); setIsFilterDropdownOpen(false); setCustomerFilterSearch(''); }}
                                            onMouseEnter={() => setFilterSelectedIndex(optionIdx)}
                                            style={{ 
                                                padding: '8px 12px', 
                                                fontSize: '13px', 
                                                cursor: 'pointer', 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                fontWeight: 600,
                                                color: isHighlighted ? '#fff' : (isSelected ? '#16a34a' : '#475569'), 
                                                background: isHighlighted ? '#16a34a' : (isSelected ? '#f0fdf4' : 'transparent') 
                                            }}>
                                            <span>{b.name}</span>
                                            <span style={{ 
                                                fontSize: '10px', 
                                                color: isHighlighted ? 'rgba(255,255,255,0.8)' : '#94a3b8' 
                                            }}>#{b.displayId}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '6px 15px', borderRadius: '10px', border: '1.5px solid #16a34a', boxShadow: '0 2px 10px rgba(22,163,74,0.1)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total:</span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', fontFamily: 'var(--font-display)' }}>{fmt(totalReceived)}</span>
                </div>
            </div>

            {/* ── Table ── */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={S.th}>{t('date')}</th>
                            <th style={S.th}>{t('customerName')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('amountReceived')}</th>
                            <th style={S.th}>{t('notes')}</th>
                            <th style={{ ...S.th, textAlign: 'center' }}>{t('action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {buyerPayments.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
                                    {t('noRecords')}
                                </td>
                            </tr>
                        ) : (
                            buyerPayments.map((p, idx) => {
                                const isHighlighted = mainTableSelectedIndex === idx;
                                return (
                                    <tr key={p.id}
                                        ref={el => mainTableRowRefs.current[idx] = el}
                                        tabIndex={0}
                                        onClick={() => setMainTableSelectedIndex(idx)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                const nextIdx = Math.min(idx + 1, buyerPayments.length - 1);
                                                setMainTableSelectedIndex(nextIdx);
                                                mainTableRowRefs.current[nextIdx]?.focus();
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                const prevIdx = Math.max(idx - 1, 0);
                                                setMainTableSelectedIndex(prevIdx);
                                                mainTableRowRefs.current[prevIdx]?.focus();
                                            }
                                        }}
                                        style={{ 
                                            background: isHighlighted ? '#16a34a' : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                                            color: isHighlighted ? '#fff' : '#374151',
                                            cursor: 'pointer',
                                            outline: 'none'
                                        }}
                                        onMouseEnter={e => !isHighlighted && (e.currentTarget.style.background = '#f0fdf4')}
                                        onMouseLeave={e => !isHighlighted && (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}
                                    >
                                        <td style={{ ...S.td, color: isHighlighted ? 'rgba(255,255,255,0.9)' : '#64748b', fontSize: '13px' }}>
                                            {formatDate(p.timestamp)}
                                        </td>
                                        <td style={{ ...S.td, fontWeight: 600 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ 
                                                    background: isHighlighted ? 'rgba(255,255,255,0.2)' : '#f0fdf4', 
                                                    border: '1px solid ' + (isHighlighted ? 'rgba(255,255,255,0.4)' : '#bbf7d0'), 
                                                    color: isHighlighted ? '#fff' : '#15803d', 
                                                    fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' 
                                                }}>
                                                    #{getDisplayId(p.entityId, p.type)}
                                                </span>
                                                {getName(p.entityId, p.type)}
                                            </div>
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : '#16a34a', fontSize: '15px' }}>
                                            {fmt(p.amount)}
                                            <div style={{ fontSize: '10px', fontWeight: 600, color: isHighlighted ? 'rgba(255,255,255,0.7)' : '#9ca3af', textTransform: 'uppercase' }}>{p.method}</div>
                                        </td>
                                        <td style={{ ...S.td, color: isHighlighted ? 'rgba(255,255,255,0.9)' : '#64748b' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{p.note || '—'}</span>
                                                <button onClick={() => handleEditNote(p)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: isHighlighted ? 'rgba(255,255,255,0.6)' : '#cbd5e1', display: 'flex', padding: '2px' }}
                                                    onMouseEnter={e => { if(!isHighlighted) e.currentTarget.style.color = '#16a34a' }}
                                                    onMouseLeave={e => { if(!isHighlighted) e.currentTarget.style.color = '#cbd5e1' }}
                                                ><Edit2 size={12} /></button>
                                            </div>
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'center' }}>
                                            <button onClick={() => handleDelete(p)}
                                                style={{ 
                                                    background: isHighlighted ? 'rgba(255,255,255,0.2)' : '#fff1f2', 
                                                    border: 'none', borderRadius: '8px', width: '32px', height: '32px', 
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', 
                                                    cursor: 'pointer', color: isHighlighted ? '#fff' : '#f43f5e' 
                                                }}
                                                onMouseEnter={e => { if(!isHighlighted) { e.currentTarget.style.background = '#f43f5e'; e.currentTarget.style.color = '#fff'; } }}
                                                onMouseLeave={e => { if(!isHighlighted) { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#f43f5e'; } }}
                                            ><Trash2 size={13} /></button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <style>
                {`
                    @keyframes slideInRight {
                        from { transform: translateX(30px); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}
            </style>

            {/* ── Receive Payment Modal ── */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '95%', maxWidth: '1200px', height: '90vh', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
                        {/* Modal Header — solid green */}
                        <div style={{ background: '#16a34a', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>{t('cashReceive')}</span>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex' }}>
                                <X size={24} strokeWidth={2.5} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            {/* Left Side: Entry Form */}
                            <div style={{ width: '450px', borderRight: '1.5px solid #f1f5f9', padding: '32px', overflowY: 'auto' }}>
                                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Date */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>{t('date')}</label>
                                        <input
                                            ref={dateRef}
                                            type="date"
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                            onKeyDown={(e) => handleKeyDown(e, customerRef)}
                                            required
                                            style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none' }}
                                        />
                                    </div>

                                    {/* Customer Searchable Dropdown */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>{t('customer')}</label>
                                        <div style={{ flex: 1, position: 'relative' }}>
                                            <input
                                                ref={customerRef}
                                                type="text"
                                                placeholder={t('selectCustomer')}
                                                value={formData.entityId ? buyers.find(b => b.id === formData.entityId)?.name || '' : customerSearch}
                                                onChange={e => {
                                                    setCustomerSearch(e.target.value);
                                                    setFormData({ ...formData, entityId: '' });
                                                    setIsDropdownOpen(true);
                                                    setSelectedIndex(-1);
                                                }}
                                                onFocus={() => setIsDropdownOpen(true)}
                                                onKeyDown={(e) => {
                                                    if (isDropdownOpen && filteredBuyers.length > 0) {
                                                        if (e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            setSelectedIndex(prev => (prev + 1) % filteredBuyers.length);
                                                        } else if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            setSelectedIndex(prev => (prev - 1 + filteredBuyers.length) % filteredBuyers.length);
                                                        } else if (e.key === 'Enter') {
                                                            if (selectedIndex >= 0) {
                                                                e.preventDefault();
                                                                const b = filteredBuyers[selectedIndex];
                                                                setFormData({ ...formData, entityId: b.id });
                                                                setCustomerSearch('');
                                                                setIsDropdownOpen(false);
                                                                setSelectedIndex(-1);
                                                                amountRef.current?.focus();
                                                            } else if (formData.entityId) {
                                                                handleKeyDown(e, amountRef);
                                                            }
                                                        }
                                                    } else if (e.key === 'Enter' && formData.entityId) {
                                                        handleKeyDown(e, amountRef);
                                                    }
                                                }}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none' }}
                                            />
                                            {isDropdownOpen && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 110, background: '#fff', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginTop: '4px', maxHeight: '250px', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
                                                    {filteredBuyers.length > 0 ? (
                                                        filteredBuyers.map((b, idx) => (
                                                            <div
                                                                key={b.id}
                                                                onClick={() => {
                                                                    setFormData({ ...formData, entityId: b.id });
                                                                    setCustomerSearch('');
                                                                    setIsDropdownOpen(false);
                                                                    setSelectedIndex(-1);
                                                                    setTimeout(() => amountRef.current?.focus(), 50);
                                                                }}
                                                                style={{ 
                                                                    padding: '12px 14px', 
                                                                    cursor: 'pointer', 
                                                                    fontSize: '14px', 
                                                                    borderBottom: '1px solid #f8fafc', 
                                                                    display: 'flex', 
                                                                    justifyContent: 'space-between', 
                                                                    alignItems: 'center',
                                                                    background: selectedIndex === idx ? '#16a34a' : '#fff',
                                                                    color: selectedIndex === idx ? '#fff' : '#1e293b'
                                                                }}
                                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                            >
                                                                <span style={{ fontWeight: 700 }}>{b.name}</span>
                                                                <span style={{ 
                                                                    fontSize: '11px', 
                                                                    fontWeight: 800,
                                                                    color: selectedIndex === idx ? 'rgba(255,255,255,0.9)' : '#64748b', 
                                                                    background: selectedIndex === idx ? 'rgba(255,255,255,0.2)' : '#f1f5f9', 
                                                                    padding: '3px 8px', 
                                                                    borderRadius: '6px' 
                                                                }}>#{b.displayId}</span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>{t('noRecords')}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Opening Balance */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>{t('openingBalance')}</label>
                                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b', background: '#f8fafc', padding: '8px 16px', borderRadius: '10px', flex: 1, border: '1.5px solid #f1f5f9' }}>
                                            {fmt(openingBalance)}
                                        </div>
                                    </div>

                                    {/* Given Amount */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>{t('givenAmount')}</label>
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <input
                                                ref={amountRef}
                                                type="number"
                                                placeholder="0"
                                                value={formData.amount}
                                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                                onKeyDown={(e) => handleKeyDown(e, cashLessRef)}
                                                required
                                                min="1"
                                                style={{ flex: 1, padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #16a34a', fontSize: '18px', fontWeight: 900, color: '#16a34a', outline: 'none' }}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: formData.method === 'UPI' ? '#16a34a' : '#64748b', whiteSpace: 'nowrap' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.method === 'UPI'}
                                                        onChange={e => setFormData({ ...formData, method: e.target.checked ? 'UPI' : 'Cash' })}
                                                        style={{ accentColor: '#16a34a', width: '18px', height: '18px' }}
                                                    />
                                                    GPAY
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cash Less */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>CASH LESS</label>
                                        <input
                                            ref={cashLessRef}
                                            type="number"
                                            placeholder="0"
                                            value={formData.cashLess}
                                            onChange={e => setFormData({ ...formData, cashLess: e.target.value })}
                                            onKeyDown={(e) => handleKeyDown(e, saveRef)}
                                            style={{ flex: 1, padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #f43f5e', fontSize: '18px', fontWeight: 900, color: '#f43f5e', outline: 'none' }}
                                        />
                                    </div>

                                    {/* Closing Balance */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>{t('closingBalance')}</label>
                                        <div style={{ fontSize: '22px', fontWeight: 950, color: closingBalance < 0 ? '#f43f5e' : '#16a34a', background: closingBalance < 0 ? '#fff1f2' : '#f0fdf4', padding: '12px 16px', borderRadius: '12px', flex: 1, textAlign: 'center', border: '2px solid ' + (closingBalance < 0 ? '#fecdd3' : '#bbf7d0') }}>
                                            {fmt(closingBalance)}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                        <button type="button" onClick={() => setIsModalOpen(false)}
                                            style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                                            {t('close')}
                                        </button>
                                        <button 
                                            ref={saveRef}
                                            type="submit" 
                                            disabled={isSaving}
                                            style={{ flex: 2, padding: '14px', borderRadius: '12px', background: '#16a34a', border: 'none', color: '#fff', fontWeight: 800, fontSize: '16px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                            {isSaving
                                                ? <div style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                                : <CheckCircle2 size={20} />
                                            }
                                            SAVE PAYMENT
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Right Side: Today's Collection List */}
                            <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ padding: '20px 24px', background: '#fff', borderBottom: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Today's Collection List
                                    </h3>
                                    <div style={{ background: '#16a34a', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>
                                        {payments.filter(p => p.type === 'buyer' && p.timestamp?.split('T')[0] === new Date().toISOString().split('T')[0]).length} ENTRIES
                                    </div>
                                </div>
                                
                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {payments
                                            .filter(p => p.type === 'buyer' && p.timestamp?.split('T')[0] === new Date().toISOString().split('T')[0])
                                            .sort((a,b) => b.timestamp.localeCompare(a.timestamp))
                                            .map((p, i) => (
                                                <div key={p.id} style={{ 
                                                    background: '#fff', 
                                                    padding: '14px 18px', 
                                                    borderRadius: '12px', 
                                                    border: '1.5px solid #e2e8f0', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between',
                                                    animation: i === 0 ? 'slideInRight 0.3s ease' : 'none',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', fontSize: '12px', fontWeight: 800 }}>
                                                            {i + 1}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{getName(p.entityId, p.type)}</div>
                                                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>#{getDisplayId(p.entityId, p.type)} • {p.method}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '16px', fontWeight: 900, color: '#16a34a' }}>{fmt(p.amount)}</div>
                                                        {p.cashLess > 0 && <div style={{ fontSize: '11px', fontWeight: 700, color: '#f43f5e' }}>Less: {fmt(p.cashLess)}</div>}
                                                    </div>
                                                </div>
                                            ))
                                        }
                                        {payments.filter(p => p.type === 'buyer' && p.timestamp?.split('T')[0] === new Date().toISOString().split('T')[0]).length === 0 && (
                                            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>
                                                No payments received today yet.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Total for Today in Modal */}
                                <div style={{ padding: '16px 24px', background: '#fff', borderTop: '2.5px solid #16a34a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Today's Total Cash Rec:</span>
                                    <span style={{ fontSize: '24px', fontWeight: 950, color: '#16a34a' }}>
                                        {fmt(payments
                                            .filter(p => p.type === 'buyer' && p.timestamp?.split('T')[0] === new Date().toISOString().split('T')[0])
                                            .reduce((sum, p) => sum + (p.amount || 0), 0)
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payments;
