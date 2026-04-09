
import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, User, Plus, Trash2, Printer, Save } from 'lucide-react';
import { getBuyers, saveSale, getFarmers } from '../utils/storage';

const FLOWER_TYPES = [
    'Rose / ரோஜா',
    'Malligai / மல்லிகை',
    'Samanthi / சாமந்தி',
    'Mullai / முல்லை',
    'Arali / அரளி',
    'Tulip / டியூலிப்'
];

const Sales = () => {
    const [buyers, setBuyers] = useState([]);
    const [farmers, setFarmers] = useState([]);
    const [cart, setCart] = useState([]);
    const [billDetails, setBillDetails] = useState({
        buyerId: '',
        date: new Date().toISOString().split('T')[0]
    });

    // Item entry state
    const [currentItem, setCurrentItem] = useState({
        flowerType: '',
        quantity: '',
        price: '',
        unit: 'Kg'
    });

    useEffect(() => {
        setBuyers(getBuyers());
        setFarmers(getFarmers()); // If we need to link sales to farmers later
    }, []);

    const addItem = (e) => {
        e.preventDefault();
        if (!currentItem.flowerType || !currentItem.quantity || !currentItem.price) return;

        const total = parseFloat(currentItem.quantity) * parseFloat(currentItem.price);
        const newItem = {
            ...currentItem,
            id: Date.now(),
            total
        };

        setCart([...cart, newItem]);
        setCurrentItem({ flowerType: '', quantity: '', price: '', unit: 'Kg' });
    };

    const removeItem = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const calculateGrandTotal = () => {
        return cart.reduce((sum, item) => sum + item.total, 0);
    };

    const handleSaveBill = () => {
        if (!billDetails.buyerId || cart.length === 0) return;

        const buyer = buyers.find(b => b.id === billDetails.buyerId);
        const saleData = {
            ...billDetails,
            buyerName: buyer?.name || 'Unknown',
            items: cart,
            grandTotal: calculateGrandTotal()
        };

        saveSale(saleData);
        alert('Bill Saved Successfully!');

        // Reset
        setCart([]);
        setBillDetails(prev => ({ ...prev, buyerId: '' }));
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
            {/* Left: Billing Form */}
            <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                    <div className="mb-8 flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-bold text-emerald-600 mb-1">New Sales Entry</h2>
                            <p className="text-gray-500 font-medium">Log details of flowers sold to customers.</p>
                        </div>
                        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-bold border border-emerald-100">
                             Invoice # {Date.now().toString().slice(-6)}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Farmer / விவசாயி</label>
                            <select
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
                            <input
                                type="date"
                                value={billDetails.date}
                                onChange={e => setBillDetails({ ...billDetails, date: e.target.value })}
                                className="w-full p-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all outline-none text-gray-700 bg-gray-50/50"
                            />
                        </div>
                    </div>

                    {/* Item Entry Area */}
                    <div className="bg-gray-50/30 border-2 border-dashed border-gray-200 rounded-2xl p-6 mb-8">
                        <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Flower Type</label>
                                <select
                                    value={currentItem.flowerType}
                                    onChange={e => setCurrentItem({ ...currentItem, flowerType: e.target.value })}
                                    className="w-full p-3 border-2 border-white rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                    required
                                >
                                    <option value="">Select Flower Type</option>
                                    {FLOWER_TYPES.map(type => (
                                        <option key={type} value={type}>{type.split(' / ')[0]}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">எடை / அளவு</label>
                                <div className="flex">
                                    <input
                                        type="number"
                                        value={currentItem.quantity}
                                        onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                                        className="w-full p-3 border-2 border-white rounded-l-xl bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                        placeholder="0"
                                        required
                                    />
                                    <select
                                        value={currentItem.unit}
                                        onChange={e => setCurrentItem({ ...currentItem, unit: e.target.value })}
                                        className="bg-emerald-50 border-2 border-l-0 border-white rounded-r-xl px-3 text-sm font-bold text-emerald-700 outline-none"
                                    >
                                        <option>Kg</option>
                                        <option>Bunch</option>
                                    </select>
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Price / விலை</label>
                                <input
                                    type="number"
                                    value={currentItem.price}
                                    onChange={e => setCurrentItem({ ...currentItem, price: e.target.value })}
                                    className="w-full p-3 border-2 border-white rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                    placeholder="Rate"
                                    required
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Total</label>
                                <div className="w-full p-3 border-2 border-transparent rounded-xl bg-gray-100 font-bold text-gray-600">
                                    ₹{(parseFloat(currentItem.quantity || 0) * parseFloat(currentItem.price || 0)).toFixed(2)}
                                </div>
                            </div>
                            <div className="md:col-span-2 flex justify-center">
                                <button type="submit" className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center hover:bg-emerald-700 shadow-lg hover:shadow-emerald-200 transition-all transform hover:scale-110 active:scale-95">
                                    <Plus size={32} />
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Customer Selection Block */}
                    <div className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100 mb-8 flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-emerald-700 mb-1 uppercase">Select Customer / வாடிக்கையாளர்</label>
                            <select
                                value={billDetails.buyerId}
                                onChange={e => setBillDetails({ ...billDetails, buyerId: e.target.value })}
                                className="w-full p-2 border border-emerald-200 rounded-lg outline-none bg-white font-medium"
                            >
                                <option value="">Select Customer Name</option>
                                {buyers.map(b => (
                                    <option key={b.id} value={b.id}>{b.name} - {b.location}</option>
                                ))}
                            </select>
                        </div>
                        <button className="mt-5 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center hover:bg-emerald-700 transition-all shadow-md">
                            <Plus size={20} />
                        </button>
                    </div>

                    {/* Cart Table */}
                    <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden shadow-sm">
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
                                {cart.map((item) => (
                                    <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors">
                                        <td className="p-4 font-bold text-gray-700">{item.flowerType}</td>
                                        <td className="p-4 text-center text-gray-600">
                                            {item.quantity} <span className="text-xs font-bold text-emerald-600">{item.unit}</span>
                                        </td>
                                        <td className="p-4 text-right text-gray-600">₹{item.price}</td>
                                        <td className="p-4 text-right font-bold text-emerald-700">₹{item.total.toFixed(2)}</td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-white rounded-full">
                                                <Trash2 size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {cart.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="p-12 text-center text-gray-400 font-medium italic">
                                            No items added yet. Click the + button to start.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Right: Summary & Actions */}
            <div className="lg:col-span-1">
                <div className="bg-emerald-600 rounded-3xl shadow-2xl p-8 text-white sticky top-24 transform hover:scale-[1.02] transition-transform">
                    <div className="mb-10">
                        <h3 className="text-emerald-100 font-bold uppercase tracking-widest text-sm mb-2">Grand Total</h3>
                        <div className="text-6xl font-black">
                            ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="space-y-4 pt-8 border-t border-emerald-500/50 mb-10">
                        <div className="flex justify-between items-center text-emerald-50 font-medium">
                            <span>Sub Total</span>
                            <span className="font-bold text-lg">₹{calculateGrandTotal().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-6 mt-2 border-t border-emerald-500/50">
                            <span className="font-black uppercase tracking-widest text-sm">Net Payable</span>
                            <span className="font-black text-3xl">₹{calculateGrandTotal().toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleSaveBill}
                            disabled={cart.length === 0 || !billDetails.buyerId}
                            className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest transition-all shadow-lg ${cart.length > 0 && billDetails.buyerId
                                    ? 'bg-white text-emerald-600 hover:bg-emerald-50 hover:shadow-2xl'
                                    : 'bg-emerald-700/50 text-emerald-400 cursor-not-allowed shadow-none'
                                }`}
                        >
                            <Save size={24} />
                            Submit Sales
                        </button>

                        <div className="flex gap-4">
                            <button className="flex-1 py-4 rounded-xl border-2 border-emerald-500/30 text-emerald-50 font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2">
                                <Printer size={20} /> Print
                            </button>
                            <button className="flex-1 py-4 rounded-xl border-2 border-emerald-500/30 text-emerald-50 font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2">
                                <Plus size={20} /> Share
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                    <h4 className="font-bold text-blue-800 mb-2">Quick Tips</h4>
                    <ul className="text-sm text-blue-600 space-y-2 list-disc pl-4">
                        <li>Select a buyer first to enable saving.</li>
                        <li>Use "Tab" to move quickly between fields.</li>
                        <li>Double-check rates before adding items.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Sales;
