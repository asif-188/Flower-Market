import React, { useState, useEffect, useRef, useContext } from 'react';
import { Plus, Edit2, Trash2, Search, X, User, FileText, Upload } from 'lucide-react';
import { saveBuyer, subscribeToCollection } from '../utils/storage';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/storage';
import { LangContext } from '../components/Layout';

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
    titleRow: {
        display: 'flex', alignItems: 'center', gap: '10px',
    },
    title: {
        fontSize: '22px', fontWeight: 800, color: '#1e293b',
        letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0,
    },
    actions: {
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
    },
    btnTemplate: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '8px',
        border: '1.5px solid #d1d5db', background: '#f9fafb',
        color: '#374151', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    btnImport: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '8px',
        border: '1.5px solid #d1d5db', background: '#f9fafb',
        color: '#374151', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    btnAdd: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 18px', borderRadius: '8px',
        border: '1.5px solid #16a34a', background: '#ffffff',
        color: '#16a34a', fontSize: '13px', fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    searchWrap: {
        position: 'relative', marginBottom: '24px', maxWidth: '380px',
    },
    searchInput: {
        width: '100%', padding: '10px 16px 10px 40px',
        border: '1.5px solid #d1fae5', borderRadius: '100px',
        background: '#fff', outline: 'none', fontSize: '14px',
        color: '#374151', fontFamily: 'var(--font-sans)',
        transition: 'border-color 0.2s',
    },
    searchIcon: {
        position: 'absolute', left: '14px', top: '50%',
        transform: 'translateY(-50%)', color: '#9ca3af',
        pointerEvents: 'none',
    },
    table: {
        width: '100%', borderCollapse: 'collapse',
    },
    th: {
        padding: '10px 14px', textAlign: 'left',
        fontSize: '11px', fontWeight: 700, color: '#16a34a',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap',
        background: '#fff',
    },
    td: {
        padding: '13px 14px', fontSize: '14px',
        color: '#374151', borderBottom: '1px solid #f3f4f6',
        verticalAlign: 'middle',
    },
    idBadge: {
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 10px', borderRadius: '6px',
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        color: '#15803d', fontWeight: 700, fontSize: '12px',
    },
    emptyRow: {
        padding: '60px 16px', textAlign: 'center',
        color: '#9ca3af', fontStyle: 'italic', fontSize: '14px',
    },
    viewBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '5px 12px', borderRadius: '8px',
        border: '1px solid #e5e7eb', background: '#fff',
        color: '#6b7280', fontSize: '12px', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    editBtn: {
        width: '32px', height: '32px', borderRadius: '8px',
        border: 'none', background: '#eff6ff', color: '#3b82f6',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.18s',
    },
    deleteBtn: {
        width: '32px', height: '32px', borderRadius: '8px',
        border: 'none', background: '#fff1f2', color: '#f43f5e',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.18s',
    },
};

