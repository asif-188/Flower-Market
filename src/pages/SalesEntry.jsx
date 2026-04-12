
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Printer, MessageCircle, Rocket } from 'lucide-react';
import { saveSale, subscribeToCollection, db } from '../utils/storage';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

const SalesEntry = () => {
    const [flowers, setFlowers] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [cart, setCart] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [billDetails, setBillDetails] = useState({
        buyerId: '',
        date: new Date().toLocaleDateString('en-CA')
    });
    const [currentItem, setCurrentItem] = useState({
        flowerType: '',
        quantity: '',
        price: '',
    });

    useEffect(() => {
        const unsubProducts = subscribeToCollection('products', (data) => {
            setFlowers(data.length === 0
                ? ['Rose', 'Jasmine', 'Marigold', 'Crossandra', 'Lotus', 'Mullai']
                : data.map(f => f.name));
        });
        const unsubBuyers = subscribeToCollection('buyers', setBuyers);
        return () => { unsubProducts(); unsubBuyers(); };
    }, []);

    const addItem = () => {
        if (!currentItem.flowerType || !currentItem.quantity || !currentItem.price) return;
        const qty = parseFloat(currentItem.quantity);
        const rate = parseFloat(currentItem.price);
        setCart([...cart, { ...currentItem, id: Date.now(), total: qty * rate }]);
        setCurrentItem({ flowerType: '', quantity: '', price: '' });
    };

    const removeItem = (id) => setCart(cart.filter(i => i.id !== id));
    const grandTotal   = cart.reduce((s, i) => s + i.total, 0);
    const totalQty     = cart.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
    const currentTotal = parseFloat(currentItem.quantity || 0) * parseFloat(currentItem.price || 0);

    const handleSaveBill = async () => {
        if (!billDetails.buyerId || cart.length === 0 || isSaving) return;
        setIsSaving(true);
        try {
            const buyer = buyers.find(b => b.id === billDetails.buyerId);
            await saveSale({
                ...billDetails,
                buyerName: buyer?.name || 'Unknown',
                items: cart,
                grandTotal,
                timestamp: serverTimestamp()
            });
            await updateDoc(doc(db, 'buyers', billDetails.buyerId), {
                balance: increment(grandTotal)
            });
            alert('✅ Bill Saved & Balance Updated!');
            setCart([]);
            setBillDetails(prev => ({ ...prev, buyerId: '' }));
        } catch (err) {
            console.error(err);
            alert('❌ Failed to save bill.');
        } finally {
            setIsSaving(false);
        }
    };

    /* ── shared input style (matches Payments page) ── */
    const inputCls = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-gray-400";
    const labelCls = "block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5";

    return (
        /* Outer card — same pattern as Payments.jsx */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-in fade-in duration-500">

            {/* ── Page Header ── */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-emerald-700 tracking-tight">Sales</h2>
                <p className="text-sm text-gray-400 font-medium">Log details of flowers sold to customers.</p>
            </div>

            {/* ── Two sub-cards side by side ── */}
            <div className="flex gap-5 items-start">

                {/* ══ LEFT SUB-CARD: Entry Form ══ */}
                <div className="w-[46%] border border-gray-200 rounded-xl p-5 flex flex-col gap-5 bg-white">

                    {/* Sub-heading */}
                    <div className="flex items-center gap-2">
                        <span>📝</span>
                        <span className="text-sm font-black text-emerald-800 uppercase tracking-widest">New Purchase Entry</span>
                    </div>

                    {/* Customer */}
                    <div>
                        <label className={labelCls}>Customer</label>
                        <select
                            className={inputCls}
                            value={billDetails.buyerId}
                            onChange={e => setBillDetails({ ...billDetails, buyerId: e.target.value })}
                        >
                            <option value="">Search by name or ID...</option>
                            {buyers.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date + Flower row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Sale Date</label>
                            <input
                                type="date"
                                className={inputCls}
                                value={billDetails.date}
                                onChange={e => setBillDetails({ ...billDetails, date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Flower Variety</label>
                            <select
                                className={inputCls}
                                value={currentItem.flowerType}
                                onChange={e => setCurrentItem({ ...currentItem, flowerType: e.target.value })}
                            >
                                <option value="">Select Flower</option>
                                {flowers.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Weight / Rate / Total row */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className={labelCls}>Weight / Qty</label>
                                <input
                                    type="number"
                                    className={inputCls}
                                    placeholder="0.00"
                                    value={currentItem.quantity}
                                    onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Rate</label>
                                <input
                                    type="number"
                                    className={inputCls}
                                    placeholder="0.00"
                                    value={currentItem.price}
                                    onChange={e => setCurrentItem({ ...currentItem, price: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Total</label>
                                <div className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-black text-emerald-600">
                                    ₹{currentTotal.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Add New button */}
                    <button
                        onClick={addItem}
                        className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                    >
                        <Plus size={18} strokeWidth={3} /> Add New
                    </button>
                </div>

                {/* ══ RIGHT SUB-CARD: Batch Summary ══ */}
                <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white flex flex-col">

                    {/* Header */}
                    <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                        <span className="text-sm font-black text-gray-700">Current Batch Items</span>
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                            {cart.length} Items
                        </span>
                    </div>

                    {/* Column headers */}
                    <div className="px-5 pt-3 pb-2 grid grid-cols-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                        <span>Flower</span>
                        <span className="text-center">Qty</span>
                        <span className="text-right">Total</span>
                    </div>

                    {/* Rows */}
                    <div className="flex-1 px-5 min-h-[140px] overflow-y-auto">
                        {cart.length === 0 ? (
                            <p className="py-10 text-center text-sm text-gray-300 italic font-medium">No items added yet.</p>
                        ) : (
                            cart.map(item => (
                                <div key={item.id} className="grid grid-cols-3 items-center py-3 border-b border-gray-50 group">
                                    <span className="text-sm font-semibold text-gray-700">{item.flowerType}</span>
                                    <span className="text-sm font-semibold text-gray-500 text-center">{item.quantity}</span>
                                    <div className="flex items-center justify-end gap-2">
                                        <span className="text-sm font-black text-gray-700">₹{item.total.toFixed(2)}</span>
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Totals */}
                    <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex items-end justify-between">
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Quantity</p>
                            <p className="text-xl font-black text-gray-700">{totalQty.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Grand Total</p>
                            <p className="text-2xl font-black text-emerald-600">₹{grandTotal.toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="px-5 py-4 border-t border-gray-200 flex gap-3">
                        <button
                            onClick={handleSaveBill}
                            disabled={cart.length === 0 || !billDetails.buyerId || isSaving}
                            className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                        >
                            {isSaving
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <><Rocket size={16} /> Submit Sales</>
                            }
                        </button>

                        <button className="w-12 h-10 flex items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 transition-all active:scale-[0.98]">
                            <Printer size={18} />
                        </button>

                        <button className="w-12 h-10 flex items-center justify-center rounded-xl border-2 border-emerald-300 bg-white text-emerald-500 hover:bg-emerald-50 transition-all active:scale-[0.98]">
                            <MessageCircle size={18} />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SalesEntry;
