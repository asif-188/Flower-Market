import React, { useState, useEffect, useRef, useContext } from 'react';
import { Plus, Edit2, Trash2, Search, X, User, Download, Upload } from 'lucide-react';
import { saveSalesman, deleteSalesman, subscribeToCollection } from '../utils/storage';
import { LangContext } from '../components/Layout';
import * as XLSX from 'xlsx';

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
    titleRow: {
        display: 'flex', alignItems: 'center', gap: '10px',
    },
    titleCol: {
        display: 'flex', flexDirection: 'column',
    },
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
    btnTemplate: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '8px',
        border: '1.5px solid #d1d5db', background: '#f9fafb',
        color: '#374151', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    btnImport: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '8px',
        border: '1.5px solid #d1d5db', background: '#f9fafb',
        color: '#374151', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
    },
    btnExport: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '8px',
        border: '1.5px solid #d1d5db', background: '#f9fafb',
        color: '#374151', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    btnAdd: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 18px', borderRadius: '8px',
        border: '1.5px solid #6366f1', background: '#ffffff',
        color: '#6366f1', fontSize: '13px', fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    searchWrap: {
        position: 'relative', marginBottom: '24px', maxWidth: '380px',
    },
    searchInput: {
        width: '100%', padding: '10px 16px 10px 40px',
        border: '1.5px solid #e2e8f0', borderRadius: '100px',
        background: '#fff', outline: 'none', fontSize: '14px',
        color: '#374151', fontFamily: 'var(--font-sans)',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
    },
    searchIcon: {
        position: 'absolute', left: '14px', top: '50%',
        transform: 'translateY(-50%)', color: '#9ca3af',
        pointerEvents: 'none',
    },
    table: {
        width: '100%', borderCollapse: 'collapse',
    },
    th: {
        padding: '10px 14px', textAlign: 'left',
        fontSize: '11px', fontWeight: 700, color: '#6366f1',
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
        background: '#e0e7ff', border: '1px solid #c7d2fe',
        color: '#4338ca', fontWeight: 700, fontSize: '12px',
    },
    statusBadge: {
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 8px', borderRadius: '100px',
        fontSize: '11px', fontWeight: 700,
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
        background: '#6366f1', color: '#fff', fontSize: '13px',
        fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s',
    }
};

