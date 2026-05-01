import React, { useState, useEffect, useRef, useContext } from 'react';
import { Plus, Trash2, Printer, MessageCircle, Pencil, History, Clock } from 'lucide-react';
import { saveSale, subscribeToCollection, db } from '../utils/storage';
import { doc, updateDoc, increment, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { generateBuyerReceiptCanvas } from '../utils/receiptCanvas';
import WhatsAppIcon from '../components/WhatsAppIcon';

/* ── Keyboard-navigable Searchable Customer Dropdown ── */
const SearchSelect = ({ items, value, onChange, onKeyDown, inputRef, placeholder, lang }) => {
    const [query, setQuery]         = useState('');
    const [open, setOpen]           = useState(false);
    const [cursor, setCursor]       = useState(0);
    const listRef                   = useRef(null);

    const selectedItem = items.find(i => i.id === value || i.name === value);
    const selectedName = selectedItem ? (lang === 'ta' ? (selectedItem.taName || selectedItem.name) : selectedItem.name) : '';

    const filtered = query.trim()
        ? items.filter(i => {
            const n = i.name?.toLowerCase() || '';
            const tn = i.taName?.toLowerCase() || '';
            const q = query.toLowerCase();
            return n.includes(q) || tn.includes(q) || (i.displayId && String(i.displayId).includes(query));
        })
        : items;

    const choose = (item) => {
        onChange(item);
        setQuery(lang === 'ta' ? (item.taName || item.name) : item.name);
        setOpen(false);
    };

    const handleKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && filtered[cursor]) {
                choose(filtered[cursor]);
                if (onKeyDown) onKeyDown(e);
            }
            else if (onKeyDown) onKeyDown(e);
        }
        else if (e.key === 'Escape') setOpen(false);
        else if (e.key === 'Tab') {
            if (open && filtered[cursor]) choose(filtered[cursor]);
            setOpen(false);
            if (onKeyDown) onKeyDown(e);
        }
    };

    useEffect(() => {
        if (listRef.current) {
            const els = listRef.current.querySelectorAll('li');
            els[cursor]?.scrollIntoView({ block: 'nearest' });
        }
    }, [cursor]);

    return (
        <div style={{ position: 'relative' }}>
            <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={open ? query : selectedName}
                onFocus={() => { setQuery(''); setOpen(true); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 200)}
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
                    {filtered.map((item, i) => (
                        <li key={item.id || item.name} onMouseDown={() => choose(item)}
                            style={{
                                padding: '8px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px',
                                fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                                background: i === cursor ? '#f0fdf4' : 'transparent',
                                color: i === cursor ? '#15803d' : '#374151',
                            }}
                            onMouseEnter={() => setCursor(i)}
                        >
                            {item.displayId && <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>#{item.displayId}</span>}
                            {lang === 'ta' ? (item.taName || item.name) : item.name}
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
    fontSize: '14px', fontWeight: 600, color: '#1e293b',
    outline: 'none', fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
};
const LABEL_S = {
    display: 'block', fontSize: '10px', fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px',
};

const SalesEntry = () => {
    const { t, lang } = useContext(LangContext);
    const [flowers, setFlowers]   = useState([]);
    const [buyers, setBuyers]     = useState([]);
    const [allSales, setAllSales] = useState([]);
    const [allPayments, setAllPayments] = useState([]);
    const [settings, setSettings] = useState({ name: 'S.V.M', type: '', address: '', phone1: '', phone2: '' });
    
    const [buyerId, setBuyerId] = useState('');
    const [date, setDate]       = useState(new Date().toLocaleDateString('en-CA'));
    const [currentItem, setCurrentItem] = useState({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
    const [isSaving, setIsSaving] = useState(false);

    // Refs
    const refDate     = useRef(null);
    const refCustomer = useRef(null);
    const refFlower   = useRef(null);
    const refQty      = useRef(null);
    const refRate     = useRef(null);
    const refAddBtn   = useRef(null);

    useEffect(() => {
        const u1 = subscribeToCollection('products', (data) => {
            setFlowers(data.length === 0
                ? [{ name: 'Rose', taName: 'ரோஜா' }, { name: 'Jasmine', taName: 'மல்லிகை' }, { name: 'Marigold', taName: 'சாமந்தி' }]
                : data.map(f => ({ name: f.name, taName: f.taName })));
        });
        const u2 = subscribeToCollection('buyers', setBuyers);
        const u3 = subscribeToCollection('sales', setAllSales);
        const u4 = subscribeToCollection('payments', setAllPayments);
        const u5 = subscribeToCollection('system', (data) => {
            const s = data.find(i => i.id === 'settings');
            if (s) setSettings(s);
        }, false); // system collection is global, not tenant-scoped
        return () => { u1(); u2(); u3(); u4(); u5(); };
    }, []);

    const toDateStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };

    // Filter today's transactions for the selected customer
    const todayEntries = React.useMemo(() => {
        return allSales.filter(s => {
            const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
            if (d !== date) return false;
            // If buyerId is selected, filter by it. Otherwise, show all.
            if (buyerId && s.buyerId !== buyerId) return false;
            return true;
        }).sort((a, b) => {
            const tA = (a.timestamp?.toMillis?.() || a.createdAt?.toMillis?.() || 0);
            const tB = (b.timestamp?.toMillis?.() || b.createdAt?.toMillis?.() || 0);
            return tB - tA;
        });
    }, [allSales, buyerId, date]);

    const financialStats = React.useMemo(() => {
        const buyer = buyers.find(b => b.id === buyerId);
        if (!buyer) return { oldBalance: 0, cashRec: 0, cashLess: 0, todayTotal: 0, finalBalance: 0 };
        
        const todayTotal = todayEntries.reduce((s, e) => s + (e.grandTotal || 0), 0);
        const dayPayments = allPayments.filter(p => {
            if (p.entityId !== buyerId) return false;
            const d = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp))) : null;
            return d === date;
        });
        const cashRec  = dayPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const cashLess = dayPayments.reduce((s, p) => s + (p.cashLess || 0), 0);
        
        // currentDebt = what's in DB right now
        // oldBalance = Debt - todayEntriesTotal + cashRec + cashLess (approximately)
        // Let's simplify: Today's live final balance is simply consumer.balance
        const finalBalance = buyer.balance || 0;
        const oldBalance = finalBalance - todayTotal + cashRec + cashLess;
        const ledgerBalance = oldBalance - cashRec - cashLess;

        return { oldBalance, cashRec, cashLess, todayTotal, finalBalance, ledgerBalance };
    }, [buyers, buyerId, todayEntries, allPayments, date]);

    const handleAddItem = async () => {
        if (!buyerId || !currentItem.flowerType || !currentItem.quantity || !currentItem.price || isSaving) return;
        setIsSaving(true);
        const qty  = parseFloat(currentItem.quantity);
        const rate = parseFloat(currentItem.price);
        const total = qty * rate;
        
        try {
            const buyer = buyers.find(b => b.id === buyerId);
            const saleData = {
                buyerId,
                date,
                buyerName: buyer?.name || 'Unknown',
                items: [{ ...currentItem, total }],
                grandTotal: total,
                timestamp: serverTimestamp()
            };
            await saveSale(saleData);
            await updateDoc(doc(db, 'buyers', buyerId), { balance: increment(total) });
            
            setCurrentItem({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
            setTimeout(() => refFlower.current?.focus(), 50);
        } catch (err) {
            alert('Error saving item: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditItem = async (sale) => {
        setBuyerId(sale.buyerId);
        setCurrentItem(sale.items[0]);
        // To edit, we basically populate the fields and delete the old entry
        // so when they click 'Save' again, it creates a clean updated version.
        try {
            await deleteDoc(doc(db, 'sales', sale.id));
            await updateDoc(doc(db, 'buyers', sale.buyerId), { balance: increment(-(sale.grandTotal || 0)) });
            // Move focus to flower dropdown or qty
            setTimeout(() => refFlower.current?.focus(), 100);
        } catch (err) {
            console.error('Edit initialization failed:', err);
        }
    };

    const handleDeleteItem = async (sale) => {
        if (!window.confirm(t('delete') + '?')) return;
        try {
            await deleteDoc(doc(db, 'sales', sale.id));
            await updateDoc(doc(db, 'buyers', sale.buyerId), { balance: increment(-(sale.grandTotal || 0)) });
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
    const formatTime = (ts) => {
        if (!ts) return '--:--';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return '--:--';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const handleShareWhatsApp = async () => {
        if (!buyerId || todayEntries.length === 0) return alert('No items to share for today.');
        const buyer = buyers.find(b => b.id === buyerId);
        const { oldBalance, cashRec, cashLess, todayTotal } = financialStats;

        try {
            const { blob, url } = await generateBuyerReceiptCanvas({
                buyer: {
                    id: buyer.id,
                    displayId: buyer.displayId,
                    name: lang === 'ta' ? (buyer.nameTa || buyer.name) : buyer.name,
                },
                salesItems: todayEntries.flatMap(s => s.items || []),
                salesTotal: todayTotal,
                paymentsTotal: cashRec,
                cashLess: cashLess,
                prevBalance: oldBalance,
                dateLabel: date.split('-').reverse().join('/'),
                bizInfo: settings,
                lang: lang,
                labels: {
                    date: t('date'), nameLabel: t('name'), oldBalance: t('oldBalance'),
                    cashRec: t('cashRec'), cashLess: t('cashLess'), balance: t('balance'),
                    particulars: t('particulars'), weight: t('weight'), rate: t('rate'),
                    total: t('total'), grandTotalLabel: t('grandTotal'), sNo: t('sNo'),
                    salesLabel: t('sales'),
                }
            });

            const file = new File([blob], 'bill.png', { type: 'image/png' });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `Bill – ${buyer.name}` });
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = `bill_${buyer.name.replace(/\s+/g,'_')}.png`;
                a.click();
            }
        } catch (err) { alert('Share failed: ' + err.message); }
    };

    const handlePrint = () => {
        if (todayEntries.length > 0) window.print();
    };

    const onKey = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef.current?.focus();
            if (nextRef.current?.select) nextRef.current.select();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'var(--font-sans)' }}>
            
            {/* ── Dashboard Top Card ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                
                {/* ── Header Row (As per User Image) ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '20px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                    
                    {/* Left: Label and Date */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px' }}>📝</span>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {t('newPurchaseEntry')}
                            </span>
                        </div>
                        <div style={{ width: '150px' }}>
                            <input
                                ref={refDate}
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                style={{ 
                                    ...INPUT_S, 
                                    padding: '6px 12px', 
                                    border: '1.5px solid #d1fae5', 
                                    borderRadius: '10px', 
                                    fontSize: '13px',
                                    color: '#475569'
                                }}
                            />
                        </div>
                    </div>

                    {/* Center: Large Title */}
                    <h1 style={{ 
                        fontSize: '32px', 
                        fontWeight: 900, 
                        color: '#16a34a', 
                        fontFamily: 'var(--font-display)', 
                        letterSpacing: '0.05em', 
                        margin: 0, 
                        textTransform: 'uppercase' 
                    }}>
                        {t('sales')}
                    </h1>

                    {/* Right: Modern Financial Box */}
                    <div style={{ 
                        justifySelf: 'end',
                        background: '#f8fafc', 
                        border: '1.5px solid #e2e8f0', 
                        borderRadius: '16px', 
                        padding: '16px 20px', 
                        minWidth: '260px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{t('oldBalance')}</span>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>{fmt(financialStats.oldBalance)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase' }}>{t('cashRec')} (-)</span>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#3b82f6' }}>{fmt(financialStats.cashRec)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>{t('cashLess')} (-)</span>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#ef4444' }}>{fmt(financialStats.cashLess)}</span>
                        </div>
                        
                        <div style={{ height: '1.5px', background: '#e2e8f0', margin: '4px 0' }} />
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>{t('balance')}</span>
                            <span style={{ fontSize: '20px', fontWeight: 900, color: '#16a34a' }}>{fmt(financialStats.ledgerBalance)}</span>
                        </div>
                    </div>
                </div>

                {/* Entry Controls */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                    <div>
                        <label style={LABEL_S}>{t('selectCustomer')}</label>
                        <SearchSelect 
                            items={buyers} 
                            value={buyerId} 
                            onChange={b => setBuyerId(b.id)} 
                            inputRef={refCustomer} 
                            onKeyDown={e => onKey(e, refFlower)} 
                            placeholder={t('selectCustomer')}
                            lang={lang}
                        />
                    </div>
                    <div>
                        <label style={LABEL_S}>{t('flowerVariety')}</label>
                        <SearchSelect 
                            items={flowers} 
                            value={currentItem.flowerType} 
                            onChange={f => setCurrentItem(p => ({...p, flowerType: f.name, flowerTypeTa: f.taName || '' }))} 
                            inputRef={refFlower} 
                            onKeyDown={e => onKey(e, refQty)} 
                            placeholder={t('flowerVariety')}
                            lang={lang}
                        />
                    </div>
                    <div>
                        <label style={LABEL_S}>{t('qty')}</label>
                        <input ref={refQty} type="number" placeholder="0.00" value={currentItem.quantity} onChange={e => setCurrentItem(p => ({...p, quantity: e.target.value}))} onKeyDown={e => onKey(e, refRate)} style={INPUT_S} />
                    </div>
                    <div>
                        <label style={LABEL_S}>{t('rate')}</label>
                        <input ref={refRate} type="number" placeholder="0.00" value={currentItem.price} onChange={e => setCurrentItem(p => ({...p, price: e.target.value}))} onKeyDown={e => e.key === 'Enter' && handleAddItem()} style={INPUT_S} />
                    </div>
                    <button
                        ref={refAddBtn}
                        onClick={handleAddItem}
                        disabled={!buyerId || !currentItem.flowerType || !currentItem.quantity || !currentItem.price || isSaving}
                        style={{
                            height: '42px', padding: '0 20px', borderRadius: '10px', border: 'none',
                            background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '14px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            transition: 'all 0.2s', opacity: (!buyerId || !currentItem.flowerType || !currentItem.quantity || !currentItem.price || isSaving) ? 0.6 : 1
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        {isSaving ? '...' : <><Plus size={18} /> {t('addNew')}</>}
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handlePrint} style={{ height: '42px', width: '42px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Printer size={18}/></button>
                        <button onClick={handleShareWhatsApp} style={{ height: '42px', width: '42px', borderRadius: '10px', border: '1.5px solid #22c55e', background: '#fff', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><WhatsAppIcon size={20}/></button>
                    </div>
                </div>
            </div>

            {/* ── History Table Section ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc' }}>
                    <History size={18} color="#64748b" />
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('todayLiveEntries')}</h3>
                </div>
                
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                                <th style={TH_S}><Clock size={12} style={{marginRight: '6px'}}/>{t('time')}</th>
                                <th style={TH_S}>{t('customerId')}</th>
                                <th style={TH_S}>{t('customerName')}</th>
                                <th style={TH_S}>{t('flower')}</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('qty')}</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('rate')}</th>
                                <th style={{...TH_S, textAlign: 'right'}}>{t('total')}</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {todayEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '14px' }}>
                                        {t('noItemsYet')}
                                    </td>
                                </tr>
                            ) : (
                                todayEntries.map((sale, idx) => {
                                    const buyer = buyers.find(b => b.id === sale.buyerId);
                                    return (
                                        <tr key={sale.id} style={{ borderBottom: '1px solid #f8fafc', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                            <td style={TD_S}>
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                                                    {formatTime(sale.timestamp || sale.createdAt)}
                                                </span>
                                            </td>
                                            <td style={TD_S}>
                                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 10px', borderRadius: '8px' }}>
                                                    #{buyer?.displayId || '---'}
                                                </span>
                                            </td>
                                            <td style={{...TD_S, fontWeight: 700, color: '#334155'}}>
                                                {buyer ? (lang === 'ta' ? (buyer.nameTa || buyer.name) : buyer.name) : (sale.buyerName || '---')}
                                            </td>
                                            <td style={{...TD_S, fontWeight: 700, color: '#16a34a'}}>
                                                {lang === 'ta' ? (sale.items[0]?.flowerTypeTa || sale.items[0]?.flowerType) : sale.items[0]?.flowerType}
                                            </td>
                                        <td style={{...TD_S, textAlign: 'center', color: '#64748b', fontWeight: 600}}>
                                            {sale.items[0]?.quantity}
                                        </td>
                                        <td style={{...TD_S, textAlign: 'center', color: '#64748b', fontWeight: 600}}>
                                            {sale.items[0]?.price}
                                        </td>
                                        <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#16a34a'}}>
                                            {fmt(sale.grandTotal)}
                                        </td>
                                        <td style={{...TD_S, textAlign: 'center'}}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button onClick={() => handleEditItem(sale)}
                                                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button onClick={() => handleDeleteItem(sale)}
                                                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {todayEntries.length > 0 && (
                            <tfoot>
                                <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                    <td colSpan={6} style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '12px'}}>{t('todayTotal')}</td>
                                    <td style={{...TD_S, textAlign: 'right', fontWeight: 900, fontSize: '18px', color: '#16a34a'}}>{fmt(financialStats.todayTotal)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
            
            {/* ── Floating Grand Total Bar ── */}
            <div style={{ position: 'sticky', bottom: '20px', background: '#1e293b', borderRadius: '16px', padding: '16px 32px', display: 'flex', gap: '30px', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', zIndex: 100 }}>
                <div style={{ display: 'flex', gap: '40px' }}>
                    <div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {t('totalQuantity')}
                        </span>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                            {todayEntries.reduce((s, e) => s + parseFloat(e.items[0]?.quantity || 0), 0).toFixed(1)}
                        </div>
                    </div>
                    <div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {t('todayTotal')}
                        </span>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#3b82f6' }}>
                            {fmt(financialStats.todayTotal)}
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {t('net')} {t('finalBalance')} ({t('balance')} + {t('todayTotal')})
                    </span>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#10b981' }}>
                        {fmt(financialStats.finalBalance)}
                    </div>
                </div>
            </div>

            {/* ── PRINT TEMPLATE (Hidden) ── */}
            <style>
                {`
                    @media print {
                        @page { size: A4; margin: 15mm; }
                        body * { visibility: hidden; }
                        #print-bill, #print-bill * { visibility: visible; }
                        #print-bill { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
                    }
                `}
            </style>
            <div id="print-bill" style={{ display: 'none', width: '210mm', padding: '10mm', background: '#fff', color: '#000', fontFamily: 'serif' }}>
                {/* 1. Mottos */}
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '4px' }}>SRI RAMA JAYAM</div>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '15px' }}>SRI PERIYANDAVAR THUNAI</div>

                {/* 2. Shop Info Box */}
                <div style={{ border: '2px solid #000', padding: '15px', textAlign: 'center', marginBottom: '10px', position: 'relative' }}>
                    <h1 style={{ fontSize: '48px', fontWeight: '900', margin: '0 0 5px 0' }}>{settings.name || 'S.V.M'}</h1>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase' }}>{settings.type || 'SRI VALLI FLOWER MERCHANT'}</div>
                    <div style={{ fontSize: '16px' }}>{settings.address || 'B-7, FLOWER MARKET, TINDIVANAM.'}</div>
                    <div style={{ borderTop: '1px solid #000', marginTop: '10px', paddingTop: '5px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold' }}>
                        <span>CELL : {settings.phone1 || '9443247771'}</span>
                        <span>CELL : {settings.phone2 || '9952535057'}</span>
                    </div>
                </div>

                {/* 3. Sales | Date Row */}
                <div style={{ border: '2px solid #000', display: 'flex', justifyContent: 'space-between', padding: '8px 15px', fontWeight: 'bold', fontSize: '18px', marginBottom: '10px' }}>
                    <span>{t('date')} : {date.split('-').reverse().join('/')}</span>
                    <span style={{ textTransform: 'uppercase' }}>{t('sales')}</span>
                </div>

                {/* 4. Customer & Balance Box */}
                <div style={{ border: '2px solid #000', display: 'grid', gridTemplateColumns: '1fr 280px', marginBottom: '10px' }}>
                    <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px', borderRight: '2px solid #000' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '18px' }}>CODE : {buyers.find(b => b.id === buyerId)?.displayId || '---'}</div>
                        <div style={{ fontWeight: 'bold', fontSize: '18px', textTransform: 'uppercase' }}>{t('name')} : {lang === 'ta' ? (buyers.find(b => b.id === buyerId)?.nameTa || buyers.find(b => b.id === buyerId)?.name) : buyers.find(b => b.id === buyerId)?.name}</div>
                    </div>
                    <div>
                        {[
                            { label: t('oldBalance'), val: financialStats.oldBalance },
                            { label: t('cashRec'), val: financialStats.cashRec },
                            { label: t('cashLess'), val: financialStats.cashLess },
                            { label: t('balance'), val: (financialStats.oldBalance - financialStats.cashRec - financialStats.cashLess), last: true }
                        ].map((row, i) => (
                            <div key={i} style={{ display: 'flex', borderBottom: row.last ? 'none' : '1px solid #000' }}>
                                <div style={{ width: '150px', padding: '5px 10px', fontSize: '14px', borderRight: '1px solid #000' }}>{row.label}</div>
                                <div style={{ flex: 1, padding: '5px 10px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>{Number(row.val).toLocaleString('en-IN')}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 5. Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '10px' }}>
                    <thead>
                        <tr style={{ background: '#eee' }}>
                            <th style={{ border: '1px solid #000', padding: '8px', width: '50px' }}>{t('sNo')}</th>
                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>{t('particulars')}</th>
                            <th style={{ border: '1px solid #000', padding: '8px', width: '100px' }}>{t('weight')}</th>
                            <th style={{ border: '1px solid #000', padding: '8px', width: '100px' }}>{t('rate')}</th>
                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', width: '120px' }}>{t('total')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {todayEntries.map((s, i) => (
                            <tr key={i}>
                                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{i + 1}</td>
                                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>{lang === 'ta' ? (s.items[0].flowerTypeTa || s.items[0].flowerType) : s.items[0].flowerType}</td>
                                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{parseFloat(s.items[0].quantity).toFixed(3)}</td>
                                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{s.items[0].price}</td>
                                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{Number(s.grandTotal).toLocaleString('en-IN')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* 6. Grand Total Box */}
                <div style={{ border: '3px solid #000', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <span style={{ fontSize: '24px', fontWeight: '900', textTransform: 'uppercase' }}>{t('grandTotal')}</span>
                    <span style={{ fontSize: '30px', fontWeight: '900' }}>₹{Number(financialStats.finalBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                {/* 7. Footer */}
                <div style={{ textAlign: 'center', fontSize: '22px', fontWeight: 'bold' }}>🌹 நன்றி (Thank You) 🌹</div>
            </div>

        </div>
    );
};

const TH_S = {
    padding: '12px 14px', textAlign: 'left',
    fontSize: '11px', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.08em',
};
const TD_S = {
    padding: '14px', fontSize: '14px', verticalAlign: 'middle'
};

export default SalesEntry;
