import React, { useState, useEffect } from 'react';
import { Plus, Calendar, User, Trash2, Users } from 'lucide-react';
import { getFarmers, saveIntake, getBuyers } from '../utils/storage';

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

    // Item Entry State
    const [currentItem, setCurrentItem] = useState({
        flowerType: '',
        quantity: '',
        price: ''
    });

    // Batch State
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState({
        outstanding: 0,
        amountPaid: ''
    });

    useEffect(() => {
        setFarmers(getFarmers());
        setBuyers(getBuyers());
    }, []);

    // Update outstanding when farmer changes
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
        setCurrentItem({ flowerType: '', quantity: '', price: '' });
    };

    const handleRemoveItem = (id) => {
        setItems(items.filter(item => item.id !== id));
    };

    // Calculations
    const totalFlowerCost = items.reduce((sum, item) => sum + item.total, 0);
    const netTotal = totalFlowerCost; // Removed Commission
    const balanceAmount = totalFlowerCost - parseFloat(summary.amountPaid || 0);

    const handleSubmit = () => {
        if (!formData.farmerId || items.length === 0) return;

        const farmer = farmers.find(f => f.id === formData.farmerId);
        const intakeBatch = {
            ...formData,
            farmerName: farmer?.name,
            items,
            summary: {
                totalCost: totalFlowerCost,
                netTotal,
                amountPaid: parseFloat(summary.amountPaid || 0),
                newBalance: balanceAmount
            },
            timestamp: new Date().toISOString()
        };

        saveIntake(intakeBatch);

        alert('Purchase Saved Successfully!');
        // Reset
        setItems([]);
        setSummary({ outstanding: balanceAmount, amountPaid: '' });
        setFormData(prev => ({ ...prev }));
    };

    return (
        <div className="p-4 max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-emerald-600 mb-1">New Purchase Entry</h2>
                    <p className="text-gray-500 font-medium">Log details of flowers purchased from farmers.</p>
                </div>

                {/* Top Form: Farmer & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Farmer / விவசாயி</label>
                        <select
                            value={formData.farmerId}
                            onChange={e => setFormData({ ...formData, farmerId: e.target.value })}
                            className="w-full p-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all outline-none text-gray-700 bg-gray-50/50"
                        >
                            <option value="">Select Farmer Name</option>
                            {farmers.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">விற்பனை தேதி</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full p-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all outline-none text-gray-700 bg-gray-50/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Middle Form: Add Items */}
                <div className="bg-gray-50/30 border-2 border-dashed border-gray-200 rounded-2xl p-6 mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Flower Type</label>
                            <select
                                value={currentItem.flowerType}
                                onChange={e => setCurrentItem({ ...currentItem, flowerType: e.target.value })}
                                className="w-full p-3 border-2 border-white rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            >
                                <option value="">Select Flower Type</option>
                                {FLOWER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">எடை / அளவு</label>
                            <input
                                type="number"
                                placeholder="e.g. 100"
                                value={currentItem.quantity}
                                onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                                className="w-full p-3 border-2 border-white rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Price / விலை</label>
                            <input
                                type="number"
                                placeholder="e.g. 80"
                                value={currentItem.price}
                                onChange={e => setCurrentItem({ ...currentItem, price: e.target.value })}
                                className="w-full p-3 border-2 border-white rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Total</label>
                            <div className="w-full p-3 border-2 border-transparent rounded-xl bg-gray-100 font-bold text-gray-600">
                                ₹{(parseFloat(currentItem.quantity || 0) * parseFloat(currentItem.price || 0)).toFixed(2)}
                            </div>
                        </div>
                        <div className="md:col-span-2 flex justify-center">
                            <button
                                onClick={handleAddItem}
                                className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center hover:bg-emerald-700 shadow-lg hover:shadow-emerald-200 transition-all transform hover:scale-110 active:scale-95"
                            >
                                <Plus size={32} />
                            </button>
                        </div>
                    </div>
                </div>



                {/* Table */}
                <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden mb-10 shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/80 border-b-2 border-gray-100">
                            <tr>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Flower</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Qty</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Price</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Total</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Remove</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {items.map(item => (
                                <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors">
                                    <td className="p-4 font-bold text-gray-700">{item.flowerType}</td>
                                    <td className="p-4 text-center text-gray-600">{item.quantity}</td>
                                    <td className="p-4 text-right text-gray-600">₹{item.price}</td>
                                    <td className="p-4 text-right font-bold text-emerald-700">₹{item.total.toFixed(2)}</td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => handleRemoveItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-white rounded-full">
                                            <Trash2 size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr><td colSpan="5" className="p-12 text-center text-gray-400 font-medium italic">No items added yet. Click the + button to start.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Bottom Summary Section */}
                <div className="flex flex-col md:flex-row gap-10 items-end justify-between border-t-2 border-gray-50 pt-10">
                    <div className="bg-emerald-50/50 rounded-3xl p-8 w-full md:max-w-sm border-2 border-emerald-100 shadow-sm">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-gray-600">
                                <span className="font-bold uppercase text-xs tracking-wider">Total</span>
                                <span className="font-black text-lg">₹{totalFlowerCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t-2 border-emerald-100/50">
                                <span className="font-bold uppercase text-xs tracking-wider text-emerald-800">Debit</span>
                                <input
                                    type="number"
                                    value={summary.amountPaid}
                                    onChange={e => setSummary({ ...summary, amountPaid: e.target.value })}
                                    className="w-32 p-3 text-right bg-white border-2 border-emerald-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none font-bold text-emerald-900 transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="flex justify-between items-center pt-4 mt-2">
                                <span className="font-black uppercase text-sm tracking-widest text-gray-900">Total</span>
                                <span className="font-black text-2xl text-emerald-600">₹{balanceAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                         <button className="p-4 border-2 border-gray-100 rounded-full hover:bg-emerald-50 hover:border-emerald-200 transition-all text-gray-400 hover:text-emerald-600 shadow-sm">
                            <Plus size={24} />
                         </button>
                         <button
                            onClick={handleSubmit}
                            className="bg-emerald-600 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_20px_-5px_rgba(5,150,105,0.3)] hover:bg-emerald-700 hover:shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0"
                        >
                            Submit Purchase
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Intake;
