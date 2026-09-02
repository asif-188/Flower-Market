import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, CheckCircle, Clock, ChevronRight, User, MessageCircle } from 'lucide-react';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';
import { 
  subscribeToPaymentReminders, 
  savePaymentReminder, 
  updatePaymentReminder, 
  subscribeToCollection, 
  combineRemindersWithExistingSales 
} from '../utils/storage';
import PaymentRemindersModal from '../components/PaymentRemindersModal';
import VVLogo from '../components/VVLogo';
import { formatDateDDMMYYYY } from '../utils/whatsappHelper';

const Dashboard = () => {
    const navigate = useNavigate();
    const { t, lang } = useContext(LangContext);
    const { tenantData } = useTenant();
    const [storedReminders, setStoredReminders] = useState([]);
    const [allSales, setAllSales] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const u1 = subscribeToPaymentReminders(setStoredReminders);
        const u2 = subscribeToCollection('sales', setAllSales, true);
        const u3 = subscribeToCollection('buyers', setBuyers, true);
        return () => { u1(); u2(); u3(); };
    }, []);

    const combinedReminders = React.useMemo(() => {
        return combineRemindersWithExistingSales(storedReminders, allSales, buyers);
    }, [storedReminders, allSales, buyers]);

    const activeReminders = combinedReminders.filter(r => r.status === 'Pending' || r.status === 'Remind Later')
        .sort((a, b) => new Date(a.reminderDate) - new Date(b.reminderDate));

    const totalPendingAmt = activeReminders.reduce((sum, r) => sum + (Number(r.pendingAmount) || 0), 0);

    const shopName = tenantData?.name || 'SVM Flowers';
    const shopType = tenantData?.type || 'Premium Operating System';

    const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

    const handleSendWhatsApp = (rem) => {
        const buyer = buyers.find(b => b.id === rem.buyerId || b.name.toLowerCase() === (rem.buyerName || '').toLowerCase());
        const rawContact = buyer?.contact || rem.contact || '';

        if (!rawContact) {
            alert(`No WhatsApp contact number found for ${rem.buyerName}. Please register a phone number in Customer Directory.`);
            return;
        }

        const cleanPhone = rawContact.replace(/\D/g, '');
        const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const formattedSalesDate = formatDateDDMMYYYY(rem.salesDate);
        const formattedReminderDate = formatDateDDMMYYYY(rem.reminderDate);

        const message = lang === 'ta'
            ? `வணக்கம் ${rem.buyerName},\n\n${shopName} - கட்டண நினைவூட்டல்:\nகடைசி விற்பனை தேதி: ${formattedSalesDate}\nநினைவூட்டல் தேதி: ${formattedReminderDate}\nமொத்த நிலுவை தொகை: ₹${Number(rem.pendingAmount).toLocaleString('en-IN')}\n\nதயவுசெய்து கட்டணத்தை விரைவில் செலுத்தவும். நன்றி!`
            : `Hello ${rem.buyerName},\n\nPayment Reminder from ${shopName}:\nLatest Sales Date: ${formattedSalesDate}\nReminder Date: ${formattedReminderDate}\nTotal Outstanding Balance: ₹${Number(rem.pendingAmount).toLocaleString('en-IN')}\n\nPlease clear your pending balance at your earliest convenience. Thank you!`;

        const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const handleMarkAsPaid = async (r) => {
        try {
            if (r.isSynthesized) {
                await savePaymentReminder({
                    saleId: r.saleId || '',
                    buyerId: r.buyerId,
                    buyerName: r.buyerName,
                    salesDate: r.salesDate,
                    reminderDate: r.reminderDate,
                    pendingAmount: 0,
                    originalAmount: r.originalAmount,
                    status: 'Completed'
                });
            } else {
                await updatePaymentReminder(r.id, { status: 'Completed', pendingAmount: 0 });
            }
        } catch (err) {
            alert('Error updating reminder: ' + err.message);
        }
    };

    const handleSnooze = async (r, days) => {
        try {
            const base = r.reminderDate ? new Date(r.reminderDate) : new Date();
            base.setDate(base.getDate() + days);
            const nextDateStr = base.toISOString().split('T')[0];

            if (r.isSynthesized) {
                await savePaymentReminder({
                    saleId: r.saleId || '',
                    buyerId: r.buyerId,
                    buyerName: r.buyerName,
                    salesDate: r.salesDate,
                    reminderDate: nextDateStr,
                    pendingAmount: r.pendingAmount,
                    originalAmount: r.originalAmount,
                    status: 'Remind Later'
                });
            } else {
                await updatePaymentReminder(r.id, {
                    reminderDate: nextDateStr,
                    status: 'Remind Later'
                });
            }
        } catch (err) {
            alert('Error snoozing reminder: ' + err.message);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto px-4 py-4 min-h-[80vh] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
            {/* Center Column: Green Bridge + Buttons */}
            <div className="flex flex-col items-center justify-center max-w-lg w-full">
                <div className="text-center mb-8">
                    <h1 className="text-5xl md:text-6xl font-black text-emerald-600 tracking-tighter italic flex items-center justify-center gap-3">
                        <span className="text-5xl">🌿</span> {shopName}
                    </h1>
                    <p className="text-gray-400 font-bold uppercase tracking-[0.3em] text-xs mt-2">{shopType}</p>
                </div>

                <div className="flex flex-col gap-6 w-full">
                    <button
                        onClick={() => navigate('/app/farmer')}
                        className="group relative overflow-hidden bg-emerald-50 border-4 border-emerald-200 hover:border-emerald-400 p-8 rounded-[36px] shadow-xl hover:shadow-emerald-200 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-6"
                    >
                        <div className="text-5xl group-hover:rotate-12 transition-transform">🤠</div>
                        <span className="text-4xl font-black text-emerald-800 tracking-tighter italic">{t('farmer')}</span>
                    </button>

                    <button
                        onClick={() => navigate('/app/sales')}
                        className="group relative overflow-hidden bg-emerald-50 border-4 border-emerald-100 hover:border-emerald-300 p-8 rounded-[36px] shadow-xl hover:shadow-emerald-200 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-6"
                    >
                        <div className="text-5xl group-hover:rotate-12 transition-transform">🧾</div>
                        <span className="text-4xl font-black text-emerald-700 tracking-tighter italic">{t('sales')}</span>
                    </button>

                    <button
                        onClick={() => navigate('/app/outside-shop')}
                        className="group relative overflow-hidden bg-amber-50 border-4 border-amber-100 hover:border-amber-300 p-8 rounded-[36px] shadow-xl hover:shadow-amber-200 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-6"
                    >
                        <div className="text-5xl group-hover:rotate-12 transition-transform">🏘️</div>
                        <span className="text-4xl font-black text-amber-800 tracking-tighter italic">{t('outsideShop')}</span>
                    </button>
                </div>
            </div>

            <div className="mt-12 flex flex-wrap gap-8 items-center justify-center opacity-40 hover:opacity-100 transition-opacity">
                <button onClick={() => navigate('/app/accounts')} className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-emerald-600">Audit Accounts</button>
                <button onClick={() => navigate('/app/buyer')} className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-emerald-600">Customer Directory</button>
                <button onClick={() => navigate('/app/products')} className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-emerald-600">Product Master</button>
                <button onClick={() => navigate('/app/settings')} className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-emerald-600">⚙️ Settings</button>
                <button onClick={() => navigate('/app/history')} className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-emerald-600">📋 Action History</button>
                <button onClick={() => navigate('/admin')} className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400 hover:text-purple-600">🔐 Admin Panel</button>
                <button
                    onClick={() => navigate('/app/power-buy')}
                    className="flex items-center gap-1.5 hover:scale-110 transition-transform"
                    title="VV"
                >
                    <VVLogo size={22} />
                </button>
            </div>

            <PaymentRemindersModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
};

export default Dashboard;


