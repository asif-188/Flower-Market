import React, { useState, useEffect } from 'react';
import { Calendar, Search, Printer, FileText } from 'lucide-react';
import { subscribeToCollection, COLLECTIONS, db } from '../utils/storage';
import { collection, query, where, getDocs } from 'firebase/firestore';

const FarmerDayAccount = () => {
    const [farmers, setFarmers] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dayRows, setDayRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const unsubscribe = subscribeToCollection(COLLECTIONS.F_FARMERS, setFarmers);
        return () => unsubscribe();
    }, []);

    const addToast = (message, type = 'success') => {
        const id = Date.now() + Math.random().toString();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const fetchDaySummary = async () => {
        setIsLoading(true);
        try {
            const tenantId = sessionStorage.getItem('fm_tenantId') || 'default';
            
            // Fetch purchases for the selected day and prior
            const qPurchases = query(
                collection(db, COLLECTIONS.F_PURCHASES),
                where('tenantId', '==', tenantId)
            );
            const purchasesSnap = await getDocs(qPurchases);
            const purchases = purchasesSnap.docs.map(doc => doc.data());

            // Fetch payments for the selected day and prior
            const qPayments = query(
                collection(db, COLLECTIONS.F_PAYMENTS),
                where('tenantId', '==', tenantId)
            );
            const paymentsSnap = await getDocs(qPayments);
            const payments = paymentsSnap.docs.map(doc => doc.data());

            // Fetch bill closings (for commissions)
            const qCloses = query(
                collection(db, COLLECTIONS.F_BILL_CLOSINGS),
                where('tenantId', '==', tenantId)
            );
            const closesSnap = await getDocs(qCloses);
            const closes = closesSnap.docs.map(doc => doc.data());

            const rows = farmers.map(farmer => {
                const fid = farmer.id;
                const opBal = farmer.openingBalance || 0;

                // Sum prior transactions (before selectedDate)
                const priorPurchases = purchases
                    .filter(p => p.farmerId === fid && p.date < selectedDate)
                    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

                const priorPayments = payments
                    .filter(p => p.farmerId === fid && p.date < selectedDate)
                    .reduce((sum, p) => sum + (p.amount || 0), 0);

                const priorCloses = closes
                    .filter(c => c.farmerId === fid && c.toDate < selectedDate)
                    .reduce((sum, c) => sum + (c.commissionAmount || 0) + (c.otherCharges || 0), 0);

                const prevOutstanding = opBal + priorPurchases - priorPayments - priorCloses;

                // Today's values
                const todayPurchase = purchases
                    .filter(p => p.farmerId === fid && p.date === selectedDate)
                    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

                const todayCashPaid = payments
                    .filter(p => p.farmerId === fid && p.date === selectedDate)
                    .reduce((sum, p) => sum + (p.amount || 0), 0);

                const todayCommission = closes
                    .filter(c => c.farmerId === fid && c.toDate === selectedDate)
                    .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

                const todayOtherCharges = closes
                    .filter(c => c.farmerId === fid && c.toDate === selectedDate)
                    .reduce((sum, c) => sum + (c.otherCharges || 0), 0);

                const closingBalance = prevOutstanding + todayPurchase - todayCashPaid - todayCommission - todayOtherCharges;

                return {
                    farmerId: farmer.displayId,
                    farmerName: farmer.name,
                    prevOutstanding,
                    todayPurchase,
                    todayCashPaid,
                    todayCommission,
                    closingBalance
                };
            });

            setDayRows(rows);
        } catch (error) {
            console.error("Day summary calculation error:", error);
            addToast('Failed to load day account data.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (farmers.length > 0) {
            fetchDaySummary();
        }
    }, [farmers, selectedDate]);

    const handlePrint = () => {
        window.print();
    };

    const filteredRows = dayRows.filter(row =>
        row.farmerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.farmerId?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totals = filteredRows.reduce((acc, row) => ({
        prevOutstanding: acc.prevOutstanding + row.prevOutstanding,
        todayPurchase: acc.todayPurchase + row.todayPurchase,
        todayCashPaid: acc.todayCashPaid + row.todayCashPaid,
        todayCommission: acc.todayCommission + row.todayCommission,
        closingBalance: acc.closingBalance + row.closingBalance
    }), { prevOutstanding: 0, todayPurchase: 0, todayCashPaid: 0, todayCommission: 0, closingBalance: 0 });

    return (
        <div className="bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden p-8 animate-in fade-in duration-500">
            {/* Toasts */}
            <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2">
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        className={`px-6 py-4 rounded-xl shadow-lg text-white font-bold text-sm transform transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
                            t.type === 'error' ? 'bg-red-500' : 'bg-green-500'
                        }`}
                    >
                        {t.message}
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 tracking-tight">Day Account</h2>
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mt-1">Daily outstanding ledger balances and daily summary</p>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/50 p-6 rounded-2xl border border-gray-100 mb-8 items-end no-print">
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Select Date</label>
                    <div className="relative">
                        <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="date"
                            className="w-full pl-10 pr-3 py-2 border rounded-xl font-bold text-gray-700 outline-none focus:border-orange-500"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Search Farmer</label>
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text"
                            className="w-full pl-10 pr-3 py-2 border rounded-xl font-bold text-gray-700 outline-none focus:border-orange-500"
                            placeholder="Search farmer name or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <button 
                        onClick={handlePrint}
                        className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-orange-100"
                    >
                        <Printer size={14} /> Print Day Summary
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto print-area">
                <table className="w-full border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-orange-50/50">
                            <th className="px-4 py-3.5 text-xs font-black text-orange-900 uppercase tracking-widest text-left first:rounded-l-xl">Farmer ID</th>
                            <th className="px-4 py-3.5 text-xs font-black text-orange-900 uppercase tracking-widest text-left">Farmer Name</th>
                            <th className="px-4 py-3.5 text-xs font-black text-orange-900 uppercase tracking-widest text-right">Previous Outstanding</th>
                            <th className="px-4 py-3.5 text-xs font-black text-orange-900 uppercase tracking-widest text-right">Today's Purchase</th>
                            <th className="px-4 py-3.5 text-xs font-black text-orange-900 uppercase tracking-widest text-right">Today's Paid</th>
                            <th className="px-4 py-3.5 text-xs font-black text-orange-900 uppercase tracking-widest text-right">Commission</th>
                            <th className="px-4 py-3.5 text-xs font-black text-orange-900 uppercase tracking-widest text-right last:rounded-r-xl">Closing Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredRows.map(row => (
                            <tr key={row.farmerId} className="hover:bg-gray-50/30">
                                <td className="px-4 py-4 text-sm font-bold text-gray-500">{row.farmerId}</td>
                                <td className="px-4 py-4 text-sm font-bold text-gray-800">{row.farmerName}</td>
                                <td className={`px-4 py-4 text-sm text-right font-semibold ${
                                    row.prevOutstanding >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                    ₹{row.prevOutstanding.toFixed(0)}
                                </td>
                                <td className="px-4 py-4 text-sm text-right font-bold text-green-600">₹{row.todayPurchase.toFixed(0)}</td>
                                <td className="px-4 py-4 text-sm text-right font-bold text-red-500">₹{row.todayCashPaid.toFixed(0)}</td>
                                <td className="px-4 py-4 text-sm text-right font-semibold text-gray-500">₹{row.todayCommission.toFixed(0)}</td>
                                <td className={`px-4 py-4 text-sm text-right font-black ${
                                    row.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                    ₹{row.closingBalance.toFixed(0)}
                                </td>
                            </tr>
                        ))}
                        {filteredRows.length === 0 && (
                            <tr>
                                <td colSpan={7} className="py-20 text-center text-gray-400 font-bold italic text-xs">
                                    No records found.
                                </td>
                            </tr>
                        )}
                        {/* Totals Row */}
                        <tr className="bg-orange-50/30 font-black">
                            <td colSpan={2} className="px-4 py-4 text-sm text-orange-950 uppercase">Grand Total</td>
                            <td className={`px-4 py-4 text-sm text-right ${totals.prevOutstanding >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                ₹{totals.prevOutstanding.toFixed(0)}
                            </td>
                            <td className="px-4 py-4 text-sm text-right text-green-700">₹{totals.todayPurchase.toFixed(0)}</td>
                            <td className="px-4 py-4 text-sm text-right text-red-600">₹{totals.todayCashPaid.toFixed(0)}</td>
                            <td className="px-4 py-4 text-sm text-right text-gray-700">₹{totals.todayCommission.toFixed(0)}</td>
                            <td className={`px-4 py-4 text-sm text-right ${totals.closingBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                ₹{totals.closingBalance.toFixed(0)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FarmerDayAccount;