const SalesmanMaster = () => {
    const { t } = useContext(LangContext);
    const [salesmen, setSalesmen] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentSalesman, setCurrentSalesman] = useState({ id: '', displayId: '', name: '', contact: '', location: '', status: 'Active' });
    const importRef = useRef(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeToCollection('salesmen', setSalesmen);
        return () => unsubscribe();
    }, []);

    const handleOpenModal = (salesman = null) => {
        if (salesman) {
            setCurrentSalesman(salesman);
        } else {
            setCurrentSalesman({ id: '', displayId: '', name: '', contact: '', location: '', status: 'Active' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await saveSalesman(currentSalesman);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving salesman:", error);
            alert("Failed to save.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this salesman? This action cannot be undone.")) {
            try {
                await deleteSalesman(id);
            } catch (error) {
                console.error("Error deleting salesman:", error);
                alert("Failed to delete.");
            }
        }
    };

    const handleExportExcel = () => {
        if (salesmen.length === 0) return alert('No data to export.');
        const data = salesmen.map((s, idx) => ({
            'S.No': idx + 1,
            'Salesman ID': s.displayId || '---',
            'Salesman Name': s.name,
            'Contact Number': s.contact || '---',
            'Location': s.location || '---',
            'Status': s.status || 'Active'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Salesmen');
        XLSX.writeFile(wb, `SalesmanMaster_${Date.now()}.xlsx`);
    };

    const handleDownloadTemplate = () => {
        const templateRows = [
            { 'Salesman Name': 'Kumar', 'Contact Number': '9876543210', 'Location': 'Tindivanam', 'Status': 'Active' },
            { 'Salesman Name': 'Ravi', 'Contact Number': '9988776655', 'Location': 'Pondicherry', 'Status': 'Active' }
        ];
        const ws = XLSX.utils.json_to_sheet(templateRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, `Salesman_Import_Template.xlsx`);
    };

    const handleImportExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const ab = evt.target.result;
                const wb = XLSX.read(ab, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);
                if (data.length === 0) return alert('No data found in Excel.');

                let importedCount = 0;
                for (const row of data) {
                    const name = row['Salesman Name'] || row['Name'];
                    if (!name) continue;

                    const contact = row['Contact Number'] || row['Contact'] || row['Phone'] || '';
                    const location = row['Location'] || row['Address'] || '';
                    const status = row['Status'] || 'Active';

                    await saveSalesman({
                        name: String(name).trim(),
                        contact: String(contact).trim(),
                        location: String(location).trim(),
                        status: String(status).trim()
                    });
                    importedCount++;
                }
                alert(`Successfully imported ${importedCount} salesmen!`);
            } catch (err) {
                alert('Error importing Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const filteredSalesmen = salesmen.filter(s => {
        const sTerm = searchTerm.toLowerCase().trim();
        if (!sTerm) return true;
        return s.name?.toLowerCase().includes(sTerm) ||
            s.location?.toLowerCase().includes(sTerm) ||
            s.contact?.includes(sTerm) ||
            (s.displayId && String(s.displayId).includes(sTerm));
    }).sort((a, b) => (parseInt(a.displayId) || 0) - (parseInt(b.displayId) || 0));

    return (
        <div style={S.page}>
            {/* Header */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <User size={22} color="#4338ca" />
                    <div style={S.titleCol}>
                        <h2 style={S.title}>Salesman Master</h2>
                        <span style={S.subtitle}>Manage active and inactive salesmen</span>
                    </div>
                </div>
                
                <div style={S.actions}>
                    <button style={S.btnTemplate} onClick={handleDownloadTemplate}
                        onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                    >
                        <Download size={14} /> Template
                    </button>
                    <button style={S.btnImport} onClick={() => importRef.current?.click()}
                        onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                    >
                        <Upload size={14} color="#6366f1" /> Import
                        <input ref={importRef} type="file" accept=".xlsx, .xls" onChange={handleImportExcel} style={{ display: 'none' }} />
                    </button>
                    <button style={S.btnExport} onClick={handleExportExcel}
                        onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                    >
                        <Download size={14} /> Export
                    </button>
                    <button style={S.btnAdd} onClick={() => handleOpenModal()}
                        onMouseEnter={e => { e.currentTarget.style.background='#6366f1'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='#ffffff'; e.currentTarget.style.color='#6366f1'; }}
                    >
                        <Plus size={15} /> Add Salesman
                    </button>
                </div>
            </div>

            {/* Search */}
            <div style={S.searchWrap}>
                <Search style={S.searchIcon} size={18} />
                <input 
                    type="text" 
                    placeholder="Search by name, ID, contact..." 
                    style={S.searchInput}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                    <thead>
                        <tr style={{ background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                            <th style={S.th}>ID</th>
                            <th style={S.th}>Salesman Name</th>
                            <th style={S.th}>Contact Number</th>
                            <th style={S.th}>Location</th>
                            <th style={S.th}>Status</th>
                            <th style={{...S.th, textAlign: 'center'}}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSalesmen.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={S.emptyRow}>
                                    No records found.
                                </td>
                            </tr>
                        ) : (
                            filteredSalesmen.map((salesman) => (
                                <tr key={salesman.id} className="group" style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={S.td}>
                                        <span style={S.idBadge}>#{salesman.displayId || '---'}</span>
                                    </td>
                                    <td style={{...S.td, fontWeight: 700, color: '#334155'}}>
                                        {salesman.name}
                                    </td>
                                    <td style={S.td}>{salesman.contact || '---'}</td>
                                    <td style={S.td}>{salesman.location || '---'}</td>
                                    <td style={S.td}>
                                        <span style={{
                                            ...S.statusBadge,
                                            background: salesman.status === 'Active' ? '#dcfce7' : '#fee2e2',
                                            color: salesman.status === 'Active' ? '#15803d' : '#b91c1c'
                                        }}>
                                            {salesman.status}
                                        </span>
                                    </td>
                                    <td style={{...S.td, textAlign: 'center'}}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button 
                                                onClick={() => handleOpenModal(salesman)}
                                                style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#3b82f6' }}
                                                onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                                                onMouseLeave={e => e.currentTarget.style.background='#ffffff'}
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(salesman.id)}
                                                style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444' }}
                                                onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                                                onMouseLeave={e => e.currentTarget.style.background='#ffffff'}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
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
                            <h3 style={S.modalTitle}>
                                {currentSalesman.id ? '✏️ Edit Salesman' : '👤 New Salesman'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} style={S.modalCloseBtn}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div style={S.modalBody}>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Salesman Name</label>
                                    <input 
                                        type="text" 
                                        style={S.input}
                                        value={currentSalesman.name}
                                        onChange={(e) => setCurrentSalesman({ ...currentSalesman, name: e.target.value })}
                                        placeholder="Full Name"
                                        required
                                    />
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Contact Number</label>
                                    <input 
                                        type="text" 
                                        style={S.input}
                                        value={currentSalesman.contact}
                                        onChange={(e) => setCurrentSalesman({ ...currentSalesman, contact: e.target.value })}
                                        placeholder="Mobile Number"
                                    />
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Location</label>
                                    <input 
                                        type="text" 
                                        style={S.input}
                                        value={currentSalesman.location}
                                        onChange={(e) => setCurrentSalesman({ ...currentSalesman, location: e.target.value })}
                                        placeholder="City/Town"
                                    />
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Status</label>
                                    <select 
                                        style={S.input}
                                        value={currentSalesman.status}
                                        onChange={(e) => setCurrentSalesman({ ...currentSalesman, status: e.target.value })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div style={S.modalFooter}>
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)}
                                    style={S.btnCancel}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    style={S.btnSave}
                                    onMouseEnter={e => e.currentTarget.style.background='#4f46e5'}
                                    onMouseLeave={e => e.currentTarget.style.background='#6366f1'}
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

export default SalesmanMaster;
