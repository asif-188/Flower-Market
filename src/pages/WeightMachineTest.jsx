import React, { useState, useEffect, useContext } from 'react';
import { 
  Cpu, 
  Wifi, 
  Trash2, 
  Tag, 
  Calculator, 
  Package, 
  Save, 
  RefreshCw, 
  Activity, 
  ShieldCheck, 
  Play, 
  Square, 
  Zap, 
  Clock, 
  AlertTriangle,
  Printer
} from 'lucide-react';
import { useWeightMachine } from '../utils/weightMachine';
import { 
  saveWmTestPurchase, 
  getWmTestPurchases, 
  deleteWmTestPurchase, 
  subscribeToCollection 
} from '../utils/storage';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';
import { generatePurchaseReceiptCanvas } from '../utils/receiptCanvas'; // Let's use layout context or standard t if available, fallback to custom translate

const STATIC_FLOWERS = [
  'Rose / ரோஜா',
  'Malligai / மல்லிகை',
  'Samanthi / சாமந்தி',
  'Mullai / முல்லை',
  'Arali / அரளி',
  'Tulip / டியூலிப்'
];

const MOCK_VENDORS = [
  { id: 'mock1', name: 'Mock Vendor A (Chennai)' },
  { id: 'mock2', name: 'Mock Vendor B (Madurai)' },
  { id: 'mock3', name: 'Mock Farmer C (Salem)' },
];

