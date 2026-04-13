import React, { useState, useEffect, useRef, useContext } from 'react';
import { Plus, Edit2, Trash2, Search, X, User, FileText, Download, Upload, Hash, Phone, Wallet } from 'lucide-react';
import { saveBuyer, subscribeToCollection } from '../utils/storage';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/storage';
import { LangContext } from '../components/Layout';

const Buyer = () => {
    const { t } = useContext(LangContext);
    const [buyers, setBuyers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentBuyer, setCurrentBuyer] = useState({ id: '', name: '', contact: '', balance: 0 });
    const [isSaving, setIsSaving] = useState(false);
    const importRef = useRef(null);

    // ── Real-time Firestore listener ──
    useEffect(() => {
        const unsubscribe = subscribeToCollection('buyers', setBuyers);
        return () => unsubscribe();
    }, []);

    const handleOpenModal = (buyer = null) => {
        if (!buyer) {
            const nextId = buyers.length > 0
                ? Math.max(...buyers.map(b => parseInt(b.displayId) || 0)) + 1
                : 101;
            setCurrentBuyer({ id: '', name: '', contact: '', balance: 0, displayId: nextId });
        } else {
            setCurrentBuyer({ ...buyer });
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
            };
            if (!buyerToSave.id) delete buyerToSave.id;
            await saveBuyer(buyerToSave);
            setIsModalOpen(false);
            setCurrentBuyer({ id: '', name: '', contact: '', balance: 0 });
        } catch (err) {
            console.error('Save error:', err);
            alert('❌ Failed to save: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this customer?')) return;
        try {
            await deleteDoc(doc(db, 'buyers', id));
        } catch (err) {
            alert('❌ Delete failed: ' + err.message);
        }
    };

    // ── Template Download ──
    const handleDownloadTemplate = () => {
        const csv = [
            ['ID', 'Name', 'Contact', 'Balance'],
            ['101', 'Sample Customer', '9876543210', '0'],
            ['102', 'Another Customer', '9123456780', '500'],
        ].map(r => r.join(',')).join('\\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'customer_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── CSV Import ──
    const handleImportCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const lines = ev.target.result.trim().split('\\n');
            const header = lines[0].split(',').map(h => h.trim().toLowerCase());
            let imported = 0, failed = 0;

            // Find current max ID once
            let currentMax = buyers.length > 0 
                ? Math.max(...buyers.map(b => parseInt(b.displayId) || 0)) 
                : 100;

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim());
                if (cols.length < 2) continue;
                const row = {};
                header.forEach((h, idx) => { row[h] = cols[idx] || ''; });
                
                try {
                    const rowId = parseInt(row.id) || (currentMax + 1);
                    if (rowId > currentMax) currentMax = rowId;

                    await saveBuyer({
                        name: row.name || '',
                        contact: row.contact || '',
                        balance: parseFloat(row.balance) || 0,
                        displayId: rowId,
                    });
                    imported++;
                } catch { failed++; }
            }
            alert(`✅ Import complete: ${imported} added${failed ? `, ${failed} failed` : ''}`);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const filteredBuyers = buyers.filter(b => {
        const search = searchTerm.toLowerCase().trim();
        if (!search) return true;
        
        return (
            (b.name || '').toLowerCase().includes(search) ||
            (b.contact || '').toLowerCase().includes(search) ||
            (b.displayId?.toString() === search) ||
            (b.displayId?.toString().includes(search))
        );
    });

    const formatCurrency = (n) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

    return (
        <div className="bg-white/70 backdrop-blur-xl rounded-[40px] border border-gray-100 shadow-premium p-10 animate-in fade-in slide-in-from-bottom-5 duration-700">

            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-indigo-50 rounded-[28px] flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-100/50">
                        <User size={36} />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black text-gray-800 tracking-tighter font-heading">{t('buyer')}</h2>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] pt-1">Management Console</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[320px]">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder={t('search')}
                            className="w-full pl-14 pr-8 py-4.5 border-2 border-emerald-500/30 rounded-full text-lg font-black text-gray-700 bg-white/50 focus:bg-white focus:border-emerald-500 outline-none focus:ring-8 focus:ring-emerald-50 transition-all placeholder:text-gray-300 shadow-inner"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDownloadTemplate}
                            className="flex items-center gap-2 px-6 py-4 bg-indigo-50 text-indigo-600 rounded-full text-[13px] font-black hover:bg-indigo-600 hover:text-white transition-all active:scale-95 border border-indigo-100 shadow-sm uppercase tracking-wider"
                        >
                            <FileText size={18} /> {t('template')}
                        </button>

                        <button
                            onClick={() => importRef.current?.click()}
                            className="flex items-center gap-2 px-6 py-4 bg-white text-gray-700 rounded-full text-[13px] font-black hover:bg-gray-50 transition-all active:scale-95 border border-gray-200 shadow-sm uppercase tracking-wider"
                        >
                            <Upload size={18} className="text-blue-500" /> {t('import')}
                            <input
                                type="file"
                                ref={importRef}
                                hidden
                                accept=".csv"
                                onChange={handleImportCSV}
                            />
                        </button>

                        <button
                            onClick={() => handleOpenModal()}
                            className="flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white rounded-full text-[13px] font-black hover:bg-emerald-600 transition-all active:scale-95 shadow-xl shadow-emerald-500/20 uppercase tracking-widest"
                        >
                            <Plus size={20} /> {t('addCustomer')}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Gap Divider ── */}
            <div className="mt-12 mb-12 border-t border-gray-100" />

            {/* ── Table ── */}
            {/* ── Table ── */}
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{t('id')}</th>
                            <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{t('name')}</th>
                            <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{t('contact')}</th>
                            <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{t('amountDue')}</th>
                            <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{t('ledger')}</th>
                            <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredBuyers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-24 text-center text-gray-300 italic font-medium">
                                    {t('noRecords')}
                                </td>
                            </tr>
                        ) : (
                            filteredBuyers.map((buyer) => (
                                <tr key={buyer.id} className="group hover:bg-gray-50/50 transition-all duration-300">
                                    <td className="px-6 py-6">
                                        <div className="w-12 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-[10px] font-black text-emerald-600 shadow-sm border border-emerald-100/50">
                                            #{buyer.displayId}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <p className="text-lg font-black text-gray-800 tracking-tight font-heading group-hover:text-emerald-600 transition-colors uppercase">
                                            {buyer.name}
                                        </p>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-2 text-gray-500 font-bold text-sm">
                                            <Phone size={14} className="opacity-40" />
                                            {buyer.contact || '—'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-2">
                                            <Wallet size={16} className="text-emerald-400" />
                                            <span className={`text-xl font-black ${buyer.balance > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                {formatCurrency(buyer.balance)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm">
                                            <FileText size={14} /> {t('view')}
                                        </button>
                                    </td>
                                    <td className="px-6 py-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={() => handleOpenModal(buyer)}
                                                className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(buyer.id)}
                                                className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Modal ── */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.2)] overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
                        
                        {/* Header */}
                        <div className="px-8 py-8 flex items-center justify-between border-b border-gray-100">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-emerald-50 rounded-2xl">
                                    <User size={32} className="text-[#22c55e]" />
                                </div>
                                <h3 className="text-3xl font-black text-gray-800 tracking-tight">
                                    {currentBuyer.id ? t('editCustomer') : t('addCustomer')}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-300 hover:text-slate-500 transition-colors"
                            >
                                <X size={32} />
                            </button>
                        </div>

                        {/* Modal Form Content */}
                        <form onSubmit={handleSave} className="flex flex-col">
                            <div className="px-8 py-8 space-y-6">
                                {/* ID Section */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-500 ml-1">{t('id')}</label>
                                    <input
                                        type="text"
                                        disabled
                                        className="w-full px-5 py-4 rounded-xl border-none bg-[#f1f5f9] font-bold text-slate-600 text-lg"
                                        value={currentBuyer.displayId}
                                    />
                                </div>

                                {/* Name Input */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-500 ml-1">{t('name')} *</label>
                                    <input
                                        type="text"
                                        className="w-full px-5 py-4 rounded-xl border border-slate-100 bg-[#f8fafc] focus:bg-white focus:border-[#22c55e] outline-none font-bold text-slate-800 transition-all placeholder:font-normal placeholder:text-slate-300 shadow-sm"
                                        placeholder={t('name')}
                                        value={currentBuyer.name}
                                        onChange={(e) => setCurrentBuyer({ ...currentBuyer, name: e.target.value })}
                                        required
                                        autoFocus
                                    />
                                </div>

                                {/* Contact Input */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-500 ml-1">{t('contact')} *</label>
                                    <input
                                        type="text"
                                        className="w-full px-5 py-4 rounded-xl border border-slate-100 bg-[#f8fafc] focus:bg-white focus:border-[#22c55e] outline-none font-bold text-slate-800 transition-all placeholder:font-normal placeholder:text-slate-300 shadow-sm"
                                        placeholder={t('contact')}
                                        value={currentBuyer.contact}
                                        onChange={(e) => setCurrentBuyer({ ...currentBuyer, contact: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Initial Dues Input */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-500 ml-1">{t('initialDues')}</label>
                                    <input
                                        type="number"
                                        className="w-full px-5 py-4 rounded-xl border border-slate-100 bg-[#f8fafc] focus:bg-white focus:border-[#22c55e] outline-none font-black text-[#22c55e] text-xl transition-all shadow-sm"
                                        value={currentBuyer.balance}
                                        onChange={(e) => setCurrentBuyer({ ...currentBuyer, balance: e.target.value })}
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Footer Buttons */}
                            <div className="px-8 py-6 border-t border-slate-50 bg-[#f9fafb] flex items-center justify-end gap-4 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-8 py-3 rounded-xl border border-slate-300 bg-white text-slate-500 font-bold text-lg hover:bg-slate-50 transition-all active:scale-95"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={`px-10 py-3 rounded-xl border-2 border-[#22c55e] bg-white text-[#22c55e] font-black text-lg transition-all active:scale-95 hover:bg-emerald-50 ${isSaving ? 'opacity-50' : ''}`}
                                >
                                    {isSaving ? 'Saving...' : (currentBuyer.id ? t('update') : t('register'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Buyer;
