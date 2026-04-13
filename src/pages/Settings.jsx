import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { db } from '../utils/storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
    const [form, setForm]       = useState(DEFAULTS);
    const [saving, setSaving]   = useState(false);
    const [saved, setSaved]     = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getDoc(doc(db, 'system', 'settings')).then(snap => {
            if (snap.exists()) setForm(f => ({ ...f, ...snap.data() }));
        }).finally(() => setLoading(false));
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await setDoc(doc(db, 'system', 'settings'), form, { merge: true });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            alert('❌ Save failed: ' + err.message);
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
    );
};

export default Settings;
