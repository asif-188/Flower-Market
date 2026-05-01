import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { Trash2, Plus, History, IndianRupee, Save, X, ChevronLeft, Printer, FileText, Search, Download, MessageCircle, Pencil, Users, Camera, Scan, Upload, FileSpreadsheet, Download as DownloadIcon } from 'lucide-react';
import { db, subscribeToCollection, saveOutsidePurchase, saveVendor, deleteVendor, getTenant } from '../utils/storage';
import { doc, updateDoc, increment, serverTimestamp, deleteDoc, collection, addDoc, getDoc } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import * as XLSX from 'xlsx';
import { generateLedgerCanvas, generatePaymentReceiptCanvas, generatePurchaseReceiptCanvas } from '../utils/receiptCanvas';
import WhatsAppIcon from '../components/WhatsAppIcon';
import Tesseract from 'tesseract.js';

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
    const [refFile] = [useRef(null)];
    const [isScanning, setIsScanning] = useState(false);
    const [draftItems, setDraftItems] = useState([]);
    const [scanResults, setScanResults] = useState([]);
    const [showScanModal, setShowScanModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkCount, setBulkCount] = useState(10);
    const [itemRows, setItemRows] = useState(5);
    const [bulkMode, setBulkMode] = useState('blank'); // 'blank' or 'filled'
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [viewingVendor, setViewingVendor] = useState(null);

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
    const formatTime = (ts) => {
        if (!ts) return '--:--';
        // Handle Firestore Timestamp, Date object, or fallback to createdAt
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return '--:--';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

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
        return filtered.sort((a,b) => {
            const tA = (a.timestamp?.toMillis?.() || a.createdAt?.toMillis?.() || 0);
            const tB = (b.timestamp?.toMillis?.() || b.createdAt?.toMillis?.() || 0);
            return tB - tA;
        });
    }, [purchases, date, vendorId]);

    const stats = useMemo(() => {
        const vendor = vendors.find(v => v.id === vendorId);
        const todayTot = todayPurchases.reduce((acc, p) => acc + (p.grandTotal || 0), 0);
        
        let todayPayFiltered = payments.filter(p => p.date === date && p.type === 'vendor');
        if (vendorId) {
            todayPayFiltered = todayPayFiltered.filter(p => p.entityId === vendorId);
        }

        return {
            todayTotal: todayTot,
            cashPaid: todayPayFiltered.reduce((acc, p) => acc + (p.amount || 0), 0),
            vendorBalance: vendor?.balance || 0
        };
    }, [todayPurchases, payments, vendors, vendorId, date]);

    // Excel Operations
    const handleDownloadTemplate = () => {
        const templateRows = [
            { 'Vendor Name': 'Vendor Name', 'Flower Name': 'Flower Name', 'Qty': 'Qty', 'Rate': 'Rate', 'Total': 'Total' },
            { 'Vendor Name': 'EXAMPLE VENDOR', 'Flower Name': 'Malli', 'Qty': 10, 'Rate': 100, 'Total': 1000 },
            { 'Vendor Name': '', 'Flower Name': 'Mulli', 'Qty': 5, 'Rate': 200, 'Total': 1000 },
            {},
            { 'Vendor Name': 'ANOTHER VENDOR', 'Flower Name': 'Rose', 'Qty': 20, 'Rate': 50, 'Total': 1000 }
        ];
        const ws = XLSX.utils.json_to_sheet(templateRows, { skipHeader: true });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ImportTemplate');
        XLSX.writeFile(wb, `ImportTemplate.xlsx`);
    };

    const handleExportToExcel = () => {
        if (draftItems.length === 0) return alert('No items in list to export!');
        
        // Group by vendor (existing logic)
        const groups = new Map();
        draftItems.forEach(item => {
            const vid = item.vendorId || vendorId || 'unknown';
            if (!groups.has(vid)) groups.set(vid, []);
            groups.get(vid).push(item);
        });

        const rows = [];
        groups.forEach((items, vid) => {
            const vendor = vendors.find(v => v.id === vid);
            // Block Header
            rows.push({
                'Vendor Name': 'Vendor Name', 'Flower Name': 'Flower Name', 'Qty': 'Qty', 'Rate': 'Rate', 'Total': 'Total'
            });
            // Items
            items.forEach((i, idx) => {
                rows.push({
                    'Vendor Name': idx === 0 ? (vendor?.name || 'Unknown') : '',
                    'Flower Name': i.flowerType,
                    'Qty': i.quantity,
                    'Rate': i.price,
                    'Total': i.total
                });
            });
            rows.push({}); // Empty separator
        });

        const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'PurchaseItems');
        XLSX.writeFile(wb, `MarketBills_${Date.now()}.xlsx`);
    };

    const handleImportFromExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const ab = evt.target.result;
            const wb = XLSX.read(ab, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws);
            
            if (data.length === 0) return;

            const vendorGroups = new Map(); // vendorId -> items[]
            let currentVendorId = null;

            for (const row of data) {
                const vName = row['Vendor Name'] || row['Vendor'];
                const fName = row['Flower Name'] || row['Flower'];
                const qty = parseFloat(row['Qty'] || row['Quantity'] || 0);
                const rate = parseFloat(row['Rate'] || row['Price'] || 0);

                if (vName) {
                    const v = vendors.find(vend => 
                        vend.name.toUpperCase().includes(String(vName).trim().toUpperCase()) ||
                        (vend.nameTa && vend.nameTa.includes(String(vName).trim()))
                    );
                    if (v) currentVendorId = v.id;
                }

                if (currentVendorId && fName && qty > 0) {
                    const flower = flowers.find(f => 
                        f.name.toUpperCase().includes(String(fName).trim().toUpperCase()) ||
                        (f.taName && f.taName.includes(String(fName).trim()))
                    );
                    
                    const newItem = {
                        flowerType: flower ? flower.name : String(fName),
                        flowerTypeTa: flower ? (flower.taName || '') : '',
                        quantity: qty,
                        price: rate,
                        total: qty * rate,
                        id: Math.random()
                    };

                    if (!vendorGroups.has(currentVendorId)) vendorGroups.set(currentVendorId, []);
                    vendorGroups.get(currentVendorId).push(newItem);
                }
            }

            if (vendorGroups.size === 0) return alert('No valid data found in Excel.');

            setIsSaving(true);
            try {
                let count = 0;
                for (const [vid, items] of vendorGroups.entries()) {
                    const vendor = vendors.find(v => v.id === vid);
                    const grandTotal = items.reduce((s, i) => s + i.total, 0);
                    
                    await saveOutsidePurchase({
                        vendorId: vid,
                        vendorName: vendor?.name || 'Unknown',
                        items,
                        grandTotal,
                        date: date, // uses current selected date
                        timestamp: serverTimestamp(),
                    });
                    
                    // Update Vendor Balance
                    const vRef = doc(db, 'vendors', vid);
                    await updateDoc(vRef, { 
                        balance: increment(grandTotal),
                        lastPurchase: serverTimestamp()
                    });
                    count++;
                }
                alert(`Successfully imported and saved ${count} bills from Excel!`);
            } catch (err) {
                alert('Save Error: ' + err.message);
            } finally {
                setIsSaving(false);
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    // AI Bill Scanning
    const handleImageScan = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setIsScanning(true);
        
        let allExtractedItems = [];
        let firstVendorId = null;

        try {
            const runScan = async (imageSource) => {
                const { data: { text } } = await Tesseract.recognize(imageSource, 'eng+tam');
                const cleanText = text.toUpperCase();
                console.log("Scan Result:", cleanText);
                
                const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
                let vendorIdMatch = null;
                let foundDate = null;
                const items = [];

                lines.forEach(line => {
                    // Pre-clean: Remove common table dividers
                    const cleanLine = line.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
                    if (cleanLine.length < 3) return;

                    // Skip Admin/Header lines
                    const skipWords = ['FLOWER', 'NAME', 'OUTSIDE', 'PURCHASE', 'BILL', 'VEND', 'TOTAL:'];
                    if (skipWords.some(w => cleanLine.includes(w))) return;

                    // Date Detection (e.g. 21/4/26, 21-04-2026)
                    const dateMatch = cleanLine.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
                    if (dateMatch && !foundDate) {
                        let [_, d, m, y] = dateMatch;
                        if (y.length === 2) y = '20' + y;
                        foundDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                        return; // Done with this line
                    }

                    // Vendor Detection
                    vendors.forEach(v => {
                        const vName = v.name.toUpperCase();
                        const vTa = v.nameTa ? v.nameTa.toUpperCase() : "";
                        const vArr = vName.split(' ');
                        const isAbbrMatch = vArr.some(word => word.length >= 2 && cleanLine === word);
                        
                        if (cleanLine.includes(vName) || (vTa && cleanLine.includes(vTa)) || isAbbrMatch) {
                            vendorIdMatch = v.id;
                        }
                    });

                    // Item Parsing
                    const numbers = cleanLine.match(/\d+(\.\d+)?/g);
                    if (numbers && numbers.length >= 2) {
                        const rowClean = cleanLine.replace(/[^A-Z0-9\u0B80-\u0BFF\s]/g, '');
                        const flower = flowers.find(f => {
                            const en = f.name.toUpperCase();
                            const ta = (f.taName || '').toUpperCase();
                            const shorthand = ta.slice(0, 3);
                            return rowClean.includes(en) || (ta && rowClean.includes(ta)) || (shorthand && rowClean.includes(shorthand));
                        });

                        const flowerName = flower ? flower.name : 'Unknown';
                        const flowerTa = flower ? (flower.taName || '') : '';

                        const q = parseFloat(numbers[0]);
                        const r = parseFloat(numbers[1]);
                        const t = numbers[2] ? parseFloat(numbers[2]) : q * r;

                        items.push({
                            flowerType: flowerName, flowerTypeTa: flowerTa,
                            quantity: q, 
                            price: r || (q > 0 ? t/q : 0), 
                            total: t,
                            vendorId: vendorIdMatch, 
                            id: Math.random()
                        });
                    }
                });
                return { vendorIdMatch, items, foundDate };
            };

            for (const file of files) {
                // Pass 1: Original
                let result = await runScan(file);

                // Pass 2: Rotated 90 Deg (if P1 failed)
                if (result.items.length === 0) {
                    const rotatedBlob = await new Promise(resolve => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.height; canvas.height = img.width;
                            const ctx = canvas.getContext('2d');
                            ctx.rotate(90 * Math.PI / 180);
                            ctx.drawImage(img, 0, -img.width);
                            canvas.toBlob(resolve, 'image/jpeg', 0.85);
                        };
                        img.src = URL.createObjectURL(file);
                    });
                    result = await runScan(rotatedBlob);
                }

                if (!firstVendorId && result.vendorIdMatch) firstVendorId = result.vendorIdMatch;
                if (result.foundDate) setDate(result.foundDate);
                const itemsWithVendor = result.items.map(item => ({ ...item, vendorId: result.vendorIdMatch || vendorId }));
                allExtractedItems = [...allExtractedItems, ...itemsWithVendor];
            }

            if (firstVendorId) setVendorId(firstVendorId);
            if (allExtractedItems.length > 0) {
                setScanResults(allExtractedItems);
                setShowScanModal(true);
            } else {
                alert(lang === 'ta' ? 'விவரங்களை எடுக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்' : 'Could not extract details from the uploaded images.');
            }
        } catch (err) {
            alert('Scan Error: ' + err.message);
        } finally {
            setIsScanning(false);
            if (refFile.current) refFile.current.value = '';
        }
    };

    const handleConfirmScan = () => {
        setDraftItems(prev => [...prev, ...scanResults]);
        setShowScanModal(false);
        setScanResults([]);
    };

    const handleUpdateScanResult = (idx, field, val) => {
        const updated = [...scanResults];
        updated[idx] = { ...updated[idx], [field]: val };
        if (field === 'quantity' || field === 'price') {
            updated[idx].total = parseFloat(updated[idx].quantity || 0) * parseFloat(updated[idx].price || 0);
        }
        setScanResults(updated);
    };

    // Handlers
    const handleAddItemToBill = () => {
        if (!currentItem.flowerType || !currentItem.quantity || !currentItem.price) return;
        const qty = parseFloat(currentItem.quantity);
        const rate = parseFloat(currentItem.price);
        const newItem = { ...currentItem, total: qty * rate, id: Date.now(), time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) };
        setDraftItems(p => [newItem, ...p]);
        setCurrentItem({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
        refFlower.current?.focus();
    };

    const handleSavePurchase = async () => {
        const finalItems = [...draftItems];
        if (currentItem.flowerType && currentItem.quantity && currentItem.price) {
            const qty = parseFloat(currentItem.quantity);
            const rate = parseFloat(currentItem.price);
            finalItems.push({ ...currentItem, total: qty * rate });
        }

        if (!vendorId || finalItems.length === 0 || isSaving) return;
        setIsSaving(true);
        const grandTotal = finalItems.reduce((s, i) => s + (i.total || 0), 0);

        try {
            const vendor = vendors.find(v => v.id === vendorId);
            if (editingPurchaseId) {
                const oldSnap = await getDoc(doc(db, 'outside_purchases', editingPurchaseId));
                if (oldSnap.exists()) {
                    const oldTotal = oldSnap.data().grandTotal || 0;
                    const diff = grandTotal - oldTotal;

                    await updateDoc(doc(db, 'outside_purchases', editingPurchaseId), {
                        vendorId,
                        vendorName: vendor?.name || '',
                        items: finalItems,
                        grandTotal: grandTotal,
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
                    items: finalItems,
                    grandTotal: grandTotal,
                    cashPaid: 0,
                    timestamp: serverTimestamp(),
                });
                await updateDoc(doc(db, 'vendors', vendorId), { balance: increment(grandTotal) });
            }
            
            setCurrentItem({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
            setDraftItems([]);
            setTimeout(() => refFlower.current?.focus(), 50);
        } catch (err) { alert(err.message); }
        finally { setIsSaving(false); }
    };

    const handleEditPurchase = (p) => {
        setEditingPurchaseId(p.id);
        setVendorId(p.vendorId);
        setDate(p.date || new Date().toLocaleDateString('en-CA'));
        
        if (p.items && p.items.length > 0) {
            const [first, ...rest] = p.items;
            setCurrentItem({
                flowerType: first.flowerType,
                flowerTypeTa: first.flowerTypeTa || '',
                quantity: first.quantity,
                price: first.price
            });
            setDraftItems(rest.map(item => ({...item, id: Math.random()})));
        }
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
        win.document.write(`<html><head><style>@media print{body{margin:0}}body{margin:0;display:flex;justify-content:center;align-items:flex-start;background:#fff}img{max-width:100%;height:auto}</style></head><body><img src="${url}"><script>window.onload=function(){window.print();}</script></body></html>`);
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
            await saveVendor({ 
                ...vendorForm, 
                id: editingVendor?.id,
                balance: parseFloat(vendorForm.balance) || 0
            });
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

    const handlePrintBlankTemplate = (count = 1, rows = 5) => {
        const isTwelve = rows === 1;
        const win = window.open('', '_blank');
        const templateHtml = `
            <div class="bill-page ${isTwelve ? 'twelve' : ''}">
                <div class="box">
                    <div class="header" style="margin-bottom: ${isTwelve ? '5px' : '10px'};">
                        <h1 style="margin:0; font-size: ${isTwelve ? '11px' : '14px'};">OUTSIDE PURCHASE BILL</h1>
                        <p style="margin:1px 0; font-size: ${isTwelve ? '8px' : '9px'}; opacity: 0.7;">${bizInfo.name}</p>
                    </div>
                    <div class="line" style="font-size: ${isTwelve ? '9px' : '11px'}; margin-bottom: ${isTwelve ? '4px' : '8px'};">VENDOR: <span class="field"></span></div>
                    <div class="line" style="font-size: ${isTwelve ? '9px' : '11px'}; margin-bottom: ${isTwelve ? '6px' : '12px'};">DATE: <span class="field" style="min-width: 60px;"></span></div>
                    
                    <table class="items-table">
                        <thead>
                            <tr style="font-size: ${isTwelve ? '8px' : '9px'};">
                                <th style="width: 45%; padding: 2px;">FLOWER</th>
                                <th style="width: 15%; padding: 2px;">QTY</th>
                                <th style="width: 15%; padding: 2px;">RATE</th>
                                <th style="width: 25%; padding: 2px;">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Array(rows).fill(0).map(() => `
                                <tr>
                                    <td><span class="field-cell" style="height: ${isTwelve ? '14px' : '18px'};"></span></td>
                                    <td><span class="field-cell" style="height: ${isTwelve ? '14px' : '18px'};"></span></td>
                                    <td><span class="field-cell" style="height: ${isTwelve ? '14px' : '18px'};"></span></td>
                                    <td><span class="field-cell" style="height: ${isTwelve ? '14px' : '18px'};"></span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="font-size: ${isTwelve ? '8px' : '10px'};">
                                <th colspan="3" style="text-align: right; padding: 3px;">TOTAL:</th>
                                <td><span class="field-cell" style="height: 14px;"></span></td>
                            </tr>
                        </tfoot>
                    </table>
                    <div style="margin-top:5px; text-align:right; font-size:7px; opacity:0.4;">
                        Ref: Poovanam-v4-UltraDensity
                    </div>
                </div>
            </div>
        `;

        win.document.write(`
            <html>
                <head>
                    <title>Bill Templates</title>
                    <style>
                        @page { margin: 3mm; size: A4; }
                        body { font-family: 'Inter', sans-serif; background: #fff; margin: 0; padding: 0; }
                        .bill-page { 
                            width: 50%; height: 33.333%; /* 6 per page default */
                            display: inline-flex; align-items: center; justify-content: center;
                            box-sizing: border-box; page-break-inside: avoid;
                            border: 0.5px dashed #eee;
                            float: left;
                        }
                        .bill-page.twelve {
                            width: 33.333%; height: 25%; /* 12 per page (4 rows x 3 columns) */
                        }
                        .box { border: 1.5px solid #000; padding: 8px; border-radius: 6px; width: 92%; }
                        .line { font-weight: 700; display: flex; align-items: flex-end; }
                        .field { border-bottom: 1px solid #000; flex: 1; height: 16px; margin-left: 5px; }
                        .items-table { width: 100%; border-collapse: collapse; }
                        .items-table th, .items-table td { border: 1.2px solid #000; padding: 0; font-size: 10px; }
                        .items-table th { background: #f9f9f9; }
                        .field-cell { display: block; height: 20px; }
                        @media print { 
                            .no-print { display: none; } 
                            .bill-page { border: 1px dashed #ccc; }
                        }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="position:fixed; top:0; left:0; right:0; background:white; padding:15px; text-align:center; border-bottom:1px solid #eee; z-index:100;">
                        <button onclick="window.print()" style="padding:10px 25px; font-size:16px; background:#d97706; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:700;">PRINT NOW</button>
                    </div>
                    <div style="padding-top: 50px;">
                        ${Array(count).fill(templateHtml).join('')}
                    </div>
                </body>
            </html>
        `);
        win.document.close();
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
        win.document.write(`<html><head><style>@media print{body{margin:0}}body{margin:0;display:flex;justify-content:center;align-items:flex-start;background:#fff}img{max-width:100%;height:auto}</style></head><body><img src="${url}"><script>window.onload=function(){window.print();}</script></body></html>`);
        win.document.close();
    };

    const handleBack = () => setActiveTab('menu');

    /* ── Render Sub-sections ── */

    const BulkPrintModal = () => (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '24px', width: '400px', maxWidth: '100%', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#92400e', marginBottom: '8px' }}>Bulk Print Bills</h3>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>Generate blank templates to distribute to vendors.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ fontSize: '10px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Flower Rows</label>
                            <select value={itemRows} onChange={e => setItemRows(Number(e.target.value))} style={{ ...INPUT_S, width: '100%', padding: '8px' }}>
                                <option value={1}>1 Flower (12/Page)</option>
                                <option value={5}>5 Flowers (6/Page)</option>
                                <option value={10}>10 Flowers (6/Page)</option>
                                <option value={15}>15 Flowers (6/Page)</option>
                                <option value={20}>20 Flowers (6/Page)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '10px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Copies</label>
                            <select value={bulkCount} onChange={e => setBulkCount(Number(e.target.value))} style={{ ...INPUT_S, width: '100%', padding: '8px' }}>
                                <option value={12}>12 Bills</option>
                                <option value={24}>24 Bills</option>
                                <option value={60}>60 Bills</option>
                                <option value={120}>120 Bills</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => { handlePrintBlankTemplate(bulkCount, itemRows); setShowBulkModal(false); }} style={{ flex: 1, padding: '14px', background: '#d97706', color: '#fff', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Generate & Print</button>
                        <button onClick={() => setShowBulkModal(false)} style={{ padding: '14px 20px', background: '#f8fafc', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );

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
            {showBulkModal && <BulkPrintModal />}
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
                    {vendorId ? (
                        <div style={{ justifySelf: 'end', background: '#fffbeb', border: '1.5px solid #fed7aa', borderRadius: '16px', padding: '16px 20px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                                    {t('initialDues') || 'Old Balance'}
                                </span>
                                <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                                    {fmt(stats.vendorBalance - stats.todayTotal + stats.cashPaid)}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>{t('cashPaid')}</span>
                                <span style={{ fontSize: '15px', fontWeight: 700, color: '#16a34a' }}>- {fmt(stats.cashPaid)}</span>
                            </div>
                            <div style={{ height: '1.5px', background: '#fed7aa', margin: '4px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>{t('balance')}</span>
                                <span style={{ fontSize: '18px', fontWeight: 900, color: '#ef4444' }}>{fmt(stats.vendorBalance - stats.todayTotal)}</span>
                            </div>
                        </div>
                    ) : (
                        <div style={{ justifySelf: 'end', background: '#f8fafc', border: '1.5px dashed #e2e8f0', borderRadius: '16px', padding: '16px 20px', minWidth: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>← Select a vendor to view balance</span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px', gap: '16px', alignItems: 'flex-end', marginBottom: '20px' }}>
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
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '32px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                        <button 
                            onClick={() => setShowBulkModal(true)}
                            style={{ 
                                height: '42px', padding: '0 15px', 
                                background: '#fff', border: '1.5px solid #fed7aa', 
                                color: '#d97706', borderRadius: '10px', 
                                cursor: 'pointer', display: 'flex', 
                                alignItems: 'center', justifyContent: 'center',
                                gap: '8px', fontWeight: 700
                            }}
                        >
                            <Printer size={18}/> {t('bulkPrint') || 'Bulk Print'}
                        </button>
                        <input type="file" ref={refFile} style={{ display: 'none' }} accept="image/*" onChange={handleImageScan} />
                        <button onClick={() => refFile.current?.click()} disabled={isScanning} style={{ width: '42px', height: '42px', background: '#fff', border: '1.5px solid #fed7aa', color: '#d97706', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('scanBill')}>
                            {isScanning ? <div style={{ width: '18px', height: '18px', border: '2px solid #d97706', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Camera size={20}/>}
                        </button>
                        <button onClick={handleDownloadTemplate} style={{ width: '42px', height: '42px', background: '#fff', border: '1.5px solid #64748b', color: '#64748b', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Download Import Template">
                            <DownloadIcon size={20}/>
                        </button>
                        <label style={{ width: '42px', height: '42px', background: '#fff', border: '1.5px solid #6366f1', color: '#6366f1', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Import Excel">
                            <Upload size={20} /><input type="file" accept=".xlsx, .xls" onChange={handleImportFromExcel} style={{ display: 'none' }} />
                        </label>
                        <div style={{ width: '1px', background: '#e2e8f0', margin: '0 4px' }} />
                        <button onClick={handleAddItemToBill} disabled={!currentItem.flowerType || !currentItem.quantity || !currentItem.price} style={{ height: '42px', padding: '0 16px', background: '#fff', border: '1.5px solid #d97706', color: '#d97706', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700 }} title={t('addToList')}>
                            <Plus size={20}/> {t('addToList') || 'Add Item'}
                        </button>
                    </div>

                    <button 
                        onClick={handleSavePurchase} 
                        disabled={isSaving || !vendorId || (draftItems.length === 0 && !currentItem.flowerType) || isScanning}
                        style={{ height: '42px', padding: '0 32px', background: '#d97706', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.2)' }}
                    >
                        {isSaving ? '...' : <><Save size={18}/> {editingPurchaseId ? t('update') : t('saveReceipt') || 'Save Receipt'}</>}
                    </button>
                    {editingPurchaseId && (
                        <button 
                            onClick={() => {
                                setEditingPurchaseId(null);
                                setVendorId('');
                                setDraftItems([]);
                                setCurrentItem({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
                            }}
                            style={{ width: '42px', height: '42px', background: '#fff', border: '1.5px solid #fed7aa', color: '#92400e', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <X size={20}/>
                        </button>
                    )}
                </div>

                {/* --- Draft Items Table --- */}
                {draftItems.length > 0 && (
                    <div style={{ marginTop: '20px', border: '1.5px dashed #fed7aa', borderRadius: '12px', padding: '16px', background: '#fffcf9' }}>
                        <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <History size={14}/> {t('currentItems') || 'Items in Current Bill'}
                        </h4>
                        <table style={{ width: '100%', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ color: '#94a3b8', textAlign: 'left', borderBottom: '1px solid #fed7aa' }}>
                                    <th style={{ padding: '8px' }}>{t('time') || 'Time'}</th>
                                    <th style={{ padding: '8px' }}>{t('flower')}</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>{t('qty')}</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>{t('rate')}</th>
                                    <th style={{ padding: '8px', textAlign: 'right' }}>{t('total')}</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {draftItems.map((item, idx) => (
                                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #fff7ed' }}>
                                        <td style={{ padding: '8px' }}>
                                            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>{item.time || '--:--'}</span>
                                        </td>
                                        <td style={{ padding: '8px', fontWeight: 600 }}>{lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : item.flowerType}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.price}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{fmt(item.total)}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <button onClick={() => setDraftItems(p => p.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
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
                            ) : todayPurchases.flatMap((p, pIdx) => (
                                p.items.map((item, iIdx) => (
                                    <tr key={`${p.id}-${iIdx}`} style={{ borderBottom: iIdx === p.items.length - 1 ? '1px solid #e2e8f0' : '1px solid #f8fafc', background: pIdx%2===0 ? '#fff' : '#fafafa' }}>
                                        <td style={TD_S}>
                                            {iIdx === 0 && (
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                                                    {formatTime(p.timestamp || p.createdAt)}
                                                </span>
                                            )}
                                        </td>
                                        <td style={TD_S}>
                                            {iIdx === 0 && (
                                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', background: '#fffbeb', border: '1px solid #fed7aa', padding: '3px 8px', borderRadius: '6px' }}>
                                                    #{vendors.find(v => v.id === p.vendorId)?.displayId || '---'}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ ...TD_S, fontWeight: 700 }}>{iIdx === 0 ? p.vendorName : ''}</td>
                                        <td style={{ ...TD_S, fontWeight: 700, color: '#92400e' }}>
                                            {lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : item.flowerType}
                                        </td>
                                        <td style={{ ...TD_S, textAlign: 'center', color: '#64748b' }}>
                                            {parseFloat(item.quantity || 0).toFixed(2)}
                                        </td>
                                        <td style={{ ...TD_S, textAlign: 'center', color: '#64748b' }}>
                                            {item.price || (item.quantity > 0 ? (item.total / item.quantity).toFixed(2) : 0)}
                                        </td>
                                        <td style={{ ...TD_S, textAlign: 'right', fontWeight: 700, color: '#d97706' }}>
                                            {fmt(item.total)}
                                        </td>
                                        <td style={{ ...TD_S, textAlign: 'center' }}>
                                            {iIdx === 0 && (
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
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ))}
                        </tbody>
                            <tfoot>
                                <tr style={{ background: '#fffbeb', borderTop: '2px solid #fed7aa' }}>
                                    <td colSpan={4} style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#92400e'}}>{t('total').toUpperCase()}</td>
                                    <td style={{...TD_S, textAlign: 'center', fontWeight: 900}}>
                                        {todayPurchases.reduce((acc, p) => acc + p.items.reduce((s, i) => s + parseFloat(i.quantity || 0), 0), 0).toFixed(2)}
                                    </td>
                                    <td></td>
                                    <td style={{...TD_S, textAlign: 'right', fontWeight: 900, fontSize: '18px', color: '#d97706'}}>{fmt(stats.todayTotal)}</td>
                                    <td></td>
                                </tr>
                                {vendorId && (() => {
                                    const balance = stats.vendorBalance - stats.todayTotal;
                                    const grandTotal = stats.vendorBalance;
                                    return (
                                        <tr style={{ background: '#dcfce7', borderTop: '2px solid #86efac' }}>
                                            <td colSpan={6} style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#14532d', fontSize: '13px'}}>
                                                {t('grandTotal').toUpperCase()}
                                                <span style={{ opacity: 0.75, fontWeight: 600, marginLeft: '8px' }}>
                                                    ({t('balance')} {fmt(balance)} + {t('todayTotal') || "Today's Total"} {fmt(stats.todayTotal)})
                                                </span>
                                            </td>
                                            <td style={{...TD_S, textAlign: 'right', fontWeight: 900, fontSize: '18px', color: '#15803d'}}>
                                                {fmt(grandTotal)}
                                            </td>
                                            <td></td>
                                        </tr>
                                    );
                                })()}
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
        
        const getVendorLedgerData = (v) => {
            const vPurchases = purchases.filter(p => p.vendorId === v.id && p.date >= reportFilters.fromDate && p.date <= reportFilters.toDate);
            const vPayments = payments.filter(p => p.entityId === v.id && p.type === 'vendor' && p.date >= reportFilters.fromDate && p.date <= reportFilters.toDate);
            
            // Calculate Opening Balance for the period
            const futurePurchases = purchases.filter(p => p.vendorId === v.id && p.date >= reportFilters.fromDate);
            const futurePayments = payments.filter(p => p.entityId === v.id && p.type === 'vendor' && p.date >= reportFilters.fromDate);
            const futurePurAmt = futurePurchases.reduce((s, x) => s + (x.grandTotal || 0), 0);
            const futurePayAmt = futurePayments.reduce((s, x) => s + (x.amount || 0), 0);
            const openingBalance = (v.balance || 0) - futurePurAmt + futurePayAmt;

            const ledgerRows = [];
            vPurchases.forEach(p => {
                p.items.forEach((item, iIdx) => {
                    ledgerRows.push({ 
                        date: p.date, 
                        particulars: lang === 'ta' ? (item.flowerTypeTa || item.flowerType || '') : (item.flowerType || ''), 
                        weight: item.quantity || 0, 
                        rate: item.price || 0, 
                        total: item.total || 0, 
                        cashRec: 0, 
                        cashLess: 0 
                    });
                });
            });
            vPayments.forEach(p => ledgerRows.push({ date: p.date, particulars: t('cashPaid') || 'Vendor Payment', weight: 0, rate: 0, total: 0, cashRec: p.amount, cashLess: 0 }));
            ledgerRows.sort((a,b) => a.date.localeCompare(b.date));

            const totalP = vPurchases.reduce((s, x) => s + (x.grandTotal || 0), 0);
            const totalPaid = vPayments.reduce((s, x) => s + (x.amount || 0), 0);
            const summary = { sales: totalP, paid: totalPaid, less: 0 };

            const labels = {
                date: t('date'), particulars: t('particulars'), weight: t('weight'), rate: t('rate'), total: t('total'), 
                cashRec: t('cashPaid'), cashLess: t('adjustments') || 'Adjustments', openingBalLabel: t('openingBalance'), 
                statementTitle: (lang==='ta' ? `${v.nameTa || v.name} அறிக்கை` : `VENDOR STATEMENT - ${v.name}`), 
                customerNoLabel: t('vendorId') || 'Vendor ID', nameLabel: t('name'),
                totalSalesLabel: (lang === 'ta' ? 'மொத்த கொள்முதல் :' : 'Total Purchase :'),
                cashRecLabel: (lang === 'ta' ? 'செலுத்திய தொகை :' : 'Total Paid :'),
                cashLessLabel: (lang === 'ta' ? 'சரிகட்டுதல் :' : 'Adjustments :'),
                finalBalLabel: t('balance') + ' :', thankYou: '🌹 Poovanam 🌹', sNoLabel: t('sNo') || 'S.No',
                dateLabel: `${reportFilters.fromDate.split('-').reverse().join('-')} to ${reportFilters.toDate.split('-').reverse().join('-')}`
            };

            return { buyer: { ...v, displayId: `V${v.displayId}`, name: lang === 'ta' ? (v.nameTa || v.name) : v.name }, ledgerRows, summary, openingBalance, bizInfo, labels, lang };
        };

        const handlePrintVendorLedger = async (v) => {
            const { url } = await generateLedgerCanvas(getVendorLedgerData(v));
            const win = window.open('', '_blank');
            win.document.write(`<html><head><style>@media print{body{margin:0}}body{margin:0;display:flex;justify-content:center;align-items:flex-start;background:#fff}img{max-width:100%;height:auto}</style></head><body><img src="${url}"><script>window.onload=function(){window.print();}</script></body></html>`);
            win.document.close();
        };

        const handleWhatsAppVendorLedger = async (v) => {
            const { url, blob } = await generateLedgerCanvas(getVendorLedgerData(v));
            const file = new File([blob], `statement_${v.displayId}.png`, { type: 'image/png' });
            if (navigator.share) await navigator.share({ files: [file], title: 'Vendor Statement' });
            else {
                const win = window.open('', '_blank');
                win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;background:#f0f0f0;"><img src="${url}" style="max-width:100%;"></body></html>`);
                win.document.close();
            }
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
                                                    <button 
                                                        onClick={() => { setViewingVendor(v); setShowDetailModal(true); }} 
                                                        title="View History" 
                                                        style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                    >
                                                        <Scan size={14}/>
                                                    </button>
                                                    <button onClick={() => handleWhatsAppVendorLedger(v)} title="WhatsApp" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #dcfce7', background: '#fff', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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

    const renderDetailModal = () => {
        if (!viewingVendor) return null;
        const vPurchases = purchases.filter(p => p.vendorId === viewingVendor.id).map(p => ({...p, type: 'PURCHASE'}));
        const vPayments = payments.filter(p => p.entityId === viewingVendor.id && p.type === 'vendor').map(p => ({...p, type: 'PAYMENT'}));
        const ledger = [...vPurchases, ...vPayments].sort((a,b) => new Date(b.date) - new Date(a.date) || (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));

        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                <div style={{ background: '#fff', borderRadius: '24px', width: '900px', maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #fed7aa' }}>
                    <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#92400e' }}>{viewingVendor.name}</h2>
                            <p style={{ margin: 0, fontSize: '12px', color: '#92400e', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Transaction Ledger</p>
                        </div>
                        <button onClick={() => { setShowDetailModal(false); setViewingVendor(null); }} style={{ background: '#fff', border: '1.5px solid #fed7aa', padding: '8px', borderRadius: '12px', cursor: 'pointer', color: '#92400e' }}><X size={24}/></button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                    <th style={TH_S}>{t('date')}</th>
                                    <th style={TH_S}>{t('type') || 'Type'}</th>
                                    <th style={TH_S}>{t('particulars') || 'Details'}</th>
                                    <th style={{...TH_S, textAlign: 'right'}}>{t('amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc', background: item.type === 'PAYMENT' ? '#f0fdf4' : 'transparent' }}>
                                        <td style={TD_S}>{item.date.split('-').reverse().join('-')}</td>
                                        <td style={TD_S}>
                                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: item.type==='PAYMENT' ? '#dcfce7' : '#fffbeb', color: item.type==='PAYMENT' ? '#166534' : '#92400e' }}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td style={TD_S}>
                                            {item.type === 'PURCHASE' ? (
                                                <div style={{ fontWeight: 600 }}>{item.items.map(i => lang==='ta' ? (i.flowerTypeTa || i.flowerType) : i.flowerType).join(', ')}</div>
                                            ) : (
                                                <div style={{ color: '#16a34a', fontWeight: 600 }}>{item.note || 'Cash Payment'}</div>
                                            )}
                                        </td>
                                        <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: item.type === 'PAYMENT' ? '#16a34a' : '#1e293b'}}>
                                            {item.type === 'PAYMENT' ? '-' : ''}{fmt(item.grandTotal || item.amount)}
                                        </td>
                                    </tr>
                                ))}
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

            {showDetailModal && renderDetailModal()}

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
                                <label style={LABEL_S}>{'Old Balance'}</label>
                                <input type="number" value={vendorForm.balance} onChange={e => setVendorForm(p => ({...p, balance: e.target.value}))} style={INPUT_S} placeholder="0" />
                            </div>
                            <button type="submit" style={{ padding: '12px', background: '#d97706', color: '#fff', borderRadius: '12px', border: 'none', fontWeight: 800, marginTop: '10px', cursor: 'pointer' }}>
                                {t('save')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {/* Scan Modal */}
            {showScanModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ padding: '32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #fffbeb 0%, #fff 100%)' }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#92400e', margin: 0 }}>📊 {t('scanResult') || 'Scan Preview'}</h2>
                                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0', fontWeight: 600 }}>Review and edit data before adding to bill</p>
                            </div>
                            <button onClick={() => setShowScanModal(false)} style={{ background: '#fee2e2', border: 'none', color: '#ef4444', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20}/></button>
                        </div>
                        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH_S, textAlign: 'left' }}>{t('flowerName')}</th>
                                        <th style={TH_S}>{t('qty')}</th>
                                        <th style={TH_S}>{t('rate')}</th>
                                        <th style={{ ...TH_S, textAlign: 'right' }}>{t('total')}</th>
                                        <th style={TH_S}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scanResults.map((res, idx) => (
                                        <tr key={idx} style={{ background: '#f8fafc', borderRadius: '12px' }}>
                                            <td style={{ padding: '12px' }}>
                                                <input value={res.flowerType} onChange={e => handleUpdateScanResult(idx, 'flowerType', e.target.value)} style={{ ...INPUT_S, height: '36px', background: 'transparent', border: '1px solid #e1e8f0' }} />
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <input type="number" value={res.quantity} onChange={e => handleUpdateScanResult(idx, 'quantity', e.target.value)} style={{ ...INPUT_S, height: '36px', textAlign: 'center', background: 'transparent', border: '1px solid #e1e8f0' }} />
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <input type="number" value={res.price} onChange={e => handleUpdateScanResult(idx, 'price', e.target.value)} style={{ ...INPUT_S, height: '36px', textAlign: 'center', background: 'transparent', border: '1px solid #e1e8f0' }} />
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#d97706' }}>{fmt(res.total)}</td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <button onClick={() => setScanResults(prev => prev.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '32px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '16px', justifyContent: 'flex-end', background: '#fafafa' }}>
                            <button onClick={() => setShowScanModal(false)} style={{ padding: '12px 24px', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleConfirmScan} style={{ padding: '12px 32px', borderRadius: '14px', border: 'none', background: '#d97706', color: '#fff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 15px -3px rgba(217, 119, 6, 0.3)' }}>
                                <Save size={20}/> {t('confirmAndAdd') || 'Confirm & Add to Bill'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OutsideShop;
