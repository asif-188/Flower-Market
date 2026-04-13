
import React, { useState, useEffect, useContext } from 'react';
import { Plus, Trash2, Printer, MessageCircle, Rocket } from 'lucide-react';
import { saveSale, subscribeToCollection, db } from '../utils/storage';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { LangContext } from '../components/Layout';

const SalesEntry = () => {
    const { t } = useContext(LangContext);
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
            alert('✅ ' + t('billSavedSuccess'));
            setCart([]);
            setBillDetails(prev => ({ ...prev, buyerId: '' }));
        } catch (err) {
            console.error(err);
            alert('❌ ' + t('billSaveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleShareWhatsApp = () => {
        if (!billDetails.buyerId || cart.length === 0) {
            alert("Please select a customer and add items first.");
            return;
        }
        const buyer = buyers.find(b => b.id === billDetails.buyerId);
        
        let message = `*FLOWER MARKET BILL*\n`;
        message += `------------------------\n`;
        message += `Date: ${billDetails.date}\n`;
        message += `Customer: ${buyer?.name || '---'}\n\n`;
        cart.forEach(item => {
            message += `• ${item.flowerType}: ${item.quantity} x ${item.price} = ₹${item.total.toFixed(2)}\n`;
        });
        message += `\n*GRAND TOTAL: ₹${grandTotal.toFixed(2)}*\n`;
        message += `------------------------\n`;
        message += `Thank you!`;

        const phone = (buyer?.contact || '').replace(/\D/g, '');
        const url = `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const handlePrintBill = () => {
        if (cart.length === 0) return;
        window.print();
    };

    /* ── shared input style (matches Screenshot) ── */
    const inputCls = "w-full bg-[#f8fafc] border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:bg-white focus:border-emerald-500 transition-all placeholder:text-gray-300 font-semibold";
    const labelCls = "block text-[11px] font-extrabold text-[#64748b] uppercase tracking-wider mb-2 px-1";

    return (
        /* Outer card — same pattern as Payments.jsx */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 min-h-[calc(100vh-180px)] flex flex-col animate-in fade-in duration-500">

            {/* ── Page Header ── */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">📝</span>
                    <h2 className="text-2xl font-black text-[#1e8a44] tracking-tight uppercase">{t('newPurchaseEntry')}</h2>
                </div>
                <div className="bg-emerald-600 text-white text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                    {cart.length} {t('items')}
                </div>
            </div>

            {/* ── Grid sub-cards ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-stretch flex-1">

                {/* ══ LEFT SUB-CARD: Entry Form ══ */}
                <div className="border border-gray-100 rounded-3xl p-10 flex flex-col gap-8 bg-white shadow-xl shadow-gray-100/50 h-full">

                    {/* Customer */}
                    <div>
                        <label className={labelCls}>{t('customer')}</label>
                        <select
                            className={inputCls}
                            value={billDetails.buyerId}
                            onChange={e => setBillDetails({ ...billDetails, buyerId: e.target.value })}
                        >
                            <option value="">{t('search')}</option>
                            {buyers.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date + Flower row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>{t('saleDate')}</label>
                            <input
                                type="date"
                                className={inputCls}
                                value={billDetails.date}
                                onChange={e => setBillDetails({ ...billDetails, date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>{t('flowerVariety')}</label>
                            <select
                                className={inputCls}
                                value={currentItem.flowerType}
                                onChange={e => setCurrentItem({ ...currentItem, flowerType: e.target.value })}
                            >
                                <option value="">{t('selectFlower')}</option>
                                {flowers.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Weight / Rate / Total row */}
                    <div className="bg-[#f8fafc]/50 border border-gray-100 rounded-2xl p-6">
                        <div className="grid grid-cols-3 gap-6">
                            <div>
                                <label className={labelCls}>{t('weightQty')}</label>
                                <input
                                    type="number"
                                    className="w-full bg-white rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm"
                                    placeholder="0.00"
                                    value={currentItem.quantity}
                                    onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>{t('rate')}</label>
                                <input
                                    type="number"
                                    className="w-full bg-white rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm"
                                    placeholder="0.00"
                                    value={currentItem.price}
                                    onChange={e => setCurrentItem({ ...currentItem, price: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>{t('total')}</label>
                                <div className="w-full bg-[#f1f5f9] rounded-xl px-4 py-3 text-sm font-black text-emerald-600 shadow-inner">
                                    ₹{currentTotal.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Add New button */}
                    <button
                        onClick={addItem}
                        className="w-full py-5 bg-[#1e8a44] hover:bg-[#166d35] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg shadow-emerald-200/50 transition-all active:scale-[0.98] mt-4"
                    >
                        <Plus size={22} strokeWidth={4} /> {t('addNew')}
                    </button>
                </div>

                {/* ══ RIGHT SUB-CARD: Batch Summary ══ */}
                <div className="border border-gray-100 rounded-3xl overflow-hidden bg-white flex flex-col shadow-xl shadow-gray-100/50 h-full">

                    {/* Header */}
                    <div className="px-8 py-6 flex items-center justify-between border-b border-gray-50 bg-[#f8fafc]/50">
                        <span className="text-base font-black text-gray-700">{t('currentBatchItems')}</span>
                    </div>

                    {/* Column headers */}
                    <div className="px-8 pt-6 pb-4 grid grid-cols-3 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                        <span>{t('flower')}</span>
                        <span className="text-center">{t('qty')}</span>
                        <span className="text-right">{t('total')}</span>
                    </div>

                    {/* Rows */}
                    <div className="flex-1 px-6 min-h-[300px] overflow-y-auto">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center py-20 grayscale opacity-40">
                                <div className="text-6xl mb-4">🛒</div>
                                <p className="text-center text-lg text-gray-400 italic font-bold">{t('noItemsYet')}</p>
                            </div>
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
                    <div className="px-8 py-8 bg-[#f8fafc] border-t border-gray-100 flex items-end justify-between">
                        <div>
                            <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">{t('totalQuantity')}</p>
                            <p className="text-3xl font-black text-gray-800">{totalQty.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] font-black text-[#1e8a44] uppercase tracking-widest mb-1">{t('grandTotal')}</p>
                            <p className="text-5xl font-black text-[#1e8a44] flex items-center justify-end">
                                <span className="text-2xl mr-1">₹</span>{grandTotal.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="px-8 py-8 border-t border-gray-100 flex gap-4">
                        <button
                            onClick={handleSaveBill}
                            disabled={cart.length === 0 || !billDetails.buyerId || isSaving}
                            className="flex-1 py-4 bg-[#1e8a44] hover:bg-[#166d35] disabled:bg-emerald-200 disabled:cursor-not-allowed text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg shadow-emerald-200/50 transition-all active:scale-[0.98]"
                        >
                            {isSaving
                                ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <><span className="text-2xl">🚀</span> {t('submitSales')}</>
                            }
                        </button>

                        <button 
                            onClick={handlePrintBill}
                            className="w-16 h-16 flex items-center justify-center rounded-2xl border-2 border-blue-100 bg-white text-blue-600 hover:bg-blue-50 transition-all active:scale-[0.98] shadow-sm"
                            title="Print Bill"
                        >
                            <Printer size={28} strokeWidth={2.5} />
                        </button>

                        <button 
                            onClick={handleShareWhatsApp}
                            className="w-16 h-16 flex items-center justify-center rounded-2xl border-2 border-emerald-100 bg-white text-emerald-500 hover:bg-emerald-50 transition-all active:scale-[0.98] shadow-sm"
                            title="WhatsApp Share"
                        >
                            <MessageCircle size={28} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SalesEntry;
