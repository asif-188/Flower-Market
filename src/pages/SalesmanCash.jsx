import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import { saveSalesmanCash, deleteSalesmanCash, subscribeToCollection } from '../utils/storage';
import { LangContext } from '../components/Layout';
import { Plus, X, Calendar, User, Trash2, CheckCircle2 } from 'lucide-react';

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
    titleCol: { display: 'flex', flexDirection: 'column' },
    title: {
        fontSize: '22px', fontWeight: 800, color: '#1e293b',
        letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0,
    },
    subtitle: {
        fontSize: '11px', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px',
    },
    btnAdd: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 18px', borderRadius: '8px',
        border: '1.5px solid #7c3aed', background: '#fff',
        color: '#7c3aed', fontSize: '13px', fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    toolbar: {
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '24px', flexWrap: 'wrap',
    },
    filterInput: {
        padding: '7px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
        fontSize: '13px', fontWeight: 600, color: '#475569', outline: 'none',
    },
    table: {
        width: '100%', borderCollapse: 'collapse',
    },
    th: {
        padding: '10px 14px', textAlign: 'left',
        fontSize: '11px', fontWeight: 700, color: '#7c3aed',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap',
        background: '#fff',
    },
    td: {
        padding: '13px 14px', fontSize: '14px',
        color: '#374151', borderBottom: '1px solid #f3f4f6',
        verticalAlign: 'middle',
    },
    badge: {
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 10px', borderRadius: '6px',
        background: '#faf5ff', border: '1px solid #e9d5ff',
        color: '#7c3aed', fontWeight: 700, fontSize: '12px',
    },
    emptyRow: {
        padding: '60px 16px', textAlign: 'center',
        color: '#9ca3af', fontStyle: 'italic', fontSize: '14px',
    },
    modalOverlay: {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        padding: '16px',
    },
    modalCard: {
        background: '#fff', borderRadius: '16px', width: '100%',
        maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
    },
    modalHeader: {
        padding: '16px 24px', background: '#f9fafb',
        borderBottom: '1px solid #f3f4f6', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
    },
    modalTitle: {
        fontSize: '16px', fontWeight: 800, color: '#1e293b', margin: 0,
    },
    modalCloseBtn: {
        background: 'none', border: 'none', color: '#9ca3af',
        cursor: 'pointer', display: 'flex', alignItems: 'center',
    },
    modalBody: {
        padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
    },
    formGroup: {
        display: 'flex', flexDirection: 'column', gap: '6px',
    },
    label: {
        fontSize: '11px', fontWeight: 700, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.05em',
    },
    input: {
        padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
        fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none',
        transition: 'border-color 0.15s',
    },
    modalFooter: {
        padding: '16px 24px', borderTop: '1px solid #f3f4f6',
        display: 'flex', justifyContent: 'flex-end', gap: '12px',
    },
    btnCancel: {
        padding: '8px 16px', borderRadius: '8px', border: 'none',
        background: 'none', color: '#6b7280', fontSize: '13px',
        fontWeight: 700, cursor: 'pointer',
    },
    btnSave: {
        padding: '8px 24px', borderRadius: '8px', border: 'none',
        background: '#7c3aed', color: '#fff', fontSize: '13px',
        fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s',
    }
};

