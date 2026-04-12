import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, User, FileText, Download, Upload } from 'lucide-react';
import { saveBuyer, subscribeToCollection } from '../utils/storage';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/storage';

const Buyer = () => {
    const [buyers, setBuyers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentBuyer, setCurrentBuyer] = useState({ id: '', name: '', contact: '', balance: 0 });
    const [isSaving, setIsSaving] = useState(false);

    // ── Real-time Firestore listener ──
    useEffect(() => {
        const unsubscribe = subscribeToCollection('buyers', setBuyers);
        return () => unsubscribe();
    }, []);

    const handleOpenModal = (buyer = null) => {
        setCurrentBuyer(buyer
            ? { ...buyer }
            : { id: '', name: '', contact: '', balance: 0 }
        );
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
                displayId: currentBuyer.displayId || (100 + buyers.length + 1),
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

    const filteredBuyers = buyers.filter(b =>
        b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.contact?.includes(searchTerm) ||
        b.displayId?.toString().includes(searchTerm)
    );

    const formatCurrency = (n) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">

            {/* ── Page Header ── */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <User size={28} className="text-blue-600" />
                    <h2 className="text-2xl font-bold text-gray-800">Customer Master</h2>
                </div>

                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors">
                        <Download size={15} /> Template
                    </button>
                    <button className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors">
                        <Upload size={15} className="text-blue-500" /> Import
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-1.5 px-5 py-2 bg-white border-2 border-emerald-500 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-50 transition-colors"
                    >
                        <Plus size={16} /> Add Customer
                    </button>
                </div>
            </div>

            {/* ── Pill Search ── */}
            <div className="mb-6">
                <div className="relative max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name or ID..."
                        className="w-full pl-10 pr-5 py-2.5 border-2 border-emerald-500 rounded-full text-sm font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-gray-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Table ── */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-emerald-50 text-emerald-800">
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest rounded-l-xl">ID</th>
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest">Name</th>
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest">Contact</th>
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest">Amount Due (₹)</th>
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest">Ledger</th>
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest rounded-r-xl">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBuyers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-16 text-center text-gray-400 italic text-sm">
                                    No records found.
                                </td>
                            </tr>
                        ) : (
                            filteredBuyers.map((buyer, idx) => (
                                <tr key={buyer.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="px-5 py-4 text-sm font-bold text-emerald-600">
                                        {buyer.displayId || (100 + idx + 1)}
                                    </td>
                                    <td className="px-5 py-4 font-semibold text-gray-800">{buyer.name}</td>
                                    <td className="px-5 py-4 text-gray-500 text-sm">{buyer.contact || '—'}</td>
                                    <td className="px-5 py-4 font-bold text-emerald-700">{formatCurrency(buyer.balance)}</td>
                                    <td className="px-5 py-4">
                                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors">
                                            <FileText size={13} /> View
                                        </button>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleOpenModal(buyer)}
                                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(buyer.id)}
                                                className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
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
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <User size={20} className="text-emerald-500" />
                                <h3 className="text-lg font-bold text-emerald-700">
                                    {currentBuyer.id ? 'Edit Customer' : 'Add Customer'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSave} className="px-6 py-6 space-y-5">

                            {/* ID */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1.5">ID</label>
                                <div className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-gray-500 font-bold text-base">
                                    {currentBuyer.displayId || (100 + buyers.length + 1)}
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Name *</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 bg-white outline-none font-medium text-gray-800 text-sm transition-all"
                                    value={currentBuyer.name}
                                    onChange={(e) => setCurrentBuyer({ ...currentBuyer, name: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* Contact */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Contact *</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 bg-white outline-none font-medium text-gray-800 text-sm transition-all"
                                    value={currentBuyer.contact}
                                    onChange={(e) => setCurrentBuyer({ ...currentBuyer, contact: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Initial Dues */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Initial Dues (₹)</label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 bg-white outline-none font-bold text-gray-800 text-base transition-all"
                                    value={currentBuyer.balance}
                                    onChange={(e) => setCurrentBuyer({ ...currentBuyer, balance: e.target.value })}
                                    min="0"
                                />
                            </div>

                            {/* Footer buttons */}
                            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={`px-7 py-2.5 rounded-lg border-2 border-emerald-500 text-emerald-600 font-bold text-sm hover:bg-emerald-50 transition-all active:scale-95 ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                    {isSaving ? 'Saving…' : (currentBuyer.id ? 'Update' : 'Register')}
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
