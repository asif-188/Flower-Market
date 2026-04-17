import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { Trash2, Plus, History, IndianRupee, Save, X, ChevronLeft, Printer, FileText, Search, Download, MessageCircle, Pencil, Users } from 'lucide-react';
import { db, subscribeToCollection, saveOutsidePurchase, saveVendor, deleteVendor, getTenant } from '../utils/storage';
import { doc, updateDoc, increment, serverTimestamp, deleteDoc, collection, addDoc, getDoc } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { generateLedgerCanvas, generatePaymentReceiptCanvas, generatePurchaseReceiptCanvas } from '../utils/receiptCanvas';
import WhatsAppIcon from '../components/WhatsAppIcon';

/* ── Shared Style Tokens (Matching Sales UI) ── */
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
const TH_S = { padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' };
const TD_S = { padding: '14px', fontSize: '14px', verticalAlign: 'middle' };

/* ── Keyboard-navigable Searchable Dropdown (Clone from Sales) ── */
const SearchSelect = ({ items, value, onChange, onKeyDown, inputRef, placeholder, lang, idPrefix = '#' }) => {
    const [query, setQuery]         = useState('');
    const [open, setOpen]           = useState(false);
    const [cursor, setCursor]       = useState(0);
    const listRef                   = useRef(null);

    const selectedItem = items.find(i => i.id === value || i.name === value);
    const selectedName = selectedItem ? (lang === 'ta' ? (selectedItem.nameTa || selectedItem.taName || selectedItem.name) : selectedItem.name) : '';

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
        setQuery(lang === 'ta' ? (item.nameTa || item.taName || item.name) : item.name);
        setOpen(false);
    };

    const handleKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && filtered[cursor]) { choose(filtered[cursor]); if (onKeyDown) onKeyDown(e); }
            else if (onKeyDown) onKeyDown(e);
        }
        else if (e.key === 'Escape') setOpen(false);
        else if (e.key === 'Tab') { if (open && filtered[cursor]) choose(filtered[cursor]); setOpen(false); if (onKeyDown) onKeyDown(e); }
    };

    return (
        <div style={{ position: 'relative' }}>
            <input
                ref={inputRef} type="text" placeholder={placeholder}
                value={open ? query : selectedName}
                onFocus={() => { setQuery(''); setOpen(true); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 200)}
                onChange={e => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={handleKey} autoComplete="off" style={INPUT_S}
            />
            {open && filtered.length > 0 && (
                <ul ref={listRef} style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)', maxHeight: '200px',
                    overflowY: 'auto', listStyle: 'none', margin: '4px 0', padding: '4px',
                }}>
                    {filtered.map((item, i) => (
                        <li key={item.id} onMouseDown={() => choose(item)}
                            style={{
                                padding: '8px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px',
                                fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                                background: i === cursor ? '#fef3c7' : 'transparent',
                                color: i === cursor ? '#92400e' : '#374151',
                            }}
                            onMouseEnter={() => setCursor(i)}
                        >
                            {item.displayId && <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>{idPrefix}{item.displayId}</span>}
                            {lang === 'ta' ? (item.nameTa || item.name) : item.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const MenuCard = ({ emoji, label, color, onClick, delay }) => {
    const [hovered, setHovered] = React.useState(false);
    return (
        <button 
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative', overflow: 'hidden', padding: '32px 24px',
                background: color.bg, borderRadius: '24px',
                border: `2px solid ${color.border}`, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                transform: hovered ? 'translateY(-8px)' : 'translateY(0)',
                boxShadow: hovered ? `0 20px 40px ${color.glow}` : '0 4px 12px rgba(0,0,0,0.03)',
                animation: `fadeInUp 0.6s ease-out ${delay} both`,
            }}
        >
            <div style={{ fontSize: '48px', transition: 'transform 0.4s', transform: hovered ? 'scale(1.2) rotate(8deg)' : 'scale(1)' }}>{emoji}</div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: color.text, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
            {hovered && <div style={{ position: 'absolute', right: '16px', opacity: 0.2 }}><Plus size={32} color={color.border}/></div>}
        </button>
    );
};

const OutsideShop = () => {
    const { t, lang } = useContext(LangContext);
    const [activeTab, setActiveTab] = useState('menu');
    
    // Data States
    const [vendors, setVendors] = useState([]);
    const [flowers, setFlowers] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [payments, setPayments] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [bizInfo, setBizInfo] = useState({});

    // Filtering states for Reports
    const [reportFilters, setReportFilters] = useState({ 
        fromDate: new Date().toLocaleDateString('en-CA'), 
        toDate: new Date().toLocaleDateString('en-CA'),
        vendorId: 'all'
    });

    const [payFilterFrom, setPayFilterFrom] = useState(new Date().toLocaleDateString('en-CA'));
    const [payFilterTo, setPayFilterTo] = useState(new Date().toLocaleDateString('en-CA'));
    const [usePayRange, setUsePayRange] = useState(false);

    // Purchase Form State
    const [vendorId, setVendorId] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [currentItem, setCurrentItem] = useState({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });

    // Vendor Modal State
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [vendorForm, setVendorForm] = useState({ name: '', nameTa: '', contact: '', location: '', displayId: '', balance: 0 });

    // Purchase editing state
    const [editingPurchaseId, setEditingPurchaseId] = useState(null);

    // Vendor Payment State
    const [paymentForm, setPaymentForm] = useState({ vendorId: '', amount: '', date: new Date().toLocaleDateString('en-CA'), note: '' });
    const [editingPaymentId, setEditingPaymentId] = useState(null);

    // Auto-translation state
    const [isTranslating, setIsTranslating] = useState(false);
    const [touched, setTouched] = useState({ name: false, nameTa: false });
    const transTimeout = useRef(null);

    // Refs
    const refFlower = useRef(null);
    const refQty = useRef(null);
    const refRate = useRef(null);
    const refPayAmount = useRef(null);
    const refPayNote = useRef(null);

    useEffect(() => {
        const u1 = subscribeToCollection('vendors', setVendors, true);
        const u2 = subscribeToCollection('products', (data) => {
             setFlowers(data.length === 0 
                ? [{ name: 'Rose', taName: 'ரோஜா' }, { name: 'Jasmine', taName: 'மல்லிகை' }] 
                : data.map(f => ({ id: f.id, name: f.name, taName: f.taName })));
        });
        const u3 = subscribeToCollection('outside_purchases', setPurchases, true);
        const u4 = subscribeToCollection('payments', setPayments, true);
        
        getDoc(doc(db, 'system', 'settings')).then(s => s.exists() && setBizInfo(s.data()));
        
        return () => { u1(); u2(); u3(); u4(); };
    }, []);

    const toDateStr = (d) => d.toISOString().split('T')[0];
    const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

    const translate = async (text, from, to) => {
        if (!text || text.length < 2) return '';
        try {
            const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
            const data = await resp.json();
            return data[0][0][0];
        } catch { return ''; }
    };

    const handleAutoTranslate = (val, source) => {
        const target = source === 'name' ? 'nameTa' : 'name';
        const fromLang = source === 'name' ? 'en' : 'ta';
        const toLang = source === 'name' ? 'ta' : 'en';

        // Update the field being typed in normally
        setVendorForm(prev => ({ ...prev, [source]: val }));

        // If the other field hasn't been manually touched, translate into it
        if (!touched[target] && val.trim().length > 2) {
            if (transTimeout.current) clearTimeout(transTimeout.current);
            transTimeout.current = setTimeout(async () => {
                setIsTranslating(true);
                const translated = await translate(val, fromLang, toLang);
                if (translated && !touched[target]) {
                    setVendorForm(prev => ({ ...prev, [target]: translated }));
                }
                setIsTranslating(false);
            }, 800);
        }
    };

    // Computed
    const todayPurchases = useMemo(() => {
        let filtered = purchases.filter(p => p.date === date);
        if (vendorId) {
            filtered = filtered.filter(p => p.vendorId === vendorId);
        }
        return filtered.sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
    }, [purchases, date, vendorId]);

    const stats = useMemo(() => {
        const vendor = vendors.find(v => v.id === vendorId);
        const todayTot = todayPurchases.reduce((acc, p) => acc + (p.grandTotal || 0), 0);
        return {
            todayTotal: todayTot,
            cashPaid: todayPurchases.reduce((acc, p) => acc + (p.cashPaid || 0), 0),
            vendorBalance: vendor?.balance || 0
        };
    }, [todayPurchases, vendors, vendorId]);

    // Handlers
    const handleSavePurchase = async () => {
        if (!vendorId || !currentItem.flowerType || !currentItem.quantity || !currentItem.price || isSaving) return;
        setIsSaving(true);
        const qty = parseFloat(currentItem.quantity);
        const rate = parseFloat(currentItem.price);
        const total = qty * rate;

        try {
            const vendor = vendors.find(v => v.id === vendorId);
            if (editingPurchaseId) {
                const oldSnap = await getDoc(doc(db, 'outside_purchases', editingPurchaseId));
                if (oldSnap.exists()) {
                    const oldTotal = oldSnap.data().grandTotal || 0;
                    const diff = total - oldTotal;

                    await updateDoc(doc(db, 'outside_purchases', editingPurchaseId), {
                        vendorId,
                        vendorName: vendor?.name || '',
                        items: [{ ...currentItem, total }],
                        grandTotal: total,
                        updatedAt: serverTimestamp()
                    });
                    
                    if (diff !== 0) {
                        await updateDoc(doc(db, 'vendors', vendorId), { balance: increment(diff) });
                    }
                }
                setEditingPurchaseId(null);
                alert(t('saveSuccess'));
            } else {
                await saveOutsidePurchase({
                    vendorId,
                    vendorName: vendor?.name || '',
                    date,
                    items: [{ ...currentItem, total }],
                    grandTotal: total,
                    cashPaid: 0,
                });
                await updateDoc(doc(db, 'vendors', vendorId), { balance: increment(total) });
            }
            
            setCurrentItem({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
            setTimeout(() => refFlower.current?.focus(), 50);
        } catch (err) { alert(err.message); }
        finally { setIsSaving(false); }
    };

    const handleEditPurchase = (p) => {
        setEditingPurchaseId(p.id);
        setVendorId(p.vendorId);
        setDate(p.date || new Date().toLocaleDateString('en-CA'));
        const item = p.items[0];
        setCurrentItem({
            flowerType: item.flowerType,
            flowerTypeTa: item.flowerTypeTa || '',
            quantity: item.quantity,
            price: item.price
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleWhatsAppPurchase = async (p) => {
        const vendor = vendors.find(v => v.id === p.vendorId);
        if (!vendor) return;

        const labels = {
            dateLabel: t('date'), vendorLabel: t('vendorName'), totalLabel: t('total'),
            purchaseReceipt: t('purchaseReceipt') || 'PURCHASE RECEIPT',
            particulars: t('particulars'), qty: t('qty'), rate: t('rate'), amount: t('amount'),
            thankYou: '🌹 Poovanam 🌹'
        };

        const { url, blob } = await generatePurchaseReceiptCanvas({ entity: vendor, purchase: p, bizInfo, labels, lang });
        const file = new File([blob], `purchase_${p.id}.png`, { type: 'image/png' });

        if (navigator.share) {
            await navigator.share({ files: [file], title: 'Purchase Receipt' });
        } else {
            const win = window.open('', '_blank');
            win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;background:#f0f0f0;"><img src="${url}" style="max-width:100%;box-shadow:0 0 20px rgba(0,0,0,0.2);"></body></html>`);
            win.document.close();
        }
    };

    const handlePrintPurchase = async (p) => {
        const vendor = vendors.find(v => v.id === p.vendorId);
        if (!vendor) return;

        const labels = {
            dateLabel: t('date'), vendorLabel: t('vendorName'), totalLabel: t('total'),
            purchaseReceipt: t('purchaseReceipt') || 'PURCHASE RECEIPT',
            particulars: t('particulars'), qty: t('qty'), rate: t('rate'), amount: t('amount'),
            thankYou: '🌹 Poovanam 🌹'
        };

        const { url } = await generatePurchaseReceiptCanvas({ entity: vendor, purchase: p, bizInfo, labels, lang });
        const win = window.open('', '_blank');
        win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;background:#f0f0f0;"><img src="${url}" style="max-width:100%;"></body></html>`);
        win.document.close();
    };

    const handleDeletePurchase = async (p) => {
        if (!window.confirm(t('delete') + '?')) return;
        try {
            await deleteDoc(doc(db, 'outside_purchases', p.id));
            await updateDoc(doc(db, 'vendors', p.vendorId), { balance: increment(-p.grandTotal) });
        } catch (err) { alert(err.message); }
    };

    const handleSaveVendor = async (e) => {
        e.preventDefault();
        try {
            await saveVendor({ ...vendorForm, id: editingVendor?.id });
            setShowVendorModal(false);
            setVendorForm({ name: '', nameTa: '', contact: '', location: '', displayId: '', balance: 0 });
            setEditingVendor(null);
            setTouched({ name: false, nameTa: false });
        } catch (err) { alert(err.message); }
    };

    const handleEditVendor = (v) => {
        setEditingVendor(v);
        setTouched({ name: true, nameTa: true });
        setVendorForm({ name: v.name, nameTa: v.nameTa || '', contact: v.contact || '', location: v.location || '', displayId: v.displayId, balance: v.balance || 0 });
        setShowVendorModal(true);
    };

    const handleDeleteVendor = async (id) => {
        if (window.confirm(t('delete') + '?')) await deleteVendor(id);
    };

    const handleSavePayment = async (vId = null) => {
        const vid = vId || paymentForm.vendorId;
        if (!vid || !paymentForm.amount || isSaving) return;
        setIsSaving(true);
        try {
            const amt = parseFloat(paymentForm.amount);

            if (editingPaymentId) {
                const oldSnap = await getDoc(doc(db, 'payments', editingPaymentId));
                if (oldSnap.exists()) {
                    const oldAmt = oldSnap.data().amount || 0;
                    const diff = amt - oldAmt;
                    
                    await updateDoc(doc(db, 'payments', editingPaymentId), {
                        amount: amt,
                        date: paymentForm.date,
                        note: paymentForm.note,
                        updatedAt: serverTimestamp(),
                    });
                    
                    // If amount changed, update vendor balance
                    if (diff !== 0) {
                        await updateDoc(doc(db, 'vendors', vid), {
                            balance: increment(-diff)
                        });
                    }
                }
                setEditingPaymentId(null);
                alert(t('updateSuccess') || 'Payment updated!');
            } else {
                const tenantId = getTenant();
                await addDoc(collection(db, 'payments'), {
                    entityId: vid,
                    type: 'vendor',
                    amount: amt,
                    date: paymentForm.date,
                    note: paymentForm.note,
                    createdAt: serverTimestamp(),
                    tenantId,
                });
                await updateDoc(doc(db, 'vendors', vid), {
                    balance: increment(-amt)
                });
                alert(t('saveSuccess') || 'Payment saved!');
            }
            setPaymentForm({ vendorId: '', amount: '', note: '', date: new Date().toISOString().split('T')[0] });
        } catch (err) {
            console.error(err);
            alert(t('saveError') || 'Error saving payment');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditPayment = (p) => {
        setEditingPaymentId(p.id);
        setPaymentForm({
            vendorId: p.entityId,
            amount: p.amount,
            date: p.date,
            note: p.note || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleWhatsAppPayment = async (p) => {
        const vendor = vendors.find(v => v.id === p.entityId);
        if (!vendor) return;

        const labels = {
            dateLabel: t('date'), nameLabel: t('name'), amountLabel: t('amount'),
            notesLabel: t('notes'), paymentReceipt: t('paymentReceipt'), thankYou: '🌹 Poovanam 🌹'
        };

        const { url, blob } = await generatePaymentReceiptCanvas({ entity: vendor, payment: p, bizInfo, labels, lang });
        const file = new File([blob], `payment_${p.id}.png`, { type: 'image/png' });

        if (navigator.share) {
            await navigator.share({ files: [file], title: 'Payment Receipt' });
        } else {
            const win = window.open('', '_blank');
            win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;background:#f0f0f0;"><img src="${url}" style="max-width:100%;box-shadow:0 0 20px rgba(0,0,0,0.2);"></body></html>`);
            win.document.close();
        }
    };

    const handlePrintPayment = async (p) => {
        const vendor = vendors.find(v => v.id === p.entityId);
        if (!vendor) return;

        const labels = {
            dateLabel: t('date'), nameLabel: t('name'), amountLabel: t('amount'),
            notesLabel: t('notes'), paymentReceipt: t('paymentReceipt'), thankYou: '🌹 Poovanam 🌹'
        };

        const { url } = await generatePaymentReceiptCanvas({ entity: vendor, payment: p, bizInfo, labels, lang });
        const win = window.open('', '_blank');
        win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;background:#f0f0f0;"><img src="${url}" style="max-width:100%;"></body></html>`);
        win.document.close();
    };

    const handleBack = () => setActiveTab('menu');

    /* ── Render Sub-sections ── */

    const renderDashboard = () => (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '40px' }}>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '8px' }}>{lang === 'ta' ? 'மாடியூல் மெனு' : 'Module Menu'}</h2>
                <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#92400e', letterSpacing: '-0.02em', margin: 0 }}>{t('outsideShop')}</h1>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', width: '100%', maxWidth: '1100px', justifyContent: 'center' }}>
                <MenuCard 
                    emoji="📦" label={t('purchase')} 
                    color={{ border: '#f59e0b', text: '#92400e', bg: '#fffbeb', glow: 'rgba(245,158,11,0.15)' }} 
                    onClick={() => setActiveTab('purchase')} delay="0s" 
                />
                <MenuCard 
                    emoji="💰" label={t('cashPaid') || 'Vendor Payment'} 
                    color={{ border: '#7c3aed', text: '#5b21b6', bg: '#f5f3ff', glow: 'rgba(124,58,237,0.15)' }} 
                    onClick={() => setActiveTab('vendor-payments')} delay="0.1s" 
                />
                <MenuCard 
                    emoji="👥" label={t('vendorName')} 
                    color={{ border: '#10b981', text: '#064e3b', bg: '#f0fdf4', glow: 'rgba(16,185,129,0.15)' }} 
                    onClick={() => setActiveTab('vendors')} delay="0.2s" 
                />
                <MenuCard 
                    emoji="📊" label={t('vendorReport')} 
                    color={{ border: '#6366f1', text: '#312e81', bg: '#eef2ff', glow: 'rgba(99,102,241,0.15)' }} 
                    onClick={() => setActiveTab('reports')} delay="0.3s" 
                />
            </div>
        </div>
    );

    const renderPurchase = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.2s' }} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.7}>
                <ChevronLeft size={16}/> {t('backToMenu').toUpperCase()}
            </button>
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #fed7aa', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '20px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid #fff7ed' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px' }}>📦</span>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('outsidePurchase')}</span>
                        </div>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...INPUT_S, border: '1.5px solid #ffedd5', width: '150px' }} />
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{t('outsidePurchase').toUpperCase()}</h1>
                    <div style={{ justifySelf: 'end', background: '#fffbeb', border: '1.5px solid #fed7aa', borderRadius: '16px', padding: '16px 20px', minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                                {date === new Date().toLocaleDateString('en-CA') ? t('todayTotal') : t('total')}
                            </span>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>{fmt(stats.todayTotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>{t('cashPaid')}</span>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#16a34a' }}>{fmt(stats.cashPaid)}</span>
                        </div>
                        <div style={{ height: '1.5px', background: '#fed7aa', margin: '4px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>{t('balance')}</span>
                            <span style={{ fontSize: '20px', fontWeight: 900, color: '#ef4444' }}>{fmt(stats.vendorBalance)}</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                    <div>
                        <label style={LABEL_S}>{t('vendorName')}</label>
                        <SearchSelect 
                            items={vendors} 
                            value={vendorId} 
                            onChange={v => setVendorId(v.id)} 
                            onKeyDown={e => { if(e.key==='Enter') refFlower.current?.focus() }}
                            placeholder={t('vendorName')} 
                            idPrefix="V" 
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
                            onKeyDown={e => { if(e.key==='Enter') refQty.current?.focus() }} 
                            placeholder={t('flowerVariety')}
                            lang={lang}
                        />
                    </div>
                    <div>
                        <label style={LABEL_S}>{t('qty')}</label>
                        <input ref={refQty} type="number" value={currentItem.quantity} onChange={e => setCurrentItem(p => ({...p, quantity: e.target.value}))} onKeyDown={e => { if(e.key==='Enter') refRate.current?.focus() }} style={INPUT_S} />
                    </div>
                    <div>
                        <label style={LABEL_S}>{t('rate')}</label>
                        <input ref={refRate} type="number" value={currentItem.price} onChange={e => setCurrentItem(p => ({...p, price: e.target.value}))} onKeyDown={e => { if(e.key==='Enter') handleSavePurchase() }} style={INPUT_S} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={handleSavePurchase} 
                            disabled={isSaving || !vendorId}
                            style={{ flex: 1, height: '42px', background: '#d97706', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            {isSaving ? '...' : <><Save size={18}/> {editingPurchaseId ? t('update') : t('addNew')}</>}
                        </button>
                        {editingPurchaseId && (
                            <button 
                                onClick={() => {
                                    setEditingPurchaseId(null);
                                    setVendorId('');
                                    setCurrentItem({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
                                }}
                                style={{ width: '42px', height: '42px', background: '#fff', border: '1.5px solid #fed7aa', color: '#92400e', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={20}/>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={18} color="#64748b" />
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                        {date === new Date().toLocaleDateString('en-CA') ? t('todayPurchases') : `${date.split('-').reverse().join('-')} ${t('purchase')}`}
                        {vendorId && ` - ${vendors.find(v => v.id === vendorId)?.name || ''}`}
                    </h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                                <th style={TH_S}>{t('time')}</th>
                                <th style={TH_S}>{t('id')}</th>
                                <th style={TH_S}>{t('vendorName')}</th>
                                <th style={TH_S}>{t('flower')}</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('qty')}</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('rate')}</th>
                                <th style={{...TH_S, textAlign: 'right'}}>{t('total')}</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {todayPurchases.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>{t('noRecords')}</td></tr>
                            ) : todayPurchases.map((p, idx) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc', background: idx%2===0 ? '#fff' : '#fafafa' }}>
                                    <td style={TD_S}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                                            {p.timestamp?.toDate ? p.timestamp.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                                        </span>
                                    </td>
                                    <td style={TD_S}>
                                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', background: '#fffbeb', border: '1px solid #fed7aa', padding: '3px 8px', borderRadius: '6px' }}>
                                            #{vendors.find(v => v.id === p.vendorId)?.displayId || '---'}
                                        </span>
                                    </td>
                                    <td style={{ ...TD_S, fontWeight: 700 }}>{p.vendorName}</td>
                                    <td style={{ ...TD_S, fontWeight: 700, color: '#92400e' }}>{lang==='ta' ? (p.items[0].flowerTypeTa || p.items[0].flowerType) : p.items[0].flowerType}</td>
                                    <td style={{ ...TD_S, textAlign: 'center', color: '#64748b' }}>{p.items[0].quantity}</td>
                                    <td style={{ ...TD_S, textAlign: 'center', color: '#64748b' }}>{p.items[0].price}</td>
                                    <td style={{ ...TD_S, textAlign: 'right', fontWeight: 800, color: '#d97706' }}>{fmt(p.grandTotal)}</td>
                                    <td style={{ ...TD_S, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button onClick={() => handleEditPurchase(p)} title="Edit" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e0e7ff', background: '#fff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                <Pencil size={14}/>
                                            </button>
                                            <button onClick={() => handleWhatsAppPurchase(p)} title="WhatsApp" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #dcfce7', background: '#fff', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                <WhatsAppIcon size={16}/>
                                            </button>
                                            <button onClick={() => handlePrintPurchase(p)} title="Print" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                <Printer size={14}/>
                                            </button>
                                            <button onClick={() => handleDeletePurchase(p)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                            <tfoot>
                                <tr style={{ background: '#fffbeb', borderTop: '2px solid #fed7aa' }}>
                                    <td colSpan={4} style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#92400e'}}>{t('total').toUpperCase()}</td>
                                    <td style={{...TD_S, textAlign: 'center', fontWeight: 900}}>{todayPurchases.reduce((acc, p) => acc + parseFloat(p.items[0].quantity), 0).toFixed(2)}</td>
                                    <td></td>
                                    <td style={{...TD_S, textAlign: 'right', fontWeight: 900, fontSize: '18px', color: '#d97706'}}>{fmt(stats.todayTotal)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderVendors = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}>
                <ChevronLeft size={16}/> {t('backToMenu').toUpperCase()}
            </button>
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={20} color="#64748b" />
                        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', margin: 0 }}>{t('vendorName')}</h2>
                    </div>
                    <button 
                        onClick={() => { 
                            const nextId = vendors.length > 0 ? Math.max(...vendors.map(v => parseInt(v.displayId) || 0)) + 1 : 101;
                            setEditingVendor(null); 
                            setVendorForm({name:'', nameTa:'', contact:'', location:'', displayId: nextId, balance: 0}); 
                            setTouched({ name: false, nameTa: false }); 
                            setShowVendorModal(true); 
                        }}
                        style={{ padding: '10px 20px', background: '#d97706', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Plus size={18} /> {t('addVendor')}
                    </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                                <th style={TH_S}>{t('id')}</th>
                                <th style={TH_S}>{t('name')}</th>
                                <th style={TH_S}>{t('contact')}</th>
                                <th style={TH_S}>{t('location')}</th>
                                <th style={{...TH_S, textAlign: 'right'}}>{t('balance')}</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vendors.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>{t('noRecords')}</td></tr>
                            ) : vendors.map((v, i) => (
                                <tr key={v.id} style={{ borderBottom: '1px solid #f8fafc', background: i%2===0 ? '#fff' : '#fafafa' }}>
                                    <td style={TD_S}><span style={{ fontWeight: 800, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>#V{v.displayId}</span></td>
                                    <td style={TD_S}>
                                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{v.name}</div>
                                        {v.nameTa && <div style={{ fontSize: '11px', color: '#64748b' }}>{v.nameTa}</div>}
                                    </td>
                                    <td style={TD_S}>{v.contact || '---'}</td>
                                    <td style={TD_S}>{v.location || '---'}</td>
                                    <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: v.balance > 0 ? '#ef4444' : '#16a34a'}}>{fmt(v.balance || 0)}</td>
                                    <td style={{...TD_S, textAlign: 'center'}}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button onClick={() => handleEditVendor(v)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Pencil size={14}/></button>
                                            <button onClick={() => handleDeleteVendor(v.id)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderVendorPayments = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                <ChevronLeft size={16}/> {t('backToMenu').toUpperCase()}
            </button>
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #ddd6fe', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#5b21b6', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <IndianRupee size={20}/> {t('recordVendorPayment').toUpperCase()}
                    </h2>
                    <input type="date" value={paymentForm.date} onChange={e => {
                        const d = e.target.value;
                        setPaymentForm(p=>({...p, date: d}));
                        if (!usePayRange) {
                            setPayFilterFrom(d);
                            setPayFilterTo(d);
                        }
                    }} style={{ ...INPUT_S, width: '150px' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                    <div>
                        <label style={LABEL_S}>{t('vendorName')}</label>
                        <SearchSelect 
                            items={vendors} 
                            value={paymentForm.vendorId} 
                            onChange={v => setPaymentForm(p=>({...p, vendorId: v.id}))} 
                            onKeyDown={e => { if(e.key==='Enter') refPayAmount.current?.focus() }}
                            placeholder={t('vendorName')} idPrefix="V" lang={lang} 
                        />
                    </div>
                    <div>
                        <label style={LABEL_S}>{t('amount')}</label>
                        <input ref={refPayAmount} type="number" value={paymentForm.amount} onChange={e => setPaymentForm(p=>({...p, amount: e.target.value}))} onKeyDown={e => { if(e.key==='Enter') refPayNote.current?.focus() }} style={INPUT_S} placeholder="0.00" />
                    </div>
                    <div>
                        <label style={LABEL_S}>{t('notes')}</label>
                        <input ref={refPayNote} type="text" value={paymentForm.note} onChange={e => setPaymentForm(p=>({...p, note: e.target.value}))} onKeyDown={e => { if(e.key==='Enter') handleSavePayment() }} style={INPUT_S} placeholder={t('paymentDetailsPlaceholder')} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={() => handleSavePayment()} 
                            disabled={isSaving || !paymentForm.vendorId}
                            style={{ flex: 1, height: '42px', background: '#7c3aed', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            {isSaving ? '...' : <><Save size={18}/> {editingPaymentId ? t('update') : t('addNew')}</>}
                        </button>
                        {editingPaymentId && (
                            <button 
                                onClick={() => {
                                    setEditingPaymentId(null);
                                    setPaymentForm({ vendorId: '', amount: '', note: '', date: new Date().toISOString().split('T')[0] });
                                }}
                                style={{ width: '42px', height: '42px', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={20}/>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <History size={18} color="#64748b" />
                        <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{t('recentPayments')}</h3>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {!usePayRange ? (
                             <button onClick={() => setUsePayRange(true)} style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6', background: '#eff6ff', border: '1px solid #dbeafe', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                                 {t('custom')} {t('filter') || 'Filter'}
                             </button>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="date" value={payFilterFrom} onChange={e => setPayFilterFrom(e.target.value)} style={{ ...INPUT_S, width: '130px', padding: '6px 10px', fontSize: '12px' }} />
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{t('to')}</span>
                                <input type="date" value={payFilterTo} onChange={e => setPayFilterTo(e.target.value)} style={{ ...INPUT_S, width: '130px', padding: '6px 10px', fontSize: '12px' }} />
                                <button onClick={() => {
                                    setUsePayRange(false);
                                    setPayFilterFrom(paymentForm.date);
                                    setPayFilterTo(paymentForm.date);
                                }} style={{ fontSize: '12px', fontWeight: 800, color: '#ef4444', background: '#fef2f2', border: '1px solid #fee2e2', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}>
                                    {t('close')}
                                </button>
                            </div>
                        )}
                        {usePayRange && (
                             <button onClick={() => {
                                 const today = new Date().toLocaleDateString('en-CA');
                                 setPayFilterFrom(today);
                                 setPayFilterTo(today);
                             }} style={{ fontSize: '12px', fontWeight: 800, color: '#10b981', background: '#f0fdf4', border: '1px solid #dcfce7', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                                 {t('today')}
                             </button>
                        )}
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                                <th style={TH_S}>{t('date')}</th>
                                <th style={TH_S}>{t('vendorName')}</th>
                                <th style={TH_S}>{t('notes')}</th>
                                <th style={{...TH_S, textAlign: 'right'}}>{t('amount')}</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.filter(p => {
                                const isVendor = p.type === 'vendor';
                                const d = p.date || '';
                                const inRange = d >= payFilterFrom && d <= payFilterTo;
                                return isVendor && inRange;
                            }).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 20).map((p, idx) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc', background: idx%2===0 ? '#fff' : '#fafafa' }}>
                                    <td style={TD_S}>{p.date || '---'}</td>
                                    <td style={{ ...TD_S, fontWeight: 700 }}>{vendors.find(v => v.id === p.entityId)?.name || '---'}</td>
                                    <td style={{ ...TD_S, color: '#64748b' }}>{p.note || '---'}</td>
                                    <td style={{ ...TD_S, textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{fmt(p.amount)}</td>
                                    <td style={{ ...TD_S, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button onClick={() => handleEditPayment(p)} title="Edit" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e0e7ff', background: '#fff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                <Pencil size={14}/>
                                            </button>
                                            <button onClick={() => handleWhatsAppPayment(p)} title="WhatsApp" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #dcfce7', background: '#fff', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                <WhatsAppIcon size={16}/>
                                            </button>
                                            <button onClick={() => handlePrintPayment(p)} title="Print" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                <Printer size={14}/>
                                            </button>
                                            <button onClick={async () => {
                                                if(window.confirm(t('delete') + '?')) {
                                                    await deleteDoc(doc(p.tenantId ? db : db, 'payments', p.id));
                                                    await updateDoc(doc(db, 'vendors', p.entityId), { balance: increment(p.amount) });
                                                }
                                            }} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderReports = () => {
        const filteredVendors = reportFilters.vendorId === 'all' ? vendors : vendors.filter(v => v.id === reportFilters.vendorId);
        
        const handlePrintVendorLedger = async (v) => {
            const vPurchases = purchases.filter(p => p.vendorId === v.id && p.date >= reportFilters.fromDate && p.date <= reportFilters.toDate);
            const vPayments = payments.filter(p => p.entityId === v.id && p.type === 'vendor' && p.date >= reportFilters.fromDate && p.date <= reportFilters.toDate);
            
            // Calculate Opening Balance for the period
            const futurePurchases = purchases.filter(p => p.vendorId === v.id && p.date >= reportFilters.fromDate);
            const futurePayments = payments.filter(p => p.entityId === v.id && p.type === 'vendor' && p.date >= reportFilters.fromDate);
            const futurePurAmt = futurePurchases.reduce((s, x) => s + (x.grandTotal || 0), 0);
            const futurePayAmt = futurePayments.reduce((s, x) => s + (x.amount || 0), 0);
            const openingBalance = (v.balance || 0) - futurePurAmt + futurePayAmt;

            const ledgerRows = [];
            vPurchases.forEach(p => ledgerRows.push({ date: p.date, particulars: `${t('purchase')} - ${p.items?.[0]?.flowerType || ''}`, weight: p.items?.[0]?.quantity || 0, rate: p.items?.[0]?.price || 0, total: p.grandTotal, cashRec: 0, cashLess: 0 }));
            vPayments.forEach(p => ledgerRows.push({ date: p.date, particulars: t('cashPaid') || 'Vendor Payment', weight: 0, rate: 0, total: 0, cashRec: p.amount, cashLess: 0 }));
            ledgerRows.sort((a,b) => a.date.localeCompare(b.date));

            const summary = {
                sales: vPurchases.reduce((s, x) => s + (x.grandTotal || 0), 0),
                paid: vPayments.reduce((s, x) => s + (x.amount || 0), 0),
                less: 0
            };

            const labels = {
                date: t('date'), particulars: t('particulars'), weight: t('weight'), rate: t('rate'), total: t('total'), 
                cashRec: t('cashPaid'), cashLess: t('adjustments') || 'Adjustments', openingBalLabel: t('openingBalance'), 
                statementTitle: (lang==='ta' ? `${v.nameTa || v.name} அறிக்கை` : `VENDOR STATEMENT - ${v.name}`), 
                customerNoLabel: t('vendorId') || 'Vendor ID', nameLabel: t('name'),
                totalSalesLabel: (lang === 'ta' ? 'மொத்த கொள்முதல் :' : 'Total Purchase :'),
                cashRecLabel: (lang === 'ta' ? 'செலுத்திய தொகை :' : 'Total Paid :'),
                cashLessLabel: (lang === 'ta' ? 'சரிகட்டுதல் :' : 'Adjustments :'),
                finalBalLabel: t('balance') + ' :', thankYou: '🌹 Poovanam 🌹', sNoLabel: t('sNo') || 'S.No',
                dateLabel: `${reportFilters.fromDate} to ${reportFilters.toDate}`
            };

            const shareData = { buyer: { ...v, displayId: `V${v.displayId}`, name: lang === 'ta' ? (v.nameTa || v.name) : v.name }, ledgerRows, summary, openingBalance, bizInfo, labels, lang };
            const { url } = await generateLedgerCanvas(shareData);
            const win = window.open('', '_blank');
            win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;background:#f0f0f0;"><img src="${url}" style="max-width:100%;box-shadow:0 0 20px rgba(0,0,0,0.2);"></body></html>`);
            win.document.close();
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}>
                    <ChevronLeft size={16}/> {t('backToMenu').toUpperCase()}
                </button>
                
                {/* Filters */}
                <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <div>
                        <label style={LABEL_S}>{t('fromDate')}</label>
                        <input type="date" value={reportFilters.fromDate} onChange={e => setReportFilters(p=>({...p, fromDate: e.target.value}))} style={INPUT_S} />
                    </div>
                    <div>
                        <label style={LABEL_S}>{t('toDate')}</label>
                        <input type="date" value={reportFilters.toDate} onChange={e => setReportFilters(p=>({...p, toDate: e.target.value}))} style={INPUT_S} />
                    </div>
                    <div style={{ minWidth: '200px' }}>
                        <label style={LABEL_S}>{t('vendorName')}</label>
                        <select value={reportFilters.vendorId} onChange={e => setReportFilters(p=>({...p, vendorId: e.target.value}))} style={INPUT_S}>
                            <option value="all">{t('allVendors')}</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileText size={20} color="#d97706" />
                            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', margin: 0 }}>{t('vendorReport')}</h2>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                                    <th style={TH_S}>{t('vendorName')}</th>
                                    <th style={{...TH_S, textAlign: 'right'}}>{t('totalPurchase')}</th>
                                    <th style={{...TH_S, textAlign: 'right'}}>{t('cashPaid')}</th>
                                    <th style={{...TH_S, textAlign: 'right'}}>{t('balance')}</th>
                                    <th style={{...TH_S, textAlign: 'center'}}>{t('action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredVendors.map((v, i) => {
                                    const vPurchases = purchases.filter(p => p.vendorId === v.id && p.date >= reportFilters.fromDate && p.date <= reportFilters.toDate);
                                    const vPayments = payments.filter(p => p.entityId === v.id && p.type === 'vendor' && p.date >= reportFilters.fromDate && p.date <= reportFilters.toDate);
                                    const totalP = vPurchases.reduce((acc, p) => acc + (p.grandTotal || 0), 0);
                                    const totalPaid = vPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
                                    return (
                                        <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={TD_S}>
                                                <div style={{fontWeight: 700}}>{v.name}</div>
                                                <div style={{fontSize: '11px', color: '#94a3b8'}}>#V{v.displayId}</div>
                                            </td>
                                            <td style={{...TD_S, textAlign: 'right', fontWeight: 700}}>{fmt(totalP)}</td>
                                            <td style={{...TD_S, textAlign: 'right', fontWeight: 700, color: '#16a34a'}}>{fmt(totalPaid)}</td>
                                            <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: v.balance > 0 ? '#ef4444' : '#16a34a'}}>{fmt(v.balance || 0)}</td>
                                            <td style={{...TD_S, textAlign: 'center'}}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    <button onClick={async () => {
                                                        const labels = {
                                                            date: t('date'), particulars: t('particulars'), weight: t('weight'), rate: t('rate'), total: t('total'), 
                                                            cashRec: t('cashPaid'), cashLess: t('adjustments') || 'Adjustments', openingBalLabel: t('openingBalance'), 
                                                            statementTitle: (lang==='ta' ? `${v.nameTa || v.name} அறிக்கை` : `VENDOR STATEMENT - ${v.name}`), 
                                                            customerNoLabel: t('vendorId') || 'Vendor ID', nameLabel: t('name'),
                                                            totalSalesLabel: (lang === 'ta' ? 'மொத்த கொள்முதல் :' : 'Total Purchase :'),
                                                            cashRecLabel: (lang === 'ta' ? 'செலுத்திய தொகை :' : 'Total Paid :'),
                                                            cashLessLabel: (lang === 'ta' ? 'சரிகட்டுதல் :' : 'Adjustments :'),
                                                            finalBalLabel: t('balance') + ' :', thankYou: '🌹 Poovanam 🌹', sNoLabel: t('sNo') || 'S.No',
                                                            dateLabel: `${reportFilters.fromDate} to ${reportFilters.toDate}`
                                                        };
                                                        const { url, blob } = await generateLedgerCanvas({ buyer: { ...v, displayId: `V${v.displayId}`, name: lang === 'ta' ? (v.nameTa || v.name) : v.name }, ledgerRows: purchases.filter(p => p.vendorId === v.id && p.date >= reportFilters.fromDate && p.date <= reportFilters.toDate).map(p => ({ date: p.date, particulars: lang==='ta' ? (p.items[0].flowerTypeTa || p.items[0].flowerType) : p.items[0].flowerType, weight: p.items[0].quantity, rate: p.items[0].price, total: p.grandTotal, cashRec: 0 })), summary: { sales: totalP, paid: totalPaid, less: 0 }, openingBalance: (v.balance - (totalP - totalPaid)), bizInfo, labels, lang });
                                                        const file = new File([blob], `statement_${v.displayId}.png`, { type: 'image/png' });
                                                        if (navigator.share) await navigator.share({ files: [file], title: 'Vendor Statement' });
                                                        else {
                                                            const win = window.open('', '_blank');
                                                            win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;background:#f0f0f0;"><img src="${url}" style="max-width:100%;"></body></html>`);
                                                            win.document.close();
                                                        }
                                                    }} title="WhatsApp" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #dcfce7', background: '#fff', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                        <WhatsAppIcon size={16}/>
                                                    </button>
                                                    <button onClick={() => handlePrintVendorLedger(v)} title="Print Statement" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                        <Printer size={14}/>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Content Rendering */}
            {activeTab === 'menu' && renderDashboard()}
            {activeTab === 'purchase' && renderPurchase()}
            {activeTab === 'vendor-payments' && renderVendorPayments()}
            {activeTab === 'vendors' && renderVendors()}
            {activeTab === 'reports' && renderReports()}

            {/* Vendor Modal */}
            {showVendorModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
                    <div style={{ background: '#fff', borderRadius: '24px', width: '400px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontWeight: 900, color: '#92400e' }}>{editingVendor ? t('editVendor') : t('addVendor')}</h3>
                            <button onClick={() => setShowVendorModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X/></button>
                        </div>
                        <form onSubmit={handleSaveVendor} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={LABEL_S}>{t('vendorId')}</label>
                                <input disabled value={vendorForm.displayId} style={{ ...INPUT_S, background: '#f8fafc' }} />
                            </div>
                             <div>
                                <label style={LABEL_S}>{t('englishName')}</label>
                                <input required value={vendorForm.name} 
                                    onChange={e => {
                                        setTouched(p => ({ ...p, name: true }));
                                        handleAutoTranslate(e.target.value, 'name');
                                    }} 
                                    style={INPUT_S} placeholder={t('englishNamePlaceholder')} />
                            </div>
                            <div>
                                <label style={LABEL_S}>{t('tamilNameOptional')}</label>
                                <input value={vendorForm.nameTa} 
                                    onChange={e => {
                                        setTouched(p => ({ ...p, nameTa: true }));
                                        handleAutoTranslate(e.target.value, 'nameTa');
                                    }} 
                                    style={INPUT_S} placeholder="பெயர்" />
                            </div>
                            <div>
                                <label style={LABEL_S}>{t('contact')}</label>
                                <input 
                                    type="tel"
                                    value={vendorForm.contact} 
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        setVendorForm(p => ({...p, contact: val}));
                                    }} 
                                    style={INPUT_S} 
                                    placeholder="9876543210" 
                                    maxLength="10" 
                                />
                            </div>
                             <div>
                                <label style={LABEL_S}>{t('location')}</label>
                                <input value={vendorForm.location} onChange={e => setVendorForm(p => ({...p, location: e.target.value}))} style={INPUT_S} placeholder={t('locationPlaceholder')} />
                            </div>
                            <div>
                                <label style={LABEL_S}>{t('initialDues') || 'Opening Balance'}</label>
                                <input type="number" value={vendorForm.balance} onChange={e => setVendorForm(p => ({...p, balance: e.target.value}))} style={INPUT_S} placeholder="0" />
                            </div>
                            <button type="submit" style={{ padding: '12px', background: '#d97706', color: '#fff', borderRadius: '12px', border: 'none', fontWeight: 800, marginTop: '10px', cursor: 'pointer' }}>
                                {t('save')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OutsideShop;
