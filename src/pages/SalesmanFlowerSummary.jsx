import React, { useState, useEffect, useMemo, useContext } from 'react';
import { subscribeToCollection } from '../utils/storage';
import { LangContext } from '../components/Layout';
import { Flower, ArrowLeftRight } from 'lucide-react';

const S = {
    page: {
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        padding: '28px 32px',
        minHeight: '70vh',
        fontFamily: 'var(--font-sans)',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', gap: '16px', flexWrap: 'wrap',
    },
    titleRow: { display: 'flex', alignItems: 'center', gap: '10px' },
    titleCol: { display: 'flex', flexDirection: 'column' },
    title: {
        fontSize: '22px', fontWeight: 800, color: '#1e293b',
        letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0,
    },
    subtitle: {
        fontSize: '11px', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px',
    },
    toolbar: {
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '20px', background: '#fdf2f8', border: '1.5px solid #fbcfe8',
        borderRadius: '12px', marginBottom: '24px', flexWrap: 'wrap',
    },
    filterGroup: {
        display: 'flex', flexDirection: 'column', gap: '4px',
    },
    label: {
        fontSize: '10px', fontWeight: 700, color: '#db2777',
        textTransform: 'uppercase', letterSpacing: '0.08em',
    },
    input: {
        padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #fbcfe8',
        fontSize: '13px', fontWeight: 600, color: '#374151', outline: 'none',
        background: '#fff',
    },
    splitGrid: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px',
    },
    subCard: {
        background: '#fff', borderRadius: '14px', border: '1.5px solid #f3f4f6',
        padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
    },
    subCardHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: '12px', borderBottom: '1.5px solid #f3f4f6', marginBottom: '16px',
    },
    subCardTitle: {
        fontSize: '16px', fontWeight: 800, margin: 0, textTransform: 'uppercase',
    },
    table: {
        width: '100%', borderCollapse: 'collapse',
    },
    th: {
        padding: '8px 12px', textAlign: 'left',
        fontSize: '11px', fontWeight: 700, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap',
    },
    td: {
        padding: '10px 12px', fontSize: '13px',
        color: '#374151', borderBottom: '1px solid #f3f4f6',
        verticalAlign: 'middle',
    },
    totalRow: {
        background: '#f8fafc', padding: '12px 16px', borderRadius: '10px',
        border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between',
        marginTop: '16px',
    },
    totalText: {
        fontSize: '12px', fontWeight: 800, color: '#475569',
    },
    compareCard: {
        background: 'linear-gradient(135deg, #fff7ed, #ecfdf5)',
        border: '1.5px solid #e2e8f0', borderRadius: '14px',
        padding: '20px', display: 'flex', justifyContent: 'space-around',
        alignItems: 'center', flexWrap: 'wrap', gap: '16px', textAlign: 'center',
    },
    compareItem: {
        display: 'flex', flexDirection: 'column', gap: '2px',
    },
    compareLabel: {
        fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase',
    },
    compareValue: {
        fontSize: '16px', fontWeight: 900, color: '#1e293b',
    },
    emptyRow: {
        padding: '80px 16px', textAlign: 'center',
        color: '#9ca3af', fontStyle: 'italic', fontSize: '14px',
    }
};

