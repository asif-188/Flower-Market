import React, { useState, useContext } from 'react';
import { X, ChevronDown, ChevronUp, Info, Receipt, CreditCard } from 'lucide-react';
import { LangContext } from './Layout';

const toDateStr = (date) => {
    if (!date) return '';
    if (typeof date === 'string') return date.substring(0, 10);
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const displayDate = (d) => {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return d;
};

export default function OpeningBalanceBreakdownModal({
    isOpen,
    onClose,
    buyer,
    appliedFrom,
    sales = [],
    payments = [],
    fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    lang: langProp
}) {
    const context = useContext(LangContext);
    const lang = langProp || context?.lang || 'en';
    const isTa = lang === 'ta';

    const [showTxList, setShowTxList] = useState(false);

    if (!isOpen || !buyer) return null;

    const currentBalance = Number(buyer.balance) || 0;
    const startDate = appliedFrom || toDateStr(new Date());
    const formattedStartDate = displayDate(startDate);

    // Filter sales on or after start date
    const futureSales = sales.filter(s => {
        if (s.buyerId !== buyer.id) return false;
        const dt = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
        return dt && dt >= startDate;
    });

    // Filter payments on or after start date
    const futurePayments = payments.filter(p => {
        if (p.entityId !== buyer.id || p.type !== 'buyer') return false;
        const dt = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : null;
        return dt && dt >= startDate;
    });

    const futureSalesAmt = futureSales.reduce((s, x) => s + (Number(x.grandTotal) || 0), 0);
    const futurePayAmt = futurePayments.reduce((s, x) => s + (Number(x.amount) || 0) + (Number(x.cashLess) || 0), 0);

    // Calculated Opening Balance (Matches existing logic exactly)
    const openingBal = currentBalance - futureSalesAmt + futurePayAmt;

    const buyerName = isTa ? (buyer.taName || buyer.nameTa || buyer.name) : buyer.name;

    // Localized Strings
    const T = {
        title: isTa ? 'ஆரம்ப இருப்பு விவரம்' : 'Opening Balance Breakdown',
        startDateLabel: isTa ? 'ஆரம்ப தேதி' : 'Start Date',
        summaryTitle: isTa ? 'கணக்கீடு சுருக்கம்' : 'CALCULATION SUMMARY',
        currentBalance: isTa ? 'தற்போதைய வாடிக்கையாளர் பாக்கி:' : 'Current Customer Balance:',
        salesOnward: isTa ? `${formattedStartDate} முதல் விற்பனைகள்:` : `Sales from ${formattedStartDate} onward:`,
        paymentsOnward: isTa ? `${formattedStartDate} முதல் பெறப்பட்ட பணம்:` : `Payments from ${formattedStartDate} onward:`,
        calculatedOpening: isTa ? 'கணக்கிடப்பட்ட ஆரம்ப இருப்பு:' : 'Calculated Opening Balance:',
        formula: isTa 
            ? 'ஆரம்ப இருப்பு = தற்போதைய பாக்கி − விற்பனை (ஆரம்ப தேதி முதல்) + பெறப்பட்ட பணம் (ஆரம்ப தேதி முதல்)' 
            : 'Opening Balance = Current Balance − Sales (from Start Date) + Payments (from Start Date)',
        sourceTxHeader: (sCount, pCount) => isTa 
            ? `மூல பரிவர்த்தனைகள் (${sCount} விற்பனைகள், ${pCount} பணம் பெறப்பட்டது)`
            : `Source Transactions (${sCount} Sales, ${pCount} Payments)`,
        emptyTx: isTa 
            ? `${formattedStartDate} முதல் விற்பனையோ அல்லது பெறப்பட்ட பணமோ இல்லை.`
            : `No sales or payments recorded from ${formattedStartDate} onward.`,
        sale: isTa ? 'விற்பனை' : 'Sale',
        payment: isTa ? 'பணம் பெறப்பட்டது' : 'Payment',
        cashLess: isTa ? '(Cash Less)' : '(Cash Less)',
        close: isTa ? 'மூடு' : 'Close'
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            zIndex: 1100,
            padding: '16px'
        }}>
            <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '580px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                fontFamily: 'var(--font-sans, system-ui, sans-serif)',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    background: '#f8fafc'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: '#eff6ff', color: '#2563eb',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Info size={20} />
                        </div>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                                {T.title}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                {buyerName} {buyer.displayId ? `(#${buyer.displayId})` : ''} • {T.startDateLabel}: <span style={{ color: '#2563eb', fontWeight: 700 }}>{formattedStartDate}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#94a3b8', padding: '4px', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

                    {/* Step-by-Step Breakdown Cards */}
                    <div style={{
                        background: '#f8fafc',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '18px'
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                            {T.summaryTitle}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                            {/* Current Balance */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#334155' }}>
                                <span style={{ fontWeight: 600 }}>{T.currentBalance}</span>
                                <span style={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', fontSize: '14px' }}>
                                    {fmt(currentBalance)}
                                </span>
                            </div>

                            {/* Sales onward */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#dc2626' }}>
                                <span style={{ fontWeight: 600 }}>
                                    <span style={{ color: '#94a3b8', marginRight: '6px' }}>−</span>
                                    {T.salesOnward}
                                </span>
                                <span style={{ fontWeight: 800, color: '#dc2626', fontFamily: 'monospace', fontSize: '14px' }}>
                                    − {fmt(futureSalesAmt)}
                                </span>
                            </div>

                            {/* Payments onward */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#16a34a' }}>
                                <span style={{ fontWeight: 600 }}>
                                    <span style={{ color: '#94a3b8', marginRight: '6px' }}>+</span>
                                    {T.paymentsOnward}
                                </span>
                                <span style={{ fontWeight: 800, color: '#16a34a', fontFamily: 'monospace', fontSize: '14px' }}>
                                    + {fmt(futurePayAmt)}
                                </span>
                            </div>

                            <div style={{ borderTop: '2px dashed #cbd5e1', margin: '4px 0 2px' }} />

                            {/* Resulting Opening Balance */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef3c7', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                <span style={{ fontWeight: 800, color: '#92400e', fontSize: '14px' }}>
                                    {T.calculatedOpening}
                                </span>
                                <span style={{ fontWeight: 900, color: '#92400e', fontFamily: 'monospace', fontSize: '16px' }}>
                                    {fmt(openingBal)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Formula Explanation Note */}
                    <div style={{
                        fontSize: '11px',
                        color: '#64748b',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        lineHeight: '1.5'
                    }}>
                        💡 <strong>{isTa ? 'ஃபார்முலா:' : 'Formula:'}</strong> <code>{T.formula}</code>
                    </div>

                    {/* Expandable Source Transactions Section */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <button
                            onClick={() => setShowTxList(!showTxList)}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: '#f8fafc',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '12px',
                                color: '#334155'
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📋 {T.sourceTxHeader(futureSales.length, futurePayments.length)}
                            </span>
                            {showTxList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {showTxList && (
                            <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#ffffff', maxHeight: '220px', overflowY: 'auto' }}>
                                {futureSales.length === 0 && futurePayments.length === 0 ? (
                                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                                        {T.emptyTx}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Future Sales List */}
                                        {futureSales.map((s, idx) => {
                                            const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : '');
                                            return (
                                                <div key={`s-${idx}`} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '8px 10px', background: '#fef2f2', borderRadius: '6px', fontSize: '12px'
                                                }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#991b1b', fontWeight: 600 }}>
                                                        <Receipt size={14} /> {T.sale} ({displayDate(d)})
                                                    </span>
                                                    <span style={{ fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                                                        − {fmt(s.grandTotal || 0)}
                                                    </span>
                                                </div>
                                            );
                                        })}

                                        {/* Future Payments List */}
                                        {futurePayments.map((p, idx) => {
                                            const d = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : '';
                                            const amt = (Number(p.amount) || 0) + (Number(p.cashLess) || 0);
                                            return (
                                                <div key={`p-${idx}`} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '8px 10px', background: '#f0fdf4', borderRadius: '6px', fontSize: '12px'
                                                }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontWeight: 600 }}>
                                                        <CreditCard size={14} /> {T.payment} ({displayDate(d)}) {p.cashLess > 0 ? T.cashLess : ''}
                                                    </span>
                                                    <span style={{ fontWeight: 800, color: '#16a34a', fontFamily: 'monospace' }}>
                                                        + {fmt(amt)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 24px',
                    borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    display: 'flex',
                    justify: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 20px',
                            borderRadius: '8px',
                            background: '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        {T.close}
                    </button>
                </div>
            </div>
        </div>
    );
}
