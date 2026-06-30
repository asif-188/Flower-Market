import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import { subscribeToCollection, saveSalesmanPurchase, deleteSalesmanPurchase } from '../utils/storage';
import { LangContext } from '../components/Layout';
import { Plus, Trash2, Calendar, User, ShoppingBag, History, Clock } from 'lucide-react';

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
    padding: '12px 14px', textAlign: 'left',
    fontSize: '11px', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.08em',
};
const TD_S = {
    padding: '14px', fontSize: '14px', verticalAlign: 'middle'
};

const displayDate = (iso) => {
    if (!iso || typeof iso !== 'string') return '---';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const SalesmanPurchases = () => {
    const { lang } = useContext(LangContext);
    const [salesmen, setSalesmen] = useState([]);
    const [flowers, setFlowers] = useState([]);
    const [cashRecords, setCashRecords] = useState([]);
    const [purchaseRecords, setPurchaseRecords] = useState([]);
    
    // Draft bill fields
    const [formData, setFormData] = useState({
        date: new Date().toLocaleDateString('en-CA'),
        salesmanId: '',
        farmerName: '',
        billNumber: '',
        remarks: ''
    });
    
    // Draft item fields
    const [draftItem, setDraftItem] = useState({
        flowerType: '',
        flowerTypeTa: '',
        quantity: '',
        price: ''
    });
    
    const [billItems, setBillItems] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    const refFlower = useRef(null);
    const refQty = useRef(null);
    const refRate = useRef(null);

    useEffect(() => {
        const unsubSalesmen = subscribeToCollection('salesmen', (data) => {
            setSalesmen(data.filter(s => s.status === 'Active'));
        });
        const unsubProducts = subscribeToCollection('products', (data) => {
            setFlowers(data.length === 0
                ? [{ name: 'Rose', taName: 'ரோஜா' }, { name: 'Jasmine', taName: 'மல்லிகை' }, { name: 'Marigold', taName: 'சாமந்தி' }]
                : data);
        });
        const unsubCash = subscribeToCollection('salesman_cash', setCashRecords);
        const unsubPurchases = subscribeToCollection('salesman_purchases', setPurchaseRecords);

        return () => {
            unsubSalesmen();
            unsubProducts();
            unsubCash();
            unsubPurchases();
        };
    }, []);

    // Calculate dynamic cash metrics for selected salesman and date
    const cashStats = useMemo(() => {
        const { salesmanId, date } = formData;
        if (!salesmanId) return { openingCash: 0, totalPurchasesToday: 0, availableCash: 0 };

        const sortedDates = Array.from(new Set([
            ...cashRecords.filter(r => r.salesmanId === salesmanId).map(r => r.date).filter(Boolean),
            ...purchaseRecords.filter(p => p.salesmanId === salesmanId).map(p => p.date).filter(Boolean),
            date
        ])).sort();

        let carryForward = 0;
        let openingCashForSelectedDate = 0;
        let totalPurchasesToday = 0;

        for (const d of sortedDates) {
            if (d > date) break;

            const dayCashRecords = cashRecords.filter(r => r.salesmanId === salesmanId && r.date === d);
            const dayPurchaseRecords = purchaseRecords.filter(p => p.salesmanId === salesmanId && p.date === d);

            const issuedToday = dayCashRecords.reduce((sum, r) => sum + (r.openingCash || 0), 0);
            const purchasesToday = dayPurchaseRecords.reduce((sum, p) => sum + (p.grandTotal || 0), 0);

            const dayOpeningCash = carryForward + issuedToday;
            const dayEndingCash = dayOpeningCash - purchasesToday;

            if (d === date) {
                openingCashForSelectedDate = dayOpeningCash;
                totalPurchasesToday = purchasesToday;
            }

            carryForward = dayEndingCash;
        }

        return {
            openingCash: openingCashForSelectedDate,
            totalPurchasesToday,
            availableCash: openingCashForSelectedDate - totalPurchasesToday
        };
    }, [cashRecords, purchaseRecords, formData.salesmanId, formData.date]);

    // Handle adding line item to the draft bill
    const handleAddItem = () => {
        const { flowerType, quantity, price } = draftItem;
        if (!flowerType || !quantity || !price) return;
        
        const qty = parseFloat(quantity);
        const rate = parseFloat(price);
        const total = qty * rate;

        const selectedFlower = flowers.find(f => f.name === flowerType);
        const flowerNameLocalized = lang === 'ta' ? (selectedFlower?.taName || flowerType) : flowerType;

        const newItem = {
            id: Date.now(),
            flowerType,
            flowerTypeLocalized: flowerNameLocalized,
            quantity: qty,
            price: rate,
            total
        };

        setBillItems([...billItems, newItem]);
        setDraftItem({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
        setTimeout(() => refFlower.current?.focus(), 50);
    };

    const handleRemoveItem = (id) => {
        setBillItems(billItems.filter(item => item.id !== id));
    };

    const totalQty = billItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalCost = billItems.reduce((sum, item) => sum + item.total, 0);

    const handleSubmitBill = async () => {
        const { date, salesmanId, farmerName, billNumber, remarks } = formData;
        if (!salesmanId || !farmerName || billItems.length === 0 || isSaving) return;

        setIsSaving(true);
        try {
            const salesman = salesmen.find(s => s.id === salesmanId);
            const billData = {
                date,
                salesmanId,
                salesmanName: salesman?.name || 'Unknown',
                farmerName,
                billNumber: billNumber || '---',
                remarks: remarks || '',
                items: billItems.map(({ flowerType, quantity, price, total }) => ({
                    flowerType,
                    quantity,
                    price,
                    total
                })),
                grandTotal: totalCost
            };

            await saveSalesmanPurchase(billData);
            alert('✅ Purchase Bill Saved & Ledger Updated!');
            
            // Clear Form
            setFormData(prev => ({
                ...prev,
                farmerName: '',
                billNumber: '',
                remarks: ''
            }));
            setBillItems([]);
        } catch (error) {
            console.error("Error saving purchase bill:", error);
            alert("❌ Failed to save purchase bill.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBill = async (id) => {
        if (window.confirm("Are you sure you want to delete this purchase bill?")) {
            try {
                await deleteSalesmanPurchase(id);
            } catch (error) {
                console.error("Error deleting purchase bill:", error);
                alert("Failed to delete.");
            }
        }
    };

    const todayBills = useMemo(() => {
        return purchaseRecords.filter(p => p.date === formData.date && (!formData.salesmanId || p.salesmanId === formData.salesmanId));
    }, [purchaseRecords, formData.date, formData.salesmanId]);

    const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'var(--font-sans)' }}>
            
            {/* ── Top Dashboard Card ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                
                {/* Header Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.5fr', alignItems: 'center', gap: '20px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                    {/* Left: Date Selector & Salesman Select */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '130px' }}>
                            <label style={LABEL_S}>Date</label>
                            <input 
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                style={{ ...INPUT_S, padding: '6px 10px', fontSize: '13px' }}
                            />
                        </div>
                        <div style={{ width: '180px' }}>
                            <label style={LABEL_S}>Salesman</label>
                            <select
                                value={formData.salesmanId}
                                onChange={e => setFormData({ ...formData, salesmanId: e.target.value })}
                                style={{ ...INPUT_S, padding: '6px 10px', fontSize: '13px' }}
                            >
                                <option value="">Select Salesman</option>
                                {salesmen.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Center: Title */}
                    <h1 style={{ 
                        fontSize: '28px', 
                        fontWeight: 900, 
                        color: '#ea580c', 
                        fontFamily: 'var(--font-display)', 
                        letterSpacing: '0.05em', 
                        margin: 0, 
                        textAlign: 'center',
                        textTransform: 'uppercase' 
                    }}>
                        Purchases
                    </h1>

                    {/* Right: Modern Financial Box */}
                    <div style={{ 
                        justifySelf: 'end',
                        background: '#f8fafc', 
                        border: '1.5px solid #e2e8f0', 
                        borderRadius: '16px', 
                        padding: '12px 18px', 
                        minWidth: '240px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                    }}>
                        <div style={{ display: 'flex', justifySpaceBetween: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Opening Cash</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{fmt(cashStats.openingCash)}</span>
                        </div>
                        <div style={{ display: 'flex', justifySpaceBetween: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>Total Purchases (-)</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>{fmt(cashStats.totalPurchasesToday)}</span>
                        </div>
                        <div style={{ height: '1px', background: '#e2e8f0', margin: '2px 0' }} />
                        <div style={{ display: 'flex', justifySpaceBetween: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>Available Cash</span>
                            <span style={{ fontSize: '18px', fontWeight: 900, color: '#ea580c' }}>{fmt(cashStats.availableCash)}</span>
                        </div>
                    </div>
                </div>

                {/* Entry Input Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                    <div>
                        <label style={LABEL_S}>Farmer Name</label>
                        <input 
                            type="text" 
                            placeholder="Farmer Name"
                            value={formData.farmerName} 
                            onChange={e => setFormData({ ...formData, farmerName: e.target.value })} 
                            style={INPUT_S} 
                        />
                    </div>
                    <div>
                        <label style={LABEL_S}>Flower Type</label>
                        <select
                            ref={refFlower}
                            value={draftItem.flowerType}
                            onChange={e => {
                                const fl = flowers.find(f => f.name === e.target.value);
                                setDraftItem({ ...draftItem, flowerType: e.target.value, flowerTypeTa: fl?.taName || '' });
                            }}
                            style={INPUT_S}
                        >
                            <option value="">Select Flower</option>
                            {flowers.map(f => (
                                <option key={f.name} value={f.name}>{lang === 'ta' ? (f.taName || f.name) : f.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={LABEL_S}>Qty (KG)</label>
                        <input 
                            ref={refQty}
                            type="number" 
                            placeholder="0.00" 
                            value={draftItem.quantity} 
                            onChange={e => setDraftItem({ ...draftItem, quantity: e.target.value })} 
                            onKeyDown={e => e.key === 'Enter' && refRate.current?.focus()}
                            style={INPUT_S} 
                        />
                    </div>
                    <div>
                        <label style={LABEL_S}>Rate</label>
                        <input 
                            ref={refRate}
                            type="number" 
                            placeholder="0.00" 
                            value={draftItem.price} 
                            onChange={e => setDraftItem({ ...draftItem, price: e.target.value })} 
                            onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                            style={INPUT_S} 
                        />
                    </div>
                    <div>
                        <label style={LABEL_S}>Bill Number</label>
                        <input 
                            type="text" 
                            placeholder="Bill No" 
                            value={formData.billNumber} 
                            onChange={e => setFormData({ ...formData, billNumber: e.target.value })} 
                            style={INPUT_S} 
                        />
                    </div>
                    
                    <button
                        onClick={handleAddItem}
                        disabled={!formData.salesmanId || !draftItem.flowerType || !draftItem.quantity || !draftItem.price}
                        style={{
                            height: '42px', padding: '0 16px', borderRadius: '8px', border: 'none',
                            background: '#ea580c', color: '#fff', fontWeight: 700, fontSize: '13px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            transition: 'all 0.2s', opacity: (!formData.salesmanId || !draftItem.flowerType || !draftItem.quantity || !draftItem.price) ? 0.6 : 1
                        }}
                    >
                        <Plus size={16} /> Add Item
                    </button>
                </div>
            </div>

            {/* ── Bill Draft Items ── */}
            {billItems.length > 0 && (
                <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#334155', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bill Details (Draft)</h3>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                                <th style={TH_S}>Particulars</th>
                                <th style={{...TH_S, textAlign: 'center'}}>Weight (KG)</th>
                                <th style={{...TH_S, textAlign: 'center'}}>Rate</th>
                                <th style={{...TH_S, textAlign: 'right'}}>Total</th>
                                <th style={{...TH_S, textAlign: 'center', width: '80px'}}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {billItems.map(item => (
                                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{...TD_S, fontWeight: 700}}>{item.flowerTypeLocalized}</td>
                                    <td style={{...TD_S, textAlign: 'center'}}>{item.quantity.toFixed(3)}</td>
                                    <td style={{...TD_S, textAlign: 'center'}}>₹{item.price}</td>
                                    <td style={{...TD_S, textAlign: 'right', color: '#ea580c', fontWeight: 700}}>{fmt(item.total)}</td>
                                    <td style={{...TD_S, textAlign: 'center'}}>
                                        <button onClick={() => handleRemoveItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={LABEL_S}>Remarks / Notes</label>
                            <input 
                                type="text" 
                                placeholder="Add remarks..." 
                                value={formData.remarks} 
                                onChange={e => setFormData({ ...formData, remarks: e.target.value })} 
                                style={INPUT_S} 
                            />
                        </div>
                    </div>

                    {totalCost > cashStats.availableCash && (
                        <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#b91c1c', fontSize: '12px', fontWeight: 700, marginBottom: '16px' }}>
                            ⚠️ Warning: Grand total exceeds available cash balance!
                        </div>
                    )}

                    <div style={{ display: 'flex', justifySpaceBetween: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>
                            Total Qty: <span style={{ color: '#1e293b', fontWeight: 900 }}>{totalQty.toFixed(3)} KG</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#64748b' }}>Bill Value: <span style={{ fontSize: '20px', color: '#ea580c', fontWeight: 900 }}>{fmt(totalCost)}</span></span>
                            <button
                                onClick={handleSubmitBill}
                                disabled={isSaving || !formData.farmerName || totalCost > cashStats.availableCash}
                                style={{
                                    padding: '10px 24px', borderRadius: '8px', border: 'none',
                                    background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '14px',
                                    cursor: 'pointer', opacity: (isSaving || !formData.farmerName || totalCost > cashStats.availableCash) ? 0.6 : 1
                                }}
                            >
                                {isSaving ? 'Saving...' : 'Submit Bill'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Logged Bills Table ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc' }}>
                    <History size={18} color="#64748b" />
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today's Logged Bills</h3>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                                <th style={TH_S}>Date</th>
                                <th style={TH_S}>Salesman</th>
                                <th style={TH_S}>Farmer</th>
                                <th style={TH_S}>Bill Number</th>
                                <th style={TH_S}>Flower Details</th>
                                <th style={{...TH_S, textAlign: 'right'}}>Total Amount</th>
                                <th style={{...TH_S, textAlign: 'center', width: '100px'}}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {todayBills.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={S.emptyRow}>No bills logged on this date.</td>
                                </tr>
                            ) : (
                                todayBills.map((bill) => (
                                    <tr key={bill.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={TD_S}>{displayDate(bill.date)}</td>
                                        <td style={{...TD_S, fontWeight: 700}}>{bill.salesmanName}</td>
                                        <td style={TD_S}>{bill.farmerName}</td>
                                        <td style={TD_S}>{bill.billNumber}</td>
                                        <td style={TD_S}>
                                            {bill.items.map((i, idx) => {
                                                const fl = flowers.find(f => f.name === i.flowerType);
                                                return `${lang === 'ta' ? (fl?.taName || i.flowerType) : i.flowerType} (${i.quantity.toFixed(1)} KG)`;
                                            }).join(', ')}
                                        </td>
                                        <td style={{...TD_S, textAlign: 'right', fontWeight: 800, color: '#ea580c'}}>{fmt(bill.grandTotal)}</td>
                                        <td style={{...TD_S, textAlign: 'center'}}>
                                            <button 
                                                onClick={() => handleDeleteBill(bill.id)} 
                                                style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', color: '#ef4444' }}
                                                onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                                                onMouseLeave={e => e.currentTarget.style.background='#ffffff'}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
        </div>
    );
};

const S = {
    emptyRow: {
        padding: '60px 16px', textAlign: 'center',
        color: '#9ca3af', fontStyle: 'italic', fontSize: '14px',
    }
};

export default SalesmanPurchases;