const SalesmanCash = () => {
    const { t } = useContext(LangContext);
    const [salesmen, setSalesmen] = useState([]);
    const [cashRecords, setCashRecords] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [formData, setFormData] = useState({
        date: new Date().toLocaleDateString('en-CA'),
        salesmanId: '',
        openingCash: '',
        remarks: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const unsubSalesmen = subscribeToCollection('salesmen', (data) => {
            setSalesmen(data.filter(s => s.status === 'Active'));
        });
        const unsubCash = subscribeToCollection('salesman_cash', setCashRecords);
        return () => {
            unsubSalesmen();
            unsubCash();
        };
    }, []);

    const dailyRecords = useMemo(() => {
        return cashRecords.filter(r => r.date === filterDate);
    }, [cashRecords, filterDate]);

    const handleOpenModal = () => {
        setFormData({
            date: filterDate,
            salesmanId: '',
            openingCash: '',
            remarks: ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.salesmanId || !formData.openingCash || isSaving) return;
        setIsSaving(true);
        try {
            const salesman = salesmen.find(s => s.id === formData.salesmanId);
            const record = {
                date: formData.date,
                salesmanId: formData.salesmanId,
                salesmanName: salesman?.name || 'Unknown',
                openingCash: parseFloat(formData.openingCash),
                remarks: formData.remarks
            };
            await saveSalesmanCash(record);
            setIsModalOpen(false);
            alert('✅ Cash Issue Saved Successfully!');
        } catch (error) {
            console.error("Error saving cash issue:", error);
            alert("❌ Failed to save cash issue.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this cash issue record?")) {
            try {
                await deleteSalesmanCash(id);
            } catch (error) {
                console.error("Error deleting cash issue record:", error);
                alert("Failed to delete.");
            }
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div style={S.page}>
            {/* Header */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <Plus size={22} color="#7c3aed" />
                    <div style={S.titleCol}>
                        <h2 style={S.title}>Cash Issue</h2>
                        <span style={S.subtitle}>Issue morning cash balance to salesmen</span>
                    </div>
                </div>
                
                <button style={S.btnAdd} onClick={handleOpenModal}
                    onMouseEnter={e => { e.currentTarget.style.background='#7c3aed'; e.currentTarget.style.color='#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='#ffffff'; e.currentTarget.style.color='#7c3aed'; }}
                >
                    <Plus size={15} /> Issue Cash
                </button>
            </div>

            {/* Filter Date Toolbar */}
            <div style={S.toolbar}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} color="#64748b" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Date:</span>
                    <input 
                        type="date"
                        style={S.filterInput}
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                    />
                </div>
            </div>

            {/* Table of Today's entries */}
            <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                    <thead>
                        <tr style={{ background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                            <th style={S.th}>Salesman</th>
                            <th style={S.th}>Cash Issued</th>
                            <th style={S.th}>Remarks</th>
                            <th style={{...S.th, textAlign: 'center'}}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dailyRecords.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={S.emptyRow}>
                                    No cash issued on this date yet.
                                </td>
                            </tr>
                        ) : (
                            dailyRecords.map((record) => (
                                <tr key={record.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{...S.td, fontWeight: 700, color: '#334155'}}>{record.salesmanName}</td>
                                    <td style={{...S.td, fontWeight: 800, color: '#16a34a'}}>
                                        {formatCurrency(record.openingCash || 0)}
                                    </td>
                                    <td style={S.td}>{record.remarks || '---'}</td>
                                    <td style={{...S.td, textAlign: 'center'}}>
                                        <button
                                            onClick={() => handleDelete(record.id)}
                                            style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444', margin: '0 auto' }}
                                            onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                                            onMouseLeave={e => e.currentTarget.style.background='#ffffff'}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={S.modalOverlay}>
                    <div style={S.modalCard}>
                        <div style={S.modalHeader}>
                            <h3 style={S.modalTitle}>💰 Issue Cash</h3>
                            <button onClick={() => setIsModalOpen(false)} style={S.modalCloseBtn}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={S.modalBody}>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Date</label>
                                    <input 
                                        type="date"
                                        style={S.input}
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Salesman</label>
                                    <select
                                        style={S.input}
                                        value={formData.salesmanId}
                                        onChange={(e) => setFormData({ ...formData, salesmanId: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Salesman</option>
                                        {salesmen.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} (Location: {s.location || '---'})</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Opening Cash Amount (₹)</label>
                                    <input 
                                        type="number"
                                        style={S.input}
                                        value={formData.openingCash}
                                        onChange={(e) => setFormData({ ...formData, openingCash: e.target.value })}
                                        placeholder="Enter cash amount"
                                        required
                                    />
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Remarks</label>
                                    <input 
                                        type="text"
                                        style={S.input}
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                        placeholder="Short note..."
                                    />
                                </div>
                            </div>
                            <div style={S.modalFooter}>
                                <button type="button" onClick={() => setIsModalOpen(false)} style={S.btnCancel}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSaving} style={S.btnSave}
                                    onMouseEnter={e => e.currentTarget.style.background='#6d28d9'}
                                    onMouseLeave={e => e.currentTarget.style.background='#7c3aed'}
                                >
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesmanCash;