const WeightMachineTest = () => {
  // Try to use LangContext if defined, fallback to local translator
  const langContext = useContext(LangContext);
  const t = langContext?.t || ((key) => key);
  const { tenantData } = useTenant();

  // Local State
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [testPurchases, setTestPurchases] = useState([]);
  
  // Form State
  const [vendorId, setVendorId] = useState('');
  const [flowerName, setFlowerName] = useState('');
  const [rate, setRate] = useState('');
  const [lastUpdatedTime, setLastUpdatedTime] = useState('Never');

  // Weight Machine Hook
  const wm = useWeightMachine();

  // Load vendors & products for realistic dropdown populating
  useEffect(() => {
    const unsubVendors = subscribeToCollection('vendors', (data) => {
      setVendors(data.length > 0 ? data : MOCK_VENDORS);
    });
    const unsubProducts = subscribeToCollection('products', (data) => {
      setProducts(data);
    });

    // Load test transactions
    loadTestPurchases();

    return () => {
      unsubVendors();
      unsubProducts();
    };
  }, []);

  // Update last updated timestamp whenever weight changes
  useEffect(() => {
    if (wm.weight !== 0) {
      setLastUpdatedTime(new Date().toLocaleTimeString());
    }
  }, [wm.weight]);

  const loadTestPurchases = async () => {
    try {
      const data = await getWmTestPurchases();
      setTestPurchases(data);
    } catch (e) {
      console.error('Failed to load test purchases:', e);
    }
  };

  // Calculate Total
  const calculatedTotal = (parseFloat(wm.weight || 0) * parseFloat(rate || 0)).toFixed(2);

  // Clear Form fields
  const handleClear = () => {
    setVendorId('');
    setFlowerName('');
    setRate('');
    wm.setWeight(0.000);
    wm.disconnect();
  };

  // Print Sandbox Receipt
  const handlePrintReceipt = async (p) => {
    const selectedVendor = vendors.find(v => v.id === p.vendorId) || MOCK_VENDORS.find(v => v.id === p.vendorId);
    
    const labels = {
      dateLabel: t('date') || 'Date',
      vendorLabel: t('vendorName') || 'Vendor',
      totalLabel: t('total') || 'Total',
      purchaseReceipt: 'TEST PURCHASE RECEIPT',
      particulars: t('particulars') || 'Particulars',
      qty: t('qty') || 'Qty',
      rate: t('rate') || 'Rate',
      amount: t('amount') || 'Amount',
      thankYou: '🌹 Sandbox Test 🌹'
    };

    const bizInfo = tenantData || { motto: 'SRI RAMA JAYAM', name: 'S.V.M', type: 'SRI VALLI FLOWER MERCHANT', address: 'B-7, FLOWER MARKET, TINDIVANAM.', phone1: '9443247771', phone2: '9952535057' };

    const purchaseData = {
      date: p.date || p.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0],
      grandTotal: p.total,
      items: [{
        flowerType: p.flowerName,
        quantity: p.weight,
        price: p.rate,
        total: p.total
      }]
    };

    try {
      const { url } = await generatePurchaseReceiptCanvas({ 
        entity: selectedVendor || { name: p.vendorName || 'Mock Vendor' }, 
        purchase: purchaseData, 
        bizInfo, 
        labels, 
        lang: langContext?.lang || 'en' 
      });
      const win = window.open('', '_blank');
      win.document.write(`<html><head><title>Test Purchase Receipt</title><style>body { margin: 0; display: flex; justify-content: center; align-items: center; background: #f3f4f6; min-height: 100vh; } img { max-width: 100%; max-height: 100vh; display: block; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1); } @page { size: A4 portrait; margin: 0; } @media print { html, body { margin: 0; padding: 0; background: #fff; display: block; width: 100%; height: auto; } .print-container { display: block; width: 100%; height: 297mm; box-sizing: border-box; overflow: hidden; } img { width: 100%; height: 100%; display: block; box-shadow: none; } }</style><script>window.onload = function() { window.print(); }</script></head><body><div class="print-container"><img src="${url}"></div></body></html>`);
      win.document.close();
    } catch (err) {
      console.error('Print Error:', err);
      alert('❌ Failed to generate receipt canvas: ' + err.message);
    }
  };

  // Save isolated test data
  const handleSaveTestData = async (e) => {
    e.preventDefault();
    if (!vendorId || !flowerName || !wm.weight || !rate) {
      alert('⚠️ Please populate all fields, including reading a weight from the machine.');
      return;
    }

    const selectedVendor = vendors.find(v => v.id === vendorId) || MOCK_VENDORS.find(v => v.id === vendorId);
    
    const purchasePayload = {
      vendorId,
      vendorName: selectedVendor?.name || 'Unknown',
      flowerName,
      weight: parseFloat(wm.weight),
      rate: parseFloat(rate),
      total: parseFloat(calculatedTotal),
      timestamp: new Date().toISOString(),
      isTest: true
    };

    try {
      await saveWmTestPurchase(purchasePayload);
      alert('✅ TEST DATA SAVED IN ISOLATION! Generating thermal print receipt...');
      loadTestPurchases();
      // Generate print window
      await handlePrintReceipt(purchasePayload);
      // Reset rate and flowerName only to speed up testing
      setFlowerName('');
      setRate('');
    } catch (err) {
      console.error(err);
      alert('❌ Failed to save test purchase.');
    }
  };

  const handleDeletePurchase = async (id) => {
    if (confirm('Delete this test transaction?')) {
      try {
        await deleteWmTestPurchase(id);
        loadTestPurchases();
      } catch (err) {
        console.error(err);
        alert('Failed to delete transaction.');
      }
    }
  };

  // Determine final list of vendors and flowers (fallback to mocks if empty)
  const vendorList = vendors.length > 0 ? vendors : MOCK_VENDORS;
  const flowerList = products.length > 0 ? products.map(p => p.name) : STATIC_FLOWERS;

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-700">
      
      {/* LEFT PANEL: Purchase Entry Form */}
      <div className="flex-1 space-y-8">
        
        {/* Banner notifying environment state */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-[30px] p-6 text-white shadow-xl flex items-center justify-between border-4 border-amber-300 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="bg-white text-orange-600 p-3 rounded-full flex items-center justify-center shadow-inner">
              <AlertTriangle size={30} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider">Standalone Test Mode</h2>
              <p className="text-amber-100 text-xs font-bold">This sandbox will NOT write to ledgers, reports, or update financial balances.</p>
            </div>
          </div>
          <span className="bg-white text-orange-600 px-4 py-2 rounded-full font-black text-xs tracking-widest shadow-md">SANDBOX</span>
        </div>

        <div className="bg-white rounded-[40px] shadow-2xl border border-gray-100 p-10">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-[20px] flex items-center justify-center shadow-lg -rotate-3">
                <Cpu size={32} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-gray-800 tracking-tighter italic">Weight Test Purchase</h1>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Weight Indicator Sandbox</p>
              </div>
            </div>
            
            {/* Status Badges */}
            <div className="flex items-center gap-2">
              <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border shadow-sm flex items-center gap-1.5 ${
                wm.status === 'connected' 
                  ? 'bg-green-50 border-green-200 text-green-600'
                  : wm.status === 'connecting'
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-red-50 border-red-200 text-red-600'
              }`}>
                <Activity size={12} className={wm.status === 'connected' ? 'animate-bounce' : ''} />
                {wm.status}
              </span>
              {wm.isSimulating && (
                <span className="bg-amber-100 text-amber-800 border border-amber-200 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest animate-pulse">
                  SIM ACTIVE
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveTestData} className="space-y-8">
            
            {/* Vendor Dropdown */}
            <div className="bg-amber-50/40 rounded-3xl p-6 border-2 border-amber-100/40 flex flex-col md:flex-row items-center gap-6">
              <div className="w-full">
                <label className="block text-xs font-black text-amber-700 uppercase tracking-widest mb-2 pl-2">
                  Vendor Name / விற்பனையாளர் 🧑‍🌾
                </label>
                <select
                  value={vendorId}
                  onChange={e => setVendorId(e.target.value)}
                  required
                  className="w-full p-4 border-none rounded-2xl outline-none bg-white font-black text-gray-700 shadow-md focus:ring-4 focus:ring-amber-200 transition-all"
                >
                  <option value="">Select Vendor / Farmer</option>
                  {vendorList.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="bg-gray-50/40 border-4 border-dashed border-gray-100 rounded-[40px] p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                
                {/* Flower Selection */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 pl-2 flex items-center gap-2">
                    <Tag size={12} /> Flower Name / பூ வகை
                  </label>
                  <select 
                    value={flowerName}
                    onChange={e => setFlowerName(e.target.value)}
                    required
                    className="w-full p-5 rounded-[20px] bg-white border-none shadow-md focus:ring-4 focus:ring-amber-400/20 font-black text-gray-800 transition-all outline-none"
                  >
                    <option value="">Select Flower...</option>
                    {flowerList.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Auto Weight Input */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 pl-2 flex items-center gap-2">
                    <Calculator size={12} /> Weight / எடை (Auto)
                  </label>
                  <div className="flex shadow-md rounded-[20px] overflow-hidden bg-white focus-within:ring-4 focus-within:ring-amber-400/20 transition-all">
                    <input
                      type="number"
                      step="0.001"
                      value={wm.weight}
                      onChange={e => wm.setWeight(parseFloat(e.target.value) || 0)}
                      className="w-full p-5 border-none bg-transparent outline-none font-black text-2xl text-amber-600"
                      placeholder="0.000"
                      required
                    />
                    <div className="bg-amber-600 text-white p-5 font-black uppercase text-xs flex items-center justify-center">KG</div>
                  </div>
                </div>

                {/* Rate Input */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 pl-2 flex items-center gap-2">
                    <Package size={12} /> Rate / விலை
                  </label>
                  <div className="bg-white rounded-[20px] p-5 shadow-md flex items-center focus-within:ring-4 focus-within:ring-amber-400/20 transition-all">
                    <span className="text-2xl font-black text-amber-500 mr-2">₹</span>
                    <input
                      type="number"
                      value={rate}
                      onChange={e => setRate(e.target.value)}
                      className="w-full bg-transparent border-none outline-none font-black text-2xl text-gray-800"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Test Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
              
              <button
                type="button"
                onClick={wm.isSimulating ? wm.stopSimulation : wm.startSimulation}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl font-black text-xs uppercase transition-all shadow-md active:scale-95 ${
                  wm.isSimulating 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-2 border-amber-200'
                }`}
              >
                {wm.isSimulating ? <Square size={16} /> : <Play size={16} />}
                {wm.isSimulating ? 'Stop Simulator' : 'Enable Test Mode'}
              </button>

              <button
                type="button"
                onClick={wm.handleTestConnection}
                disabled={wm.isSimulating}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-100 text-blue-800 border-2 border-blue-200 hover:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl font-black text-xs uppercase transition-all shadow-md active:scale-95"
              >
                <Wifi size={16} />
                Test Connection
              </button>

              <button
                type="button"
                onClick={() => {
                  if (wm.isSimulating) {
                    wm.triggerSimulateWeight();
                  } else {
                    alert('Read Triggered! In live mode, weight continuous stream automatically reads weights.');
                  }
                }}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-purple-100 text-purple-800 border-2 border-purple-200 hover:bg-purple-200 rounded-2xl font-black text-xs uppercase transition-all shadow-md active:scale-95"
              >
                <RefreshCw size={16} />
                Read Weight
              </button>

              <button
                type="button"
                onClick={wm.triggerSimulateWeight}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-emerald-100 text-emerald-800 border-2 border-emerald-200 hover:bg-emerald-200 rounded-2xl font-black text-xs uppercase transition-all shadow-md active:scale-95"
              >
                <Zap size={16} />
                Simulate Weight
              </button>

              <button
                type="submit"
                className="flex flex-col items-center justify-center gap-2 p-4 bg-orange-600 text-white hover:bg-orange-700 rounded-2xl font-black text-xs uppercase transition-all shadow-md active:scale-95"
              >
                <Save size={16} />
                Save Test Data
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-100 text-gray-700 border-2 border-gray-200 hover:bg-gray-200 rounded-2xl font-black text-xs uppercase transition-all shadow-md active:scale-95"
              >
                <Trash2 size={16} />
                Clear
              </button>

            </div>

          </form>

        </div>

        {/* Saved Test Purchases Table */}
        <div className="bg-white rounded-[40px] shadow-2xl border border-gray-100 p-10">
          <h2 className="text-2xl font-black text-gray-800 tracking-tighter italic mb-6 flex items-center gap-2">
            <ShieldCheck className="text-green-600" /> Standalone Sandbox Ledger
          </h2>
          <div className="overflow-x-auto rounded-[24px] border border-gray-100">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-amber-50/30">
                  <th className="px-6 py-4 text-xs font-black text-amber-800 uppercase tracking-widest text-left">Vendor</th>
                  <th className="px-6 py-4 text-xs font-black text-amber-800 uppercase tracking-widest text-left">Flower</th>
                  <th className="px-6 py-4 text-xs font-black text-amber-800 uppercase tracking-widest text-center">Weight</th>
                  <th className="px-6 py-4 text-xs font-black text-amber-800 uppercase tracking-widest text-right">Rate</th>
                  <th className="px-6 py-4 text-xs font-black text-amber-800 uppercase tracking-widest text-right">Total</th>
                  <th className="px-6 py-4 text-xs font-black text-amber-800 uppercase tracking-widest text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {testPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/10">
                    <td className="px-6 py-4 font-bold text-gray-700">{p.vendorName}</td>
                    <td className="px-6 py-4 font-black italic text-gray-600">🌾 {p.flowerName}</td>
                    <td className="px-6 py-4 text-center font-black text-amber-600">{p.weight.toFixed(3)} KG</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-400">₹{p.rate}</td>
                    <td className="px-6 py-4 text-right font-black text-orange-700 text-lg">₹{p.total.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                      <button onClick={() => handlePrintReceipt(p)} className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all" title="Print Receipt">
                        <Printer size={18} />
                      </button>
                      <button onClick={() => handleDeletePurchase(p.id)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete Entry">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {testPurchases.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-bold uppercase tracking-wider text-xs">
                      No test data saved yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* RIGHT PANEL: Settings, Live Weight & Comm Logs */}
      <div className="w-full lg:w-[450px] space-y-8">
        
        {/* Live Weight Indicator Display Card */}
        <div className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-[50px] shadow-2xl p-10 text-white flex flex-col justify-between overflow-hidden relative min-h-[300px]">
          <div className="relative z-10">
            <h3 className="text-amber-200 font-black uppercase tracking-[0.3em] text-xs mb-2">Live Weight Reading</h3>
            <div className="text-[10px] text-amber-100/60 font-bold tracking-widest mb-8 flex items-center gap-1">
              <Clock size={10} /> UPDATED: {lastUpdatedTime}
            </div>
            <div className="text-center py-6">
              <div className="text-7xl font-black tracking-tight drop-shadow-lg tabular-nums animate-pulse">
                {wm.weight.toFixed(3)}
              </div>
              <p className="text-amber-300 font-black text-2xl tracking-widest uppercase mt-2">KILOGRAMS</p>
            </div>
          </div>
          
          <div className="relative z-10 flex justify-between items-center pt-6 border-t border-white/10 text-xs text-amber-100 font-bold">
            <span>METHOD: {wm.method.toUpperCase()}</span>
            <span>TOTAL DUE: ₹{calculatedTotal}</span>
          </div>

          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-orange-500/25 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* Machine Hardware Settings Card */}
        <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 p-8">
          <h3 className="text-lg font-black text-gray-800 uppercase tracking-wider mb-6 pb-2 border-b border-gray-50 flex items-center gap-2">
            <Wifi size={18} className="text-amber-600" /> Machine Settings
          </h3>
          
          <div className="space-y-6">
            
            {/* Method Select */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Connection Method</label>
              <select
                value={wm.method}
                onChange={e => wm.setMethod(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-gray-700 focus:border-amber-500"
              >
                <option value="usb">USB (Web Serial)</option>
                <option value="rs232">RS232 (Web Serial)</option>
                <option value="bluetooth">Bluetooth (Web Bluetooth)</option>
                <option value="tcp">TCP/IP (WebSocket Client)</option>
              </select>
            </div>

            {/* Dynamic Options based on method */}
            {(wm.method === 'usb' || wm.method === 'rs232') && (
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Baud Rate</label>
                <select
                  value={wm.baudRate}
                  onChange={e => wm.setBaudRate(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-gray-700 focus:border-amber-500"
                >
                  <option value="2400">2400</option>
                  <option value="4800">4800</option>
                  <option value="9600">9600</option>
                  <option value="19200">19200</option>
                  <option value="38400">38400</option>
                  <option value="115200">115200</option>
                </select>
              </div>
            )}

            {wm.method === 'bluetooth' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Service UUID</label>
                  <input
                    type="text"
                    value={wm.btService}
                    onChange={e => wm.setBtService(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-xs text-gray-700 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Characteristic UUID</label>
                  <input
                    type="text"
                    value={wm.btChar}
                    onChange={e => wm.setBtChar(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-xs text-gray-700 focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {wm.method === 'tcp' && (
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">WebSocket Bridge Server IP/Port</label>
                <input
                  type="text"
                  placeholder="ws://192.168.1.100:8080"
                  value={wm.ipAddress}
                  onChange={e => wm.setIpAddress(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-gray-700 focus:border-amber-500"
                />
              </div>
            )}

            {wm.status !== 'disconnected' && (
              <button
                type="button"
                onClick={wm.disconnect}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md transition-all active:scale-95"
              >
                Disconnect Device
              </button>
            )}

          </div>
        </div>

        {/* Live Communication Logs Card */}
        <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 p-8">
          <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-50">
            <h3 className="text-lg font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <Zap size={18} className="text-amber-600" /> Communication Logs
            </h3>
            <button 
              onClick={wm.clearLogs}
              className="text-[10px] font-black text-gray-400 hover:text-amber-600 uppercase tracking-wider"
            >
              Clear Logs
            </button>
          </div>
          
          <div className="h-64 overflow-y-auto bg-gray-900 rounded-2xl p-4 font-mono text-[11px] text-green-400 space-y-1.5 scrollbar-thin">
            {wm.logs.map((log, index) => (
              <div key={index} className="break-all whitespace-pre-wrap">{log}</div>
            ))}
            {wm.logs.length === 0 && (
              <div className="text-gray-500 text-center py-20 uppercase tracking-wider text-[10px]">
                Waiting for communication...
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default WeightMachineTest;