const Buyer = () => {
    const { t } = useContext(LangContext);
    const [buyers, setBuyers] = useState([]);
    const [sales, setSales] = useState([]);
    const [payments, setPayments] = useState([]);
    const [viewingBuyer, setViewingBuyer] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentBuyer, setCurrentBuyer] = useState({ id: '', name: '', contact: '', balance: 0 });
    const [isSaving, setIsSaving] = useState(false);
    const importRef = useRef(null);

    useEffect(() => {
        const u1 = subscribeToCollection('buyers', setBuyers);
        const u2 = subscribeToCollection('sales', setSales);
        const u3 = subscribeToCollection('payments', setPayments);
        return () => { u1(); u2(); u3(); };
    }, []);

    const toDateStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };

    const buyerTransactions = React.useMemo(() => {
        if (!viewingBuyer) return [];
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const startDate = toDateStr(oneMonthAgo);
        const res = [];
        sales.filter(s => s.buyerId === viewingBuyer.id).forEach(s => {
            const d = s.date || (s.timestamp?.toDate ? toDateStr(s.timestamp.toDate()) : null);
            if (d && d >= startDate) res.push({ date: d, type: 'SALE', amount: s.grandTotal || 0 });
        });
        payments.filter(p => p.entityId === viewingBuyer.id && p.type === 'buyer').forEach(p => {
            const d = p.timestamp
                ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10)
                    : toDateStr(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp)))
                : null;
            if (d && d >= startDate) res.push({ date: d, type: 'PAID', amount: p.amount || 0 });
        });
        return res.sort((a, b) => b.date.localeCompare(a.date));
    }, [viewingBuyer, sales, payments]);

    const handleOpenModal = (buyer = null) => {
        if (!buyer) {
            const nextId = buyers.length > 0 ? Math.max(...buyers.map(b => parseInt(b.displayId) || 0)) + 1 : 101;
            setCurrentBuyer({ id: '', name: '', contact: '', balance: 0, displayId: nextId });
        } else {
            setCurrentBuyer({ ...buyer });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (isSaving) return;
        setIsSaving(true);
        try {
            const buyerToSave = { ...currentBuyer, balance: parseFloat(currentBuyer.balance) || 0 };
            if (!buyerToSave.id) delete buyerToSave.id;
            await saveBuyer(buyerToSave);
            setIsModalOpen(false);
            setCurrentBuyer({ id: '', name: '', contact: '', balance: 0 });
        } catch (err) {
            alert('❌ Failed to save: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this customer?')) return;
        try { await deleteDoc(doc(db, 'buyers', id)); }
        catch (err) { alert('❌ Delete failed: ' + err.message); }
    };

    const handleDownloadTemplate = () => {
        const csv = [['ID','Name','Contact','Balance'],['101','Sample Customer','9876543210','0'],['102','Another Customer','9123456780','500']]
            .map(r => r.join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'customer_template.csv';
        a.click();
    };

    const handleImportCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const lines = ev.target.result.trim().split('\n');
            const header = lines[0].split(',').map(h => h.trim().toLowerCase());
            let imported = 0, failed = 0;
            let currentMax = buyers.length > 0 ? Math.max(...buyers.map(b => parseInt(b.displayId) || 0)) : 100;
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim());
                if (cols.length < 2) continue;
                const row = {};
                header.forEach((h, idx) => { row[h] = cols[idx] || ''; });
                try {
                    const rowId = parseInt(row.id) || (currentMax + 1);
                    if (rowId > currentMax) currentMax = rowId;
                    await saveBuyer({ name: row.name || '', contact: row.contact || '', balance: parseFloat(row.balance) || 0, displayId: rowId });
                    imported++;
                } catch { failed++; }
            }
            alert(`✅ Import complete: ${imported} added${failed ? `, ${failed} failed` : ''}`);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const filteredBuyers = buyers.filter(b => {
        const s = searchTerm.toLowerCase().trim();
        if (!s) return true;
        return (b.name || '').toLowerCase().includes(s) || (b.contact || '').includes(s) || String(b.displayId || '').includes(s);
    });

    const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

    return (
        <div style={S.page}>
            {/* ── Header ── */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <User size={22} color="#334155" />
                    <h2 style={S.title}>{t('buyer')}</h2>
                </div>
                <div style={S.actions}>
                    <button style={S.btnTemplate} onClick={handleDownloadTemplate}
                        onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                    >
                        <FileText size={14}/> {t('template')}
                    </button>
                    <button style={S.btnImport} onClick={() => importRef.current?.click()}
                        onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                    >
                        <Upload size={14} color="#3b82f6"/> {t('import')}
                        <input type="file" ref={importRef} hidden accept=".csv" onChange={handleImportCSV} />
                    </button>
                    <button style={S.btnAdd} onClick={() => handleOpenModal()}
                        onMouseEnter={e => { e.currentTarget.style.background='#16a34a'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#16a34a'; }}
                    >
                        <Plus size={14}/> {t('addCustomer')}
                    </button>
                </div>
            </div>

            {/* ── Search ── */}
            <div style={S.searchWrap}>
                <Search size={15} style={S.searchIcon} />
                <input
                    type="text"
                    placeholder={t('search')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={S.searchInput}
                    onFocus={e => e.target.style.borderColor='#16a34a'}
                    onBlur={e => e.target.style.borderColor='#d1fae5'}
                />
            </div>

            {/* ── Table ── */}
            <div style={{overflowX:'auto'}}>
                <table style={S.table}>
                    <thead>
                        <tr>
                            <th style={S.th}>{t('id')}</th>
                            <th style={S.th}>{t('name')}</th>
                            <th style={S.th}>{t('contact')}</th>
                            <th style={{...S.th, textAlign:'right'}}>{t('amountDue')}</th>
                            <th style={{...S.th, textAlign:'center'}}>{t('ledger')}</th>
                            <th style={{...S.th, textAlign:'center'}}>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBuyers.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={S.emptyRow}>{t('noRecords')}</td>
                            </tr>
                        ) : (
                            filteredBuyers.map((buyer, idx) => (
                                <tr key={buyer.id}
                                    style={{background: idx % 2 === 0 ? '#fff' : '#fafafa'}}
                                    onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'}
                                    onMouseLeave={e => e.currentTarget.style.background=idx % 2 === 0 ? '#fff' : '#fafafa'}
                                >
                                    <td style={S.td}>
                                        <span style={S.idBadge}>#{buyer.displayId}</span>
                                    </td>
                                    <td style={{...S.td, fontWeight:700, color:'#1e293b'}}>{buyer.name}</td>
                                    <td style={{...S.td, color:'#6b7280'}}>{buyer.contact || '—'}</td>
                                    <td style={{...S.td, textAlign:'right', fontWeight:700, color: buyer.balance > 0 ? '#f43f5e' : '#16a34a'}}>
                                        {fmt(buyer.balance)}
                                    </td>
                                    <td style={{...S.td, textAlign:'center'}}>
                                        <button style={S.viewBtn} onClick={() => setViewingBuyer(buyer)}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor='#16a34a'; e.currentTarget.style.color='#16a34a'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.color='#6b7280'; }}
                                        >
                                            <FileText size={13}/> {t('view')}
                                        </button>
                                    </td>
                                    <td style={{...S.td, textAlign:'center'}}>
                                        <div style={{display:'flex', gap:'6px', justifyContent:'center'}}>
                                            <button style={S.editBtn} onClick={() => handleOpenModal(buyer)}
                                                onMouseEnter={e => { e.currentTarget.style.background='#3b82f6'; e.currentTarget.style.color='#fff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background='#eff6ff'; e.currentTarget.style.color='#3b82f6'; }}
                                            ><Edit2 size={13}/></button>
                                            <button style={S.deleteBtn} onClick={() => handleDelete(buyer.id)}
                                                onMouseEnter={e => { e.currentTarget.style.background='#f43f5e'; e.currentTarget.style.color='#fff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background='#fff1f2'; e.currentTarget.style.color='#f43f5e'; }}
                                            ><Trash2 size={13}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Add/Edit Modal ── */}
            {isModalOpen && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:'16px'}}>
                    <div style={{background:'#fff',borderRadius:'16px',width:'100%',maxWidth:'460px',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden',fontFamily:'var(--font-sans)'}}>
                        <div style={{padding:'22px 24px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                                <div style={{background:'#f0fdf4',borderRadius:'10px',padding:'6px'}}>
                                    <User size={20} color="#16a34a"/>
                                </div>
                                <span style={{fontSize:'16px',fontWeight:800,color:'#1e293b',fontFamily:'var(--font-display)'}}>
                                    {currentBuyer.id ? 'Edit Customer' : t('addCustomer')}
                                </span>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',display:'flex'}}>
                                <X size={20}/>
                            </button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px'}}>
                                {[
                                    {label:t('id'), key:'displayId', type:'text', disabled:true},
                                    {label:`${t('name')} *`, key:'name', type:'text', required:true, autoFocus:true},
                                    {label:`${t('contact')} *`, key:'contact', type:'text', required:true},
                                    {label:t('initialDues'), key:'balance', type:'number'},
                                ].map(f => (
                                    <div key={f.key}>
                                        <label style={{display:'block',marginBottom:'5px',fontSize:'12px',fontWeight:600,color:'#64748b'}}>{f.label}</label>
                                        <input
                                            type={f.type}
                                            disabled={f.disabled}
                                            required={f.required}
                                            autoFocus={f.autoFocus}
                                            value={currentBuyer[f.key] ?? ''}
                                            onChange={e => setCurrentBuyer({...currentBuyer,[f.key]:e.target.value})}
                                            min={f.type==='number' ? '0' : undefined}
                                            style={{
                                                width:'100%',padding:'10px 12px',borderRadius:'10px',
                                                border:'1.5px solid #e2e8f0',background:f.disabled?'#f8fafc':'#fff',
                                                fontSize:'14px',fontWeight:600,color:'#1e293b',
                                                outline:'none',fontFamily:'var(--font-sans)',
                                            }}
                                            onFocus={e => !f.disabled && (e.target.style.borderColor='#16a34a')}
                                            onBlur={e => e.target.style.borderColor='#e2e8f0'}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div style={{padding:'16px 24px',borderTop:'1px solid #f1f5f9',background:'#fafafa',display:'flex',justifyContent:'flex-end',gap:'10px'}}>
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    style={{padding:'9px 20px',borderRadius:'9px',border:'1.5px solid #e2e8f0',background:'#fff',color:'#64748b',fontWeight:600,fontSize:'13px',cursor:'pointer',fontFamily:'var(--font-sans)'}}>
                                    {t('cancel')}
                                </button>
                                <button type="submit" disabled={isSaving}
                                    style={{padding:'9px 22px',borderRadius:'9px',border:'1.5px solid #16a34a',background:'#fff',color:'#16a34a',fontWeight:700,fontSize:'13px',cursor:isSaving?'not-allowed':'pointer',opacity:isSaving?0.6:1,fontFamily:'var(--font-sans)'}}>
                                    {isSaving ? 'Saving...' : (currentBuyer.id ? t('update') : t('register'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Ledger Modal ── */}
            {viewingBuyer && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:'16px'}}>
                    <div style={{background:'#fff',borderRadius:'16px',width:'100%',maxWidth:'560px',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden',fontFamily:'var(--font-sans)'}}>
                        <div style={{padding:'20px 24px 16px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                            <div>
                                <div style={{fontSize:'16px',fontWeight:800,color:'#1e293b',fontFamily:'var(--font-display)'}}>{viewingBuyer.name}</div>
                                <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'2px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em'}}>Last 30 Days • #{viewingBuyer.displayId}</div>
                            </div>
                            <button onClick={() => setViewingBuyer(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',display:'flex'}}>
                                <X size={20}/>
                            </button>
                        </div>
                        <div style={{padding:'16px 24px',maxHeight:'55vh',overflowY:'auto'}}>
                            <div style={{fontSize:'11px',fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'12px'}}>Transaction History</div>
                            {buyerTransactions.length === 0 ? (
                                <div style={{padding:'48px 16px',textAlign:'center',color:'#9ca3af',fontStyle:'italic'}}>No transactions in the last 30 days.</div>
                            ) : (
                                <div style={{border:'1px solid #f1f5f9',borderRadius:'10px',overflow:'hidden'}}>
                                    {buyerTransactions.map((tx, i) => (
                                        <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:i<buyerTransactions.length-1?'1px solid #f8fafc':'none',background:i%2===0?'#fff':'#fafafa'}}>
                                            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                                                <div style={{width:'44px',height:'36px',borderRadius:'8px',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'#64748b'}}>
                                                    {tx.date.split('-').slice(1).reverse().join('/')}
                                                </div>
                                                <span style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:tx.type==='SALE'?'#3b82f6':'#16a34a'}}>{tx.type}</span>
                                            </div>
                                            <span style={{fontWeight:700,fontSize:'14px',color:tx.type==='SALE'?'#1e293b':'#16a34a'}}>
                                                {tx.type==='PAID'?'-':''}{fmt(tx.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{padding:'14px 24px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'flex-end'}}>
                            <button onClick={() => setViewingBuyer(null)}
                                style={{padding:'8px 20px',borderRadius:'9px',background:'#1e293b',color:'#fff',border:'none',fontWeight:700,fontSize:'12px',cursor:'pointer',letterSpacing:'0.04em',textTransform:'uppercase',fontFamily:'var(--font-sans)'}}>
                                {t('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Buyer;
