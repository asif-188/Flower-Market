
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, User, FileText, Download, Upload } from 'lucide-react';
import { saveFarmer, subscribeToCollection } from '../utils/storage';

const Farmer = () => {
    const [farmers, setFarmers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentFarmer, setCurrentFarmer] = useState({ id: '', name: '', contact: '', location: '', balance: 0 });

    useEffect(() => {
        const unsubscribe = subscribeToCollection('farmers', setFarmers);
        return () => unsubscribe();
    }, []);

    const handleOpenModal = (farmer = null) => {
        if (farmer) {
            setCurrentFarmer(farmer);
        } else {
            setCurrentFarmer({ id: '', name: '', contact: '', location: '', balance: 0 });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await saveFarmer(currentFarmer);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving farmer:", error);
            alert("Failed to save.");
        }
    };

    const filteredFarmers = farmers.filter(f =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.contact && f.contact.includes(searchTerm))
    );

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(amount);
    };

    return (
        <div className="bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden p-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
                        <User size={30} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-800 tracking-tight">Farmer Master</h2>
                </div>
                
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-6 py-2 bg-blue-50 text-blue-600 rounded-full font-bold text-sm hover:bg-blue-100 transition-colors border border-blue-100">
                        <Download size={16} /> Template
                    </button>
                    <button className="flex items-center gap-2 px-6 py-2 bg-gray-50 text-gray-600 rounded-full font-bold text-sm hover:bg-gray-100 transition-colors border border-gray-100">
                        <Upload size={16} className="text-orange-500" /> Import
                    </button>
                    <button 
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-6 py-2 bg-white text-orange-600 border-2 border-orange-500 rounded-full font-bold text-sm hover:bg-orange-50 transition-all shadow-sm"
                    >
                        <Plus size={18} /> Add Farmer
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="mb-10">
                <div className="relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search by name, ID or contact..." 
                        className="w-full pl-12 pr-6 py-3 border-2 border-orange-200 rounded-full outline-none focus:ring-4 focus:ring-orange-50 transition-all font-medium text-gray-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-orange-50/50">
                            <th className="px-6 py-4 text-xs font-black text-orange-800 uppercase tracking-widest text-left first:rounded-l-xl">ID</th>
                            <th className="px-6 py-4 text-xs font-black text-orange-800 uppercase tracking-widest text-left">Farmer Name / விவசாயி</th>
                            <th className="px-6 py-4 text-xs font-black text-orange-800 uppercase tracking-widest text-left">Contact</th>
                            <th className="px-6 py-4 text-xs font-black text-orange-800 uppercase tracking-widest text-left">Dues / நிலுவை (₹)</th>
                            <th className="px-6 py-4 text-xs font-black text-orange-800 uppercase tracking-widest text-left">Ledger</th>
                            <th className="px-6 py-4 text-xs font-black text-orange-800 uppercase tracking-widest text-left last:rounded-r-xl">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredFarmers.map((farmer, index) => (
                            <tr key={farmer.id} className="group hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-5 text-sm font-bold text-gray-400">#{(index + 1).toString().padStart(3, '0')}</td>
                                <td className="px-6 py-5">
                                    <span className="font-black text-gray-800 tracking-tight">{farmer.name}</span>
                                </td>
                                <td className="px-6 py-5 text-gray-600 font-medium">{farmer.contact || '---'}</td>
                                <td className="px-6 py-5 text-red-600 font-black">{formatCurrency(farmer.balance || 0)}</td>
                                <td className="px-6 py-5">
                                    <button className="flex items-center gap-2 px-4 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-bold border border-yellow-100 hover:bg-yellow-100 transition-colors">
                                        <FileText size={14} /> View
                                    </button>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleOpenModal(farmer)}
                                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredFarmers.length === 0 && (
                    <div className="py-20 text-center text-gray-400 font-bold italic tracking-wide">
                        No records found.
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-3xl">
                            <h3 className="text-xl font-black text-orange-900 tracking-tight">
                                {currentFarmer.id ? '✏️ Edit Farmer' : '👨‍🌾 New Farmer'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-8 space-y-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Farmer Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-5 py-4 rounded-2xl border-2 border-orange-50 bg-orange-50/10 focus:border-orange-500 focus:bg-white transition-all outline-none font-bold text-gray-700 shadow-sm" 
                                        value={currentFarmer.name}
                                        onChange={(e) => setCurrentFarmer({ ...currentFarmer, name: e.target.value })}
                                        placeholder="Full Name"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Contact Number</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-5 py-4 rounded-2xl border-2 border-orange-50 bg-orange-50/10 focus:border-orange-500 focus:bg-white transition-all outline-none font-bold text-gray-700 shadow-sm" 
                                        value={currentFarmer.contact}
                                        onChange={(e) => setCurrentFarmer({ ...currentFarmer, contact: e.target.value })}
                                        placeholder="Mobile Number"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 flex items-center justify-between border-t border-gray-100 mt-8">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2 text-gray-400 font-black uppercase tracking-widest hover:text-red-500 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-16 py-4 bg-orange-600 text-white rounded-full font-black uppercase tracking-widest hover:bg-orange-700 shadow-xl shadow-orange-100 transition-all transform hover:-translate-y-1 active:scale-95"
                                >
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

export default Farmer;
