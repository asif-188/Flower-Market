import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, X, User, FileText, Download, Upload, ArrowLeft, Phone, Filter, RotateCcw } from 'lucide-react';
import { subscribeToCollection, saveFFarmer, deleteFFarmer, COLLECTIONS, db } from '../utils/storage';
import { collection, query, where, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';

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
const TH_S = { 
    padding: '12px 14px', textAlign: 'left', fontSize: '11px', 
    fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', 
    letterSpacing: '0.08em', borderBottom: '1.5px solid #e5e7eb',
    background: '#fff'
};
const TD_S = { 
    padding: '12px 14px', fontSize: '13px', verticalAlign: 'middle',
    color: '#374151', borderBottom: '1px solid #f3f4f6'
};

const WhatsAppIcon = ({ size = 14 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ flexShrink: 0 }}>
        <path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.761.459 3.479 1.332 4.992L2 22l5.176-1.357a9.92 9.92 0 0 0 4.836 1.258h.005c5.505 0 9.988-4.482 9.988-9.988C22 6.482 17.518 2 12.012 2zm0 18.294h-.004c-1.536 0-3.042-.413-4.358-1.192l-.312-.186-3.238.85.864-3.158-.204-.325a8.232 8.232 0 0 1-1.261-4.385c0-4.562 3.712-8.274 8.276-8.274 2.213 0 4.293.861 5.854 2.424a8.214 8.214 0 0 1 2.42 5.856c-.002 4.563-3.714 8.275-8.277 8.275zm4.536-6.195c-.248-.124-1.472-.727-1.7-.81-.227-.083-.393-.124-.558.124-.166.248-.641.81-.786.975-.145.166-.29.186-.538.062-.249-.124-1.049-.387-1.998-1.233-.738-.658-1.236-1.47-1.381-1.719-.145-.248-.015-.383.11-.507.112-.111.248-.29.372-.435.124-.145.166-.248.248-.415.083-.166.041-.31-.02-.435-.062-.124-.558-1.346-.765-1.844-.201-.486-.406-.419-.558-.427-.145-.008-.31-.01-.475-.01s-.435.062-.662.31c-.227.248-.869.85-.869 2.07 0 1.222.89 2.404.99 2.538.103.136 1.748 2.671 4.237 3.743.592.255 1.055.408 1.416.523.595.19 1.137.163 1.564.099.477-.072 1.472-.601 1.679-1.182.207-.581.207-1.079.145-1.182-.062-.103-.227-.166-.475-.29z"/>
    </svg>
);