const SalesmanFlowerSummary = () => {
    const { lang } = useContext(LangContext);
    const [flowers, setFlowers] = useState([]);
    const [intakes, setIntakes] = useState([]);
    const [sales, setSales] = useState([]);
    const [selectedFlower, setSelectedFlower] = useState('');

    useEffect(() => {
        const unsubProducts = subscribeToCollection('products', (data) => {
            setFlowers(data.length === 0
                ? [{ name: 'Rose', taName: 'ரோஜா' }, { name: 'Jasmine', taName: 'மல்லிகை' }, { name: 'Marigold', taName: 'சாமந்தி' }]
                : data);
        });
        const unsubIntakes = subscribeToCollection('intakes', setIntakes);
        const unsubSales = subscribeToCollection('sales', setSales);

        return () => {
            unsubProducts();
            unsubIntakes();
            unsubSales();
        };
    }, []);

    // Left Panel: Purchase Summary grouped by Farmer Name
    const purchaseSummary = useMemo(() => {
        if (!selectedFlower) return [];
        const groups = {};
        intakes.forEach(intake => {
            const matchingItems = (intake.items || []).filter(item => 
                item.flowerType?.trim().toLowerCase() === selectedFlower.trim().toLowerCase()
            );
            if (matchingItems.length > 0) {
                const farmer = intake.farmerName || 'Unknown Farmer';
                if (!groups[farmer]) groups[farmer] = { name: farmer, quantity: 0, amount: 0 };
                matchingItems.forEach(item => {
                    groups[farmer].quantity += Number(item.quantity) || 0;
                    groups[farmer].amount += Number(item.total) || (Number(item.quantity) * Number(item.price)) || 0;
                });
            }
        });
        return Object.values(groups).sort((a, b) => b.quantity - a.quantity);
    }, [intakes, selectedFlower]);

    // Right Panel: Sales Summary grouped by Buyer Name
    const salesSummary = useMemo(() => {
        if (!selectedFlower) return [];
        const groups = {};
        sales.forEach(sale => {
            const matchingItems = (sale.items || []).filter(item => 
                item.flowerType?.trim().toLowerCase() === selectedFlower.trim().toLowerCase()
            );
            if (matchingItems.length > 0) {
                const buyer = sale.buyerName || 'Unknown Buyer';
                if (!groups[buyer]) groups[buyer] = { name: buyer, quantity: 0, amount: 0 };
                matchingItems.forEach(item => {
                    groups[buyer].quantity += Number(item.quantity) || 0;
                    groups[buyer].amount += Number(item.total) || (Number(item.quantity) * Number(item.price)) || 0;
                });
            }
        });
        return Object.values(groups).sort((a, b) => b.quantity - a.quantity);
    }, [sales, selectedFlower]);

    const totalPurchaseQty = purchaseSummary.reduce((sum, r) => sum + r.quantity, 0);
    const totalPurchaseAmt = purchaseSummary.reduce((sum, r) => sum + r.amount, 0);

    const totalSalesQty = salesSummary.reduce((sum, r) => sum + r.quantity, 0);
    const totalSalesAmt = salesSummary.reduce((sum, r) => sum + r.amount, 0);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div style={S.page}>
            {/* Header */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <Flower size={22} color="#db2777" />
                    <div style={S.titleCol}>
                        <h2 style={S.title}>Flower Summary</h2>
                        <span style={S.subtitle}>Compare Farmer Intake vs. Customer Sales</span>
                    </div>
                </div>
            </div>

            {/* Selector Toolbar */}
            <div style={S.toolbar}>
                <div style={S.filterGroup}>
                    <label style={S.label}>Choose Flower Variety</label>
                    <select
                        style={{...S.input, minWidth: '220px'}}
                        value={selectedFlower}
                        onChange={(e) => setSelectedFlower(e.target.value)}
                    >
                        <option value="">Select Flower...</option>
                        {flowers.map(f => (
                            <option key={f.name} value={f.name}>{lang === 'ta' ? (f.taName || f.name) : f.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Split Panels */}
            {selectedFlower ? (
                <>
                    <div style={S.splitGrid}>
                        {/* Left: Purchase */}
                        <div style={S.subCard}>
                            <div style={S.subCardHeader}>
                                <h4 style={{...S.subCardTitle, color: '#ea580c'}}>📥 Purchase (Farmer)</h4>
                            </div>
                            <div style={{ minHeight: '260px', overflowX: 'auto' }}>
                                <table style={S.table}>
                                    <thead>
                                        <tr style={{ borderBottom: '1.5px solid #f3f4f6' }}>
                                            <th style={S.th}>S.No</th>
                                            <th style={S.th}>Farmer Name</th>
                                            <th style={{...S.th, textAlign: 'right'}}>Weight (KG)</th>
                                            <th style={{...S.th, textAlign: 'right'}}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {purchaseSummary.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={S.emptyRow}>No purchases logged.</td>
                                            </tr>
                                        ) : (
                                            purchaseSummary.map((row, idx) => (
                                                <tr key={row.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={S.td}>#{(idx + 1).toString().padStart(2, '0')}</td>
                                                    <td style={{...S.td, fontWeight: 700}}>{row.name}</td>
                                                    <td style={{...S.td, textAlign: 'right'}}>{row.quantity.toFixed(3)}</td>
                                                    <td style={{...S.td, textAlign: 'right', fontWeight: 700, color: '#ea580c'}}>{formatCurrency(row.amount)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div style={S.totalRow}>
                                <span style={S.totalText}>Total: {totalPurchaseQty.toFixed(3)} KG</span>
                                <span style={{...S.totalText, color: '#ea580c', fontSize: '14px'}}>Val: {formatCurrency(totalPurchaseAmt)}</span>
                            </div>
                        </div>

                        {/* Right: Sales */}
                        <div style={S.subCard}>
                            <div style={S.subCardHeader}>
                                <h4 style={{...S.subCardTitle, color: '#16a34a'}}>📤 Sales (Buyer)</h4>
                            </div>
                            <div style={{ minHeight: '260px', overflowX: 'auto' }}>
                                <table style={S.table}>
                                    <thead>
                                        <tr style={{ borderBottom: '1.5px solid #f3f4f6' }}>
                                            <th style={S.th}>S.No</th>
                                            <th style={S.th}>Buyer Name</th>
                                            <th style={{...S.th, textAlign: 'right'}}>Weight (KG)</th>
                                            <th style={{...S.th, textAlign: 'right'}}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {salesSummary.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={S.emptyRow}>No sales logged.</td>
                                            </tr>
                                        ) : (
                                            salesSummary.map((row, idx) => (
                                                <tr key={row.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={S.td}>#{(idx + 1).toString().padStart(2, '0')}</td>
                                                    <td style={{...S.td, fontWeight: 700}}>{row.name}</td>
                                                    <td style={{...S.td, textAlign: 'right'}}>{row.quantity.toFixed(3)}</td>
                                                    <td style={{...S.td, textAlign: 'right', fontWeight: 700, color: '#16a34a'}}>{formatCurrency(row.amount)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div style={S.totalRow}>
                                <span style={S.totalText}>Total: {totalSalesQty.toFixed(3)} KG</span>
                                <span style={{...S.totalText, color: '#16a34a', fontSize: '14px'}}>Val: {formatCurrency(totalSalesAmt)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Comparison Card */}
                    <div style={S.compareCard}>
                        <div style={S.compareItem}>
                            <span style={S.compareLabel}>Flower Variety</span>
                            <span style={{...S.compareValue, color: '#db2777'}}>{selectedFlower}</span>
                        </div>
                        <div style={{ width: '1px', height: '24px', background: '#ccc' }}></div>
                        <div style={S.compareItem}>
                            <span style={S.compareLabel}>Purchase Weight vs. Sold Weight</span>
                            <span style={S.compareValue}>{totalPurchaseQty.toFixed(2)} KG vs. {totalSalesQty.toFixed(2)} KG</span>
                        </div>
                        <div style={{ width: '1px', height: '24px', background: '#ccc' }}></div>
                        <div style={S.compareItem}>
                            <span style={S.compareLabel}>Purchase Value vs. Sold Value</span>
                            <span style={S.compareValue}>{formatCurrency(totalPurchaseAmt)} vs. {formatCurrency(totalSalesAmt)}</span>
                        </div>
                    </div>
                </>
            ) : (
                <div style={S.emptyRow}>
                    Select a flower variety from the dropdown above to load the comparison panels.
                </div>
            )}
        </div>
    );
};

export default SalesmanFlowerSummary;
