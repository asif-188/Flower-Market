import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, Flower2 } from 'lucide-react';
import { savePbProduct, deletePbProduct, subscribeToCollection } from '../../utils/storage';

const PB = {
  primary: '#7c3aed',
  light: '#f5f3ff',
  border: '#c4b5fd',
  badge: '#ede9fe',
  badgeText: '#5b21b6',
};

const S = {
  page: { background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', padding: '28px 32px', minHeight: '60vh', fontFamily: 'var(--font-sans)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
  title: { fontSize: '22px', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0 },
  btnAdd: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '8px', border: `1.5px solid ${PB.primary}`, background: '#fff', color: PB.primary, fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.18s' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: PB.primary, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1.5px solid #e5e7eb', background: '#fff', whiteSpace: 'nowrap' },
  td: { padding: '13px 14px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  input: { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' },
};

const PbFlowers = () => {
  const [flowers, setFlowers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', taName: '', unit: 'kg' });
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const transTimeout = React.useRef(null);
  const [touched, setTouched] = useState({ name: false, taName: false });
  const nameRef = React.useRef(null);

  useEffect(() => {
    const unsub = subscribeToCollection('pb_products', setFlowers);
    return () => unsub();
  }, []);

  const translate = async (text, from, to) => {
    if (!text || text.length < 2) return '';
    try {
      const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await resp.json();
      return data[0][0][0];
    } catch { return ''; }
  };

  const handleAutoTranslate = (val, source) => {
    const target = source === 'name' ? 'taName' : 'name';
    const fromLang = source === 'name' ? 'en' : 'ta';
    const toLang = source === 'name' ? 'ta' : 'en';
    setForm(prev => ({ ...prev, [source]: val }));
    if (!touched[target] && val.trim().length > 2) {
      if (transTimeout.current) clearTimeout(transTimeout.current);
      transTimeout.current = setTimeout(async () => {
        setIsTranslating(true);
        const translated = await translate(val, fromLang, toLang);
        if (translated && !touched[target]) setForm(prev => ({ ...prev, [target]: translated }));
        setIsTranslating(false);
      }, 800);
    }
  };

  const openModal = (flower = null) => {
    setTouched({ name: false, taName: false });
    if (flower) {
      setEditing(flower);
      setForm({ name: flower.name || '', taName: flower.taName || '', unit: flower.unit || 'kg' });
    } else {
      setEditing(null);
      setForm({ name: '', taName: '', unit: 'kg' });
    }
    setIsModalOpen(true);
    setTimeout(() => nameRef.current?.focus(), 80);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await savePbProduct({ id: editing?.id, name: form.name.trim(), taName: form.taName.trim(), unit: form.unit });
      setIsModalOpen(false);
    } catch (err) { alert('❌ Failed: ' + err.message); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this VV flower variety?')) return;
    try { await deletePbProduct(id); }
    catch (err) { alert('❌ Delete failed: ' + err.message); }
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>⚡</span>
          <h2 style={S.title}>⚜️ VV — Flower Master</h2>
        </div>
        <button style={S.btnAdd} onClick={() => openModal()}
          onMouseEnter={e => { e.currentTarget.style.background = PB.primary; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = PB.primary; }}
        ><Plus size={14} /> Add Flower</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={S.th}>#</th>
              <th style={S.th}>Flower Name</th>
              <th style={S.th}>Tamil Name</th>
              <th style={S.th}>Unit</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {flowers.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
                No VV flower varieties added yet. Click "Add Flower" to get started.
              </td></tr>
            ) : (
              flowers.map((f, idx) => (
                <tr key={f.id}
                  style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                  onMouseEnter={e => e.currentTarget.style.background = PB.light}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa'}
                >
                  <td style={{ ...S.td, color: '#9ca3af', fontWeight: 600, width: '48px' }}>{idx + 1}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: '#1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '16px' }}>🌸</span> {f.name}</div>
                  </td>
                  <td style={{ ...S.td, color: '#64748b' }}>{f.taName || '—'}</td>
                  <td style={S.td}>
                    <span style={{ background: PB.badge, border: `1px solid ${PB.border}`, color: PB.badgeText, fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '100px' }}>{f.unit || 'kg'}</span>
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button onClick={() => openModal(f)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#eff6ff', color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#3b82f6'; }}
                      ><Edit2 size={13} /></button>
                      <button onClick={() => handleDelete(f.id)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#fff1f2', color: '#f43f5e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f43f5e'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#f43f5e'; }}
                      ><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {flowers.length > 0 && (
        <div style={{ marginTop: '20px', padding: '12px 16px', background: PB.light, borderRadius: '10px', border: `1px solid ${PB.border}`, fontSize: '12px', color: PB.primary, fontWeight: 600 }}>
          ⚜️ {flowers.length} VV flower {flowers.length === 1 ? 'variety' : 'varieties'} available — these appear in the VV Sales entry dropdown.
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: PB.light, borderRadius: '10px', padding: '6px' }}><span style={{ fontSize: '18px' }}>⚡</span></div>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-display)' }}>{editing ? 'Edit PB Flower' : 'Add PB Flower'}</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', flex: 1 }}>
                {[
                  { label: 'Flower Name (English) *', key: 'name', type: 'text', required: true },
                  { label: 'Tamil Name (optional)', key: 'taName', type: 'text' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{f.label}</label>
                    <input ref={f.key === 'name' ? nameRef : null} type={f.type} required={f.required}
                      placeholder={f.key === 'name' ? 'e.g. Rose, Jasmine...' : 'e.g. ரோஜா, மல்லி...'}
                      value={form[f.key]}
                      onChange={e => { setTouched(p => ({ ...p, [f.key]: true })); handleAutoTranslate(e.target.value, f.key); }}
                      onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                      style={S.input}
                      onFocus={e => e.target.style.borderColor = PB.primary}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Unit of Measurement</label>
                  <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={S.input}
                    onFocus={e => e.target.style.borderColor = PB.primary}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  >
                    <option value="kg">kg</option>
                    <option value="g">grams</option>
                    <option value="bunch">bunch</option>
                    <option value="piece">piece</option>
                    <option value="dozen">dozen</option>
                    <option value="meter">meter</option>
                  </select>
                </div>
                {isTranslating && <div style={{ fontSize: '11px', color: PB.primary, fontStyle: 'italic' }}>🌐 Translating...</div>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafa', flexShrink: 0 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '9px 20px', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={isSaving} style={{ padding: '9px 22px', borderRadius: '9px', border: `1.5px solid ${PB.primary}`, background: '#fff', color: PB.primary, fontWeight: 700, fontSize: '13px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1, fontFamily: 'var(--font-sans)' }}>
                  {isSaving ? 'Saving...' : (editing ? 'Update' : 'Add Flower')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PbFlowers;
