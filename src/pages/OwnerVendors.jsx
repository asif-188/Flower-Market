import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Edit, Trash2, X, MoreVertical, ShieldAlert, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import { subscribeToCollection, saveVendor, deleteVendor, db } from '../utils/storage';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

const INPUT_S = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1.5px solid #cbd5e1',
  background: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  color: '#1e293b',
  outline: 'none',
  transition: 'all 0.2s',
  boxSizing: 'border-box',
};

const LABEL_S = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
};

const OwnerVendors = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [activeKebabId, setActiveKebabId] = useState(null);
  
  const [vendorForm, setVendorForm] = useState({
    id: '',
    name: '',
    shop_name: '',
    mobile: '',
    location: '',
    balance: 0,
    status: 'active'
  });
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToCollection('vendors', setVendors);
    return () => unsubscribe();
  }, []);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      // Filter status
      const matchStatus = showRemoved ? v.status === 'removed' : (v.status !== 'removed');
      if (!matchStatus) return false;

      // Filter search term
      const term = searchTerm.toLowerCase();
      const name = v.name?.toLowerCase() || '';
      const shop = v.shop_name?.toLowerCase() || '';
      const loc = v.location?.toLowerCase() || '';
      const mobile = v.mobile || '';
      return name.includes(term) || shop.includes(term) || loc.includes(term) || mobile.includes(term);
    });
  }, [vendors, searchTerm, showRemoved]);

  const handleOpenModal = (v = null) => {
    if (v) {
      setVendorForm({
        id: v.id,
        name: v.name || '',
        shop_name: v.shop_name || '',
        mobile: v.mobile || '',
        location: v.location || '',
        balance: v.balance || 0,
        status: v.status || 'active'
      });
    } else {
      setVendorForm({
        id: '',
        name: '',
        shop_name: '',
        mobile: '',
        location: '',
        balance: 0,
        status: 'active'
      });
    }
    setShowModal(true);
    setActiveKebabId(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!vendorForm.name.trim()) return alert('Name is required');
    setIsSaving(true);
    try {
      await saveVendor({
        ...vendorForm,
        name: vendorForm.name.trim(),
        shop_name: vendorForm.shop_name.trim(),
        mobile: vendorForm.mobile.trim(),
        location: vendorForm.location.trim()
      });
      setShowModal(false);
    } catch (err) {
      alert('Error saving vendor: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSoftDelete = async (v) => {
    if (window.confirm(`Are you sure you want to deactivate/remove "${v.name}"? Past transaction history will remain intact.`)) {
      try {
        await updateDoc(doc(db, 'vendors', v.id), { status: 'removed' });
        setActiveKebabId(null);
      } catch (err) {
        alert('Error deactivating vendor: ' + err.message);
      }
    }
  };

  const handleRestore = async (v) => {
    try {
      await updateDoc(doc(db, 'vendors', v.id), { status: 'active' });
      setActiveKebabId(null);
    } catch (err) {
      alert('Error restoring vendor: ' + err.message);
    }
  };

  const handlePermanentDelete = async (v) => {
    // 1. Check if vendor has purchase history in flower purchases or outside purchases
    setIsSaving(true);
    try {
      const pQuery = query(collection(db, 'salesman_flower_purchases'), where('vendor_id', '==', v.id));
      const opQuery = query(collection(db, 'outside_purchases'), where('vendorId', '==', v.id));
      
      const [pSnap, opSnap] = await Promise.all([getDocs(pQuery), getDocs(opQuery)]);
      const hasHistory = pSnap.size > 0 || opSnap.size > 0;

      let proceed = false;
      if (hasHistory) {
        proceed = window.confirm(
          `⚠️ WARNING: "${v.name}" has active transaction records in the database. Deleting this vendor will result in orphaned transaction records. Are you absolutely sure you want to permanently delete this vendor record?`
        );
      } else {
        proceed = window.confirm(`Permanently delete vendor "${v.name}"? This action is irreversible.`);
      }

      if (proceed) {
        await deleteVendor(v.id);
        setActiveKebabId(null);
      }
    } catch (err) {
      alert('Error deleting vendor: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 p-4 md:p-6 pb-20 animate-in fade-in duration-300">
      
      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin Control</span>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            🏪 Vendor Master Registry
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/app/owner-dashboard')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 transition-all font-bold text-xs"
          >
            <ArrowLeft size={16} /> Owner Dashboard
          </button>

          <button
            onClick={() => setShowRemoved(!showRemoved)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs border transition-all ${
              showRemoved 
                ? 'bg-amber-50 border-amber-200 text-amber-700' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showRemoved ? <ToggleRight size={16} /> : <ToggleLeft size={16} />} 
            {showRemoved ? 'Showing Deactivated' : 'Show Deactivated'}
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition-all shadow-md shadow-purple-100"
          >
            <Plus size={16} /> Add Vendor
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm relative">
        <div className="relative w-full max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search by vendor name, shop name, or location..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={INPUT_S}
            className="pl-11 focus:ring-2 focus:ring-purple-200"
          />
        </div>
      </div>

      {/* Vendors Table / Cards */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Display ID</th>
                <th className="p-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Vendor Name</th>
                <th className="p-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Shop Name</th>
                <th className="p-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Mobile Number</th>
                <th className="p-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Location</th>
                <th className="p-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Outstanding Balance</th>
                <th className="p-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-slate-400 italic text-sm">
                    No vendors registered or match the query.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors font-bold text-xs">
                    <td className="p-4 font-mono text-purple-700">#{String(v.displayId || v.id.slice(-4)).toUpperCase()}</td>
                    <td className="p-4 text-slate-800 text-sm">{v.name}</td>
                    <td className="p-4 text-slate-600">{v.shop_name || '---'}</td>
                    <td className="p-4 text-slate-600 font-mono">{v.mobile || '---'}</td>
                    <td className="p-4 text-slate-600">{v.location || '---'}</td>
                    <td className="p-4 font-mono text-sm text-slate-900">
                      ₹{(v.balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-4 text-center relative">
                      <button
                        onClick={() => setActiveKebabId(activeKebabId === v.id ? null : v.id)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Dropdown Menu */}
                      {activeKebabId === v.id && (
                        <div className="absolute right-6 top-10 w-40 bg-white border border-slate-200 shadow-xl rounded-xl p-1 z-30 flex flex-col gap-0.5">
                          <button
                            onClick={() => handleOpenModal(v)}
                            className="w-full text-left p-2 hover:bg-purple-50 hover:text-purple-700 rounded-lg text-xs transition-colors flex items-center gap-1.5"
                          >
                            <Edit size={14} /> Edit Details
                          </button>
                          {v.status === 'removed' ? (
                            <button
                              onClick={() => handleRestore(v)}
                              className="w-full text-left p-2 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-xs transition-colors flex items-center gap-1.5"
                            >
                              <ToggleLeft size={14} /> Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSoftDelete(v)}
                              className="w-full text-left p-2 hover:bg-amber-50 hover:text-amber-700 rounded-lg text-xs transition-colors flex items-center gap-1.5"
                            >
                              <Trash2 size={14} /> Deactivate
                            </button>
                          )}
                          <button
                            onClick={() => handlePermanentDelete(v)}
                            className="w-full text-left p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-xs transition-colors flex items-center gap-1.5 border-t border-slate-100 mt-1"
                          >
                            <Trash2 size={14} className="text-red-500" /> Delete Forever
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in duration-300 overflow-hidden flex flex-col"
          >
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">
                {vendorForm.id ? 'Edit Vendor Master Record' : 'Register New Vendor'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div>
                <label style={LABEL_S}>Vendor Name *</label>
                <input
                  type="text"
                  placeholder="Enter full name..."
                  value={vendorForm.name}
                  onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })}
                  style={INPUT_S}
                  required
                  className="focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div>
                <label style={LABEL_S}>Shop Name</label>
                <input
                  type="text"
                  placeholder="e.g. S.V.M Flower Stalls"
                  value={vendorForm.shop_name}
                  onChange={e => setVendorForm({ ...vendorForm, shop_name: e.target.value })}
                  style={INPUT_S}
                  className="focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={LABEL_S}>Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={vendorForm.mobile}
                    onChange={e => setVendorForm({ ...vendorForm, mobile: e.target.value })}
                    style={INPUT_S}
                    className="focus:ring-2 focus:ring-purple-200"
                  />
                </div>
                <div>
                  <label style={LABEL_S}>Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Tindivanam"
                    value={vendorForm.location}
                    onChange={e => setVendorForm({ ...vendorForm, location: e.target.value })}
                    style={INPUT_S}
                    className="focus:ring-2 focus:ring-purple-200"
                  />
                </div>
              </div>

              {vendorForm.id && (
                <div>
                  <label style={LABEL_S}>Outstanding Balance (₹) (Read-only)</label>
                  <input
                    type="number"
                    disabled
                    value={vendorForm.balance}
                    style={{ ...INPUT_S, background: '#f8fafc', color: '#64748b' }}
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl font-bold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-extrabold text-xs transition-all shadow-md shadow-purple-100"
              >
                {isSaving ? 'Saving...' : 'Save Vendor'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default OwnerVendors;
