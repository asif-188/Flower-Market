import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, Lock, Unlock, ShieldAlert } from 'lucide-react';
import { useTenant } from '../utils/TenantContext';
import { db, COLLECTIONS } from '../utils/storage';
import { doc, setDoc } from 'firebase/firestore';

const DEFAULTS = {
    motto:   'SRI RAMA JAYAM',
    name:    'S.V.M',
    type:    'Sri Valli Flower Merchant',
    address: 'B-7, Flower Market, Tindivanam.',
    phone1:  '',
    phone2:  '',
};

const S = {
    page: {
        background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)', padding: '28px 32px',
        fontFamily: 'var(--font-sans)', maxWidth: '560px',
    },
    label: { display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '5px' },
    input: {
        width: '100%', padding: '10px 14px', borderRadius: '10px',
        border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px',
        fontWeight: 500, color: '#1e293b', outline: 'none',
        fontFamily: 'var(--font-sans)', boxSizing: 'border-box', transition: 'border-color 0.15s',
    },
};

const Settings = () => {
    const { tenantId, tenantData, setTenantData, loading, ownerModeActive, enableOwnerMode, disableOwnerMode } = useTenant();
    const [form, setForm]       = useState(tenantData || DEFAULTS);
    const [saving, setSaving]   = useState(false);
    const [saved, setSaved]     = useState(false);
    const [toasts, setToasts]   = useState([]);
    const [pin, setPin]         = useState('');

    const addToast = (message, type = 'success') => {
        const id = Date.now() + Math.random().toString();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const handleUnlockClick = () => {
        const success = enableOwnerMode(pin);
        if (success) {
            addToast('Owner Mode activated! Edit/Delete features unlocked.', 'success');
            setPin('');
        } else {
            addToast('Incorrect PIN. Access denied.', 'error');
        }
    };

    const handleLock = () => {
        disableOwnerMode();
        addToast('Owner Mode deactivated. Edit/Delete features locked.', 'success');
    };

    useEffect(() => {
        if (tenantData) {
            setForm(tenantData);
        }
    }, [tenantData]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!tenantId) return;
        setSaving(true);
        try {
            await setDoc(doc(db, COLLECTIONS.TENANTS, tenantId), form, { merge: true });
            setTenantData(form);
            setSaved(true);
            addToast('Settings saved successfully!', 'success');
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            addToast('❌ Save failed: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const field = (key, label, placeholder) => (
        <div style={{ marginBottom: '16px' }}>
            <label style={S.label}>{label}</label>
            <input
                value={form[key] || ''}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                style={S.input}
                onFocus={e => e.target.style.borderColor = '#16a34a'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
        </div>
    );

    if (loading) return (
        <div style={{ ...S.page, textAlign: 'center', padding: '60px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            <p style={{ marginTop: '12px', color: '#94a3b8', fontSize: '13px' }}>Loading settings…</p>
        </div>
    );

    return (
        <div style={{ position: 'relative' }}>
            {/* Toasts */}
            <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        style={{
                            padding: '12px 20px', borderRadius: '10px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            color: '#fff', fontWeight: 'bold', fontSize: '13px',
                            background: t.type === 'error' ? '#ef4444' : '#10b981',
                            fontFamily: 'var(--font-sans)',
                        }}
                    >
                        {t.message}
                    </div>
                ))}
            </div>

            <div style={S.page}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <span style={{ fontSize: '22px' }}>🏪</span>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', margin: 0, fontFamily: 'var(--font-display)' }}>
                        Business Settings
                    </h2>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        This info appears on WhatsApp receipts
                    </p>
                </div>
            </div>

            {/* Preview box — letterhead style */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px', textAlign: 'center', fontFamily: 'serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                    <span>{form.phone1 ? `CELL : ${form.phone1}` : ''}</span>
                    <span style={{ fontStyle: 'italic' }}>{form.motto}</span>
                    <span>{form.phone2 ? `CELL : ${form.phone2}` : ''}</span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#111827', letterSpacing: '1px' }}>{form.name || 'Shop Name'}</div>
                <div style={{ fontSize: '12px', color: '#374151', marginTop: '2px' }}>{form.type}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{form.address}</div>
            </div>

            <form onSubmit={handleSave}>
                {field('motto',   'Blessing / Motto (top center)', 'e.g. SRI RAMA JAYAM')}
                {field('name',    'Shop Name (large bold)',         'e.g. S.V.M')}
                {field('type',    'Business Type',                  'e.g. Sri Valli Flower Merchant')}
                {field('address', 'Address',                        'e.g. B-7, Flower Market, Tindivanam.')}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                        <label style={S.label}>Phone 1 (left)</label>
                        <input
                            value={form.phone1 || ''}
                            onChange={e => setForm(p => ({ ...p, phone1: e.target.value }))}
                            placeholder="9952535057"
                            style={S.input}
                            onFocus={e => e.target.style.borderColor = '#16a34a'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>
                    <div>
                        <label style={S.label}>Phone 2 (right)</label>
                        <input
                            value={form.phone2 || ''}
                            onChange={e => setForm(p => ({ ...p, phone2: e.target.value }))}
                            placeholder="9443247771"
                            style={S.input}
                            onFocus={e => e.target.style.borderColor = '#16a34a'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>
                </div>

                {/* Farmer Commission Settings */}
                {(tenantId === 'kasivetrivel' || tenantId === 'kasi.vetrivel') && (
                    <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '20px', marginTop: '24px', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f766e', margin: '0 0 4px 0', fontFamily: 'var(--font-display)' }}>
                            🌾 Farmer Commission Settings
                        </h3>
                        <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#94a3b8' }}>
                            Configure default commission rules applied during Bill Closing
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label style={S.label}>Shop Pays Farmer %</label>
                                <input
                                    type="number"
                                    value={form.farmerCommShopPays !== undefined ? form.farmerCommShopPays : '10'}
                                    onChange={e => setForm(p => ({ ...p, farmerCommShopPays: e.target.value }))}
                                    placeholder="10"
                                    style={S.input}
                                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={S.label}>Farmer Pays Shop %</label>
                                <input
                                    type="number"
                                    value={form.farmerCommFarmerPays !== undefined ? form.farmerCommFarmerPays : '15'}
                                    onChange={e => setForm(p => ({ ...p, farmerCommFarmerPays: e.target.value }))}
                                    placeholder="15"
                                    style={S.input}
                                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                            <div>
                                <label style={S.label}>Threshold %</label>
                                <input
                                    type="number"
                                    value={form.farmerCommThreshold !== undefined ? form.farmerCommThreshold : '70'}
                                    onChange={e => setForm(p => ({ ...p, farmerCommThreshold: e.target.value }))}
                                    placeholder="70"
                                    style={S.input}
                                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={S.label}>% if &gt;= Threshold</label>
                                <input
                                    type="number"
                                    value={form.farmerCommAboveThreshold !== undefined ? form.farmerCommAboveThreshold : '10'}
                                    onChange={e => setForm(p => ({ ...p, farmerCommAboveThreshold: e.target.value }))}
                                    placeholder="10"
                                    style={S.input}
                                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={S.label}>% if &lt; Threshold</label>
                                <input
                                    type="number"
                                    value={form.farmerCommBelowThreshold !== undefined ? form.farmerCommBelowThreshold : '15'}
                                    onChange={e => setForm(p => ({ ...p, farmerCommBelowThreshold: e.target.value }))}
                                    placeholder="15"
                                    style={S.input}
                                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {(tenantId === 'kasivetrivel' || tenantId === 'kasi.vetrivel') && (
                    <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '20px', marginTop: '24px', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#b91c1c', margin: '0 0 4px 0', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShieldAlert size={18} /> Owner Mode Settings
                        </h3>
                        <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#94a3b8' }}>
                            SVM Flowers restricted Edit/Delete security configuration
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
                            <input 
                                type="checkbox"
                                id="ownerModeFeatureEnabled"
                                checked={form.ownerModeFeatureEnabled || false}
                                onChange={e => setForm(p => ({ ...p, ownerModeFeatureEnabled: e.target.checked }))}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#ef4444' }}
                            />
                            <label htmlFor="ownerModeFeatureEnabled" style={{ fontSize: '13px', fontWeight: 700, color: '#9f1239', cursor: 'pointer', userSelect: 'none' }}>
                                Enable Edit/Delete Protection (Requires Owner PIN to Edit/Delete)
                            </label>
                        </div>

                        {form.ownerModeFeatureEnabled && (
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    {ownerModeActive ? (
                                        <Unlock size={18} style={{ color: '#16a34a' }} />
                                    ) : (
                                        <Lock size={18} style={{ color: '#ef4444' }} />
                                    )}
                                    <span style={{ fontSize: '14px', fontWeight: 800, color: ownerModeActive ? '#16a34a' : '#ef4444' }}>
                                        Status: {ownerModeActive ? 'UNLOCKED (Owner Mode Active)' : 'LOCKED (Protected Mode)'}
                                    </span>
                                </div>

                                {ownerModeActive ? (
                                    <div>
                                        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#475569' }}>
                                            Edit/Delete protections are temporarily disabled. Mode will auto-lock in 15 minutes.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleLock}
                                            style={{
                                                padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #ef4444',
                                                background: '#fff', color: '#ef4444', fontWeight: 800, fontSize: '12px',
                                                cursor: 'pointer', transition: 'all 0.15s'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#ef4444'; }}
                                        >
                                            Re-Lock Immediately
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px' }}>
                                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#475569' }}>
                                            Enter Owner secret PIN to enable editing and deleting.
                                        </p>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="password"
                                                placeholder="Enter PIN"
                                                value={pin}
                                                onChange={e => setPin(e.target.value)}
                                                style={{ ...S.input, padding: '8px 12px', fontSize: '13px' }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleUnlockClick();
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleUnlockClick}
                                                style={{
                                                    padding: '0 16px', borderRadius: '8px', border: 'none',
                                                    background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: '12px',
                                                    cursor: 'pointer', whiteSpace: 'nowrap'
                                                }}
                                            >
                                                Unlock
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <button type="submit" disabled={saving}
                    style={{
                        width: '100%', padding: '12px', borderRadius: '10px',
                        background: saved ? '#16a34a' : '#16a34a',
                        border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700,
                        cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                    }}
                >
                    {saving
                        ? <><div style={{ width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /> Saving…</>
                        : saved
                        ? <><CheckCircle2 size={16} /> Saved!</>
                        : <><Save size={16} /> Save Business Info</>
                    }
                </button>
            </form>
        </div>
        </div>
    );
};

export default Settings;
