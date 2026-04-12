import React, { useState, useEffect } from 'react';
import { FileText, Search, User, Users, ArrowUpRight, ArrowDownRight, Wallet, History, Landmark, ShieldCheck } from 'lucide-react';
import { subscribeToCollection } from '../utils/storage';

const Accounts = () => {
    const [farmers, setFarmers] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [activeTab, setActiveTab] = useState('farmers');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsubFarmers = subscribeToCollection('farmers', setFarmers);
        const unsubBuyers = subscribeToCollection('buyers', setBuyers);
        return () => {
            unsubFarmers();
            unsubBuyers();
        };
    }, []);

    const filteredData = (activeTab === 'farmers' ? farmers : buyers).filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const totalFarmerBalance = farmers.reduce((sum, f) => sum + (f.balance || 0), 0);
    const totalBuyerBalance = buyers.reduce((sum, b) => sum + (b.balance || 0), 0);

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Top Stat Cluster */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-gray-100 flex items-center justify-between group hover:border-blue-500 transition-all cursor-default">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Total Farmer Payables</p>
                        <h4 className="text-4xl font-black text-gray-800 tracking-tighter italic">{formatCurrency(totalFarmerBalance)}</h4>
                        <div className="flex items-center gap-2 mt-4 text-emerald-500 font-bold text-xs uppercase tracking-widest pl-1">
                             <ShieldCheck size={14} /> Secured Balance
                        </div>
                    </div>
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[28px] flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:rotate-12">
                        <ArrowUpRight size={38} />
                    </div>
                </div>

                <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-gray-100 flex items-center justify-between group hover:border-purple-500 transition-all cursor-default">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Total Buyer Receivables</p>
                        <h4 className="text-4xl font-black text-gray-800 tracking-tighter italic">{formatCurrency(totalBuyerBalance)}</h4>
                        <div className="flex items-center gap-2 mt-4 text-emerald-500 font-bold text-xs uppercase tracking-widest pl-1">
                             <ShieldCheck size={14} /> Global Sync active
                        </div>
                    </div>
                    <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-[28px] flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all transform group-hover:-rotate-12">
                        <ArrowDownRight size={38} />
                    </div>
                </div>

                <div className="bg-emerald-600 rounded-[40px] p-8 shadow-2xl flex items-center justify-between text-white relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-emerald-200 uppercase tracking-[0.2em] mb-2">Market Liquidity</p>
                        <h4 className="text-4xl font-black tracking-tighter italic">Healthy</h4>
                        <div className="mt-4 px-4 py-1 bg-white/20 rounded-full inline-block text-[10px] font-black uppercase tracking-widest">System Operational</div>
                    </div>
                    <Landmark size={80} className="text-emerald-500/30 absolute -right-4 -bottom-4 group-hover:scale-110 transition-transform" />
                </div>
            </div>

            {/* Ledger Interface */}
            <div className="bg-white rounded-[40px] shadow-2xl border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50/50 flex gap-4">
                    <button 
                        onClick={() => setActiveTab('farmers')}
                        className={`flex-1 py-6 rounded-[28px] flex items-center justify-center gap-4 font-black uppercase tracking-widest transition-all ${activeTab === 'farmers' ? 'bg-white text-blue-600 shadow-xl scale-[1.02]' : 'text-gray-400 hover:text-gray-700 hover:bg-white/50'}`}
                    >
                        <History size={24} />
                        Farmer Ledger
                    </button>
                    <button 
                        onClick={() => setActiveTab('buyers')}
                        className={`flex-1 py-6 rounded-[28px] flex items-center justify-center gap-4 font-black uppercase tracking-widest transition-all ${activeTab === 'buyers' ? 'bg-white text-purple-600 shadow-xl scale-[1.02]' : 'text-gray-400 hover:text-gray-700 hover:bg-white/50'}`}
                    >
                        <Wallet size={24} />
                        Buyer Ledger
                    </button>
                </div>

                <div className="p-10 flex flex-col md:flex-row justify-between items-center gap-8 border-b border-gray-50">
                    <div className="relative flex-1 w-full max-w-2xl">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={24} />
                        <input 
                            type="text" 
                            placeholder={`Search identified ${activeTab}...`} 
                            className="w-full pl-16 pr-8 py-5 bg-gray-50/50 border-3 border-transparent rounded-[30px] outline-none focus:border-blue-400 focus:bg-white transition-all font-black text-gray-700 text-lg shadow-inner"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-4">
                         <button className="px-8 py-4 bg-gray-800 text-white rounded-full font-black uppercase tracking-widest text-xs hover:bg-black transition-all">Print Statements</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-gray-50/30">
                                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">{activeTab === 'farmers' ? 'Supplier Name' : 'Client Identity'}</th>
                                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Last Journal Entry</th>
                                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] text-right">Outstanding Bal (₹)</th>
                                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] text-center">Credit Risk</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredData.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 transition-all cursor-pointer group">
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-5">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${activeTab === 'farmers' ? 'bg-blue-100/50 text-blue-600' : 'bg-purple-100/50 text-purple-600'}`}>
                                                {activeTab === 'farmers' ? <User size={28} /> : <Users size={28} />}
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-800 text-xl tracking-tight italic">{item.name}</p>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">📍 {item.location || 'Regional Market'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="bg-gray-100 rounded-full px-4 py-2 inline-block">
                                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                                                {item.lastTxDate || 'Archive Ready'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                        <p className={`text-3xl font-black tracking-tighter ${item.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            ₹{(item.balance || 0).toLocaleString()}
                                        </p>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex justify-center">
                                            <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm border-2 ${
                                                item.balance > 10000 ? 'bg-red-50 text-red-600 border-red-100' : 
                                                item.balance > 0 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                            }`}>
                                                {item.balance > 10000 ? 'Critical' : item.balance > 0 ? 'Warning' : 'Verified'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="py-32 text-center opacity-30">
                                        <FileText size={80} className="mx-auto mb-4" />
                                        <p className="text-xl font-black uppercase tracking-widest">Empty Ledger entries</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Accounts;
