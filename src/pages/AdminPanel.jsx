import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { firebaseConfig, db } from '../firebase';
import { useTenant } from '../utils/TenantContext';
import { ShieldCheck, UserPlus, Trash2, Eye, EyeOff, RefreshCw, LogOut, Users, Store, Key } from 'lucide-react';

// Secondary Firebase app — creates users WITHOUT logging out the current admin
const getSecondaryAuth = () => {
    const existing = getApps().find(a => a.name === 'admin-secondary');
    const secondaryApp = existing || initializeApp(firebaseConfig, 'admin-secondary');
    return getAuth(secondaryApp);
};

const DOMAIN = '@poovanam.com';

const AdminPanel = () => {
    const { user } = useTenant();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ username: '', password: '', confirmPassword: '', shopName: '' });
    const [showPw, setShowPw] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null); // { type: 'success'|'error', text }
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const showMsg = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 5000);
    };

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch {
            // tenants collection may not have index yet — try without orderBy
            try {
                const snap = await getDocs(collection(db, 'tenants'));
                setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                showMsg('error', 'Could not load accounts: ' + err.message);
            }
        }
        setLoading(false);
    };

    useEffect(() => { loadAccounts(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        const { username, password, confirmPassword, shopName } = form;

        if (!username || !password || !shopName) return showMsg('error', 'All fields are required.');
        if (password !== confirmPassword) return showMsg('error', 'Passwords do not match.');
        if (password.length < 6) return showMsg('error', 'Password must be at least 6 characters.');
        if (!/^[a-z0-9_]+$/.test(username)) return showMsg('error', 'Username: only lowercase letters, numbers, underscores.');

        setSaving(true);
        try {
            const secondaryAuth = getSecondaryAuth();
            const email = `${username}${DOMAIN}`;

            // Create Firebase Auth user using secondary auth (doesn't affect current session)
            await createUserWithEmailAndPassword(secondaryAuth, email, password);
            await signOut(secondaryAuth); // clean up secondary session immediately

            // Store tenant profile in Firestore
            await setDoc(doc(db, 'tenants', username), {
                shopName,
                username,
                email,
                tenantId: username,
                createdAt: new Date().toISOString(),
                createdBy: user?.email || 'admin',
                active: true,
            });

            showMsg('success', `✅ Account "${username}" created successfully!`);
            setForm({ username: '', password: '', confirmPassword: '', shopName: '' });
            await loadAccounts();
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                showMsg('error', `Username "${username}" is already taken.`);
            } else {
                showMsg('error', 'Failed to create account: ' + err.message);
            }
        }
        setSaving(false);
    };

    const handleDelete = async (tenantId) => {
        try {
            await deleteDoc(doc(db, 'tenants', tenantId));
            showMsg('success', `Tenant record removed. Note: Delete the Firebase Auth user manually from Firebase Console.`);
            setDeleteConfirm(null);
            await loadAccounts();
        } catch (err) {
            showMsg('error', 'Delete failed: ' + err.message);
        }
    };

    const S = {
        page: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', padding: '40px 24px', fontFamily: 'Inter, sans-serif' },
        card: { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px' },
        input: { width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#f1f5f9', fontSize: '15px', fontWeight: 500, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' },
        label: { display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' },
        btn: { padding: '14px 28px', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' },
    };

    return (
        <div style={S.page}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                    <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldCheck size={28} color="white" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>Admin Panel</h1>
                        <p style={{ color: '#64748b', margin: 0, fontSize: '14px', fontWeight: 500 }}>Manage tenant accounts · Logged in as <span style={{ color: '#a78bfa' }}>{user?.email}</span></p>
                    </div>
                    <button onClick={loadAccounts} style={{ ...S.btn, background: 'rgba(255,255,255,0.08)', color: '#94a3b8', marginLeft: 'auto', padding: '10px 16px' }}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>

                {/* Alert */}
                {msg && (
                    <div style={{ padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', fontWeight: 600, fontSize: '14px', background: msg.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: msg.type === 'success' ? '#34d399' : '#f87171' }}>
                        {msg.text}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
                    {/* Create Account Form */}
                    <div style={S.card}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
                            <UserPlus size={22} color="#a78bfa" />
                            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Create New Account</h2>
                        </div>

                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={S.label}><Store size={11} style={{ display: 'inline', marginRight: 4 }} />Shop Name</label>
                                <input
                                    style={S.input}
                                    placeholder="e.g. Ramu Flowers"
                                    value={form.shopName}
                                    onChange={e => setForm(p => ({ ...p, shopName: e.target.value }))}
                                    required
                                />
                            </div>

                            <div>
                                <label style={S.label}><Key size={11} style={{ display: 'inline', marginRight: 4 }} />Username</label>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
                                    <input
                                        style={{ ...S.input, border: 'none', background: 'transparent', flex: 1 }}
                                        placeholder="ramu"
                                        value={form.username}
                                        onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                                        required
                                    />
                                    <span style={{ padding: '0 14px', color: '#475569', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>{DOMAIN}</span>
                                </div>
                                <p style={{ fontSize: '11px', color: '#475569', marginTop: '6px', marginLeft: '4px' }}>Login: <span style={{ color: '#818cf8' }}>{form.username || 'username'}{DOMAIN}</span></p>
                            </div>

                            <div>
                                <label style={S.label}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        style={{ ...S.input, paddingRight: '48px' }}
                                        type={showPw ? 'text' : 'password'}
                                        placeholder="Min. 6 characters"
                                        value={form.password}
                                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                        {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style={S.label}>Confirm Password</label>
                                <input
                                    style={{ ...S.input, borderColor: form.confirmPassword && form.password !== form.confirmPassword ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.15)' }}
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="Re-enter password"
                                    value={form.confirmPassword}
                                    onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                style={{ ...S.btn, background: saving ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', justifyContent: 'center', padding: '16px', fontSize: '15px', borderRadius: '14px', opacity: saving ? 0.7 : 1 }}
                            >
                                {saving ? <><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creating...</> : <><UserPlus size={18} /> Create Account</>}
                            </button>
                        </form>
                    </div>

                    {/* Accounts List */}
                    <div style={S.card}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <Users size={22} color="#34d399" />
                            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Registered Accounts</h2>
                            <span style={{ marginLeft: 'auto', background: 'rgba(52,211,153,0.15)', color: '#34d399', borderRadius: '20px', padding: '2px 12px', fontSize: '12px', fontWeight: 700 }}>{accounts.length}</span>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>
                                <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
                                <p style={{ margin: 0 }}>Loading accounts...</p>
                            </div>
                        ) : accounts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#334155' }}>
                                <Users size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                <p style={{ margin: 0, fontWeight: 600 }}>No accounts yet</p>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.6 }}>Create your first account on the left</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '480px', overflowY: 'auto' }}>
                                {accounts.map(acc => (
                                    <div key={acc.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ width: '42px', height: '42px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>{(acc.shopName || acc.username || '?')[0].toUpperCase()}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: 0, fontWeight: 700, color: '#f1f5f9', fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.shopName || acc.username}</p>
                                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{acc.email || `${acc.id}${DOMAIN}`}</p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(52,211,153,0.15)', color: '#34d399', borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</span>
                                            {deleteConfirm === acc.id ? (
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button onClick={() => handleDelete(acc.id)} style={{ ...S.btn, background: 'rgba(239,68,68,0.2)', color: '#f87171', padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}>Confirm</button>
                                                    <button onClick={() => setDeleteConfirm(null)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: '#64748b', padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}>Cancel</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setDeleteConfirm(acc.id)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '7px', borderRadius: '8px' }} title="Remove tenant record">
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Info Note */}
                <div style={{ marginTop: '32px', padding: '16px 20px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '14px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <ShieldCheck size={18} color="#818cf8" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
                        <strong style={{ color: '#94a3b8' }}>How it works:</strong> Each account gets its own isolated data space. The username becomes the <strong style={{ color: '#a78bfa' }}>Tenant ID</strong> — all farmers, buyers, sales, and payments are stored separately per tenant. Login email will be <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px', color: '#c4b5fd' }}>username{DOMAIN}</code>
                    </div>
                </div>

                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );
};

export default AdminPanel;
