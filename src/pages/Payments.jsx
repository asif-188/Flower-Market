import React, { useState, useEffect, useContext } from 'react';
import { Plus, X, User, DollarSign, Calendar, FileText, ArrowRight, CheckCircle2, Trash2, Edit2 } from 'lucide-react';
import { subscribeToCollection, db } from '../utils/storage';
import { collection, addDoc, doc, updateDoc, increment, deleteDoc, query, orderBy } from 'firebase/firestore';
import { LangContext } from '../components/Layout';

const Payments = () => {
    const { t } = useContext(LangContext);
    const [payments, setPayments] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [farmers, setFarmers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [paymentType, setPaymentType] = useState('buyer'); // Focus on buyers as per 'Cash Receive' context

    const [formData, setFormData] = useState({
        entityId: '',
        amount: '',
        method: 'Cash',
        note: ''
    });

    // ── Real-time Listeners ──
    useEffect(() => {
        const unsubPayments = subscribeToCollection('payments', (data) => {
            // Sort by timestamp desc locally if subscription doesn't provide it
            setPayments(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        });
        const unsubBuyers = subscribeToCollection('buyers', setBuyers);
        const unsubFarmers = subscribeToCollection('farmers', setFarmers);

        return () => {
            unsubPayments();
            unsubBuyers();
            unsubFarmers();
        };
    }, []);

    const handleOpenModal = () => {
        setFormData({ entityId: '', amount: '', method: 'Cash', note: '' });
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (isSaving || !formData.entityId || !formData.amount) return;
        
        setIsSaving(true);
        try {
            const amountNum = parseFloat(formData.amount);
            const collectionName = paymentType === 'farmer' ? 'farmers' : 'buyers';
            const entityRef = doc(db, collectionName, formData.entityId);

            // 1. Save Journal Entry
            await addDoc(collection(db, 'payments'), {
                ...formData,
                amount: amountNum,
                type: paymentType,
                timestamp: new Date().toISOString()
            });

            // 2. Update Entity Balance
            // For Farmers: balance + amount (we owe them more if we receive? No, farmers we PAY them. Receive is for Buyers.)
            // For Buyers: balance - amount (they owe us less)
            await updateDoc(entityRef, {
                balance: increment(paymentType === 'farmer' ? -amountNum : -amountNum) 
            });
            // Note: In your previous logic, Pay Farmer was increment(amountNum). 
            // If balance is "what they owe us", then receiving from buyer is -amount.
            // If balance is "what we owe farmer", then paying them is -amount.
            // I'll stick to logic that assumes balance = "what they owe us" for buyers.

            setIsModalOpen(false);
            setFormData({ entityId: '', amount: '', method: 'Cash', note: '' });
        } catch (err) {
            console.error('Payment Error:', err);
            alert('❌ Failed to record payment: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (p) => {
        if (!window.confirm('Delete this payment record? This will NOT revert the balance automatically.')) return;
        try {
            await deleteDoc(doc(db, 'payments', p.id));
        } catch (err) {
            alert('❌ Delete failed');
        }
    };

    const handleEditNote = async (p) => {
        const newNote = window.prompt('Edit Short Note:', p.note || '');
        if (newNote === null) return;
        try {
            const paymentRef = doc(db, 'payments', p.id);
            await updateDoc(paymentRef, { note: newNote });
        } catch (err) {
            alert('❌ Update failed: ' + err.message);
        }
    };

    const getEntityName = (id, type) => {
        const list = type === 'farmer' ? farmers : buyers;
        return list.find(item => item.id === id)?.name || 'Unknown Entity';
    };

    const getEntityDisplayId = (id, type) => {
        const list = type === 'farmer' ? farmers : buyers;
        return list.find(item => item.id === id)?.displayId || '---';
    };

    const filteredPayments = payments.filter(p => {
        const name = getEntityName(p.entityId, p.type).toLowerCase();
        const displayId = getEntityDisplayId(p.entityId, p.type).toString().toLowerCase();
        const term = searchTerm.toLowerCase();
        return name.includes(term) || displayId.includes(term) || p.note?.toLowerCase().includes(term);
    });

    const formatCurrency = (n) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

    const formatDate = (isoStr) => {
        if (!isoStr) return '---';
        const date = new Date(isoStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + 
               date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const selectedEntity = (paymentType === 'buyer' ? buyers : farmers).find(e => e.id === formData.entityId);
    const openingBalance = selectedEntity?.balance || 0;
    const amountNum = parseFloat(formData.amount) || 0;
    const closingBalance = openingBalance - amountNum;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-in fade-in duration-500">
            
            {/* ── Page Header ── */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="text-4xl text-emerald-600 font-bold">💰</div>
                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight">{t('cashReceive')}</h2>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenModal}
                        className="flex items-center gap-1.5 px-5 py-2 bg-white border-2 border-emerald-500 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-50 transition-colors shadow-sm"
                    >
                        <Plus size={16} /> {t('receivePayment')}
                    </button>
                </div>
            </div>

            {/* ── Search (Symbol Removed) ── */}
            <div className="mb-6">
                <div className="relative max-w-sm">
                    <input
                        type="text"
                        placeholder={t('search')}
                        className="w-full px-6 py-2.5 border-2 border-emerald-500 rounded-full text-sm font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-gray-400"
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
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest rounded-l-xl">{t('date')}</th>
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest">{t('customerId')}</th>
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest">{t('customerName')}</th>
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest">{t('amountReceived')}</th>
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest">{t('notes')}</th>
                            <th className="px-5 py-3 text-xs font-black uppercase tracking-widest rounded-r-xl">{t('action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPayments.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-24 text-center text-gray-400 italic font-medium">
                                    {t('noRecords')}
                                </td>
                            </tr>
                        ) : (
                            filteredPayments.map((p) => (
                                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors group">
                                    <td className="px-5 py-4 text-xs font-bold text-gray-500">
                                        {formatDate(p.timestamp)}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-black tracking-tighter">
                                            #{getEntityDisplayId(p.entityId, p.type)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800">{getEntityName(p.entityId, p.type)}</span>
                                            <span className="text-[10px] uppercase tracking-wider font-black text-gray-300">{p.type}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="font-black text-emerald-600 text-lg">
                                            {formatCurrency(p.amount)}
                                        </span>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.method}</div>
                                    </td>
                                    <td className="px-5 py-4 text-sm text-gray-500 max-w-xs truncate">
                                        <div className="flex items-center gap-2">
                                            <span>{p.note || '—'}</span>
                                            <button 
                                                onClick={() => handleEditNote(p)}
                                                className="p-1 text-gray-300 hover:text-[#1e8a44] transition-colors"
                                                title="Edit Note"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <button 
                                            onClick={() => handleDelete(p)}
                                            className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Cash Receive Modal (Matches Screenshot Exactly) ── */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-[600px] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        
                        {/* Solid Green Header */}
                        <div className="px-6 py-4 bg-[#1e8a44] flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">{t('cashReceive')}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white transition-colors">
                                <X size={20} strokeWidth={3} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSave} className="p-8 space-y-8">
                            
                            <div className="space-y-6 max-w-lg mx-auto">
                                {/* Customer Row */}
                                <div className="flex items-center">
                                    <label className="w-1/3 text-gray-700 font-bold">{t('customer')}</label>
                                    <div className="w-2/3">
                                        <select 
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:border-[#1e8a44] outline-none font-medium text-gray-700 text-sm"
                                            value={formData.entityId}
                                            onChange={e => setFormData({ ...formData, entityId: e.target.value })}
                                            required
                                        >
                                            <option value="">{t('selectCustomer')}</option>
                                            {(paymentType === 'buyer' ? buyers : farmers).map(item => (
                                                <option key={item.id} value={item.id}>{item.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Opening Balance Row */}
                                <div className="flex items-center">
                                    <label className="w-1/3 text-gray-700 font-bold">{t('openingBalance')}</label>
                                    <div className="w-2/3 text-gray-800 font-black text-lg">
                                        {formatCurrency(openingBalance)}
                                    </div>
                                </div>

                                {/* givenAmount Row */}
                                <div className="flex items-center">
                                    <label className="w-1/3 text-gray-700 font-bold">{t('givenAmount')}</label>
                                    <div className="w-2/3 flex items-center gap-4">
                                        <input 
                                            type="number" 
                                            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:border-[#1e8a44] outline-none font-bold text-gray-800"
                                            placeholder="0.00"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            required
                                        />
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 accent-[#1e8a44]" 
                                                checked={formData.method === 'UPI'}
                                                onChange={(e) => setFormData({...formData, method: e.target.checked ? 'UPI' : 'Cash'})}
                                            />
                                            <span className="text-sm font-bold text-gray-500">GPay</span>
                                        </label>
                                    </div>
                                </div>

                                {/* closingBalance Row */}
                                <div className="flex items-center">
                                    <label className="w-1/3 text-gray-700 font-bold">{t('closingBalance')}</label>
                                    <div className="w-2/3 text-[#1e8a44] font-black text-xl">
                                        {formatCurrency(closingBalance)}
                                    </div>
                                </div>

                                {/* Short Note Row */}
                                <div className="flex items-center">
                                    <label className="w-1/3 text-gray-700 font-bold">{t('notes')}</label>
                                    <div className="w-2/3">
                                        <input 
                                            type="text" 
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-[#1e8a44] outline-none font-medium text-gray-700"
                                            placeholder="..."
                                            value={formData.note}
                                            onChange={e => setFormData({ ...formData, note: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer Buttons */}
                            <div className="pt-10 flex items-center justify-end gap-3">
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="w-14 h-11 bg-[#1e8a44] text-white rounded-lg flex items-center justify-center shadow-md hover:bg-[#166d35] transition-all disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <CheckCircle2 size={24} strokeWidth={3} />
                                    )}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 h-11 bg-[#64748b] text-white rounded-lg font-bold text-sm shadow-md hover:bg-[#475569] transition-all"
                                >
                                    {t('close')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payments;

