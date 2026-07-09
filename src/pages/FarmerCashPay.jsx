import React, { useState, useEffect, useRef, useContext } from 'react';
import { Plus, X, Edit2, Trash2, CheckCircle2, User, Calendar, History, Clock } from 'lucide-react';
import { subscribeToCollection, db, addData, COLLECTIONS } from '../utils/storage';
import { doc, updateDoc, increment, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';

/* ── Keyboard-navigable Searchable Dropdown ── */
const SearchSelect = ({ items, value, onChange, onKeyDown, inputRef, placeholder, lang }) => {
    const [queryVal, setQueryVal]   = useState('');
    const [open, setOpen]           = useState(false);
    const [cursor, setCursor]       = useState(0);
    const listRef                   = useRef(null);

    const selectedItem = items.find(i => i.id === value || i.name === value);
    const selectedName = selectedItem ? (lang === 'ta' ? (selectedItem.taName || selectedItem.name) : selectedItem.name) : '';

    const filtered = queryVal.trim()
        ? items.filter(i => {
            const n = i.name?.toLowerCase() || '';
            const tn = i.taName?.toLowerCase() || '';
            const q = queryVal.toLowerCase();
            return n.includes(q) || tn.includes(q) || (i.displayId && String(i.displayId).includes(queryVal));
        })
        : items;

    const choose = (item) => {
        onChange(item);
        if (item) {
            setQueryVal(lang === 'ta' ? (item.taName || item.name) : item.name);
        } else {
            setQueryVal('');
        }
        setOpen(false);
    };

    const handleKey = (e) => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
            onChange(null);
            setQueryVal('');
            setOpen(true);
        }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && filtered[cursor]) {
                choose(filtered[cursor]);
                if (onKeyDown) onKeyDown(e);
            }
            else if (onKeyDown) onKeyDown(e);
        }
        else if (e.key === 'Escape') setOpen(false);
        else if (e.key === 'Tab') {
            if (open && filtered[cursor]) choose(filtered[cursor]);
            setOpen(false);
            if (onKeyDown) onKeyDown(e);
        }
    };

    useEffect(() => {
        if (listRef.current) {
            const els = listRef.current.querySelectorAll('li');
            els[cursor]?.scrollIntoView({ block: 'nearest' });
        }
    }, [cursor]);

    return (
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={open ? queryVal : selectedName}
                onFocus={() => { setQueryVal(''); setOpen(true); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 200)}
                onChange={e => { 
                    const val = e.target.value;
                    setQueryVal(val); 
                    setCursor(0); 
                    if (val === '') {
                        onChange(null);
                    }
                }}
                onKeyDown={handleKey}
                autoComplete="off"
                style={INPUT_S}
            />
            {open && filtered.length > 0 && (
                <ul ref={listRef} style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)', maxHeight: '200px',
                    overflowY: 'auto', listStyle: 'none', margin: '4px 0', padding: '4px',
                }}>
                    {filtered.map((item, i) => (
                        <li key={item.id || item.name} onMouseDown={() => choose(item)}
                            style={{
                                padding: '8px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px',
                                fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                                background: i === cursor ? '#fff7ed' : 'transparent',
                                color: i === cursor ? '#ea580c' : '#374151',
                            }}
                            onMouseEnter={() => setCursor(i)}
                        >
                            {item.displayId && <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>#{item.displayId}</span>}
                            {lang === 'ta' ? (item.taName || item.name) : item.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

/* ── Shared style tokens ── */
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
    btnAdd: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 18px', borderRadius: '8px',
        border: '1.5px solid #ea580c', background: '#fff',
        color: '#ea580c', fontSize: '13px', fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    th: {
        padding: '10px 14px', textAlign: 'left',
        fontSize: '11px', fontWeight: 700, color: '#ea580c',
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

const FarmerCashPay = () => {
    const { isEditDeleteAllowed } = useTenant();
    const { t, lang } = useContext(LangContext);
    const [payments, setPayments] = useState([]);
    const [farmers, setFarmers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toasts, setToasts] = useState([]);

    const [formData, setFormData] = useState({ entityId: '', amount: '', notes: '', date: new Date().toISOString().split('T')[0] });
    const [dateRange, setDateRange] = useState('today'); // 'all', 'today', 'yesterday', 'thisMonth', 'thisYear', 'prevYear', 'custom'
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    
    const [farmerFilterId, setFarmerFilterId] = useState('all');
    const [farmerFilterSearch, setFarmerFilterSearch] = useState('');
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

    const [mainTableSelectedIndex, setMainTableSelectedIndex] = useState(-1);
    const mainTableRowRefs = React.useRef([]);

    // Open balance calculation in modal
    const [modalPurchases, setModalPurchases] = useState([]);
    const [modalPayments, setModalPayments] = useState([]);

    // Refs
    const dateRef = React.useRef(null);
    const farmerRef = React.useRef(null);
    const amountRef = React.useRef(null);
    const notesRef = React.useRef(null);
    const saveRef = React.useRef(null);

    const toDateStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };

    useEffect(() => {
        if (isModalOpen) {
            setTimeout(() => dateRef.current?.focus(), 100);
        }
    }, [isModalOpen]);

    // Subscriptions
    useEffect(() => {
        const u1 = subscribeToCollection(COLLECTIONS.F_PAYMENTS, (data) =>
            setPayments(data.sort((a, b) => {
                const dA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                const dB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                return dA - dB;
            })), true);
        const u2 = subscribeToCollection(COLLECTIONS.F_FARMERS, setFarmers);
        return () => { u1(); u2(); };
    }, []);

    useEffect(() => {
        if (!isModalOpen || !formData.date) {
            setModalPurchases([]);
            setModalPayments([]);
            return;
        }
        const u1 = subscribeToCollection(COLLECTIONS.F_PURCHASES, setModalPurchases, true);
        const u2 = subscribeToCollection(COLLECTIONS.F_PAYMENTS, setModalPayments, true);
        return () => { u1(); u2(); };
    }, [isModalOpen, formData.date]);

    const addToast = (message, type = 'success') => {
        const id = Date.now() + Math.random().toString();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const handleOpenModal = () => {
        setFormData({ 
            entityId: '', 
            amount: '', 
            notes: '', 
            date: new Date().toISOString().split('T')[0] 
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (isSaving || !formData.entityId || !formData.amount) return;
        setIsSaving(true);
        try {
            const amountNum = parseFloat(formData.amount || 0);
            const farmerObj = farmers.find(f => f.id === formData.entityId);

            // 1. Save payment document
            const paymentDoc = {
                farmerId: formData.entityId,
                farmerName: farmerObj?.name || 'Unknown',
                amount: amountNum,
                notes: formData.notes,
                date: formData.date,
                timestamp: new Date(formData.date).toISOString()
            };
            const savedDocRef = await addData(COLLECTIONS.F_PAYMENTS, paymentDoc);

            // 2. Save Ledger Record (Debit transaction: reduces dues)
            const ledgerDoc = {
                farmerId: formData.entityId,
                date: formData.date,
                type: 'payment',
                refId: savedDocRef.id,
                description: `Cash Payment ${formData.notes ? `(${formData.notes})` : ''}`,
                debit: amountNum,
                credit: 0,
                commission: 0,
                balance: (farmerObj?.balance || 0) - amountNum
            };
            await addData(COLLECTIONS.F_LEDGERS, ledgerDoc);

            // 3. Update Farmer's Running Balance
            await updateDoc(doc(db, COLLECTIONS.F_FARMERS, formData.entityId), {
                balance: increment(-amountNum)
            });

            addToast('Payment recorded successfully!');
            setFormData(prev => ({ 
                ...prev, 
                entityId: '', 
                amount: '', 
                notes: '' 
            }));
        } catch (err) {
            addToast('Failed to save payment: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (p) => {
        if (!window.confirm('Delete this payment record?')) return;
        try {
            // Delete payment
            await deleteDoc(doc(db, COLLECTIONS.F_PAYMENTS, p.id));
            
            // Delete matching ledger entry
            const q = query(
                collection(db, COLLECTIONS.F_LEDGERS),
                where('refId', '==', p.id)
            );
            const snap = await getDocs(q);
            for (const docRef of snap.docs) {
                await deleteDoc(docRef.ref);
            }
            
            // Reverse balance
            await updateDoc(doc(db, COLLECTIONS.F_FARMERS, p.farmerId), {
                balance: increment(p.amount)
            });
            addToast('Payment record deleted!');
        } catch (err) {
            addToast('Delete failed: ' + err.message, 'error');
        }
    };

    const handleEditNote = async (p) => {
        const newNote = window.prompt('Edit Note:', p.notes || '');
        if (newNote === null) return;
        try {
            await updateDoc(doc(db, COLLECTIONS.F_PAYMENTS, p.id), { notes: newNote });
            addToast('Note updated!');
        } catch (err) {
            addToast('Update failed: ' + err.message, 'error');
        }
    };

    const selectedEntity = farmers.find(e => e.id === formData.entityId);

    const openingBalance = React.useMemo(() => {
        if (!selectedEntity) return 0;
        const currentBalance = selectedEntity.balance || 0;
        
        // Filter purchases after formData.date
        const purchasesAfter = modalPurchases.filter(s => {
            if (s.farmerId !== selectedEntity.id) return false;
            const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
            return dt && dt > formData.date;
        });
        
        // Filter payments after formData.date
        const paymentsAfter = modalPayments.filter(p => {
            if (p.farmerId !== selectedEntity.id) return false;
            const dt = p.date || (p.timestamp?.toDate ? toDateStr(p.timestamp.toDate()) : null);
            return dt && dt > formData.date;
        });
        
        const totalPurchasesAmt = purchasesAfter.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
        const totalPaymentsAmt = paymentsAfter.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        
        return currentBalance - totalPurchasesAmt + totalPaymentsAmt;
    }, [selectedEntity, modalPurchases, modalPayments, formData.date]);

    const closingBalance = openingBalance - (parseFloat(formData.amount) || 0);

    const handleKeyDown = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef?.current?.focus();
        }
    };

    const getFilteredPayments = () => {
        let filtered = payments;
        
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (dateRange === 'today') {
            filtered = filtered.filter(p => p.date === todayStr);
        } else if (dateRange === 'yesterday') {
            filtered = filtered.filter(p => p.date === yesterdayStr);
        } else if (dateRange === 'thisMonth') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            filtered = filtered.filter(p => p.date >= startOfMonth);
        } else if (dateRange === 'thisYear') {
            const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
            filtered = filtered.filter(p => p.date >= startOfYear);
        } else if (dateRange === 'prevYear') {
            const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
            const endOfPrevYear = new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
            filtered = filtered.filter(p => p.date >= startOfPrevYear && p.date <= endOfPrevYear);
        } else if (dateRange === 'custom' && customRange.start && customRange.end) {
            filtered = filtered.filter(p => p.date >= customRange.start && p.date <= customRange.end);
        }
        if (farmerFilterId !== 'all') {
            filtered = filtered.filter(p => p.farmerId === farmerFilterId);
        }

        return filtered;
    };

    const farmerPayments = getFilteredPayments();
    const totalPaid = farmerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return dateStr.split('-').reverse().join('/');
    };

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

            {/* ── Header ── */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <span style={{ fontSize: '22px' }}>💵</span>
                    <h2 style={S.title}>{t('farmerCashPay')}</h2>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        style={S.btnAdd}
                        onClick={handleOpenModal}
                        onMouseEnter={e => { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#ea580c'; }}
                    >
                        <Plus size={14} /> Record Payment
                    </button>
                </div>
            </div>

            {/* ── Date Filters ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: '#fff7ed', padding: '12px', borderRadius: '12px', border: '1px solid #fed7aa' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', marginRight: '5px' }}>{t('filter')}:</span>
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
                            background: dateRange === f.id ? '#ea580c' : '#fff',
                            color: dateRange === f.id ? '#fff' : '#c2410c',
                            boxShadow: dateRange === f.id ? '0 2px 8px rgba(234,88,12,0.3)' : '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >{t(f.id)}</button>
                ))}

                {dateRange === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px' }}>
                        <input type="date" value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1.5px solid #fed7aa', fontSize: '12px', outline: 'none' }} />
                        <span style={{ color: '#ea580c' }}>to</span>
                        <input type="date" value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1.5px solid #fed7aa', fontSize: '12px', outline: 'none' }} />
                    </div>
                )}

                {/* Farmer Filter */}
                <div style={{ position: 'relative', minWidth: '180px', marginLeft: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #fed7aa', cursor: 'pointer' }}
                        onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}>
                        <User size={14} style={{ color: '#ea580c' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#c2410c' }}>
                            {farmerFilterId === 'all' ? t('all') : farmers.find(b => b.id === farmerFilterId)?.name || t('all')}
                        </span>
                    </div>
                    {isFilterDropdownOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginTop: '5px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', minWidth: '220px' }}>
                            <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                <input 
                                    type="text" 
                                    placeholder={t('search')} 
                                    value={farmerFilterSearch} 
                                    onChange={e => setFarmerFilterSearch(e.target.value)}
                                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1.5px solid #f1f5f9', fontSize: '12px', outline: 'none' }} 
                                    autoFocus 
                                />
                            </div>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                <div onClick={() => { setFarmerFilterId('all'); setIsFilterDropdownOpen(false); setFarmerFilterSearch(''); }}
                                    style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', fontWeight: 700, color: farmerFilterId === 'all' ? '#ea580c' : '#475569', background: farmerFilterId === 'all' ? '#fff7ed' : 'transparent' }}>
                                    {t('all')}
                                </div>
                                {farmers.filter(b => b.name.toLowerCase().includes(farmerFilterSearch.toLowerCase()) || b.displayId?.toString().includes(farmerFilterSearch)).map(b => (
                                    <div key={b.id} onClick={() => { setFarmerFilterId(b.id); setIsFilterDropdownOpen(false); setFarmerFilterSearch(''); }}
                                        style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: farmerFilterId === b.id ? '#ea580c' : '#475569', background: farmerFilterId === b.id ? '#fff7ed' : 'transparent' }}>
                                        <span>{b.name}</span>
                                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>#{b.displayId}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '6px 15px', borderRadius: '10px', border: '1.5px solid #ea580c', boxShadow: '0 2px 10px rgba(234,88,12,0.1)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total:</span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', fontFamily: 'var(--font-display)' }}>{fmt(totalPaid)}</span>
                </div>
            </div>

            {/* ── Table ── */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={S.th}>{t('date')}</th>
                            <th style={S.th}>Farmer Name</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>Amount Paid</th>
                            <th style={S.th}>{t('notes')}</th>
                            <th style={{ ...S.th, textAlign: 'center' }}>{t('action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {farmerPayments.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
                                    {t('noRecords')}
                                </td>
                            </tr>
                        ) : (
                            farmerPayments.map((p, idx) => {
                                const farmer = farmers.find(x => x.id === p.farmerId);
                                const isHighlighted = mainTableSelectedIndex === idx;
                                return (
                                    <tr key={p.id}
                                        ref={el => mainTableRowRefs.current[idx] = el}
                                        tabIndex={0}
                                        onClick={() => setMainTableSelectedIndex(idx)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                const nextIdx = Math.min(idx + 1, farmerPayments.length - 1);
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
                                            background: isHighlighted ? '#ea580c' : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                                            color: isHighlighted ? '#fff' : '#374151',
                                            cursor: 'pointer',
                                            outline: 'none'
                                        }}
                                        onMouseEnter={e => !isHighlighted && (e.currentTarget.style.background = '#fff7ed')}
                                        onMouseLeave={e => !isHighlighted && (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}
                                    >
                                        <td style={{ ...S.td, color: isHighlighted ? 'rgba(255,255,255,0.9)' : '#64748b', fontSize: '13px' }}>
                                            {formatDate(p.date)}
                                        </td>
                                        <td style={{ ...S.td, fontWeight: 600 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ 
                                                    background: isHighlighted ? 'rgba(255,255,255,0.2)' : '#fff7ed', 
                                                    border: '1px solid ' + (isHighlighted ? 'rgba(255,255,255,0.4)' : '#fed7aa'), 
                                                    color: isHighlighted ? '#fff' : '#ea580c', 
                                                    fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' 
                                                }}>
                                                    #{farmer?.displayId || '—'}
                                                </span>
                                                {farmer?.name || p.farmerName}
                                            </div>
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isHighlighted ? '#fff' : '#ea580c', fontSize: '15px' }}>
                                            {fmt(p.amount)}
                                        </td>
                                        <td style={{ ...S.td, color: isHighlighted ? 'rgba(255,255,255,0.9)' : '#64748b' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{p.notes || '—'}</span>
                                                {isEditDeleteAllowed() && (
                                                    <button onClick={() => handleEditNote(p)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isHighlighted ? 'rgba(255,255,255,0.6)' : '#cbd5e1', display: 'flex', padding: '2px' }}
                                                    ><Edit2 size={12} /></button>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'center' }}>
                                            {isEditDeleteAllowed() && (
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
                                            )}
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

            {/* ── Record Payment Modal ── */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '95%', maxWidth: '1200px', height: '90vh', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
                        {/* Modal Header — solid orange */}
                        <div style={{ background: '#ea580c', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>Record Farmer Payment</span>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex' }}>
                                <X size={24} strokeWidth={2.5} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            {/* Left Side: Entry Form */}
                            <div style={{ width: '450px', flexShrink: 0, borderRight: '1.5px solid #f1f5f9', padding: '32px', overflowY: 'auto', boxSizing: 'border-box' }}>
                                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '12px' }}>
                                    {/* Date */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>{t('date')}</label>
                                        <input
                                            ref={dateRef}
                                            type="date"
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                            onKeyDown={(e) => handleKeyDown(e, farmerRef)}
                                            required
                                            style={{ flex: 1, width: '100%', boxSizing: 'border-box', minWidth: 0, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none' }}
                                        />
                                    </div>

                                    {/* Farmer Searchable Dropdown */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>Farmer</label>
                                        <SearchSelect 
                                            items={farmers}
                                            value={formData.entityId}
                                            onChange={f => {
                                                setFormData({ ...formData, entityId: f ? f.id : '' });
                                                setTimeout(() => amountRef.current?.focus(), 50);
                                            }}
                                            inputRef={farmerRef}
                                            onKeyDown={(e) => handleKeyDown(e, amountRef)}
                                            placeholder="Select Farmer"
                                            lang={lang}
                                        />
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
                                        <label style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>Paid Amount</label>
                                        <input
                                            ref={amountRef}
                                            type="number"
                                            placeholder="0"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            onKeyDown={(e) => handleKeyDown(e, notesRef)}
                                            onWheel={(e) => e.target.blur()}
                                            required
                                            min="1"
                                            style={{ flex: 1, width: '100%', boxSizing: 'border-box', minWidth: 0, padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #ea580c', fontSize: '18px', fontWeight: 900, color: '#ea580c', outline: 'none' }}
                                        />
                                    </div>

                                    {/* Notes */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>Short Note</label>
                                        <input
                                            ref={notesRef}
                                            type="text"
                                            placeholder="e.g. Advance, weekly balance"
                                            value={formData.notes}
                                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                            onKeyDown={(e) => handleKeyDown(e, saveRef)}
                                            style={{ flex: 1, width: '100%', boxSizing: 'border-box', minWidth: 0, padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none' }}
                                        />
                                    </div>

                                    {/* Closing Balance */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>{t('closingBalance')}</label>
                                        <div style={{ fontSize: '22px', fontWeight: 950, color: closingBalance < 0 ? '#f43f5e' : '#ea580c', background: closingBalance < 0 ? '#fff1f2' : '#fff7ed', padding: '12px 16px', borderRadius: '12px', flex: 1, textAlign: 'center', border: '2px solid ' + (closingBalance < 0 ? '#fecdd3' : '#fed7aa') }}>
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
                                            style={{ flex: 2, padding: '14px', borderRadius: '12px', background: '#ea580c', border: 'none', color: '#fff', fontWeight: 800, fontSize: '16px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                            {isSaving
                                                ? <div style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                                : <CheckCircle2 size={20} />
                                            }
                                            RECORD PAYMENT
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Right Side: Today's Payment List */}
                            <div style={{ flex: 1, background: '#fdf8f6', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ padding: '20px 24px', background: '#fff', borderBottom: '1.5px solid #fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Today's Payments List
                                    </h3>
                                    <div style={{ background: '#ea580c', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>
                                        {payments.filter(p => p.date === new Date().toISOString().split('T')[0]).length} ENTRIES
                                    </div>
                                </div>
                                
                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {payments
                                            .filter(p => p.date === new Date().toISOString().split('T')[0])
                                            .sort((a,b) => b.timestamp.localeCompare(a.timestamp))
                                            .map((p, i) => {
                                                const farmer = farmers.find(x => x.id === p.farmerId);
                                                return (
                                                    <div key={p.id} style={{ 
                                                        background: '#fff', 
                                                        padding: '14px 18px', 
                                                        borderRadius: '12px', 
                                                        border: '1.5px solid #fed7aa', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'space-between',
                                                        animation: i === 0 ? 'slideInRight 0.3s ease' : 'none',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fff7ed', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c', fontSize: '12px', fontWeight: 800 }}>
                                                                {i + 1}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{farmer?.name || p.farmerName}</div>
                                                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>#{farmer?.displayId || '—'}</div>
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '16px', fontWeight: 900, color: '#ea580c' }}>{fmt(p.amount)}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        }
                                        {payments.filter(p => p.date === new Date().toISOString().split('T')[0]).length === 0 && (
                                            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>
                                                No payments recorded today yet.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Total for Today in Modal */}
                                <div style={{ padding: '16px 24px', background: '#fff', borderTop: '2.5px solid #ea580c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Today's Total Paid:</span>
                                    <span style={{ fontSize: '24px', fontWeight: 950, color: '#ea580c' }}>
                                        {fmt(payments
                                            .filter(p => p.date === new Date().toISOString().split('T')[0])
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

export default FarmerCashPay;
