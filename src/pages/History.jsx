import React, { useState, useEffect, useContext } from 'react';
import { Search, Calendar, Filter, RefreshCw, Trash2, ArrowLeftRight } from 'lucide-react';
import { subscribeToCollection, db } from '../utils/storage';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';

const History = () => {
    const { t, lang } = useContext(LangContext);
    const [historyList, setHistoryList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAction, setSelectedAction] = useState('All');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    useEffect(() => {
        // Subscribe to the history collection sorted by createdAt desc
        const unsubscribe = subscribeToCollection('history', (data) => {
            // Sort by createdAt / timestamp just in case
            const sorted = [...data].sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return timeB - timeA;
            });
            setHistoryList(sorted);
        }, true);

        return () => unsubscribe();
    }, []);

    // Filter logic
    const filteredHistory = historyList.filter(item => {
        // Search filter
        const matchSearch = 
            (item.entityIdentifier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.entityType || '').toLowerCase().includes(searchTerm.toLowerCase());

        // Action filter
        const matchAction = selectedAction === 'All' || item.actionType === selectedAction;

        // Category filter
        const matchCategory = selectedCategory === 'All' || item.entityType === selectedCategory;

        // Date filter
        const itemDate = item.date; // YYYY-MM-DD
        const matchFrom = !fromDate || itemDate >= fromDate;
        const matchTo = !toDate || itemDate <= toDate;

        return matchSearch && matchAction && matchCategory && matchFrom && matchTo;
    });

    const getActionBadgeStyle = (action) => {
        const base = {
            padding: '4px 10px',
            borderRadius: '100px',
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            display: 'inline-block',
            letterSpacing: '0.05em'
        };
        if (action === 'Add') {
            return { ...base, background: '#e6f4ea', color: '#137333', border: '1px solid #ceead6' };
        } else if (action === 'Edit') {
            return { ...base, background: '#e8f0fe', color: '#1a73e8', border: '1px solid #d2e3fc' };
        } else if (action === 'Delete') {
            return { ...base, background: '#fce8e6', color: '#c5221f', border: '1px solid #fad2cf' };
        }
        return { ...base, background: '#f1f3f4', color: '#5f6368' };
    };

    const getCategoryBadgeStyle = (cat) => {
        return {
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#475569',
            fontFamily: 'var(--font-sans)'
        };
    };

    // Styling constants matching SVM flower market UI
    const styles = {
        card: {
            background: '#white',
            borderRadius: '30px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
            border: '1px solid rgba(0,0,0,0.05)',
            padding: '30px',
            fontFamily: 'var(--font-sans)',
            backgroundColor: '#ffffff'
        },
        input: {
            padding: '10px 14px',
            borderRadius: '12px',
            border: '1.5px solid #e2e8f0',
            fontSize: '14px',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            width: '100%',
            transition: 'border-color 0.2s',
            background: '#fff'
        },
        label: {
            fontSize: '12px',
            fontWeight: 800,
            color: '#64748b',
            marginBottom: '6px',
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.02em'
        },
        th: {
            padding: '16px 20px',
            fontSize: '12px',
            fontWeight: 800,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '2px solid #e2e8f0',
            textAlign: 'left',
            background: '#f8fafc'
        },
        td: {
            padding: '16px 20px',
            fontSize: '14px',
            color: '#334155',
            borderBottom: '1px solid #f1f5f9',
            verticalAlign: 'middle'
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Header Description */}
            <div style={{ marginBottom: '24px' }}>
                <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
                    {lang === 'ta' ? 'மென்பொருளில் செய்யப்பட்ட அனைத்து சேர்த்தல், திருத்தம் மற்றும் நீக்குதல் செயல்களின் வரலாற்று பதிவு.' : 'Real-time history log of all creations, updates, and deletions within the application.'}
                </p>
            </div>

            <div style={styles.card}>
                {/* Filters Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginBottom: '28px',
                    paddingBottom: '20px',
                    borderBottom: '1px solid #f1f5f9'
                }}>
                    {/* Search */}
                    <div>
                        <span style={styles.label}>{lang === 'ta' ? 'தேடு' : 'Search'}</span>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder={lang === 'ta' ? 'வாடிக்கையாளர், பூ அல்லது குறிப்புகள்...' : 'Search log details...'}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ ...styles.input, paddingLeft: '36px' }}
                            />
                        </div>
                    </div>

                    {/* Action Filter */}
                    <div>
                        <span style={styles.label}>{lang === 'ta' ? 'செயல் வகை' : 'Action Type'}</span>
                        <select
                            value={selectedAction}
                            onChange={e => setSelectedAction(e.target.value)}
                            style={styles.input}
                        >
                            <option value="All">{lang === 'ta' ? 'அனைத்தும்' : 'All Actions'}</option>
                            <option value="Add">{lang === 'ta' ? 'சேர்த்தல் (Add)' : 'Additions'}</option>
                            <option value="Edit">{lang === 'ta' ? 'திருத்தம் (Edit)' : 'Edits'}</option>
                            <option value="Delete">{lang === 'ta' ? 'நீக்குதல் (Delete)' : 'Deletions'}</option>
                        </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <span style={styles.label}>{lang === 'ta' ? 'வகை' : 'Category'}</span>
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            style={styles.input}
                        >
                            <option value="All">{lang === 'ta' ? 'அனைத்து பிரிவுகள்' : 'All Categories'}</option>
                            <option value="Customer">{lang === 'ta' ? 'வாடிக்கையாளர்' : 'Customer'}</option>
                            <option value="Sale">{lang === 'ta' ? 'விற்பனை' : 'Sale'}</option>
                            <option value="Payment">{lang === 'ta' ? 'பணம் / கொடுப்பனவு' : 'Payment'}</option>
                            <option value="Farmer">{lang === 'ta' ? 'விவசாயி' : 'Farmer'}</option>
                            <option value="Product">{lang === 'ta' ? 'பூ வகை' : 'Product'}</option>
                            <option value="Vendor">{lang === 'ta' ? 'வெளிக்கடை வியாபாரி' : 'Vendor'}</option>
                            <option value="Outside Purchase">{lang === 'ta' ? 'வெளிப்புற கொள்முதல்' : 'Outside Purchase'}</option>
                        </select>
                    </div>

                    {/* Date From */}
                    <div>
                        <span style={styles.label}>{lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}</span>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={e => setFromDate(e.target.value)}
                            style={styles.input}
                        />
                    </div>

                    {/* Date To */}
                    <div>
                        <span style={styles.label}>{lang === 'ta' ? 'முடிவு தேதி' : 'To Date'}</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={e => setToDate(e.target.value)}
                            style={styles.input}
                        />
                    </div>
                </div>

                {/* Table Container */}
                <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={styles.th}>{lang === 'ta' ? 'தேதி & நேரம்' : 'Date & Time'}</th>
                                <th style={styles.th}>{lang === 'ta' ? 'செயல்' : 'Action'}</th>
                                <th style={styles.th}>{lang === 'ta' ? 'வகை' : 'Category'}</th>
                                <th style={styles.th}>{lang === 'ta' ? 'பெயர் / குறிப்பீடு' : 'Name / Target'}</th>
                                <th style={styles.th}>{lang === 'ta' ? 'விவரங்கள்' : 'Details'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.length > 0 ? (
                                filteredHistory.map((item, idx) => (
                                    <tr 
                                        key={item.id || idx}
                                        style={{ 
                                            backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#fff' : '#f8fafc'}
                                    >
                                        <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.date}</span>
                                            <span style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                                                {item.time || ''}
                                            </span>
                                        </td>
                                        <td style={styles.td}>
                                            <span style={getActionBadgeStyle(item.actionType)}>
                                                {item.actionType}
                                            </span>
                                        </td>
                                        <td style={styles.td}>
                                            <span style={getCategoryBadgeStyle(item.entityType)}>
                                                {item.entityType}
                                            </span>
                                        </td>
                                        <td style={{ ...styles.td, fontWeight: 700, color: '#1e293b' }}>
                                            {item.entityIdentifier || '—'}
                                        </td>
                                        <td style={{ ...styles.td, fontSize: '13px', lineHeight: '1.5', color: '#475569' }}>
                                            {item.details || '—'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" style={{ ...styles.td, textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: 600 }}>
                                        {lang === 'ta' ? 'பதிவுகள் எதுவும் இல்லை.' : 'No audit history logs found matching filters.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default History;