const S = {
    page: {
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        padding: '28px 16px',
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
    title: {
        fontSize: '22px', fontWeight: 800, color: '#ea580c',
        letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0,
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
        border: '1.5px solid #16a34a', background: '#ffffff',
        color: '#16a34a', fontSize: '13px', fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    searchWrap: {
        position: 'relative', marginBottom: '24px', maxWidth: '380px',
    },
    searchInput: {
        width: '100%', padding: '10px 16px 10px 40px',
        border: '1.5px solid #d1fae5', borderRadius: '100px',
        background: '#fff', outline: 'none', fontSize: '14px',
        color: '#374151', fontFamily: 'var(--font-sans)',
        transition: 'border-color 0.2s',
    },
    searchIcon: {
        position: 'absolute', left: '14px', top: '50%',
        transform: 'translateY(-50%)', color: '#9ca3af',
        pointerEvents: 'none',
    },
};

const FarmerMaster = () => {
    const { isEditDeleteAllowed } = useTenant();
    const { t } = useContext(LangContext);
    const [farmers, setFarmers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);
    const [selectedFarmer, setSelectedFarmer] = useState(null);
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [isLoadingLedger, setIsLoadingLedger] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [toasts, setToasts] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Sorting, Pagination, and Filters States
    const [selectedVillage, setSelectedVillage] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [appliedVillage, setAppliedVillage] = useState('all');
    const [appliedStatus, setAppliedStatus] = useState('all');
    const [sortField, setSortField] = useState('displayId');
    const [sortAsc, setSortAsc] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    const [currentFarmer, setCurrentFarmer] = useState({
        id: '',
        displayId: '',
        name: '',
        contact: '',
        village: '',
        commissionType: '10% Flat',
        openingBalance: 0,
        balance: 0,
        status: 'Active'
    });

    useEffect(() => {
        const unsubscribe = subscribeToCollection(COLLECTIONS.F_FARMERS, setFarmers);
        return () => unsubscribe();
    }, []);

    const addToast = (message, type = 'success') => {
        const id = Date.now() + Math.random().toString();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const handleOpenModal = (farmer = null) => {
        if (farmer) {
            setCurrentFarmer({
                ...farmer,
                openingBalance: farmer.openingBalance || 0,
                balance: farmer.balance || 0
            });
        } else {
            // Auto generate Farmer ID based on count
            const nextNum = farmers.length + 1;
            const autoId = `F-${String(nextNum).padStart(3, '0')}`;
            setCurrentFarmer({
                id: '',
                displayId: autoId,
                name: '',
                contact: '',
                village: '',
                commissionType: '10% Flat',
                openingBalance: 0,
                balance: 0,
                status: 'Active'
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (isSaving) return;
        setIsSaving(true);

        try {
            const opBal = parseFloat(currentFarmer.openingBalance || 0);
            
            // If it's a new farmer, set the current balance same as opening balance
            const farmerData = {
                ...currentFarmer,
                openingBalance: opBal,
                balance: currentFarmer.id ? parseFloat(currentFarmer.balance || 0) : opBal
            };

            await saveFFarmer(farmerData);
            addToast(currentFarmer.id ? 'Farmer updated successfully!' : 'Farmer added successfully!');
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving farmer:", error);
            addToast('Failed to save farmer details.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this farmer? This action cannot be undone.')) return;
        try {
            await deleteFFarmer(id);
            addToast('Farmer deleted successfully!');
        } catch (error) {
            console.error("Error deleting farmer:", error);
            addToast('Failed to delete farmer.', 'error');
        }
    };

    const handleViewLedger = async (farmer) => {
        setSelectedFarmer(farmer);
        setIsLedgerOpen(true);
        setIsLoadingLedger(true);
        try {
            const tenantId = sessionStorage.getItem('fm_tenantId') || 'default';
            const q = query(
                collection(db, COLLECTIONS.F_LEDGERS),
                where('tenantId', '==', tenantId),
                where('farmerId', '==', farmer.id)
            );
            const snap = await getDocs(q);
            const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            setLedgerEntries(entries);
        } catch (error) {
            console.error("Error loading ledger:", error);
            addToast('Failed to load ledger history.', 'error');
        } finally {
            setIsLoadingLedger(false);
        }
    };

    const handleExportExcel = () => {
        try {
            const dataToExport = farmers.map(f => ({
                'Farmer ID': f.displayId || '',
                'Farmer Name': f.name || '',
                'Contact Number': f.contact || '',
                'Village': f.village || '',
                'Commission Type': f.commissionType || '',
                'Opening Balance (₹)': f.openingBalance || 0,
                'Current Balance (₹)': f.balance || 0,
                'Status': f.status || 'Active'
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Farmers');
            XLSX.writeFile(wb, `FarmerMaster_${Date.now()}.xlsx`);
            addToast('Excel exported successfully!');
        } catch (error) {
            console.error("Excel export error:", error);
            addToast('Failed to export Excel file.', 'error');
        }
    };

    const handleDownloadTemplate = () => {
        try {
            const templateRows = [
                {
                    'Farmer Name': 'John Doe',
                    'Contact Number': '9876543210',
                    'Village': 'Green Village',
                    'Commission Type': '10% Flat',
                    'Opening Balance': 1500,
                    'Status': 'Active'
                }
            ];
            const ws = XLSX.utils.json_to_sheet(templateRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Template');
            XLSX.writeFile(wb, `Farmer_Import_Template.xlsx`);
            addToast('Import template downloaded!');
        } catch (error) {
            console.error(error);
            addToast('Failed to download template.', 'error');
        }
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
                if (data.length === 0) return addToast('No data found in Excel.', 'error');

                let importedCount = 0;
                for (const row of data) {
                    const name = row['Farmer Name'] || row['Name'];
                    if (!name) continue;

                    const contact = row['Contact Number'] || row['Contact'] || row['Phone'] || '';
                    const village = row['Village'] || row['Address'] || '';
                    const commType = row['Commission Type'] || '10% Flat';
                    const opBal = parseFloat(row['Opening Balance'] || row['Opening Balance (₹)'] || 0);
                    const status = row['Status'] || 'Active';

                    const nextNum = farmers.length + importedCount + 1;
                    const autoId = `F-${String(nextNum).padStart(3, '0')}`;

                    await saveFFarmer({
                        displayId: autoId,
                        name: String(name).trim(),
                        contact: String(contact).trim(),
                        village: String(village).trim(),
                        commissionType: String(commType).trim(),
                        openingBalance: opBal,
                        balance: opBal,
                        status: String(status).trim()
                    });
                    importedCount++;
                }
                addToast(`Successfully imported ${importedCount} farmers!`);
            } catch (err) {
                console.error(err);
                addToast('Error importing Excel: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    // Compute unique villages for the filter dropdown
    const uniqueVillages = useMemo(() => {
        const vSet = new Set(farmers.map(f => f.village).filter(Boolean));
        return Array.from(vSet).sort();
    }, [farmers]);

    // Handle sort field changes
    const handleSort = (field) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    };

    // Filter handlers
    const handleApplyFilters = () => {
        setAppliedVillage(selectedVillage);
        setAppliedStatus(selectedStatus);
    };

    const handleResetFilters = () => {
        setSelectedVillage('all');
        setSelectedStatus('all');
        setAppliedVillage('all');
        setAppliedStatus('all');
        setSearchTerm('');
    };

    // Filter farmers based on search term, applied village, and applied status
    const filteredFarmers = useMemo(() => {
        return farmers.filter(f => {
            const matchesSearch = !searchTerm || 
                f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                f.displayId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                f.contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                f.village?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesVillage = appliedVillage === 'all' || f.village === appliedVillage;
            const matchesStatus = appliedStatus === 'all' || (f.status || 'Active') === appliedStatus;

            return matchesSearch && matchesVillage && matchesStatus;
        });
    }, [farmers, searchTerm, appliedVillage, appliedStatus]);

    // Sort the filtered farmers
    const sortedFarmers = useMemo(() => {
        const sorted = [...filteredFarmers];
        sorted.sort((a, b) => {
            let valA = a[sortField] || '';
            let valB = b[sortField] || '';

            if (sortField === 'openingBalance' || sortField === 'balance') {
                valA = Number(valA);
                valB = Number(valB);
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [filteredFarmers, sortField, sortAsc]);

    // Paginate sorted & filtered farmers
    const itemsPerPage = 10;
    const totalPages = Math.ceil(sortedFarmers.length / itemsPerPage);
    const paginatedFarmers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedFarmers.slice(start, start + itemsPerPage);
    }, [sortedFarmers, currentPage]);

    // Reset pagination to first page when search filters or sorting change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, appliedVillage, appliedStatus, sortField, sortAsc]);

    const entryStart = sortedFarmers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const entryEnd = Math.min(currentPage * itemsPerPage, sortedFarmers.length);

    const SortHeader = ({ field, label, align = 'left' }) => {
        const active = sortField === field;
        return (
            <th 
                onClick={() => handleSort(field)}
                style={{
                    ...TH_S,
                    textAlign: align === 'right' ? 'right' : 'left',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'background-color 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff7ed'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
                    {label}
                    <span style={{ fontSize: '10px', color: active ? '#ea580c' : '#fed7aa' }}>
                        {active ? (sortAsc ? '▲' : '▼') : '⇅'}
                    </span>
                </div>
            </th>
        );
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
            {/* Toaster Container */}
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

            {/* Header */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <User size={22} color="#ea580c" />
                    <div>
                        <h2 style={S.title}>{t('farmerMaster')}</h2>
                        <p className="text-xs font-semibold text-gray-400 mt-0.5">Manage all your farmers in one place</p>
                    </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button 
                        onClick={handleDownloadTemplate}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px', borderRadius: '10px', border: '1.5px solid #ea580c',
                            background: '#fff', color: '#ea580c', fontSize: '13px', fontWeight: 800,
                            textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fff7ed'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                    >
                        <FileText size={14} /> {t('template')}
                    </button>
                    <label 
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px', borderRadius: '10px', border: '1.5px solid #ea580c',
                            background: '#fff', color: '#ea580c', fontSize: '13px', fontWeight: 800,
                            textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fff7ed'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                    >
                        <Upload size={14} /> {t('import')}
                        <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" />
                    </label>
                    <button 
                        onClick={handleExportExcel}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px', borderRadius: '10px', border: '1.5px solid #ea580c',
                            background: '#fff', color: '#ea580c', fontSize: '13px', fontWeight: 800,
                            textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fff7ed'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                    >
                        <Download size={14} /> {t('export')}
                    </button>
                    <button 
                        onClick={() => handleOpenModal()}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '9px 20px', borderRadius: '10px', border: 'none',
                            background: '#ea580c', color: '#fff', fontSize: '13px', fontWeight: 800,
                            textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.15s',
                            boxShadow: '0 4px 12px rgba(234, 88, 12, 0.2)'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#c2410c'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#ea580c'; }}
                    >
                        <Plus size={14} /> {t('addFarmer')}
                    </button>
                </div>
            </div>

            {/* Filters Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#fff7ed', padding: '16px 20px', borderRadius: '16px', border: '1px solid #fed7aa', marginBottom: '24px', flexWrap: 'wrap' }} className="no-print">
                {/* Search */}
                <div style={{ flex: '1 1 240px', maxWidth: '320px' }}>
                    <label style={LABEL_S}>Search Farmers</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', color: '#ea580c' }} />
                        <input 
                            type="text" 
                            placeholder="Name, ID, village or contact..." 
                            style={{ ...INPUT_S, paddingLeft: '32px' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Village Selector */}
                <div style={{ width: '180px' }}>
                    <label style={LABEL_S}>Village</label>
                    <select 
                        value={selectedVillage} 
                        onChange={(e) => setSelectedVillage(e.target.value)}
                        style={INPUT_S}
                    >
                        <option value="all">All Villages</option>
                        {uniqueVillages.map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </div>

                {/* Filter and Reset buttons */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', alignSelf: 'flex-end' }}>
                    <button 
                        onClick={handleApplyFilters} 
                        style={{
                            height: '42px', padding: '0 16px', borderRadius: '10px', border: '1.5px solid #ea580c',
                            background: '#fff', color: '#ea580c', fontWeight: 800, fontSize: '11px',
                            textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#ea580c'; }}
                    >
                        <Filter size={13} /> Filter
                    </button>
                    <button 
                        onClick={handleResetFilters} 
                        style={{
                            height: '42px', padding: '0 16px', borderRadius: '10px', border: '1.5px solid #64748b',
                            background: '#fff', color: '#64748b', fontWeight: 800, fontSize: '11px',
                            textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#64748b'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#64748b'; }}
                    >
                        <RotateCcw size={13} /> Reset
                    </button>
                </div>
            </div>

            {/* ── Table Card ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', padding: '24px 16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#374151', margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Farmer List
                </h3>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <SortHeader field="displayId" label={t('id')} />
                                <SortHeader field="name" label={t('farmerName')} />
                                <SortHeader field="contact" label={t('contact')} />
                                <SortHeader field="village" label={t('village')} />
                                <SortHeader field="openingBalance" label={t('openingBalance')} align="right" />
                                <SortHeader field="balance" label={t('currentBalance')} align="right" />
                                <th style={{ ...TH_S, textAlign: 'left' }}>{t('ledger')}</th>
                                <th style={{ ...TH_S, textAlign: 'left' }}>{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedFarmers.map((farmer, idx) => (
                                <tr key={farmer.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                    <td style={{ ...TD_S, fontWeight: 700, color: '#ea580c', whiteSpace: 'nowrap' }}>
                                        #{farmer.displayId || '—'}
                                    </td>
                                    <td style={TD_S}>
                                        <span style={{ fontWeight: 850, color: '#1e293b' }}>{farmer.name}</span>
                                    </td>
                                    <td style={TD_S}>
                                        {farmer.contact ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Phone size={13} style={{ color: '#94a3b8' }} />
                                                <span>{farmer.contact}</span>
                                                <a 
                                                    href={`https://wa.me/${farmer.contact.length === 10 ? '91' + farmer.contact : farmer.contact}`} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    style={{ color: '#22c55e', display: 'flex', transition: 'transform 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                >
                                                    <WhatsAppIcon size={14} />
                                                </a>
                                            </div>
                                        ) : '—'}
                                    </td>
                                    <td style={{ ...TD_S, fontWeight: 600, color: '#475569' }}>{farmer.village || '—'}</td>
                                    <td style={{ ...TD_S, textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
                                        {formatCurrency(farmer.openingBalance || 0)}
                                    </td>
                                    <td style={{ ...TD_S, textAlign: 'right' }}>
                                        <span style={{ fontWeight: 800, color: (farmer.balance || 0) > 0 ? '#16a34a' : (farmer.balance || 0) < 0 ? '#ef4444' : '#64748b' }}>
                                            {formatCurrency(farmer.balance || 0)}
                                        </span>
                                    </td>
                                    <td style={TD_S}>
                                        <button 
                                            onClick={() => handleViewLedger(farmer)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '5px 12px', background: '#fff', color: '#64748b',
                                                borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                                                border: '1.5px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ea580c'; e.currentTarget.style.color = '#ea580c'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                                        >
                                            <FileText size={13} /> {t('view')}
                                        </button>
                                    </td>
                                    <td style={TD_S}>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {isEditDeleteAllowed() && (
                                                <>
                                                    <button 
                                                        onClick={() => handleOpenModal(farmer)}
                                                        style={{
                                                            padding: '6px', color: '#3b82f6', background: 'transparent',
                                                            border: '1.5px solid transparent', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.background = '#eff6ff'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(farmer.id)}
                                                        style={{
                                                            padding: '6px', color: '#ef4444', background: 'transparent',
                                                            border: '1.5px solid transparent', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.background = '#fef2f2'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {sortedFarmers.length === 0 && (
                        <div style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
                            {t('noRecords')}
                        </div>
                    )}
                </div>

                {/* Pagination footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifySide: 'space-between', justifyContent: 'space-between', marginTop: '24px', boxSizing: 'border-box' }} className="no-print">
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                        Showing {entryStart} to {entryEnd} of {sortedFarmers.length} entries
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            style={{
                                padding: '8px 16px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
                                background: currentPage === 1 ? '#f8fafc' : '#fff',
                                color: currentPage === 1 ? '#cbd5e1' : '#64748b',
                                fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer', transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { if (currentPage !== 1) e.currentTarget.style.borderColor = '#ea580c'; }}
                            onMouseLeave={e => { if (currentPage !== 1) e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        >
                            Previous
                        </button>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button 
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                style={{
                                    width: '36px', height: '36px', borderRadius: '10px', border: currentPage === page ? 'none' : '1.5px solid #e2e8f0',
                                    background: currentPage === page ? '#ea580c' : '#fff',
                                    color: currentPage === page ? '#fff' : '#64748b',
                                    fontSize: '11px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
                                    boxShadow: currentPage === page ? '0 4px 12px rgba(234, 88, 12, 0.2)' : 'none'
                                }}
                            >
                                {page}
                            </button>
                        ))}

                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            style={{
                                padding: '8px 16px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
                                background: (currentPage === totalPages || totalPages === 0) ? '#f8fafc' : '#fff',
                                color: (currentPage === totalPages || totalPages === 0) ? '#cbd5e1' : '#64748b',
                                fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
                                cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { if (currentPage !== totalPages && totalPages !== 0) e.currentTarget.style.borderColor = '#ea580c'; }}
                            onMouseLeave={e => { if (currentPage !== totalPages && totalPages !== 0) e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal - Add / Edit Farmer */}
            {isModalOpen && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:'16px'}}>
                    <div style={{background:'#fff',borderRadius:'16px',width:'100%',maxWidth:'480px',maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden',fontFamily:'var(--font-sans)'}}>
                        <div style={{padding:'22px 24px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                                <div style={{background:'#fff7ed',borderRadius:'10px',padding:'6px'}}>
                                    <User size={20} color="#ea580c"/>
                                </div>
                                <span style={{fontSize:'16px',fontWeight:800,color:'#1e293b',fontFamily:'var(--font-display)'}}>
                                    {currentFarmer.id ? t('editFarmer') : t('newFarmer')}
                                </span>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',display:'flex'}}>
                                <X size={20}/>
                            </button>
                        </div>
                        <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
                            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px',overflowY:'auto',flex:1}}>
                                <div>
                                    <label style={{display:'block',marginBottom:'5px',fontSize:'12px',fontWeight:600,color:'#64748b'}}>{t('farmerIdAuto')}</label>
                                    <input 
                                        type="text" 
                                        style={{
                                            width:'100%',padding:'10px 12px',borderRadius:'10px',
                                            border:'1.5px solid #e2e8f0',background:'#f8fafc',
                                            fontSize:'14px',fontWeight:600,color:'#64748b',
                                            outline:'none',fontFamily:'var(--font-sans)',
                                        }}
                                        value={currentFarmer.displayId}
                                        disabled
                                    />
                                </div>
                                <div>
                                    <label style={{display:'block',marginBottom:'5px',fontSize:'12px',fontWeight:600,color:'#64748b'}}>{t('farmerName')} *</label>
                                    <input 
                                        type="text" 
                                        style={{
                                            width:'100%',padding:'10px 12px',borderRadius:'10px',
                                            border:'1.5px solid #e2e8f0',background:'#fff',
                                            fontSize:'14px',fontWeight:600,color:'#1e293b',
                                            outline:'none',fontFamily:'var(--font-sans)',
                                        }}
                                        onFocus={e => e.target.style.borderColor='#ea580c'}
                                        onBlur={e => e.target.style.borderColor='#e2e8f0'}
                                        value={currentFarmer.name}
                                        onChange={(e) => setCurrentFarmer({ ...currentFarmer, name: e.target.value })}
                                        placeholder={t('fullNamePlaceholder')}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label style={{display:'block',marginBottom:'5px',fontSize:'12px',fontWeight:600,color:'#64748b'}}>{t('contactNumber')}</label>
                                    <input 
                                        type="text" 
                                        style={{
                                            width:'100%',padding:'10px 12px',borderRadius:'10px',
                                            border:'1.5px solid #e2e8f0',background:'#fff',
                                            fontSize:'14px',fontWeight:600,color:'#1e293b',
                                            outline:'none',fontFamily:'var(--font-sans)',
                                        }}
                                        onFocus={e => e.target.style.borderColor='#ea580c'}
                                        onBlur={e => e.target.style.borderColor='#e2e8f0'}
                                        value={currentFarmer.contact}
                                        onChange={(e) => setCurrentFarmer({ ...currentFarmer, contact: e.target.value })}
                                        placeholder={t('mobilePlaceholder')}
                                    />
                                </div>
                                <div>
                                    <label style={{display:'block',marginBottom:'5px',fontSize:'12px',fontWeight:600,color:'#64748b'}}>{t('village')}</label>
                                    <input 
                                        type="text" 
                                        style={{
                                            width:'100%',padding:'10px 12px',borderRadius:'10px',
                                            border:'1.5px solid #e2e8f0',background:'#fff',
                                            fontSize:'14px',fontWeight:600,color:'#1e293b',
                                            outline:'none',fontFamily:'var(--font-sans)',
                                        }}
                                        onFocus={e => e.target.style.borderColor='#ea580c'}
                                        onBlur={e => e.target.style.borderColor='#e2e8f0'}
                                        value={currentFarmer.village}
                                        onChange={(e) => setCurrentFarmer({ ...currentFarmer, village: e.target.value })}
                                        placeholder={t('villagePlaceholder')}
                                    />
                                </div>
                                <div>
                                    <label style={{display:'block',marginBottom:'5px',fontSize:'12px',fontWeight:600,color:'#64748b'}}>{t('openingBalance')} (₹)</label>
                                    <input 
                                        type="number" 
                                        style={{
                                            width:'100%',padding:'10px 12px',borderRadius:'10px',
                                            border:'1.5px solid #e2e8f0',background:currentFarmer.id?'#f8fafc':'#fff',
                                            fontSize:'14px',fontWeight:600,color:currentFarmer.id?'#64748b':'#1e293b',
                                            outline:'none',fontFamily:'var(--font-sans)',
                                        }}
                                        onFocus={e => !currentFarmer.id && (e.target.style.borderColor='#ea580c')}
                                        onBlur={e => e.target.style.borderColor='#e2e8f0'}
                                        value={currentFarmer.openingBalance}
                                        onChange={(e) => setCurrentFarmer({ ...currentFarmer, openingBalance: e.target.value })}
                                        onWheel={(e) => e.target.blur()}
                                        disabled={!!currentFarmer.id}
                                    />
                                </div>
                                <div>
                                    <label style={{display:'block',marginBottom:'5px',fontSize:'12px',fontWeight:600,color:'#64748b'}}>Status</label>
                                    <select 
                                        style={{
                                            width:'100%',padding:'10px 12px',borderRadius:'10px',
                                            border:'1.5px solid #e2e8f0',background:'#fff',
                                            fontSize:'14px',fontWeight:600,color:'#1e293b',
                                            outline:'none',fontFamily:'var(--font-sans)',
                                        }}
                                        onFocus={e => e.target.style.borderColor='#ea580c'}
                                        onBlur={e => e.target.style.borderColor='#e2e8f0'}
                                        value={currentFarmer.status || 'Active'}
                                        onChange={(e) => setCurrentFarmer({ ...currentFarmer, status: e.target.value })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{padding:'16px 24px',borderTop:'1px solid #f1f5f9',background:'#fafafa',display:'flex',justifyContent:'flex-end',gap:'10px',flexShrink:0}}>
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    style={{padding:'9px 20px',borderRadius:'9px',border:'1.5px solid #e2e8f0',background:'#fff',color:'#64748b',fontWeight:600,fontSize:'13px',cursor:'pointer',fontFamily:'var(--font-sans)'}}>
                                    {t('cancel')}
                                </button>
                                <button type="submit" disabled={isSaving}
                                    style={{padding:'9px 22px',borderRadius:'9px',border:'1.5px solid #ea580c',background:'#fff',color:'#ea580c',fontWeight:700,fontSize:'13px',cursor:isSaving?'not-allowed':'pointer',opacity:isSaving?0.6:1,fontFamily:'var(--font-sans)'}}
                                    onMouseEnter={e => { if(!isSaving) { e.currentTarget.style.background='#ea580c'; e.currentTarget.style.color='#fff'; } }}
                                    onMouseLeave={e => { if(!isSaving) { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#ea580c'; } }}
                                >
                                    {isSaving ? t('saving') : t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal - Ledger History */}
            {isLedgerOpen && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:'16px'}}>
                    <div style={{background:'#fff',borderRadius:'16px',width:'100%',maxWidth:'560px',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden',fontFamily:'var(--font-sans)'}}>
                        <div style={{padding:'20px 24px 16px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                            <div>
                                <div style={{fontSize:'16px',fontWeight:800,color:'#1e293b',fontFamily:'var(--font-display)'}}>{selectedFarmer?.name}</div>
                                <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'2px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em'}}>
                                    {t('farmerId')}: {selectedFarmer?.displayId} • {selectedFarmer?.village || '—'}
                                </div>
                            </div>
                            <button onClick={() => setIsLedgerOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',display:'flex'}}>
                                <X size={20}/>
                            </button>
                        </div>
                        <div style={{padding:'16px 24px',maxHeight:'55vh',overflowY:'auto'}}>
                            <div style={{fontSize:'11px',fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'12px'}}>{t('transactionHistory')}</div>
                            {isLoadingLedger ? (
                                <div style={{padding:'48px 16px',textAlign:'center',color:'#9ca3af',fontStyle:'italic'}}>{t('loadingLedger')}</div>
                            ) : (
                                <div style={{border:'1px solid #f1f5f9',borderRadius:'10px',overflow:'hidden'}}>
                                    {/* Opening Balance Row */}
                                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:ledgerEntries.length > 0?'1px solid #f8fafc':'none',background:'#fff'}}>
                                        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                                            <div style={{width:'44px',height:'36px',borderRadius:'8px',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent: isLedgerOpen ? 'center' : 'flex-start',fontSize:'11px',fontWeight:700,color:'#64748b'}}>
                                                —
                                            </div>
                                            <div style={{display:'flex',flexDirection:'column'}}>
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.06em',
                                                    color: '#64748b'
                                                }}>
                                                    {t('oldBalance').toUpperCase()}
                                                </span>
                                                <span style={{fontSize:'10px',color:'#94a3b8',marginTop:'2px'}}>{t('openingBalance')}</span>
                                            </div>
                                        </div>
                                        <span style={{
                                            fontWeight: 700,
                                            fontSize: '14px',
                                            color: '#1e293b'
                                        }}>
                                            {formatCurrency(selectedFarmer?.openingBalance || 0)}
                                        </span>
                                    </div>

                                    {/* Ledger Entries */}
                                    {ledgerEntries.map((entry, idx) => {
                                        const isPaid = !!entry.debit;
                                        return (
                                            <div key={entry.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:idx < ledgerEntries.length - 1?'1px solid #f8fafc':'none',background:idx % 2 === 0 ? '#fafafa' : '#fff'}}>
                                                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                                                    <div style={{width:'44px',height:'36px',borderRadius:'8px',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'#64748b'}}>
                                                        {entry.date ? entry.date.split('-').slice(1).reverse().join('/') : '—'}
                                                    </div>
                                                    <div style={{display:'flex',flexDirection:'column'}}>
                                                        <span style={{
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.06em',
                                                            color: isPaid ? '#16a34a' : '#3b82f6'
                                                        }}>
                                                            {isPaid ? t('paid').toUpperCase() : t('purchase').toUpperCase()}
                                                        </span>
                                                        <span style={{fontSize:'10px',color:'#94a3b8',marginTop:'2px'}}>{entry.description}</span>
                                                    </div>
                                                </div>
                                                <span style={{
                                                    fontWeight: 700,
                                                    fontSize: '14px',
                                                    color: isPaid ? '#16a34a' : '#1e293b'
                                                }}>
                                                    {isPaid ? '-' : ''}{formatCurrency(entry.debit || entry.credit || 0)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div style={{padding:'14px 24px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'flex-end'}}>
                            <button onClick={() => setIsLedgerOpen(false)}
                                style={{padding:'8px 20px',borderRadius:'9px',background:'#1e293b',color:'#fff',border:'none',fontWeight:700,fontSize:'12px',cursor:'pointer',letterSpacing:'0.04em',textTransform:'uppercase',fontFamily:'var(--font-sans)'}}>
                                {t('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FarmerMaster;
