import React, { useState, useEffect, useRef, useContext } from 'react';
import { Plus, Trash2, Printer, MessageCircle } from 'lucide-react';
import { saveSale, subscribeToCollection, db } from '../utils/storage';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { LangContext } from '../components/Layout';

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
    const { t } = useContext(LangContext);
    const [flowers, setFlowers]   = useState([]);
    const [buyers, setBuyers]     = useState([]);
    const [cart, setCart]         = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [billDetails, setBillDetails] = useState({
        buyerId: '', date: new Date().toLocaleDateString('en-CA'),
    });
    const [currentItem, setCurrentItem] = useState({ flowerType: '', quantity: '', price: '' });

    // Refs for keyboard navigation
    const refCustomer  = useRef(null);
    const refDate      = useRef(null);
    const refFlower    = useRef(null);
    const refQty       = useRef(null);
    const refRate      = useRef(null);
    const refAddBtn    = useRef(null);

    useEffect(() => {
        const u1 = subscribeToCollection('products', (data) => {
            setFlowers(data.length === 0
                ? ['Rose', 'Jasmine', 'Marigold', 'Crossandra', 'Lotus', 'Mullai']
                : data.map(f => f.name));
        });
        const u2 = subscribeToCollection('buyers', setBuyers);
        return () => { u1(); u2(); };
    }, []);

    const addItem = () => {
        if (!currentItem.flowerType || !currentItem.quantity || !currentItem.price) return;
        const qty  = parseFloat(currentItem.quantity);
        const rate = parseFloat(currentItem.price);
        if (isNaN(qty) || isNaN(rate)) return;
        setCart(prev => [...prev, { ...currentItem, id: Date.now(), total: qty * rate }]);
        setCurrentItem({ flowerType: '', quantity: '', price: '' });
        // Return focus to flower for fast entry of next item
        setTimeout(() => refFlower.current?.focus(), 50);
    };

    const removeItem = (id) => setCart(prev => prev.filter(i => i.id !== id));

    const grandTotal   = cart.reduce((s, i) => s + i.total, 0);
    const totalQty     = cart.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
    const currentTotal = parseFloat(currentItem.quantity || 0) * parseFloat(currentItem.price || 0);

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

    const handleShareWhatsApp = () => {
        if (!billDetails.buyerId || cart.length === 0) return alert('Please select a customer and add items first.');
        const buyer = buyers.find(b => b.id === billDetails.buyerId);
        let msg = `*FLOWER MARKET BILL*\n------------------------\nDate: ${billDetails.date}\nCustomer: ${buyer?.name || '---'}\n\n`;
        cart.forEach(item => { msg += `• ${item.flowerType}: ${item.quantity} x ₹${item.price} = ₹${item.total.toFixed(2)}\n`; });
        msg += `\n*GRAND TOTAL: ₹${grandTotal.toFixed(2)}*\n------------------------\nThank you!`;
        const phone = (buyer?.contact || '').replace(/\D/g, '');
        window.open(`https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    // ── Keyboard navigation helpers ──
    const focusStyle = (ref) => {
        ref.current?.focus();
        ref.current?.select?.();
    };

    const onEnterGo = (nextRef) => (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            focusStyle(nextRef);
        }
    };

    const onRateKey = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (currentItem.flowerType && currentItem.quantity && currentItem.price) {
                addItem();  // Enter on Rate → add row and go back to flower
            } else {
                focusStyle(refAddBtn);
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            focusStyle(refAddBtn);
        }
    };

    const onAddBtnKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            addItem();
        }
    };

    return (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', padding: '24px 28px', fontFamily: 'var(--font-sans)', minHeight: '80vh' }}>

            {/* ── Page Title ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: 0 }}>
                    {t('sales')}
                </h2>
                <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>Log details of flowers sold to customers.</span>
            </div>

            {/* ── Two Column Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

                {/* ══ LEFT: Entry Form ══ */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', background: '#fff' }}>

                    {/* Sub-title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                        <span style={{ fontSize: '16px' }}>📝</span>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {t('newPurchaseEntry')}
                        </span>
                    </div>

                    {/* Customer */}
                    <div style={{ marginBottom: '14px' }}>
                        <label style={LABEL_S}>{t('customer')}</label>
                        <CustomerSearch
                            buyers={buyers}
                            value={billDetails.buyerId}
                            onChange={(id) => setBillDetails(prev => ({ ...prev, buyerId: id }))}
                            inputRef={refCustomer}
                            onKeyDown={onEnterGo(refDate)}
                        />
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px', marginLeft: '2px' }}>
                            ↓↑ navigate · Enter select · Tab next
                        </div>
                    </div>

                    {/* Date + Flower row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                        <div>
                            <label style={LABEL_S}>{t('saleDate')}</label>
                            <input
                                ref={refDate}
                                type="date"
                                value={billDetails.date}
                                onChange={e => setBillDetails(prev => ({ ...prev, date: e.target.value }))}
                                onKeyDown={onEnterGo(refFlower)}
                                style={INPUT_S}
                                onFocus={e => e.target.style.borderColor = '#16a34a'}
                                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>
                        <div>
                            <label style={LABEL_S}>{t('flowerVariety')}</label>
                            <select
                                ref={refFlower}
                                value={currentItem.flowerType}
                                onChange={e => setCurrentItem(prev => ({ ...prev, flowerType: e.target.value }))}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') { e.preventDefault(); focusStyle(refQty); }
                                    else if (e.key === 'Tab') { e.preventDefault(); focusStyle(refQty); }
                                }}
                                style={INPUT_S}
                                onFocus={e => e.target.style.borderColor = '#16a34a'}
                                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                            >
                                <option value="">Select Flower</option>
                                {flowers.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Weight / Rate / Total */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={LABEL_S}>{t('weightQty')}</label>
                                <input
                                    ref={refQty}
                                    type="number"
                                    placeholder="0.00"
                                    value={currentItem.quantity}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))}
                                    onKeyDown={onEnterGo(refRate)}
                                    style={{ ...INPUT_S, background: '#fff' }}
                                    onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.select(); }}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={LABEL_S}>{t('rate')}</label>
                                <input
                                    ref={refRate}
                                    type="number"
                                    placeholder="0.00"
                                    value={currentItem.price}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, price: e.target.value }))}
                                    onKeyDown={onRateKey}
                                    style={{ ...INPUT_S, background: '#fff' }}
                                    onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.select(); }}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={LABEL_S}>{t('total')}</label>
                                <div style={{ ...INPUT_S, background: '#f1f5f9', color: '#16a34a', fontWeight: 800, border: 'none', cursor: 'default' }}>
                                    ₹{currentTotal.toFixed(2)}
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px' }}>
                            💡 Press <kbd style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>Enter</kbd> on Rate to auto-add row
                        </div>
                    </div>

                    {/* Add New button */}
                    <button
                        ref={refAddBtn}
                        onClick={addItem}
                        onKeyDown={onAddBtnKey}
                        style={{
                            width: '100%', padding: '13px', background: '#16a34a', border: 'none',
                            borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '8px', fontFamily: 'var(--font-sans)', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#15803d'}
                        onMouseLeave={e => e.currentTarget.style.background = '#16a34a'}
                    >
                        <Plus size={18} strokeWidth={3} /> {t('addNew')}
                    </button>
                </div>

                {/* ══ RIGHT: Batch Summary ══ */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>

                    {/* Header */}
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{t('currentBatchItems')}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '100px', background: cart.length > 0 ? '#16a34a' : '#e2e8f0', color: cart.length > 0 ? '#fff' : '#64748b' }}>
                            {cart.length} Items
                        </span>
                    </div>

                    {/* Column headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 18px', borderBottom: '1px solid #f1f5f9', gap: '8px' }}>
                        {['FLOWER', 'QTY', 'TOTAL'].map((h, i) => (
                            <span key={h} style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>
                        ))}
                    </div>

                    {/* Rows */}
                    <div style={{ flex: 1, minHeight: '160px', maxHeight: '240px', overflowY: 'auto', padding: '0 18px' }}>
                        {cart.length === 0 ? (
                            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>
                                No items added yet.
                            </div>
                        ) : (
                            cart.map((item, idx) => (
                                <div key={item.id}
                                    style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 0', borderBottom: '1px solid #f8fafc', alignItems: 'center', gap: '8px' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{item.flowerType}</span>
                                    <span style={{ fontSize: '13px', color: '#64748b', textAlign: 'right' }}>{item.quantity}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>₹{item.total.toFixed(2)}</span>
                                        <button onClick={() => removeItem(item.id)}
                                            title="Remove"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', display: 'flex', padding: '2px' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = '#fca5a5'}
                                        ><Trash2 size={13} /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Totals bar */}
                    <div style={{ padding: '14px 18px', background: '#f8fafc', borderTop: '1.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>TOTAL QUANTITY</div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: '#374151' }}>{totalQty.toFixed(2)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>GRAND TOTAL</div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a' }}>₹{grandTotal.toFixed(2)}</div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ padding: '14px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {/* Submit */}
                        <button
                            onClick={handleSaveBill}
                            disabled={cart.length === 0 || !billDetails.buyerId || isSaving}
                            style={{
                                flex: 1, padding: '12px', background: cart.length === 0 || !billDetails.buyerId ? '#bbf7d0' : '#16a34a',
                                border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 700,
                                cursor: cart.length === 0 || !billDetails.buyerId || isSaving ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                fontFamily: 'var(--font-sans)', transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#15803d'; }}
                            onMouseLeave={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#16a34a'; }}
                        >
                            {isSaving
                                ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                : <><span style={{ fontSize: '16px' }}>🚀</span> {t('submitSales')}</>
                            }
                        </button>

                        {/* Print */}
                        <button onClick={() => cart.length > 0 && window.print()}
                            title="Print Bill"
                            style={{ width: '42px', height: '42px', border: '1.5px solid #e2e8f0', borderRadius: '10px', background: '#fff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        ><Printer size={18} /></button>

                        {/* WhatsApp */}
                        <button onClick={handleShareWhatsApp}
                            title="WhatsApp Share"
                            style={{ width: '42px', height: '42px', border: '1.5px solid #e2e8f0', borderRadius: '10px', background: '#fff', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        ><MessageCircle size={18} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesEntry;
