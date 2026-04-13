import React, { useState, useEffect, useContext } from 'react';
import { Plus, X, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { subscribeToCollection, db } from '../utils/storage';
import { collection, addDoc, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
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

    const [formData, setFormData] = useState({ entityId: '', amount: '', method: 'Cash', note: '' });

    useEffect(() => {
        const u1 = subscribeToCollection('payments', (data) =>
            setPayments(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))));
        const u2 = subscribeToCollection('buyers', setBuyers);
        const u3 = subscribeToCollection('farmers', setFarmers);
        return () => { u1(); u2(); u3(); };
    }, []);

    const handleOpenModal = () => {
        setFormData({ entityId: '', amount: '', method: 'Cash', note: '' });
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (isSaving || !formData.entityId || !formData.amount) return;
        setIsSaving(true);
        try {
            const amountNum = parseFloat(formData.amount);
            const entityRef = doc(db, paymentType === 'farmer' ? 'farmers' : 'buyers', formData.entityId);
            await addDoc(collection(db, 'payments'), {
                ...formData, amount: amountNum, type: paymentType,
                timestamp: new Date().toISOString()
            });
            await updateDoc(entityRef, { balance: increment(-amountNum) });
            setIsModalOpen(false);
            setFormData({ entityId: '', amount: '', method: 'Cash', note: '' });
        } catch (err) {
            alert('❌ Failed to record payment: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (p) => {
        if (!window.confirm('Delete this payment record?')) return;
        try { await deleteDoc(doc(db, 'payments', p.id)); }
        catch { alert('❌ Delete failed'); }
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

    const formatDate = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    const selectedEntity = buyers.find(e => e.id === formData.entityId);
    const openingBalance = selectedEntity?.balance || 0;
    const closingBalance = openingBalance - (parseFloat(formData.amount) || 0);

    // Filter to show only buyer payments in this view
    const buyerPayments = payments.filter(p => p.type === 'buyer');

    return (
        <div style={S.page}>
            {/* ── Header ── */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <span style={{ fontSize: '22px' }}>💰</span>
                    <h2 style={S.title}>{t('cashReceive')}</h2>
                </div>
                <button
                    style={S.btnAdd}
                    onClick={handleOpenModal}
                    onMouseEnter={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#16a34a'; }}
                >
                    <Plus size={14} /> {t('receivePayment')}
                </button>
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
                            buyerPayments.map((p, idx) => (
                                <tr key={p.id}
                                    style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa'}
                                >
                                    <td style={{ ...S.td, color: '#64748b', fontSize: '13px' }}>
                                        {formatDate(p.timestamp)}
                                    </td>
                                    <td style={{ ...S.td, fontWeight: 600 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' }}>
                                                #{getDisplayId(p.entityId, p.type)}
                                            </span>
                                            {getName(p.entityId, p.type)}
                                        </div>
                                    </td>
                                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#16a34a', fontSize: '15px' }}>
                                        {fmt(p.amount)}
                                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>{p.method}</div>
                                    </td>
                                    <td style={{ ...S.td, color: '#64748b' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>{p.note || '—'}</span>
                                            <button onClick={() => handleEditNote(p)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', display: 'flex', padding: '2px' }}
                                                onMouseEnter={e => e.currentTarget.style.color = '#16a34a'}
                                                onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                                            ><Edit2 size={12} /></button>
                                        </div>
                                    </td>
                                    <td style={{ ...S.td, textAlign: 'center' }}>
                                        <button onClick={() => handleDelete(p)}
                                            style={{ background: '#fff1f2', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#f43f5e' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#f43f5e'; e.currentTarget.style.color = '#fff'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#f43f5e'; }}
                                        ><Trash2 size={13} /></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Receive Payment Modal ── */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
                        {/* Modal Header — solid green */}
                        <div style={{ background: '#16a34a', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>{t('cashReceive')}</span>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex' }}>
                                <X size={20} strokeWidth={2.5} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            {/* Customer */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label style={{ width: '140px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#374151' }}>{t('customer')}</label>
                                <select
                                    value={formData.entityId}
                                    onChange={e => setFormData({ ...formData, entityId: e.target.value })}
                                    required
                                    style={{ flex: 1, padding: '9px 12px', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 500, color: '#1e293b', outline: 'none', fontFamily: 'var(--font-sans)' }}
                                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                >
                                    <option value="">{t('selectCustomer')}</option>
                                    {buyers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            {/* Opening Balance */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label style={{ width: '140px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#374151' }}>{t('openingBalance')}</label>
                                <span style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>{fmt(openingBalance)}</span>
                            </div>

                            {/* Given Amount */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label style={{ width: '140px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#374151' }}>{t('givenAmount')}</label>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        required
                                        min="1"
                                        style={{ flex: 1, padding: '9px 12px', borderRadius: '9px', border: '1.5px solid #e2e8f0', fontSize: '14px', fontWeight: 700, color: '#1e293b', outline: 'none', fontFamily: 'var(--font-sans)' }}
                                        onFocus={e => e.target.style.borderColor = '#16a34a'}
                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.method === 'UPI'}
                                            onChange={e => setFormData({ ...formData, method: e.target.checked ? 'UPI' : 'Cash' })}
                                            style={{ accentColor: '#16a34a', width: '15px', height: '15px' }}
                                        />
                                        GPay
                                    </label>
                                </div>
                            </div>

                            {/* Closing Balance */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label style={{ width: '140px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#374151' }}>{t('closingBalance')}</label>
                                <span style={{ fontSize: '18px', fontWeight: 800, color: closingBalance < 0 ? '#f43f5e' : '#16a34a' }}>{fmt(closingBalance)}</span>
                            </div>

                            {/* Note */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label style={{ width: '140px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#374151' }}>{t('notes')}</label>
                                <input
                                    type="text"
                                    placeholder="..."
                                    value={formData.note}
                                    onChange={e => setFormData({ ...formData, note: e.target.value })}
                                    style={{ flex: 1, padding: '9px 12px', borderRadius: '9px', border: '1.5px solid #e2e8f0', fontSize: '14px', color: '#374151', outline: 'none', fontFamily: 'var(--font-sans)' }}
                                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    style={{ padding: '9px 20px', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                    {t('close')}
                                </button>
                                <button type="submit" disabled={isSaving}
                                    style={{ padding: '9px 20px', borderRadius: '9px', background: '#16a34a', border: 'none', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-sans)' }}>
                                    {isSaving
                                        ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                        : <CheckCircle2 size={16} />
                                    }
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payments;
