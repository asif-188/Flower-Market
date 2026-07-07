import React, { useState, useEffect, useRef, useContext } from 'react';
import { Plus, Trash2, Printer, MessageCircle, Pencil, History, Clock, Scan, Loader, X, Calendar, User } from 'lucide-react';
import { subscribeToCollection, addData, saveFPurchase, saveFLedger, COLLECTIONS, db } from '../utils/storage';
import { doc, updateDoc, increment, serverTimestamp, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import Tesseract from 'tesseract.js';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { useTenant } from '../utils/TenantContext';

/* ── Keyboard-navigable Searchable Dropdown ── */
const SearchSelect = ({ items, value, onChange, onKeyDown, inputRef, placeholder, lang }) => {
    const [queryVal, setQueryVal]   = useState('');
    const [open, setOpen]           = useState(false);
    const [cursor, setCursor]       = useState(0);
    const listRef                   = useRef(null);

    const selectedItem = items.find(i => i.id === value || i.name === value);
    const selectedName = selectedItem ? (lang === 'ta' ? (selectedItem.taName || selectedItem.name) : selectedItem.name) : '';

    const filtered = queryVal.trim()
        ? items.filter(i => {
            const n = i.name?.toLowerCase() || '';
            const tn = i.taName?.toLowerCase() || '';
            const q = queryVal.toLowerCase();
            return n.includes(q) || tn.includes(q) || (i.displayId && String(i.displayId).includes(queryVal));
        })
        : items;

    const choose = (item) => {
        onChange(item);
        if (item) {
            setQueryVal(lang === 'ta' ? (item.taName || item.name) : item.name);
        } else {
            setQueryVal('');
        }
        setOpen(false);
    };

    const handleKey = (e) => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
            onChange(null);
            setQueryVal('');
            setOpen(true);
        }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
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
                value={open ? queryVal : selectedName}
                onFocus={() => { setQueryVal(''); setOpen(true); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 200)}
                onChange={e => { 
                    const val = e.target.value;
                    setQueryVal(val); 
                    setCursor(0); 
                    if (val === '') {
                        onChange(null);
                    }
                }}
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
                                background: i === cursor ? '#fdf2f8' : 'transparent',
                                color: i === cursor ? '#db2777' : '#374151',
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
const TH_S = {
    padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800,
    color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.08em',
    borderBottom: '1.5px solid #e2e8f0', background: '#f8fafc', whiteSpace: 'nowrap',
};
const TD_S = {
    padding: '12px 16px', fontSize: '13px', color: '#334155',
    borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle',
};

const FarmerPurchase = () => {
    const { t, lang } = useContext(LangContext);
    const { tenantData, isEditDeleteAllowed } = useTenant();
    const [flowers, setFlowers] = useState([]);
    const [farmers, setFarmers] = useState([]);
    const [allPurchases, setAllPurchases] = useState([]);
    const [allPayments, setAllPayments] = useState([]);

    const [selectedFarmerId, setSelectedFarmerId] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [currentItem, setCurrentItem] = useState({ flowerId: '', flowerName: '', flowerNameTa: '', weight: '', rate: '', amount: '' });
    
    const [isSaving, setIsSaving] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResults, setScanResults] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [mainTableSelectedIndex, setMainTableSelectedIndex] = useState(-1);

    // Refs
    const refDate      = useRef(null);
    const refFarmer    = useRef(null);
    const refFlower    = useRef(null);
    const refQty       = useRef(null);
    const refRate      = useRef(null);
    const refAddBtn    = useRef(null);
    const refScanInput = useRef(null);
    const mainTableRowRefs = useRef([]);

    // Reset selected index when selection changes
    useEffect(() => {
        setMainTableSelectedIndex(-1);
    }, [selectedFarmerId]);

    useEffect(() => {
        const u1 = subscribeToCollection('products', (data) => {
            setFlowers(data.length === 0
                ? [{ name: 'Rose', taName: 'ரோஜா' }, { name: 'Jasmine', taName: 'மல்லிகை' }, { name: 'Marigold', taName: 'சாமந்தி' }]
                : data.map(f => ({ id: f.id, name: f.name, taName: f.taName })));
        });
        const u2 = subscribeToCollection(COLLECTIONS.F_FARMERS, setFarmers);
        const u3 = subscribeToCollection(COLLECTIONS.F_PURCHASES, setAllPurchases, true);
        const u4 = subscribeToCollection(COLLECTIONS.F_PAYMENTS, setAllPayments, true);
        return () => { u1(); u2(); u3(); u4(); };
    }, []);

    // Calculate current item amount
    useEffect(() => {
        const w = parseFloat(currentItem.weight || 0);
        const r = parseFloat(currentItem.rate || 0);
        if (w > 0 && r > 0) {
            setCurrentItem(prev => ({ ...prev, amount: (w * r).toFixed(2) }));
        } else {
            setCurrentItem(prev => ({ ...prev, amount: '' }));
        }
    }, [currentItem.weight, currentItem.rate]);

    const addToast = (message, type = 'success') => {
        const id = Date.now() + Math.random().toString();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    // Calculate financial stats
    const financialStats = React.useMemo(() => {
        const activeFarmerEntries = selectedFarmerId ? allPurchases.filter(s => s.farmerId === selectedFarmerId && s.date === date) : [];
        const todayTotal = activeFarmerEntries.reduce((s, e) => s + (e.totalAmount || 0), 0);
        
        const dayPayments = allPayments.filter(p => p.farmerId === selectedFarmerId && p.date === date);
        const cashPaid  = dayPayments.reduce((s, p) => s + (p.amount || 0), 0);
        
        let liveBalance = 0;
        if (selectedFarmerId) {
            const farmer = farmers.find(f => f.id === selectedFarmerId);
            liveBalance = farmer?.balance || 0;
        }

        const futurePurchases = selectedFarmerId ? allPurchases.filter(s => s.farmerId === selectedFarmerId && s.date > date) : [];
        const futurePayments = selectedFarmerId ? allPayments.filter(p => p.farmerId === selectedFarmerId && p.date > date) : [];
        
        const futurePurchasesAmt = futurePurchases.reduce((s, x) => s + (Number(x.totalAmount) || 0), 0);
        const futurePayAmt   = futurePayments.reduce((s, x) => s + (Number(x.amount) || 0), 0);

        const oldBalance = selectedFarmerId ? (liveBalance - (futurePurchasesAmt + todayTotal) + (futurePayAmt + cashPaid)) : 0;
        const ledgerBalance = oldBalance - cashPaid;
        const finalBalance = ledgerBalance + todayTotal;

        return { oldBalance, cashPaid, todayTotal, finalBalance };
    }, [farmers, selectedFarmerId, allPurchases, allPayments, date]);

    const toDateStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };

    // Filter today's purchases
    const dailyEntries = React.useMemo(() => {
        return allPurchases.filter(s => {
            const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
            return d === date;
        }).sort((a, b) => {
            const tA = (a.timestamp?.toMillis?.() || a.createdAt?.toMillis?.() || 0);
            const tB = (b.timestamp?.toMillis?.() || b.createdAt?.toMillis?.() || 0);
            return tA - tB;
        });
    }, [allPurchases, date]);

    const farmerTodayEntries = React.useMemo(() => {
        return dailyEntries.filter(s => !selectedFarmerId || s.farmerId === selectedFarmerId);
    }, [dailyEntries, selectedFarmerId]);

    const handleAddItem = async () => {
        if (!selectedFarmerId || !currentItem.flowerName || !currentItem.weight || !currentItem.rate || isSaving) return;
        setIsSaving(true);
        const qty  = parseFloat(currentItem.weight);
        const rate = parseFloat(currentItem.rate);
        const total = qty * rate;
        
        try {
            const farmerObj = farmers.find(f => f.id === selectedFarmerId);
            const purchaseData = {
                farmerId: selectedFarmerId,
                date,
                farmerName: farmerObj?.name || 'Unknown',
                items: [{
                    flowerId: currentItem.flowerId,
                    flowerName: currentItem.flowerName,
                    flowerNameTa: currentItem.flowerNameTa,
                    weight: qty,
                    rate: rate,
                    amount: total
                }],
                totalAmount: total,
                timestamp: serverTimestamp()
            };
            const savedDocRef = await addData(COLLECTIONS.F_PURCHASES, purchaseData);

            // Save Ledger Record (Credit transaction: increases balance we owe farmer)
            const ledgerDoc = {
                farmerId: selectedFarmerId,
                date,
                type: 'purchase',
                refId: savedDocRef.id,
                description: `Flower Purchase (${currentItem.flowerName})`,
                debit: 0,
                credit: total,
                commission: 0,
                balance: (farmerObj?.balance || 0) + total
            };
            await addData(COLLECTIONS.F_LEDGERS, ledgerDoc);

            // Update Farmer's Balance
            await updateDoc(doc(db, COLLECTIONS.F_FARMERS, selectedFarmerId), {
                balance: increment(total)
            });

            addToast('Purchase entry saved successfully!');
            setCurrentItem({ flowerId: '', flowerName: '', flowerNameTa: '', weight: '', rate: '', amount: '' });
            setTimeout(() => refFlower.current?.focus(), 50);
        } catch (err) {
            addToast('Error saving item: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditItem = async (purchase) => {
        setSelectedFarmerId(purchase.farmerId);
        const item = purchase.items[0];
        setCurrentItem({
            flowerId: item.flowerId || '',
            flowerName: item.flowerName || '',
            flowerNameTa: item.flowerNameTa || '',
            weight: String(item.weight),
            rate: String(item.rate),
            amount: String(item.amount)
        });

        try {
            await deleteDoc(doc(db, COLLECTIONS.F_PURCHASES, purchase.id));
            const q = query(
                collection(db, COLLECTIONS.F_LEDGERS),
                where('refId', '==', purchase.id)
            );
            const snap = await getDocs(q);
            for (const docRef of snap.docs) {
                await deleteDoc(docRef.ref);
            }
            await updateDoc(doc(db, COLLECTIONS.F_FARMERS, purchase.farmerId), {
                balance: increment(-purchase.totalAmount)
            });
            setTimeout(() => refFlower.current?.focus(), 100);
        } catch (err) {
            console.error('Edit init failed:', err);
        }
    };

    const handleDeleteItem = async (purchase) => {
        if (!window.confirm(t('delete') + '?')) return;
        try {
            await deleteDoc(doc(db, COLLECTIONS.F_PURCHASES, purchase.id));
            const q = query(
                collection(db, COLLECTIONS.F_LEDGERS),
                where('refId', '==', purchase.id)
            );
            const snap = await getDocs(q);
            for (const docRef of snap.docs) {
                await deleteDoc(docRef.ref);
            }
            await updateDoc(doc(db, COLLECTIONS.F_FARMERS, purchase.farmerId), {
                balance: increment(-purchase.totalAmount)
            });
            addToast('Purchase deleted successfully!');
        } catch (err) {
            addToast('Delete failed: ' + err.message, 'error');
        }
    };

    // OCR Scanning
    const handleImageScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsScanning(true);
        try {
            const { data: { text } } = await Tesseract.recognize(file, 'eng+tam');
            const cleanText = text.toUpperCase();
            console.log("OCR Extracted Text:", cleanText);

            const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
            let matchedFarmerId = '';
            let matchedDate = date;
            const extractedItems = [];

            lines.forEach(line => {
                const cleanLine = line.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
                
                // Date extraction
                const dateMatch = cleanLine.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
                if (dateMatch) {
                    let [_, d, m, y] = dateMatch;
                    if (y.length === 2) y = '20' + y;
                    matchedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }

                // Farmer matching
                farmers.forEach(f => {
                    const fName = f.name.toUpperCase();
                    if (cleanLine.includes(fName)) {
                        matchedFarmerId = f.id;
                    }
                });

                // Item quantities
                const numbers = cleanLine.match(/\d+(\.\d+)?/g);
                if (numbers && numbers.length >= 2) {
                    const rowTextClean = cleanLine.replace(/[^A-Z0-9\s]/g, '');
                    const matchedFlower = flowers.find(fl => {
                        const flName = fl.name.toUpperCase();
                        return rowTextClean.includes(flName);
                    });

                    const flowerName = matchedFlower ? matchedFlower.name : 'Unknown Flower';
                    const weightVal = parseFloat(numbers[0]);
                    const rateVal = parseFloat(numbers[1]);
                    const amtVal = numbers[2] ? parseFloat(numbers[2]) : weightVal * rateVal;

                    if (weightVal > 0 && rateVal > 0) {
                        extractedItems.push({
                            flowerId: matchedFlower ? matchedFlower.id : '',
                            flowerName: flowerName,
                            flowerNameTa: matchedFlower ? (matchedFlower.taName || '') : '',
                            weight: weightVal,
                            rate: rateVal,
                            amount: amtVal
                        });
                    }
                }
            });

            setScanResults({
                farmerId: matchedFarmerId,
                date: matchedDate,
                items: extractedItems
            });
        } catch (error) {
            console.error("OCR scan error:", error);
            addToast('Failed to parse bill text.', 'error');
        } finally {
            setIsScanning(false);
            e.target.value = '';
        }
    };

    const handleApplyScanResults = async () => {
        if (!scanResults) return;
        if (!scanResults.farmerId) {
            addToast('Please select a farmer in the scan results.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const farmerObj = farmers.find(f => f.id === scanResults.farmerId);
            for (const item of scanResults.items) {
                const total = item.weight * item.rate;
                const purchaseDoc = {
                    farmerId: scanResults.farmerId,
                    date: scanResults.date,
                    farmerName: farmerObj?.name || 'Unknown',
                    items: [{
                        flowerId: item.flowerId || '',
                        flowerName: item.flowerName,
                        flowerNameTa: item.flowerNameTa || '',
                        weight: item.weight,
                        rate: item.rate,
                        amount: total
                    }],
                    totalAmount: total,
                    timestamp: serverTimestamp()
                };
                const docRef = await addData(COLLECTIONS.F_PURCHASES, purchaseDoc);

                const ledgerDoc = {
                    farmerId: scanResults.farmerId,
                    date: scanResults.date,
                    type: 'purchase',
                    refId: docRef.id,
                    description: `Flower Purchase (${item.flowerName})`,
                    debit: 0,
                    credit: total,
                    commission: 0,
                    balance: (farmerObj?.balance || 0) + total
                };
                await addData(COLLECTIONS.F_LEDGERS, ledgerDoc);

                await updateDoc(doc(db, COLLECTIONS.F_FARMERS, scanResults.farmerId), {
                    balance: increment(total)
                });
            }
            addToast(`Successfully imported ${scanResults.items.length} items from scanned bill!`);
            setScanResults(null);
        } catch (error) {
            console.error(error);
            addToast('Failed to import scan items.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleShareWhatsApp = () => {
        const activeFarmerEntries = dailyEntries.filter(s => s.farmerId === selectedFarmerId);
        if (!selectedFarmerId || activeFarmerEntries.length === 0) return alert('No items to share for today.');
        const farmer = farmers.find(f => f.id === selectedFarmerId);
        const { oldBalance, cashPaid, todayTotal, finalBalance } = financialStats;

        const dateStr = date.split('-').reverse().join('/');
        let msg = `*POOVANAM MARKET*\n`;
        msg += `*Farmer Purchase Bill*\n\n`;
        msg += `*Date:* ${dateStr}\n`;
        msg += `*Farmer:* ${farmer.name} (#${farmer.displayId})\n`;
        msg += `---------------------------\n`;
        activeFarmerEntries.forEach((entry, idx) => {
            const it = entry.items[0];
            msg += `${idx + 1}. ${it.flowerName}: ${it.weight} KG @ ₹${it.rate} = ₹${it.amount.toFixed(0)}\n`;
        });
        msg += `---------------------------\n`;
        msg += `*Today's Purchase:* ₹${todayTotal.toFixed(0)}\n`;
        msg += `*Cash Paid Today:* ₹${cashPaid.toFixed(0)}\n`;
        msg += `*Old Balance:* ₹${oldBalance.toFixed(0)}\n`;
        msg += `*Net Balance:* ₹${finalBalance.toFixed(0)}\n\n`;
        msg += `Thank you!`;

        const phone = farmer.contact ? farmer.contact.replace(/\D/g, '') : '';
        if (phone.length === 10) {
            window.open(`https://api.whatsapp.com/send?phone=91${phone}&text=${encodeURIComponent(msg)}`, '_blank');
        } else {
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
        }
    };

    const handlePrint = () => {
        const activeFarmerEntries = dailyEntries.filter(s => s.farmerId === selectedFarmerId);
        if (activeFarmerEntries.length > 0) window.print();
    };

    const onKey = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef.current?.focus();
            if (nextRef.current?.select) nextRef.current.select();
        }
    };

    const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
    const formatTime = (ts) => {
        if (!ts) return '--:--';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return '--:--';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'var(--font-sans)' }}>
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

            {/* Print style */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-area, .print-area * { visibility: visible; }
                    .print-area { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}</style>

            {/* ── Dashboard Top Card ── */}
            <div className="print-area" style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                
                {/* ── Header Row ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '20px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                    
                    {/* Left: Label and Date */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px' }}>🌸</span>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {t('farmerPurchase')}
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
                                    border: '1.5px solid #ffedd5', 
                                    borderRadius: '10px', 
                                    fontSize: '13px',
                                    color: '#475569'
                                }}
                            />
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#ea580c', marginTop: '6px', textAlign: 'center' }}>
                                {date.split('-').reverse().join('-')}
                            </div>
                        </div>
                    </div>

                    {/* Center: Large Title */}
                    <h1 style={{ 
                        fontSize: '32px', 
                        fontWeight: 950, 
                        color: '#ea580c', 
                        fontFamily: 'var(--font-display)', 
                        letterSpacing: '0.05em', 
                        margin: 0, 
                        textTransform: 'uppercase' 
                    }}>
                        {t('farmerPurchase')}
                    </h1>

                    {/* Right: Financial Box */}
                    <div style={{ 
                        justifySelf: 'end',
                        background: '#fdf8f6', 
                        border: '1.5px solid #fed7aa', 
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
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>{t('cashPaid')} (-)</span>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#ef4444' }}>{fmt(financialStats.cashPaid)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>{t('purchase')} (+)</span>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#16a34a' }}>{fmt(financialStats.todayTotal)}</span>
                        </div>
                        
                        <div style={{ height: '1.5px', background: '#fed7aa', margin: '4px 0' }} />
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>{t('balance')}</span>
                            <span style={{ fontSize: '20px', fontWeight: 900, color: '#ea580c' }}>{fmt(financialStats.finalBalance)}</span>
                        </div>
                    </div>
                </div>

                {/* Entry Controls */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                    <div>
                        <label style={LABEL_S}>{t('farmer')}</label>
                        <SearchSelect 
                            items={farmers} 
                            value={selectedFarmerId} 
                            onChange={f => setSelectedFarmerId(f.id)} 
                            inputRef={refFarmer} 
                            onKeyDown={e => onKey(e, refFlower)} 
                            placeholder={t('farmer')}
                            lang={lang}
                        />
                    </div>
                    <div>
                        <label style={LABEL_S}>{t('flowerVariety')}</label>
                        <SearchSelect 
                            items={flowers} 
                            value={currentItem.flowerName} 
                            onChange={f => setCurrentItem(p => ({...p, flowerName: f.name, flowerNameTa: f.taName || '', flowerId: f.id || '' }))} 
                            inputRef={refFlower} 
                            onKeyDown={e => onKey(e, refQty)} 
                            placeholder={t('flowerVariety')}
                            lang={lang}
                        />
                    </div>
                    <div>
                        <label style={LABEL_S}>{t('weight')}</label>
                        <input ref={refQty} type="number" placeholder="0.00" value={currentItem.weight} onChange={e => setCurrentItem(p => ({...p, weight: e.target.value}))} onKeyDown={e => onKey(e, refRate)} style={INPUT_S} />
                    </div>
                    <div>
                        <label style={LABEL_S}>{t('rate')}</label>
                        <input ref={refRate} type="number" placeholder="0.00" value={currentItem.rate} onChange={e => setCurrentItem(p => ({...p, rate: e.target.value}))} onKeyDown={e => e.key === 'Enter' && handleAddItem()} style={INPUT_S} />
                    </div>
                    
                    <button
                        ref={refAddBtn}
                        onClick={handleAddItem}
                        disabled={!selectedFarmerId || !currentItem.flowerName || !currentItem.weight || !currentItem.rate || isSaving}
                        style={{
                            height: '42px', padding: '0 20px', borderRadius: '10px', border: 'none',
                            background: '#ea580c', color: '#fff', fontWeight: 700, fontSize: '14px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            transition: 'all 0.2s', opacity: (!selectedFarmerId || !currentItem.flowerName || !currentItem.weight || !currentItem.rate || isSaving) ? 0.6 : 1
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        {isSaving ? '...' : <><Plus size={18} /> {t('addNew')}</>}
                    </button>


                </div>
            </div>

            {/* ── History Table Section ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px', background: '#fdf8f6' }}>
                    <History size={18} color="#ea580c" />
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('todayLiveEntries')}</h3>
                </div>
                
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                                <th style={TH_S}><Clock size={12} style={{marginRight: '6px'}}/>{t('time')}</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('sNo')}</th>
                                <th style={TH_S}>{t('id')}</th>
                                <th style={TH_S}>{t('name')}</th>
                                <th style={TH_S}>{t('flower')}</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('weight')} (KG)</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('rate')}</th>
                                <th style={{...TH_S, textAlign: 'right'}}>{t('total')}</th>
                                <th style={{...TH_S, textAlign: 'center'}}>{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {farmerTodayEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '14px' }}>
                                        {t('noItemsYet')}
                                    </td>
                                </tr>
                            ) : (
                                farmerTodayEntries.map((purchase, idx) => {
                                    const farmer = farmers.find(b => b.id === purchase.farmerId);
                                    const isHighlighted = mainTableSelectedIndex === idx;
                                    return (
                                        <tr key={purchase.id}
                                            ref={el => mainTableRowRefs.current[idx] = el}
                                            tabIndex={0}
                                            onClick={() => setMainTableSelectedIndex(idx)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    const nextIdx = Math.min(idx + 1, farmerTodayEntries.length - 1);
                                                    setMainTableSelectedIndex(nextIdx);
                                                    mainTableRowRefs.current[nextIdx]?.focus();
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    const prevIdx = Math.max(idx - 1, 0);
                                                    setMainTableSelectedIndex(prevIdx);
                                                    mainTableRowRefs.current[prevIdx]?.focus();
                                                }
                                            }}
                                            style={{ 
                                                background: isHighlighted ? '#ea580c' : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                                                color: isHighlighted ? '#fff' : '#374151',
                                                cursor: 'pointer',
                                                outline: 'none'
                                            }}
                                            onMouseEnter={e => !isHighlighted && (e.currentTarget.style.background = '#fff7ed')}
                                            onMouseLeave={e => !isHighlighted && (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}
                                        >
                                            <td style={TD_S}>
                                                <span style={{ 
                                                    fontSize: '11px', fontWeight: 700, 
                                                    color: isHighlighted ? '#fff' : '#94a3b8', 
                                                    background: isHighlighted ? 'rgba(255,255,255,0.2)' : '#f1f5f9', 
                                                    padding: '3px 8px', borderRadius: '6px' 
                                                }}>
                                                    {formatTime(purchase.timestamp || purchase.createdAt)}
                                                </span>
                                            </td>
                                            <td style={{...TD_S, textAlign: 'center', fontWeight: 600, color: isHighlighted ? '#fff' : '#64748b'}}>
                                                {idx + 1}
                                            </td>
                                            <td style={TD_S}>
                                                <span style={{ 
                                                    fontSize: '12px', fontWeight: 800, 
                                                    color: isHighlighted ? '#fff' : '#ea580c', 
                                                    background: isHighlighted ? 'rgba(255,255,255,0.2)' : '#fff7ed', 
                                                    border: '1px solid ' + (isHighlighted ? 'rgba(255,255,255,0.4)' : '#fed7aa'), 
                                                    padding: '3px 10px', borderRadius: '8px' 
                                                }}>
                                                    #{farmer?.displayId || '---'}
                                                </span>
                                            </td>
                                            <td style={{...TD_S, fontWeight: 700, color: isHighlighted ? '#fff' : '#334155'}}>
                                                {farmer ? farmer.name : (purchase.farmerName || '---')}
                                            </td>
                                            <td style={{...TD_S, fontWeight: 700, color: isHighlighted ? '#fff' : '#ea580c'}}>
                                                {lang === 'ta' ? (purchase.items[0]?.flowerNameTa || purchase.items[0]?.flowerName) : purchase.items[0]?.flowerName}
                                            </td>
                                            <td style={{...TD_S, textAlign: 'center', color: isHighlighted ? '#fff' : '#64748b', fontWeight: 600}}>
                                                {purchase.items[0]?.weight} KG
                                            </td>
                                            <td style={{...TD_S, textAlign: 'center', color: isHighlighted ? '#fff' : '#64748b', fontWeight: 600}}>
                                                ₹{purchase.items[0]?.rate}
                                            </td>
                                            <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: isHighlighted ? '#fff' : '#ea580c'}}>
                                                {fmt(purchase.totalAmount)}
                                            </td>
                                            <td style={{...TD_S, textAlign: 'center'}}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    {isEditDeleteAllowed() && (
                                                        <>
                                                            <button onClick={() => handleEditItem(purchase)}
                                                                style={{ 
                                                                    width: '28px', height: '28px', borderRadius: '6px', 
                                                                    border: '1px solid ' + (isHighlighted ? 'rgba(255,255,255,0.4)' : '#e2e8f0'), 
                                                                    background: isHighlighted ? 'rgba(255,255,255,0.1)' : '#fff', 
                                                                    color: isHighlighted ? '#fff' : '#3b82f6', 
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' 
                                                                }}
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button onClick={() => handleDeleteItem(purchase)}
                                                                style={{ 
                                                                    width: '28px', height: '28px', borderRadius: '6px', 
                                                                    border: '1px solid ' + (isHighlighted ? 'rgba(255,255,255,0.4)' : '#fee2e2'), 
                                                                    background: isHighlighted ? 'rgba(255,255,255,0.1)' : '#fff', 
                                                                    color: isHighlighted ? '#fff' : '#ef4444', 
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' 
                                                                }}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {farmerTodayEntries.length > 0 && (
                            <tfoot>
                                <tr style={{ background: '#fcfcfc', borderTop: '2px solid #e2e8f0' }}>
                                    <td colSpan={7} style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '12px'}}>{t('todayTotal')}</td>
                                    <td style={{...TD_S, textAlign: 'right', fontWeight: 900, fontSize: '18px', color: '#ea580c'}}>{fmt(farmerTodayEntries.reduce((s, e) => s + (e.totalAmount || 0), 0))}</td>
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
                            Total Weight
                        </span>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                            {farmerTodayEntries.reduce((s, e) => s + parseFloat(e.items[0]?.weight || 0), 0).toFixed(1)} KG
                        </div>
                    </div>
                    <div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {t('todayTotal')}
                        </span>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                            {fmt(farmerTodayEntries.reduce((s, e) => s + (e.totalAmount || 0), 0))}
                        </div>
                    </div>
                </div>
                {selectedFarmerId && (
                    <div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Net Final Balance
                        </span>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#ea580c' }}>
                            {fmt(financialStats.finalBalance)}
                        </div>
                    </div>
                )}
            </div>

            {/* OCR Verification Modal */}
            {scanResults && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ background: '#fff7ed', borderRadius: '10px', padding: '6px' }}>
                                    <span style={{ fontSize: '18px' }}>🔍</span>
                                </div>
                                <span style={{ fontSize: '16px', fontWeight: 800, color: '#ea580c', fontFamily: 'var(--font-display)' }}>
                                    AI Bill Scan Results
                                </span>
                            </div>
                            <button onClick={() => setScanResults(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={20} /></button>
                        </div>

                        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', flex: 1 }}>
                            <div>
                                <label style={LABEL_S}>Detected Date</label>
                                <input 
                                    type="date"
                                    value={scanResults.date}
                                    onChange={e => setScanResults({...scanResults, date: e.target.value})}
                                    style={INPUT_S}
                                />
                            </div>
                            <div>
                                <label style={LABEL_S}>Detected Farmer</label>
                                <select 
                                    value={scanResults.farmerId}
                                    onChange={e => setScanResults({...scanResults, farmerId: e.target.value})}
                                    style={INPUT_S}
                                >
                                    <option value="">-- Select Farmer --</option>
                                    {farmers.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={LABEL_S}>Detected Items</label>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#ea580c' }}>Flower</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#ea580c' }}>Weight</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#ea580c' }}>Rate</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#ea580c' }}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scanResults.items.map((it, idx) => (
                                                <tr key={idx} style={{ borderBottom: idx < scanResults.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                                    <td style={{ padding: '8px 12px' }}>
                                                        <select
                                                            value={it.flowerName}
                                                            onChange={(e) => {
                                                                const copy = [...scanResults.items];
                                                                const fl = flowers.find(f => f.name === e.target.value);
                                                                copy[idx].flowerName = e.target.value;
                                                                copy[idx].flowerId = fl ? fl.id : '';
                                                                copy[idx].flowerNameTa = fl ? (fl.taName || '') : '';
                                                                setScanResults({ ...scanResults, items: copy });
                                                            }}
                                                            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 4px', fontSize: '12px' }}
                                                        >
                                                            <option value={it.flowerName}>{it.flowerName}</option>
                                                            {flowers.map(f => (
                                                                <option key={f.id} value={f.name}>{f.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                        <input 
                                                            type="number"
                                                            value={it.weight}
                                                            onChange={(e) => {
                                                                const copy = [...scanResults.items];
                                                                copy[idx].weight = parseFloat(e.target.value || 0);
                                                                copy[idx].amount = copy[idx].weight * copy[idx].rate;
                                                                setScanResults({ ...scanResults, items: copy });
                                                            }}
                                                            style={{ width: '60px', textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 4px', fontSize: '12px' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                        <input 
                                                            type="number"
                                                            value={it.rate}
                                                            onChange={(e) => {
                                                                const copy = [...scanResults.items];
                                                                copy[idx].rate = parseFloat(e.target.value || 0);
                                                                copy[idx].amount = copy[idx].weight * copy[idx].rate;
                                                                setScanResults({ ...scanResults, items: copy });
                                                            }}
                                                            style={{ width: '60px', textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 4px', fontSize: '12px' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                                                        ₹{it.amount.toFixed(0)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafa', flexShrink: 0 }}>
                            <button type="button" onClick={() => setScanResults(null)}
                                style={{ padding: '9px 20px', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleApplyScanResults} disabled={isSaving}
                                style={{ padding: '9px 22px', borderRadius: '9px', border: '1.5px solid #ea580c', background: '#fff', color: '#ea580c', fontWeight: 700, fontSize: '13px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1, fontFamily: 'var(--font-sans)' }}>
                                Import & Save All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FarmerPurchase;
