import React, { useState, useEffect, useRef, useContext } from 'react';
import { Plus, Trash2, Printer, MessageCircle, Pencil } from 'lucide-react';
import { saveSale, subscribeToCollection, db } from '../utils/storage';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { generateBuyerReceiptCanvas } from '../utils/receiptCanvas';

/* ── Keyboard-navigable Searchable Customer Dropdown ── */
const CustomerSearch = ({ buyers, value, onChange, onKeyDown, inputRef }) => {
    const [query, setQuery]         = useState('');
    const [open, setOpen]           = useState(false);
    const [cursor, setCursor]       = useState(0);
    const listRef                   = useRef(null);

    const selectedName = buyers.find(b => b.id === value)?.name || '';

    const filtered = query.trim()
        ? buyers.filter(b =>
            b.name.toLowerCase().includes(query.toLowerCase()) ||
            String(b.displayId || '').includes(query))
        : buyers;

    const choose = (buyer) => {
        onChange(buyer.id);
        setQuery(buyer.name);
        setOpen(false);
    };

    const handleKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && filtered[cursor]) { choose(filtered[cursor]); }
            else if (onKeyDown) onKeyDown(e);
        }
        else if (e.key === 'Escape') setOpen(false);
        else if (e.key === 'Tab') {
            if (open && filtered[cursor]) choose(filtered[cursor]);
            setOpen(false);
            if (onKeyDown) onKeyDown(e);
        }
    };

    // Scroll active item into view
    useEffect(() => {
        if (listRef.current) {
            const items = listRef.current.querySelectorAll('li');
            items[cursor]?.scrollIntoView({ block: 'nearest' });
        }
    }, [cursor]);

    return (
        <div style={{ position: 'relative' }}>
            <input
                ref={inputRef}
                type="text"
                placeholder="Search by name or ID..."
                value={open ? query : selectedName}
                onFocus={() => { setQuery(''); setOpen(true); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onChange={e => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={handleKey}
                autoComplete="off"
                style={INPUT_S}
            />
            {open && filtered.length > 0 && (
                <ul ref={listRef} style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)', maxHeight: '200px',
                    overflowY: 'auto', listStyle: 'none', margin: '4px 0', padding: '4px',
                }}>
                    {filtered.map((b, i) => (
                        <li key={b.id} onMouseDown={() => choose(b)}
                            style={{
                                padding: '8px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px',
                                fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                                background: i === cursor ? '#f0fdf4' : 'transparent',
                                color: i === cursor ? '#15803d' : '#374151',
                            }}
                            onMouseEnter={() => setCursor(i)}
                        >
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>#{b.displayId}</span>
                            {b.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

/* ── Shared style tokens ── */
const INPUT_S = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1.5px solid #e2e8f0', background: '#fff',
    fontSize: '14px', fontWeight: 500, color: '#1e293b',
    outline: 'none', fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
};
const LABEL_S = {
    display: 'block', fontSize: '10px', fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '5px',
};

const SalesEntry = () => {
    const { t, lang } = useContext(LangContext);
    const [flowers, setFlowers]   = useState([]);
    const [buyers, setBuyers]     = useState([]);
    const [cart, setCart]         = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [billDetails, setBillDetails] = useState({
        buyerId: '', date: new Date().toLocaleDateString('en-CA'),
    });
    const [currentItem, setCurrentItem] = useState({ flowerType: '', quantity: '', price: '' });
    const [selectedRowIdx, setSelectedRowIdx] = useState(-1);
    const [selectedColIdx, setSelectedColIdx] = useState(-1); // 0=Qty, 1=Rate, 2=Total
    const [allPayments, setAllPayments] = useState([]);

    // Refs for keyboard navigation
    const refCustomer  = useRef(null);
    const refDate      = useRef(null);
    const refFlower    = useRef(null);
    const refQty       = useRef(null);
    const refRate      = useRef(null);
    const refAddBtn    = useRef(null);
    const refList      = useRef(null);

    // Auto-scroll batch list to bottom when new item added
    useEffect(() => {
        if (refList.current) {
            if (selectedRowIdx === -1) {
                refList.current.scrollTop = refList.current.scrollHeight;
            } else {
                const row = refList.current.children[selectedRowIdx];
                row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [cart, selectedRowIdx]);

    useEffect(() => {
        const u1 = subscribeToCollection('products', (data) => {
            setFlowers(data.length === 0
                ? ['Rose', 'Jasmine', 'Marigold', 'Crossandra', 'Lotus', 'Mullai']
                : data.map(f => f.name));
        });
        const u2 = subscribeToCollection('buyers', setBuyers);
        const u3 = subscribeToCollection('payments', setAllPayments);
        const u4 = subscribeToCollection('system', (data) => {
            const s = data.find(i => i.id === 'settings');
            if (s) setSettings(s);
        });
        return () => { u1(); u2(); u3(); u4(); };
    }, []);

    const [settings, setSettings] = useState({ motto: '', name: 'S.V.M', type: '', address: '', phone1: '', phone2: '' });

    const addItem = () => {
        if (!currentItem.flowerType || !currentItem.quantity || !currentItem.price) return;
        const qty  = parseFloat(currentItem.quantity);
        const rate = parseFloat(currentItem.price);
        if (isNaN(qty) || isNaN(rate)) return;
        setCart(prev => [...prev, { ...currentItem, id: Date.now(), total: qty * rate }]);
        setCurrentItem({ flowerType: '', quantity: '', price: '' });
        setSelectedRowIdx(-1);
        setSelectedColIdx(-1);
        // Return focus to flower for fast entry of next item
        setTimeout(() => refFlower.current?.focus(), 50);
    };

    const removeItem = (id) => setCart(prev => prev.filter(i => i.id !== id));

    const editItem = (item) => {
        setCurrentItem({ flowerType: item.flowerType, quantity: item.quantity, price: item.price });
        removeItem(item.id);
        setTimeout(() => refFlower.current?.focus(), 50);
    };

    const grandTotal   = cart.reduce((s, i) => s + i.total, 0);
    const totalQty     = cart.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
    const currentTotal = parseFloat(currentItem.quantity || 0) * parseFloat(currentItem.price || 0);

    // Financial calculations for the header
    const selectedBuyer = buyers.find(b => b.id === billDetails.buyerId);
    const currentDebt   = selectedBuyer?.balance || 0;
    const dayPayments   = allPayments.filter(p => {
        if (p.entityId !== billDetails.buyerId) return false;
        // Robust check for date match
        const d = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : p.timestamp) : null;
        return d === billDetails.date;
    });
    const cashRec       = dayPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const cashLess      = dayPayments.reduce((s, p) => s + (p.cashLess || 0), 0);
    
    // Balance before today's payments
    const oldBalance     = currentDebt + cashRec + cashLess;
    // Current net balance before this sale is submitted
    const runningBalance = currentDebt; 
    // Absolute grand total (Debt + today's cart)
    const absoluteGrandTotal = runningBalance + grandTotal;

    const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

    const handleSaveBill = async () => {
        if (!billDetails.buyerId || cart.length === 0 || isSaving) return;
        setIsSaving(true);
        try {
            const buyer = buyers.find(b => b.id === billDetails.buyerId);
            await saveSale({ ...billDetails, buyerName: buyer?.name || 'Unknown', items: cart, grandTotal, timestamp: serverTimestamp() });
            await updateDoc(doc(db, 'buyers', billDetails.buyerId), { balance: increment(grandTotal) });
            alert('✅ ' + t('billSavedSuccess'));
            setCart([]);
            setBillDetails(prev => ({ ...prev, buyerId: '' }));
        } catch (err) {
            alert('❌ ' + t('billSaveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleShareWhatsApp = async () => {
        if (!billDetails.buyerId || cart.length === 0) return alert('Please select a customer and add items first.');
        const buyer = buyers.find(b => b.id === billDetails.buyerId);
        
        const displayDate = (iso) => {
            if (!iso) return '';
            const [y, m, d] = iso.split('-');
            return `${d}/${m}/${y}`;
        };

        const dateLabel = displayDate(billDetails.date);
        const buyerContact = (buyer?.contact || '').replace(/\D/g, '');
        const whatsappNumber = buyerContact.length === 10 ? '91' + buyerContact : buyerContact;

        try {
            const { blob, url } = await generateBuyerReceiptCanvas({
                buyer: {
                    id: buyer.id,
                    displayId: buyer.displayId,
                    name: (lang === 'ta' && buyer.nameTa) ? buyer.nameTa : buyer.name,
                },
                salesItems: cart,
                salesTotal: grandTotal,
                paymentsTotal: cashRec,
                cashLess: cashLess,
                prevBalance: oldBalance,
                dateLabel,
                bizInfo: settings,
                labels: {
                    date: t('date'),
                    nameLabel: t('name'),
                    oldBalance: t('oldBalance'),
                    cashRec: t('cashRec'),
                    cashLess: t('cashLess'),
                    balance: t('balance'),
                    particulars: t('particulars'),
                    weight: t('weight'),
                    rate: t('rate'),
                    total: t('total'),
                    grandTotalLabel: t('grandTotal'),
                }
            });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'bill.png', { type: 'image/png' })] })) {
                await navigator.share({
                    files: [new File([blob], 'bill.png', { type: 'image/png' })],
                    title: `Bill – ${buyer.name}`,
                });
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = `bill_${buyer.name.replace(/\s+/g,'_')}.png`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 30000);

                if (whatsappNumber) {
                    setTimeout(() => {
                        window.open(`https://wa.me/${whatsappNumber}`, '_blank');
                    }, 500);
                }
            }
        } catch (err) {
            console.error('WhatsApp share error:', err);
            alert('❌ Failed to share bill: ' + err.message);
        }
    };

    // ── Keyboard navigation helpers ──
    const focusStyle = (ref) => {
        ref.current?.focus();
        ref.current?.select?.();
    };

    // ── Keyboard navigation row logic ──
    const onDateKey = (e) => {
        if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            focusStyle(refCustomer);
        }
    };

    const onCustomerKey = (e) => {
        if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'Tab') {
            if (billDetails.buyerId) { e.preventDefault(); focusStyle(refFlower); }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault(); focusStyle(refDate);
        }
    };

    const onFlowerKey = (e) => {
        if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault(); focusStyle(refQty);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault(); focusStyle(refCustomer);
        }
    };

    const onQtyKey = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (cart.length > 0) {
                setSelectedRowIdx(prev => Math.min(prev + 1, cart.length - 1));
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cart.length > 0) {
                setSelectedRowIdx(prev => prev === -1 ? cart.length - 1 : Math.max(0, prev - 1));
            }
        } else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            setSelectedColIdx(-1);
            focusStyle(refRate);
        } else if (e.key === 'ArrowLeft') {
            if (selectedRowIdx !== -1) {
                e.preventDefault();
                setSelectedColIdx(prev => prev === -1 ? 2 : Math.max(0, prev - 1));
            } else {
                e.preventDefault(); focusStyle(refFlower);
            }
        }
    };

    const onRateKey = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (cart.length > 0) {
                setSelectedRowIdx(prev => Math.min(prev + 1, cart.length - 1));
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cart.length > 0) {
                setSelectedRowIdx(prev => prev === -1 ? cart.length - 1 : Math.max(0, prev - 1));
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentItem.flowerType && currentItem.quantity && currentItem.price) {
                addItem();
            } else { focusStyle(refAddBtn); }
        } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
            if (selectedRowIdx !== -1) {
                e.preventDefault();
                setSelectedColIdx(prev => prev === 2 ? 0 : prev + 1);
            } else {
                e.preventDefault(); focusStyle(refAddBtn);
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault(); focusStyle(refQty);
        }
    };

    const onAddBtnKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); addItem();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault(); focusStyle(refRate);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault(); refList.current?.focus(); setSelectedRowIdx(0);
        }
    };

    const onTableKey = (e) => {
        if (cart.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedRowIdx(prev => prev === -1 ? 0 : Math.min(prev + 1, cart.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedRowIdx === 0) {
                setSelectedRowIdx(-1);
                refAddBtn.current?.focus();
            } else {
                setSelectedRowIdx(prev => Math.max(0, prev - 1));
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setSelectedColIdx(prev => (prev === 2 || prev === -1) ? 0 : prev + 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setSelectedColIdx(prev => (prev <= 0) ? 2 : prev - 1);
        } else if (e.key === 'Escape') {
            setSelectedRowIdx(-1);
            setSelectedColIdx(-1);
            refFlower.current?.focus();
        }
    };

    return (
        <>
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', padding: '24px 28px', fontFamily: 'var(--font-sans)', minHeight: '80vh' }}>

            {/* ── Vertical Layout ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* ══ TOP: Entry Form (Shrinked) ══ */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>

                    {/* Form Header - 3 Column Layout */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', gap: '20px' }}>
                        
                        {/* Left: Entry Label + Date Stack */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '15px' }}>📝</span>
                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    {t('newPurchaseEntry')}
                                </span>
                            </div>
                            <div style={{ width: '135px' }}>
                                <input
                                    ref={refDate}
                                    type="date"
                                    value={billDetails.date}
                                    onChange={e => setBillDetails(prev => ({ ...prev, date: e.target.value }))}
                                    onKeyDown={onDateKey}
                                    style={{ ...INPUT_S, padding: '5px 8px', fontSize: '12px', border: '1.5px solid #bbf7d0', boxShadow: '0 2px 4px rgba(22,163,74,0.05)' }}
                                />
                            </div>
                        </div>

                        {/* Center: Main Title */}
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#16a34a', fontFamily: 'var(--font-display)', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>
                                {t('sales')}
                            </h2>
                        </div>

                        {/* Right: Top Right Financial Bar - VERTICALIZED */}
                        <div style={{ 
                            justifySelf: 'end',
                            display: 'flex', flexDirection: 'column', gap: '8px', 
                            padding: '12px 20px', background: '#f8fafc', borderRadius: '12px', 
                            border: '1.5px solid #e2e8f0', minWidth: '220px' 
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>{t('oldBalance').toUpperCase()}</span>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>{fmt(oldBalance)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>{t('cashRec').toUpperCase()}</span>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>{fmt(cashRec)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>{t('cashLess').toUpperCase()}</span>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>{fmt(cashLess)}</span>
                            </div>
                            <div style={{ height: '1px', background: '#e2e8f0', margin: '2px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a' }}>{t('balance').toUpperCase()}</span>
                                <span style={{ fontSize: '18px', fontWeight: 900, color: '#16a34a' }}>{fmt(runningBalance)}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end' }}>
                        {/* Customer */}
                        <div style={{ flex: '1.2', minWidth: '240px' }}>
                            <label style={LABEL_S}>{t('customer')}</label>
                            <CustomerSearch
                                buyers={buyers}
                                value={billDetails.buyerId}
                                onChange={(id) => setBillDetails(prev => ({ ...prev, buyerId: id }))}
                                inputRef={refCustomer}
                                onKeyDown={onCustomerKey}
                            />
                        </div>

                        {/* Entry row - merged with Save button */}
                        <div style={{ flex: '3', display: 'grid', gridTemplateColumns: '1.5fr 0.6fr 0.6fr 0.8fr 0.8fr', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div>
                                <label style={LABEL_S}>{t('flowerVariety')}</label>
                                <select
                                    ref={refFlower}
                                    value={currentItem.flowerType}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, flowerType: e.target.value }))}
                                    onKeyDown={onFlowerKey}
                                    style={{ ...INPUT_S, padding: '7px 10px' }}
                                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                >
                                    <option value="">Flower</option>
                                    {flowers.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={LABEL_S}>{t('weightQty')}</label>
                                <input
                                    ref={refQty}
                                    type="number"
                                    placeholder="0"
                                    value={currentItem.quantity}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))}
                                    onKeyDown={onQtyKey}
                                    style={{ ...INPUT_S, background: '#fff', padding: '7px 10px' }}
                                    onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.select(); }}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={LABEL_S}>{t('rate')}</label>
                                <input
                                    ref={refRate}
                                    type="number"
                                    placeholder="0"
                                    value={currentItem.price}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, price: e.target.value }))}
                                    onKeyDown={onRateKey}
                                    style={{ ...INPUT_S, background: '#fff', padding: '7px 10px' }}
                                    onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.select(); }}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={LABEL_S}>{t('total')}</label>
                                <div style={{ ...INPUT_S, background: '#fff', color: '#16a34a', fontWeight: 800, border: '1.5px solid #bbf7d0', cursor: 'default', display: 'flex', alignItems: 'center', padding: '7px 10px', height: '37px' }}>
                                    ₹{currentTotal.toFixed(0)}
                                </div>
                            </div>
                            <div>
                                <label style={LABEL_S}>&nbsp;</label>
                                <button
                                    ref={refAddBtn}
                                    onClick={addItem}
                                    onKeyDown={onAddBtnKey}
                                    style={{
                                        width: '100%', height: '37px', background: '#16a34a', border: 'none',
                                        borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 800,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        gap: '4px', fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#15803d'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#16a34a'; }}
                                >
                                    <Plus size={14} strokeWidth={3} /> {t('addNew')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══ BOTTOM: Batch Summary ══ */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>

                    {/* Header */}
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>{t('currentBatchItems')}</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 10px', borderRadius: '100px', background: cart.length > 0 ? '#16a34a' : '#e2e8f0', color: cart.length > 0 ? '#fff' : '#64748b' }}>
                                {cart.length} Items
                            </span>
                        </div>
                    </div>

                    {/* Row Headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 2fr) 1fr 1fr 1.2fr 80px', padding: '8px 20px', borderBottom: '1px solid #f1f5f9', gap: '10px', background: '#fcfcfc' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'left' }}>FLOWER</span>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>QTY</span>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>RATE</span>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>TOTAL</span>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>ACTION</span>
                    </div>

                    {/* Table of items */}
                    <div
                        ref={refList}
                        tabIndex={0}
                        onKeyDown={onTableKey}
                        onFocus={() => selectedRowIdx === -1 && cart.length > 0 && setSelectedRowIdx(0)}
                        style={{
                            minHeight: '120px', maxHeight: '400px', overflowY: 'auto', outline: 'none',
                            border: '2px solid transparent', transition: 'border-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                    >
                        {cart.length === 0 ? (
                            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>
                                No items added yet. Items will appear here line by line as you save them.
                            </div>
                        ) : (
                            cart.map((item, idx) => (
                                <div key={item.id}
                                    style={{
                                        display: 'grid', gridTemplateColumns: 'minmax(160px, 2fr) 1fr 1fr 1.2fr 80px',
                                        padding: '10px 20px', borderBottom: '1px solid #f8fafc', alignItems: 'center', gap: '10px',
                                        background: selectedRowIdx === idx ? '#1e293b' : 'transparent',
                                        color: selectedRowIdx === idx ? '#fff' : '#1e293b',
                                        transition: 'all 0.15s',
                                        position: 'relative'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = selectedRowIdx === idx ? '#1e293b' : '#f9fafb'}
                                    onMouseLeave={e => e.currentTarget.style.background = selectedRowIdx === idx ? '#1e293b' : 'transparent'}
                                >
                                    {selectedRowIdx === idx && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#10b981' }} />}
                                    <span style={{ fontSize: '14px', fontWeight: 600, textAlign: 'left' }}>{item.flowerType}</span>
                                    <span style={{ 
                                        fontSize: '14px', textAlign: 'center', fontWeight: 500, 
                                        color: selectedRowIdx === idx ? '#fff' : '#64748b',
                                        background: (selectedRowIdx === idx && selectedColIdx === 0) ? '#059669' : 'transparent', 
                                        borderRadius: '4px', padding: '2px 0'
                                    }}>{item.quantity}</span>
                                    <span style={{ 
                                        fontSize: '14px', textAlign: 'center', fontWeight: 500, 
                                        color: selectedRowIdx === idx ? '#fff' : '#64748b',
                                        background: (selectedRowIdx === idx && selectedColIdx === 1) ? '#059669' : 'transparent', 
                                        borderRadius: '4px', padding: '2px 0'
                                    }}>{item.price}</span>
                                    <span style={{ 
                                        fontSize: '14px', fontWeight: 700, textAlign: 'right',
                                        color: (selectedRowIdx === idx && selectedColIdx === 2) ? '#fff' : (selectedRowIdx === idx ? '#10b981' : '#16a34a'),
                                        background: (selectedRowIdx === idx && selectedColIdx === 2) ? '#059669' : 'transparent', 
                                        borderRadius: '4px', padding: '2px 4px'
                                    }}>₹{item.total.toFixed(0)}</span>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                        <button onClick={() => editItem(item)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedRowIdx === idx ? '#94a3b8' : '#94a3b8', display: 'flex', padding: '4px' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                                            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                        ><Pencil size={14} /></button>
                                        <button onClick={() => removeItem(item.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedRowIdx === idx ? '#fca5a5' : '#fca5a5', display: 'flex', padding: '4px' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = '#fca5a5'}
                                        ><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer / Summary - Grid Aligned */}
                    <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1.5px solid #e5e7eb', display: 'grid', gridTemplateColumns: 'minmax(160px, 2fr) 1fr 1fr 1.2fr 80px', gap: '10px', alignItems: 'center' }}>
                        
                        {/* LEFT: Actions */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                                onClick={handleSaveBill}
                                disabled={cart.length === 0 || !billDetails.buyerId || isSaving}
                                style={{
                                    padding: '10px 24px', background: cart.length === 0 || !billDetails.buyerId ? '#bbf7d0' : '#16a34a',
                                    border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: 800,
                                    cursor: cart.length === 0 || !billDetails.buyerId || isSaving ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                                }}
                            >
                                {isSaving
                                    ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                    : <><span style={{ fontSize: '15px' }}>🚀</span> {t('submitSales')}</>
                                }
                            </button>

                            <button onClick={() => cart.length > 0 && window.print()}
                                style={{ width: '38px', height: '38px', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            ><Printer size={16} /></button>

                            <button onClick={handleShareWhatsApp}
                                style={{ width: '38px', height: '38px', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            ><MessageCircle size={16} /></button>
                        </div>

                        {/* QTY TOTAL */}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>TOTAL QTY</div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: '#374151' }}>{totalQty.toFixed(1)}</div>
                        </div>

                        {/* RATE COLUMN SPACER */}
                        <div />

                        {/* Today's Total (Old Grand Total) */}
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{t('todayTotal')}</div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a' }}>{fmt(grandTotal)}</div>
                        </div>

                        {/* ACTION COLUMN SPACER */}
                        <div />
                    </div>

                    <div style={{ padding: '12px 20px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '40px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: '15px' }}>
                                {t('grandTotal')} ({t('balance')} + {t('todayTotal')})
                            </span>
                            <span style={{ fontSize: '28px', fontWeight: 900, color: '#10b981' }}>
                                {fmt(absoluteGrandTotal)}
                            </span>
                        </div>
                        <div style={{ width: '80px' }} /> {/* Matches action column width */}
                    </div>
                </div>
            </div>
        </div>

        {/* ── PRINT-ONLY BILL TEMPLATE (Hidden in UI) ── */}
        <style>
            {`
                @media print {
                    @page { size: A4; margin: 15mm; }
                    body { background: #fff !important; }
                    body * { visibility: hidden; }
                    #bill-print-template, #bill-print-template * { visibility: visible; }
                    #bill-print-template { 
                        display: block !important;
                        position: absolute; left: 0; top: 0; width: 100%; 
                        padding: 0; color: #000; font-family: 'serif'; 
                    }
                }
            `}
        </style>
        
        <div id="bill-print-template" style={{ display: 'none' }}>
            <div style={{ textAlign: 'center', marginBottom: '2px', fontSize: '13px' }}>{settings.motto || 'SRI RAMA JAYAM'}</div>
            <div style={{ textAlign: 'center', marginBottom: '10px', fontSize: '13px' }}>SRI PERIYANDAVAR THUNAI</div>
            
            <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 900, marginBottom: '2px' }}>{settings.name || 'S.V.M'}</div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{settings.type || 'SRI VALLI FLOWER MERCHANT'}</div>
                <div style={{ fontSize: '13px', marginBottom: '5px' }}>{settings.address || 'B-7, FLOWER MARKET, TINDIVANAM.'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
                    <span>CELL : {settings.phone1 || settings.phone2 || '9443247771'}</span>
                    <span>CELL : {settings.phone2 || '9952535057'}</span>
                </div>
            </div>

            {/* Sub-header row */}
            <div style={{ display: 'flex', border: '1px solid #000', borderTop: 'none', padding: '4px 10px' }}>
                <div style={{ flex: 1, fontWeight: 700 }}>{t('sales').toUpperCase()}</div>
                <div style={{ flex: 1, textAlign: 'right', fontWeight: 700 }}>{t('date')} : {billDetails.date}</div>
            </div>

            {/* Customer & Mini Financials Merged Container */}
            <div style={{ display: 'flex', border: '1px solid #000', borderTop: 'none', minHeight: '80px' }}>
                <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '5px 10px' }}>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>CODE : <strong style={{ marginLeft: '10px' }}>{selectedBuyer?.displayId || '---'}</strong></div>
                    <div style={{ fontSize: '14px' }}>{t('customerName')} : <strong style={{ marginLeft: '10px' }}>{selectedBuyer?.name?.toUpperCase() || '---'}</strong></div>
                </div>
                <div style={{ flex: 1, borderLeft: '1px solid #000' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', height: '100%' }}>
                        <tbody>
                            <tr>
                                <td style={{ borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontSize: '13px' }}>{t('oldBalance')}</td>
                                <td style={{ borderBottom: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>{oldBalance.toFixed(0)}</td>
                            </tr>
                            <tr>
                                <td style={{ borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontSize: '13px' }}>{t('cashLess')}</td>
                                <td style={{ borderBottom: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>{cashLess.toFixed(0)}</td>
                            </tr>
                            <tr>
                                <td style={{ borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontSize: '13px' }}>{t('cashRec')}</td>
                                <td style={{ borderBottom: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>{cashRec.toFixed(0)}</td>
                            </tr>
                            <tr>
                                <td style={{ borderRight: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontSize: '13px' }}>{t('balance')}</td>
                                <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>{runningBalance.toFixed(0)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', borderTop: 'none' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #000' }}>
                        <th style={{ borderRight: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '13px' }}>{t('flower')}</th>
                        <th style={{ borderRight: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '13px' }}>{t('qty')}</th>
                        <th style={{ borderRight: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '13px' }}>{t('rate')}</th>
                        <th style={{ padding: '6px', textAlign: 'center', fontSize: '13px' }}>{t('total')}</th>
                    </tr>
                </thead>
                <tbody>
                    {cart.map((item, idx) => (
                        <tr key={idx}>
                            <td style={{ borderRight: '1px solid #000', padding: '4px 8px', fontSize: '14px', fontWeight: 600 }}>{item.flowerType}</td>
                            <td style={{ borderRight: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontSize: '14px' }}>{parseFloat(item.quantity).toFixed(3)}</td>
                            <td style={{ borderRight: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontSize: '14px' }}>{parseFloat(item.price).toFixed(0)}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '14px', fontWeight: 700 }}>{parseFloat(item.total).toFixed(0)}</td>
                        </tr>
                    ))}
                    {[...Array(Math.max(0, 12 - cart.length))].map((_, i) => (
                        <tr key={'f' + i} style={{ height: '24px' }}>
                            <td style={{ borderRight: '1px solid #000' }} />
                            <td style={{ borderRight: '1px solid #000' }} />
                            <td style={{ borderRight: '1.5px solid #000', borderRightStyle: 'solid', borderRightColor: '#000' }} />
                            <td />
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Grand Total Row */}
            <div style={{ display: 'flex', border: '1px solid #000', borderTop: 'none', padding: '8px 15px', alignItems: 'center' }}>
                <div style={{ flex: 1, fontSize: '18px', fontWeight: 900, textAlign: 'center' }}>{t('grandTotal').toUpperCase()}</div>
                <div style={{ fontSize: '20px', fontWeight: 900, width: '150px', textAlign: 'right' }}>{absoluteGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
        </div>
        </>
    );
};

export default SalesEntry;
