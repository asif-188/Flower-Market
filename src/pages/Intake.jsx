import React, { useState, useEffect } from 'react';
import { Plus, Calendar, User, Trash2, Users, ShoppingBag, Tag, Calculator, Package, Save, Printer, CheckCircle2 } from 'lucide-react';
import { saveIntake, subscribeToCollection, db } from '../utils/storage';
import { doc, updateDoc, increment } from 'firebase/firestore';

const FLOWER_TYPES = [
    'Rose / ரோஜா',
    'Malligai / மல்லிகை',
    'Samanthi / சாமந்தி',
    'Mullai / முல்லை',
    'Arali / அரளி',
    'Tulip / டியூலிப்'
];

const Intake = () => {
    const [farmers, setFarmers] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [formData, setFormData] = useState({
        farmerId: '',
        date: new Date().toISOString().split('T')[0]
    });

    const [currentItem, setCurrentItem] = useState({
        flowerType: '',
        quantity: '',
        price: '',
        unit: 'Kg'
    });

    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState({
        outstanding: 0,
        amountPaid: ''
    });

    useEffect(() => {
        const unsubscribeFarmers = subscribeToCollection('farmers', setFarmers);
        const unsubscribeBuyers = subscribeToCollection('buyers', setBuyers);
        return () => {
            unsubscribeFarmers();
            unsubscribeBuyers();
        };
    }, []);

    useEffect(() => {
        if (formData.farmerId) {
            const farmer = farmers.find(f => f.id === formData.farmerId);
            setSummary(prev => ({ ...prev, outstanding: farmer?.balance || 0 }));
        }
    }, [formData.farmerId, farmers]);

    const handleAddItem = (e) => {
        if (e) e.preventDefault();
        if (!currentItem.flowerType || !currentItem.quantity || !currentItem.price) return;
        const newItem = {
            id: Date.now(),
            ...currentItem,
            total: parseFloat(currentItem.quantity) * parseFloat(currentItem.price)
        };
        setItems([...items, newItem]);
        setCurrentItem({ flowerType: '', quantity: '', price: '', unit: 'Kg' });
    };

    const handleRemoveItem = (id) => setItems(items.filter(item => item.id !== id));

    const totalFlowerCost = items.reduce((sum, item) => sum + item.total, 0);
    const balanceAmount = totalFlowerCost - parseFloat(summary.amountPaid || 0);

    const handleSubmit = async () => {
        if (!formData.farmerId || items.length === 0) return;
        try {
            const farmer = farmers.find(f => f.id === formData.farmerId);
            const intakeBatch = {
                ...formData,
                farmerName: farmer?.name,
                items,
                summary: {
                    totalCost: totalFlowerCost,
                    amountPaid: parseFloat(summary.amountPaid || 0),
                    newBalance: balanceAmount
                },
                timestamp: new Date().toISOString()
            };

            // 1. Save Intake Record
            await saveIntake(intakeBatch);

            // 2. Update Farmer Balance (Increment debt by net change)
            const farmerRef = doc(db, 'farmers', formData.farmerId);
            await updateDoc(farmerRef, {
                balance: increment(balanceAmount)
            });


            alert('✅ Purchase Saved & Balance Updated!');
            setItems([]);
            setSummary({ outstanding: balanceAmount, amountPaid: '' });
        } catch (error) {
            console.error("Error saving intake:", error);
            alert("❌ Failed to save purchase.");
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-700">
            {/* Purchase Entry Form */}
            <div className="flex-1 space-y-8">
                <div className="bg-white rounded-[40px] shadow-2xl border border-gray-100 p-10">
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-emerald-600 text-white rounded-[20px] flex items-center justify-center shadow-lg -rotate-3">
                                <ShoppingBag size={32} />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-gray-800 tracking-tighter italic">Purchase Entry</h1>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Farmer Inward Logistics</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Entry Date / தேதி</p>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="bg-gray-50 border-none rounded-2xl p-3 font-black text-emerald-600 outline-none focus:ring-4 focus:ring-emerald-50 transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Farmer Selection Card */}
                    <div className="bg-emerald-50/50 rounded-3xl p-6 border-2 border-emerald-100/50 mb-10 flex flex-wrap lg:flex-nowrap items-center gap-6">
                        <div className="flex-1 min-w-[300px]">
                            <label className="block text-xs font-black text-emerald-600 uppercase tracking-widest mb-2 pl-2">Farmer / விவசாயி 👨‍🌾</label>
                            <select
                                value={formData.farmerId}
                                onChange={e => setFormData({ ...formData, farmerId: e.target.value })}
                                className="w-full p-4 border-none rounded-2xl outline-none bg-white font-black text-gray-700 shadow-xl focus:ring-4 focus:ring-emerald-200"
                            >
                                <option value="">Select Farmer Name</option>
                                {farmers.map(f => (
                                    <option key={f.id} value={f.id}>{f.name} — Balance: ₹{f.balance || 0}</option>
                                ))}
                            </select>
                        </div>
                        <div className="hidden lg:block h-12 w-1 bg-emerald-200/50 rounded-full"></div>
                        <div className="flex items-center gap-4 bg-white/50 px-6 py-4 rounded-2xl border border-white">
                             <div className="text-center">
                                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Outstanding</p>
                                 <p className="text-xl font-black text-red-500 tracking-tight">₹{summary.outstanding.toFixed(2)}</p>
                             </div>
                        </div>
                    </div>

                    {/* Item Entry Grid */}
                    <div className="bg-gray-50/30 border-4 border-dashed border-gray-100 rounded-[40px] p-8 mb-10">
                        <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-4">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 pl-2 flex items-center gap-2">
                                    <Tag size={12} /> Flower / பூ வகை
                                </label>
                                <select 
                                    className="w-full p-5 rounded-[20px] bg-white border-none shadow-xl focus:ring-4 focus:ring-emerald-400/20 font-black text-gray-800 transition-all outline-none appearance-none"
                                    value={currentItem.flowerType}
                                    onChange={(e) => setCurrentItem({...currentItem, flowerType: e.target.value})}
                                >
                                    <option value="">Select...</option>
                                    {FLOWER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 pl-2 flex items-center gap-2">
                                    <Calculator size={12} /> Weight / அளவு
                                </label>
                                <div className="flex shadow-xl rounded-[20px] overflow-hidden bg-white">
                                    <input
                                        type="number"
                                        value={currentItem.quantity}
                                        onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                                        className="w-full p-5 border-none bg-transparent outline-none font-black text-2xl text-emerald-600"
                                        placeholder="0"
                                        required
                                    />
                                    <div className="bg-emerald-600 text-white p-5 font-black uppercase text-xs">Kg</div>
                                </div>
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 pl-2 flex items-center gap-2">
                                    <Package size={12} /> Price / விலை
                                </label>
                                <div className="bg-white rounded-[20px] p-5 shadow-xl flex items-center">
                                    <span className="text-2xl font-black text-emerald-500 mr-2">₹</span>
                                    <input
                                        type="number"
                                        value={currentItem.price}
                                        onChange={e => setCurrentItem({ ...currentItem, price: e.target.value })}
                                        className="w-full bg-transparent border-none outline-none font-black text-2xl text-gray-800"
                                        placeholder="0"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2 flex justify-center">
                                <button type="submit" className="w-20 h-20 bg-emerald-600 text-white rounded-full flex items-center justify-center hover:bg-emerald-700 shadow-2xl transition-all transform hover:scale-110 active:scale-95 group">
                                    <Plus size={40} className="group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Items Table */}
                    <div className="bg-white border border-gray-50 rounded-[30px] overflow-hidden">
                        <table className="w-full border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-emerald-50/30">
                                    <th className="px-6 py-5 text-xs font-black text-emerald-800 uppercase tracking-widest text-left">Purchased Items</th>
                                    <th className="px-6 py-5 text-xs font-black text-emerald-800 uppercase tracking-widest text-center">Batch Qty</th>
                                    <th className="px-6 py-5 text-xs font-black text-emerald-800 uppercase tracking-widest text-right">Rate (₹)</th>
                                    <th className="px-6 py-5 text-xs font-black text-emerald-800 uppercase tracking-widest text-right">Total (₹)</th>
                                    <th className="px-6 py-5 text-xs font-black text-emerald-800 uppercase tracking-widest text-center">Delete</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {items.map((item) => (
                                    <tr key={item.id} className="group hover:bg-emerald-50/20 transition-colors">
                                        <td className="px-6 py-6">
                                            <span className="font-black text-gray-800 text-lg tracking-tight italic">🌾 {item.flowerType}</span>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <span className="px-4 py-2 bg-white shadow-sm border border-emerald-50 rounded-full font-black text-emerald-600 text-sm">
                                                {item.quantity} Kg
                                            </span>
                                        </td>
                                        <td className="px-6 py-6 text-right font-bold text-gray-400 italic">₹{item.price}</td>
                                        <td className="px-6 py-6 text-right font-black text-emerald-700 text-xl tracking-tighter">₹{item.total.toFixed(2)}</td>
                                        <td className="px-6 py-6 text-center">
                                            <button onClick={() => handleRemoveItem(item.id)} className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                                                <Trash2 size={24} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="py-24 text-center">
                                            <div className="opacity-20 flex flex-col items-center gap-4">
                                                <Package size={80} />
                                                <p className="text-xl font-black uppercase tracking-[0.2em] italic">No Purchase Data</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Inward Summary Panel */}
            <div className="w-full lg:w-[450px]">
                <div className="bg-emerald-600 rounded-[50px] shadow-2xl p-10 text-white sticky top-10 flex flex-col h-[85vh] overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-emerald-200 font-bold uppercase tracking-[0.3em] text-xs mb-4">Total Cost of Goods</h3>
                        <div className="mb-10 animate-in slide-in-from-right duration-500">
                             <div className="text-xs font-bold text-emerald-100/50 mb-1 ml-1 tracking-widest">INWARD TOTAL</div>
                             <div className="text-7xl font-black tracking-tighter shadow-emerald-700/50 drop-shadow-2xl">
                                ₹{totalFlowerCost.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                             </div>
                             <p className="text-emerald-300 font-black text-xl italic mt-1 ml-1 opacity-70">Calculated Batch Cost</p>
                        </div>

                        <div className="space-y-8 pt-10 border-t border-white/10 mb-auto">
                            <div className="space-y-3">
                                <label className="block text-xs font-black text-emerald-100 uppercase tracking-widest pl-1">Cash Paid to Farmer</label>
                                <div className="bg-emerald-700/50 rounded-2xl border-2 border-white/20 p-2 flex items-center">
                                    <span className="text-2xl font-black px-4">₹</span>
                                    <input
                                        type="number"
                                        value={summary.amountPaid}
                                        onChange={e => setSummary({ ...summary, amountPaid: e.target.value })}
                                        className="w-full bg-transparent border-none outline-none font-black text-2xl placeholder-emerald-400/50"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-emerald-100 font-bold text-lg pt-4 border-t border-white/5">
                                <span className="uppercase tracking-tighter text-sm">Remaining Due</span>
                                <span className="font-black text-3xl tracking-tighter">₹{balanceAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Block */}
                    <div className="mt-auto relative z-10 space-y-6">
                        <button
                            onClick={handleSubmit}
                            disabled={items.length === 0 || !formData.farmerId}
                            className={`w-full py-8 rounded-[32px] flex items-center justify-center gap-4 font-black text-2xl uppercase tracking-[0.1em] transition-all shadow-2xl ${
                                 items.length > 0 && formData.farmerId
                                ? 'bg-white text-emerald-600 hover:scale-[1.05] active:scale-95'
                                : 'bg-white/10 text-white/20 cursor-not-allowed'
                            }`}
                        >
                            <Save size={32} />
                            Log Purchase
                        </button>
                        
                        <div className="flex gap-4">
                            <button className="flex-1 py-5 rounded-[24px] bg-emerald-700/50 border-2 border-white/10 flex items-center justify-center gap-3 font-black text-sm uppercase hover:bg-emerald-500 transition-colors">
                                <Printer size={20} /> Bill Print
                            </button>
                            <button className="flex-1 py-5 rounded-[24px] bg-emerald-700/50 border-2 border-white/10 flex items-center justify-center gap-3 font-black text-sm uppercase hover:bg-emerald-500 transition-colors">
                                <CheckCircle2 size={20} /> Review
                            </button>
                        </div>
                    </div>

                    <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
                </div>
            </div>
        </div>
    );
};

export default Intake;
