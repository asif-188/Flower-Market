import React, { useState, useEffect, useContext } from 'react';
import { Calendar, User, FileText, Download, MessageCircle, Lock, Unlock, Eye, Sparkles, X, Save, Trash2, Edit, Check } from 'lucide-react';
import { subscribeToCollection, saveFBillClosing, saveFLedger, COLLECTIONS, db, addData, getTenant } from '../utils/storage';
import { useTenant } from '../utils/TenantContext';
import { collection, query, where, getDocs, doc, updateDoc, increment, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { LangContext } from '../components/Layout';

/* ── Style Tokens (matching Outside Shop & Sales Report layout) ── */
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
    padding: '12px 6px', textAlign: 'left', fontSize: '11px', 
    fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', 
    letterSpacing: '0.08em', borderBottom: '1.5px solid #e5e7eb',
    background: '#fff'
};
const TD_S = { 
    padding: '12px 6px', fontSize: '13px', verticalAlign: 'middle',
    color: '#374151', borderBottom: '1px solid #f3f4f6'
};

const S = {
    page: {
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        padding: '28px 16px',
        minHeight: '70vh',
        fontFamily: 'var(--font-sans)',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '24px',
    },
    titleRow: { display: 'flex', alignItems: 'center', gap: '10px' },
    title: {
        fontSize: '22px', fontWeight: 800, color: '#ea580c',
        letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0,
    },
};

const FarmerBillClose = () => {
    const { tenantData, isEditDeleteAllowed } = useTenant();
    const { t, lang } = useContext(LangContext);
    const [farmers, setFarmers] = useState([]);
    const [products, setProducts] = useState([]);
    const [dropdownFarmerId, setDropdownFarmerId] = useState('all');
    const [commTypeFilter, setCommTypeFilter] = useState('all');
    const [selectedFarmerIds, setSelectedFarmerIds] = useState([]);
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // First day of current month
        return d.toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [calculations, setCalculations] = useState({});
    const [isCalculating, setIsCalculating] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Dialog state for previewing statement
    const [previewFarmerId, setPreviewFarmerId] = useState(null);
    const [previewData, setPreviewData] = useState(null);

    // Load farmers & products list
    useEffect(() => {
        const unsubscribeFarmers = subscribeToCollection(COLLECTIONS.F_FARMERS, setFarmers);
        const unsubscribeProducts = subscribeToCollection(COLLECTIONS.PRODUCTS, setProducts);
        return () => {
            unsubscribeFarmers();
            unsubscribeProducts();
        };
    }, []);

    // Reset farmer dropdown when commission type filter changes
    useEffect(() => {
        setDropdownFarmerId('all');
    }, [commTypeFilter]);

    // Sync selected Farmer IDs when farmer list or dropdown selection updates
    useEffect(() => {
        if (farmers.length > 0) {
            if (dropdownFarmerId === 'all') {
                const filteredList = farmers.filter(f => commTypeFilter === 'all' || f.commissionType === commTypeFilter);
                setSelectedFarmerIds(filteredList.map(f => f.id));
            } else {
                setSelectedFarmerIds([dropdownFarmerId]);
            }
        }
    }, [farmers, dropdownFarmerId, commTypeFilter]);

    const filteredFarmersForDropdown = farmers.filter(f => {
        if (commTypeFilter === 'all') return true;
        return f.commissionType === commTypeFilter;
    });

    const addToast = (message, type = 'success') => {
        const id = Date.now() + Math.random().toString();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const getLocalizedFarmerName = (calcOrFarmer) => {
        if (!calcOrFarmer) return '---';
        if (lang === 'ta') {
            return calcOrFarmer.farmerNameTa || calcOrFarmer.nameTa || calcOrFarmer.farmerName || calcOrFarmer.name || '---';
        }
        return calcOrFarmer.farmerName || calcOrFarmer.name || '---';
    };

    const getLocalizedFlowerName = (name, item = {}) => {
        if (!name) return '';
        if (lang === 'ta') {
            if (item.flowerNameTa) return item.flowerNameTa;
            const found = products.find(p => p.name?.trim().toLowerCase() === name.trim().toLowerCase());
            if (found && (found.taName || found.nameTa)) return found.taName || found.nameTa;
            return name;
        }
        return name;
    };

    const generateFarmerStatementCanvas = (previewData, tenantData, statementRows, lang) => {
        const isTa = lang === 'ta';
        const farmerNameLoc = getLocalizedFarmerName(previewData);
        
        const lbl = {
            code: isTa ? 'குறியீடு' : 'CODE',
            name: isTa ? 'பெயர்' : 'NAME',
            advance: isTa ? 'முன்பணம்' : 'ADVANCE',
            date: isTa ? 'தேதி' : 'DATE',
            fname: isTa ? 'பூ விபரம்' : 'F.NAME',
            qty: isTa ? 'எடை' : 'QTY',
            rate: isTa ? 'விலை' : 'RATE',
            amount: isTa ? 'தொகை' : 'AMOUNT',
            credit: isTa ? 'வரவு' : 'CREDIT',
            openingBal: isTa ? 'ஆரம்ப நிலுவை' : 'Opening Balance',
            totalRow: isTa ? 'மொத்தம் :' : 'Total :',
            totalAmt: isTa ? 'மொத்த தொகை :' : 'TOTAL AMOUNT :',
            creditAmt: isTa ? 'வரவு தொகை :' : 'CREDIT AMOUNT :',
            commAmt: isTa ? 'கமிஷன் தொகை :' : 'COMMISION AMOUNT :',
            amtToGive: isTa ? 'தர வேண்டிய தொகை :' : 'AMOUNT TO GIVE :',
            balDue: isTa ? 'நிலுவை தொகை :' : 'BALANCE DUE :'
        };

        const W = 750;
        const PAD = 30;
        const rowH = 32;
        const numRows = statementRows.length;
        const tableH = (numRows + 2) * rowH;
        const H = 220 + tableH + 160;

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(PAD, PAD, W - 2 * PAD, H - 2 * PAD);

        let y = PAD + 30;

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 20px Arial, "Noto Sans Tamil", "Latha", sans-serif';
        ctx.textAlign = 'center';
        const shopType = tenantData?.type || (isTa ? 'ஸ்ரீ வள்ளி பூ வியாபாரம்' : 'SRI VALLI FLOWER MERCHANT');
        ctx.fillText(shopType.toUpperCase(), W / 2, y);

        y += 22;
        ctx.font = 'bold 12px Arial, "Noto Sans Tamil", "Latha", sans-serif';
        const phoneLine = `CELL: ${tenantData?.phone1 || '9952535057'}     ${tenantData?.name || 'S.V.M'}     CELL: ${tenantData?.phone2 || '9443247771'}`;
        ctx.fillText(phoneLine, W / 2, y);

        y += 18;
        ctx.font = '12px Arial, "Noto Sans Tamil", "Latha", sans-serif';
        const addr = tenantData?.address || (isTa ? 'B-7, பூ மார்க்கெட், திண்டிவனம்.' : 'B-7, FLOWER MARKET, TINDIVANAM.');
        ctx.fillText(addr, W / 2, y);

        y += 16;
        ctx.beginPath();
        ctx.moveTo(PAD + 15, y);
        ctx.lineTo(W - PAD - 15, y);
        ctx.lineWidth = 1;
        ctx.stroke();

        y += 20;
        ctx.font = 'bold 13px Arial, "Noto Sans Tamil", "Latha", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${lbl.code} : ${previewData.farmerDisplayId || '---'}`, PAD + 20, y);
        ctx.textAlign = 'right';
        ctx.fillText(`${lbl.name} : ${farmerNameLoc}`, W - PAD - 20, y);

        y += 20;
        ctx.textAlign = 'left';
        ctx.fillText(`${lbl.advance} : ${(previewData.openingBalance || 0).toLocaleString('en-IN')}`, PAD + 20, y);

        y += 14;
        ctx.beginPath();
        ctx.moveTo(PAD + 15, y);
        ctx.lineTo(W - PAD - 15, y);
        ctx.stroke();

        y += 12;
        const tableX = PAD + 15;
        const tableW = W - 2 * PAD - 30;
        const cols = [
            { label: lbl.date, w: 100, align: 'left' },
            { label: lbl.fname, w: 190, align: 'left' },
            { label: lbl.qty, w: 90, align: 'right' },
            { label: lbl.rate, w: 70, align: 'right' },
            { label: lbl.amount, w: 110, align: 'right' },
            { label: lbl.credit, w: 100, align: 'right' },
        ];

        ctx.lineWidth = 1;
        ctx.strokeRect(tableX, y, tableW, rowH);

        let curX = tableX;
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px Arial, "Noto Sans Tamil", "Latha", sans-serif';
        cols.forEach(col => {
            ctx.strokeRect(curX, y, col.w, rowH);
            ctx.textAlign = col.align;
            const textX = col.align === 'left' ? curX + 8 : curX + col.w - 8;
            ctx.fillText(col.label, textX, y + 20);
            curX += col.w;
        });

        y += rowH;

        ctx.strokeRect(tableX, y, tableW, rowH);
        const col01W = cols[0].w + cols[1].w;
        ctx.strokeRect(tableX, y, col01W, rowH);
        ctx.font = '12px Arial, "Noto Sans Tamil", "Latha", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(lbl.openingBal, tableX + 8, y + 20);

        ctx.textAlign = 'right';
        curX = tableX + col01W;
        ctx.strokeRect(curX, y, cols[2].w, rowH);
        ctx.fillText('0', curX + cols[2].w - 8, y + 20);
        curX += cols[2].w;
        ctx.strokeRect(curX, y, cols[3].w, rowH);
        ctx.fillText('0.00', curX + cols[3].w - 8, y + 20);
        curX += cols[3].w;
        ctx.strokeRect(curX, y, cols[4].w, rowH);
        ctx.fillText((previewData.openingBalance || 0).toFixed(2), curX + cols[4].w - 8, y + 20);
        curX += cols[4].w;
        ctx.strokeRect(curX, y, cols[5].w, rowH);

        y += rowH;

        let totalQty = 0;
        statementRows.forEach(r => {
            if (r.qty) totalQty += r.qty;
            ctx.strokeRect(tableX, y, tableW, rowH);

            const rowValues = [
                r.displayDate,
                r.fName,
                r.qty !== null ? r.qty.toFixed(3) : '',
                r.rate !== null ? String(r.rate) : '',
                r.amount !== null ? r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
                r.credit !== null ? r.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
            ];

            curX = tableX;
            cols.forEach((col, cIdx) => {
                ctx.strokeRect(curX, y, col.w, rowH);
                ctx.textAlign = col.align;
                ctx.font = (cIdx === 1 ? 'bold ' : '') + '12px Arial, "Noto Sans Tamil", "Latha", sans-serif';
                const textX = col.align === 'left' ? curX + 8 : curX + col.w - 8;
                ctx.fillText(rowValues[cIdx], textX, y + 20);
                curX += col.w;
            });

            y += rowH;
        });

        ctx.lineWidth = 1.5;
        ctx.strokeRect(tableX, y, tableW, rowH);
        ctx.strokeRect(tableX, y, col01W, rowH);
        ctx.font = 'bold 12px Arial, "Noto Sans Tamil", "Latha", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(lbl.totalRow, tableX + 8, y + 20);

        curX = tableX + col01W;
        ctx.strokeRect(curX, y, cols[2].w, rowH);
        ctx.textAlign = 'right';
        ctx.fillText(totalQty.toFixed(3), curX + cols[2].w - 8, y + 20);
        curX += cols[2].w;
        ctx.strokeRect(curX, y, cols[3].w, rowH);
        curX += cols[3].w;
        const purTot = (previewData.purchaseTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        ctx.strokeRect(curX, y, cols[4].w, rowH);
        ctx.fillText(purTot, curX + cols[4].w - 8, y + 20);
        curX += cols[4].w;
        const cashTot = (previewData.cashPaidTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        ctx.strokeRect(curX, y, cols[5].w, rowH);
        ctx.fillText(cashTot, curX + cols[5].w - 8, y + 20);

        y += rowH + 24;

        const sumW = 300;
        const sumX = W - PAD - 15 - sumW;
        const sumRowH = 24;

        const purTotalStr = (previewData.purchaseTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const cashTotalStr = (previewData.cashPaidTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const commTotalStr = (previewData.commissionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const netBal = previewData.netBalance || 0;
        const netBalStr = Math.abs(netBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const finalBalHeader = netBal >= 0 ? lbl.amtToGive : lbl.balDue;

        ctx.font = 'bold 13px Arial, "Noto Sans Tamil", "Latha", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(lbl.totalAmt, sumX, y);
        ctx.textAlign = 'right';
        ctx.fillText(purTotalStr, sumX + sumW, y);

        y += sumRowH;
        ctx.textAlign = 'left';
        ctx.fillText(lbl.creditAmt, sumX, y);
        ctx.textAlign = 'right';
        ctx.fillText(cashTotalStr, sumX + sumW, y);

        y += sumRowH;
        ctx.textAlign = 'left';
        ctx.fillText(lbl.commAmt, sumX, y);
        ctx.textAlign = 'right';
        ctx.fillText(commTotalStr, sumX + sumW, y);

        y += 10;
        ctx.beginPath();
        ctx.moveTo(sumX, y);
        ctx.lineTo(sumX + sumW, y);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        y += 20;
        ctx.font = 'bold 15px Arial, "Noto Sans Tamil", "Latha", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(finalBalHeader, sumX, y);
        ctx.textAlign = 'right';
        ctx.fillText(netBalStr, sumX + sumW, y);

        return canvas;
    };

    useEffect(() => {
        let active = true;
        
        const load = async () => {
            if (farmers.length === 0 || selectedFarmerIds.length === 0) {
                setCalculations({});
                return;
            }
            setIsCalculating(true);
            try {
                const tenantId = getTenant();
                const newCalcs = {};

                // Fetch all tenant records once to avoid composite index requirements and N+1 queries
                const purchasesSnap = await getDocs(query(
                    collection(db, COLLECTIONS.F_PURCHASES),
                    where('tenantId', '==', tenantId)
                ));
                if (!active) return;
                const tenantPurchases = purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                const paymentsSnap = await getDocs(query(
                    collection(db, COLLECTIONS.F_PAYMENTS),
                    where('tenantId', '==', tenantId)
                ));
                if (!active) return;
                const tenantPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                const billClosingsSnap = await getDocs(query(
                    collection(db, COLLECTIONS.F_BILL_CLOSINGS),
                    where('tenantId', '==', tenantId)
                ));
                if (!active) return;
                const tenantBillClosings = billClosingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Default settings from Tenant Data
                const parseSetting = (val, def) => {
                    if (val === undefined || val === null || val === '') return def;
                    const num = parseFloat(val);
                    return isNaN(num) ? def : num;
                };

                const commShopPays = parseSetting(tenantData?.farmerCommShopPays, 10);
                const commFarmerPays = parseSetting(tenantData?.farmerCommFarmerPays, 15);
                const commThreshold = parseSetting(tenantData?.farmerCommThreshold, 70);
                const commAboveTh = parseSetting(tenantData?.farmerCommAboveThreshold, 10);
                const commBelowTh = parseSetting(tenantData?.farmerCommBelowThreshold, 15);

                for (const fid of selectedFarmerIds) {
                    const farmer = farmers.find(f => f.id === fid);
                    if (!farmer) continue;

                    // 1. Filter purchases for the period in-memory
                    const purchases = tenantPurchases.filter(p => p.farmerId === fid && p.date >= fromDate && p.date <= toDate);

                    // 2. Filter payments for the period in-memory
                    const payments = tenantPayments.filter(p => p.farmerId === fid && p.date >= fromDate && p.date <= toDate);

                    // 3. Opening balance calculation from prior locked closes in-memory
                    const prevCloses = tenantBillClosings.filter(c => c.farmerId === fid && c.toDate < fromDate);

                    let openingBalance = farmer.openingBalance || 0;
                    let lastCloseDate = '';

                    if (prevCloses.length > 0) {
                        prevCloses.sort((a, b) => b.toDate.localeCompare(a.toDate));
                        openingBalance = prevCloses[0].netBalance;
                        lastCloseDate = prevCloses[0].toDate;
                    }

                    // Adjust opening balance with historical purchases & payments after lastCloseDate and before fromDate
                    const histPurchasesSum = tenantPurchases
                        .filter(p => p.farmerId === fid && p.date > (lastCloseDate || '1970-01-01') && p.date < fromDate)
                        .reduce((sum, d) => sum + (d.totalAmount || 0), 0);

                    const histPaymentsSum = tenantPayments
                        .filter(p => p.farmerId === fid && p.date > (lastCloseDate || '1970-01-01') && p.date < fromDate)
                        .reduce((sum, d) => sum + (d.amount || 0), 0);

                    openingBalance = openingBalance + histPurchasesSum - histPaymentsSum;

                    // 4. Totals
                    const purchaseTotal = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
                    const cashPaidTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

                    // Check if there is an existing saved close for this date range exactly
                    const existingClose = tenantBillClosings.find(c => 
                        c.farmerId === fid && 
                        c.fromDate === fromDate && 
                        c.toDate === toDate
                    );

                    let commissionRate = 10;
                    let commissionAmount = 0;
                    let otherCharges = 0;
                    let netBalance = 0;
                    let flowDirection = 'Shop Pays Farmer';
                    let isSaved = false;
                    let savedBillId = null;

                    if (existingClose) {
                        commissionRate = existingClose.commissionRate;
                        commissionAmount = existingClose.commissionAmount;
                        otherCharges = existingClose.otherCharges;
                        netBalance = existingClose.netBalance;
                        isSaved = true;
                        savedBillId = existingClose.id;
                    } else {
                        // Calculate fresh in-memory values
                        const rawDiff = openingBalance + purchaseTotal - cashPaidTotal;
                        if (rawDiff < 0) {
                            flowDirection = 'Farmer Pays Shop';
                        }
                        if (cashPaidTotal > 0) {
                            const pct = (purchaseTotal / cashPaidTotal) * 100;
                            if (pct >= commThreshold) {
                                commissionRate = commAboveTh;
                            } else {
                                commissionRate = commBelowTh;
                            }
                        } else {
                            commissionRate = flowDirection === 'Farmer Pays Shop' ? commFarmerPays : commShopPays;
                        }
                        commissionAmount = parseFloat(((purchaseTotal * commissionRate) / 100).toFixed(2));
                        otherCharges = 0;
                        netBalance = openingBalance + purchaseTotal - cashPaidTotal - commissionAmount - otherCharges;
                    }

                    newCalcs[fid] = {
                        farmerId: fid,
                        farmerName: farmer.name,
                        farmerNameTa: farmer.nameTa || farmer.name,
                        farmerDisplayId: farmer.displayId || '—',
                        openingBalance,
                        purchaseTotal,
                        cashPaidTotal,
                        commissionRate: commissionRate.toString(),
                        commissionAmount,
                        otherCharges: otherCharges.toString(),
                        netBalance,
                        purchases,
                        payments,
                        flowDirection,
                        isSaved,
                        savedBillId,
                        isEditing: false
                    };
                }

                if (active) {
                    setCalculations(newCalcs);
                }
            } catch (error) {
                console.error("Calculation failed:", error);
                if (active) {
                    addToast('Failed to calculate statements.', 'error');
                }
            } finally {
                if (active) {
                    setIsCalculating(false);
                }
            }
        };

        load();

        return () => {
            active = false;
        };
    }, [fromDate, toDate, selectedFarmerIds, tenantData]);

    const deleteExistingBillCloseIfAny = async (tenantId, fid, fromDate, toDate) => {
        const qExist = query(
            collection(db, COLLECTIONS.F_BILL_CLOSINGS),
            where('tenantId', '==', tenantId),
            where('farmerId', '==', fid),
            where('toDate', '==', toDate)
        );
        const existSnap = await getDocs(qExist);
        for (const docObj of existSnap.docs) {
            const existData = docObj.data();
            const existDebit = (existData.commissionAmount || 0) + (existData.otherCharges || 0);
            
            // Delete corresponding ledger entry
            const ledgerSnap = await getDocs(query(
                collection(db, COLLECTIONS.F_LEDGERS),
                where('refId', '==', docObj.id)
            ));
            for (const lDoc of ledgerSnap.docs) {
                await deleteDoc(doc(db, COLLECTIONS.F_LEDGERS, lDoc.id));
            }
            
            // Revert farmer balance (add back the debited amount)
            await updateDoc(doc(db, COLLECTIONS.F_FARMERS, fid), {
                balance: increment(existDebit)
            });
            
            // Delete bill closing document
            await deleteDoc(doc(db, COLLECTIONS.F_BILL_CLOSINGS, docObj.id));
        }
    };

    const handleSaveBillClose = async () => {
        if (Object.keys(calculations).length === 0) return;
        if (!window.confirm(t('confirmSaveStatements') || 'Save statements for the selected period?')) return;

        setIsSaving(true);
        try {
            const tenantId = getTenant();
            for (const fid of Object.keys(calculations)) {
                const calc = calculations[fid];

                // Remove existing duplicates first
                await deleteExistingBillCloseIfAny(tenantId, fid, fromDate, toDate);

                // 1. Save Bill Closing Record
                const billDoc = {
                    tenantId,
                    farmerId: fid,
                    farmerName: calc.farmerName,
                    farmerDisplayId: calc.farmerDisplayId,
                    fromDate,
                    toDate,
                    openingBalance: calc.openingBalance,
                    purchaseTotal: calc.purchaseTotal,
                    cashPaidTotal: calc.cashPaidTotal,
                    commissionRate: parseFloat(calc.commissionRate || 0),
                    commissionAmount: calc.commissionAmount,
                    otherCharges: parseFloat(calc.otherCharges || 0),
                    netBalance: calc.netBalance,
                    timestamp: new Date().toISOString()
                };
                const savedDocRef = await addData(COLLECTIONS.F_BILL_CLOSINGS, billDoc);

                // 2. Write settlement transaction to Farmer Ledger
                const ledgerDoc = {
                    tenantId,
                    farmerId: fid,
                    date: toDate,
                    type: 'bill_close',
                    refId: savedDocRef.id,
                    description: `Bill Closing Statement (${fromDate} to ${toDate})`,
                    debit: calc.commissionAmount + parseFloat(calc.otherCharges || 0),
                    credit: 0,
                    commission: calc.commissionAmount,
                    balance: calc.netBalance
                };
                await addData(COLLECTIONS.F_LEDGERS, ledgerDoc);

                // 3. Update Farmer Running Balance in Master collection
                await updateDoc(doc(db, COLLECTIONS.F_FARMERS, fid), {
                    balance: calc.netBalance
                });
            }

            addToast(t('saveSuccess') || 'All bills saved successfully!');
            setCalculations({});
        } catch (error) {
            console.error("Saving statements failed:", error);
            addToast('Failed to save statement: ' + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSingleBillClose = async (fid) => {
        const calc = calculations[fid];
        if (!calc) return;
        if (!window.confirm(`Save closing statement for ${calc.farmerName}?`)) return;

        setIsSaving(true);
        try {
            const tenantId = getTenant();

            // Remove existing duplicates first
            await deleteExistingBillCloseIfAny(tenantId, fid, fromDate, toDate);

            // 1. Save Bill Closing Record
            const billDoc = {
                tenantId,
                farmerId: fid,
                farmerName: calc.farmerName,
                farmerDisplayId: calc.farmerDisplayId,
                fromDate,
                toDate,
                openingBalance: calc.openingBalance,
                purchaseTotal: calc.purchaseTotal,
                cashPaidTotal: calc.cashPaidTotal,
                commissionRate: parseFloat(calc.commissionRate || 0),
                commissionAmount: calc.commissionAmount,
                otherCharges: parseFloat(calc.otherCharges || 0),
                netBalance: calc.netBalance,
                timestamp: new Date().toISOString()
            };
            const savedDocRef = await addData(COLLECTIONS.F_BILL_CLOSINGS, billDoc);

            // 2. Write settlement transaction to Farmer Ledger
            const ledgerDoc = {
                tenantId,
                farmerId: fid,
                date: toDate,
                type: 'bill_close',
                refId: savedDocRef.id,
                description: `Bill Closing Statement (${fromDate} to ${toDate})`,
                debit: calc.commissionAmount + parseFloat(calc.otherCharges || 0),
                credit: 0,
                commission: calc.commissionAmount,
                balance: calc.netBalance
            };
            await addData(COLLECTIONS.F_LEDGERS, ledgerDoc);

            // 3. Update Farmer Running Balance in Master collection
            await updateDoc(doc(db, COLLECTIONS.F_FARMERS, fid), {
                balance: calc.netBalance
            });

            // 4. Update local state
            setCalculations(prev => ({
                ...prev,
                [fid]: {
                    ...prev[fid],
                    isSaved: true,
                    savedBillId: savedDocRef.id,
                    isEditing: false
                }
            }));

            addToast(`Statement for ${calc.farmerName} saved successfully!`);
        } catch (error) {
            console.error("Saving statement failed:", error);
            addToast('Failed to save statement: ' + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const [highlightedId, setHighlightedId] = useState(null);

    const handleUpdateSingleBillClose = async (fid) => {
        const calc = calculations[fid];
        if (!calc || !calc.savedBillId) return;

        setIsSaving(true);
        try {
            // 1. Update Bill Close Document in Firestore
            await updateDoc(doc(db, COLLECTIONS.F_BILL_CLOSINGS, calc.savedBillId), {
                commissionRate: parseFloat(calc.commissionRate || 0),
                commissionAmount: calc.commissionAmount,
                otherCharges: parseFloat(calc.otherCharges || 0),
                otherChargesNote: calc.otherChargesNote || '',
                netBalance: calc.netBalance,
                updatedAt: serverTimestamp()
            });

            // 2. Update Ledger document
            const ledgerSnap = await getDocs(query(
                collection(db, COLLECTIONS.F_LEDGERS),
                where('refId', '==', calc.savedBillId)
            ));
            if (!ledgerSnap.empty) {
                const ledgerDocId = ledgerSnap.docs[0].id;
                await updateDoc(doc(db, COLLECTIONS.F_LEDGERS, ledgerDocId), {
                    debit: calc.commissionAmount + parseFloat(calc.otherCharges || 0),
                    commission: calc.commissionAmount,
                    balance: calc.netBalance
                });
            }

            // 3. Update Farmer Running Balance in Master collection
            await updateDoc(doc(db, COLLECTIONS.F_FARMERS, fid), {
                balance: calc.netBalance
            });

            // 4. Update local state
            setCalculations(prev => ({
                ...prev,
                [fid]: {
                    ...prev[fid],
                    isSaved: true,
                    isEditing: false
                }
            }));

            setHighlightedId(fid);
            setTimeout(() => setHighlightedId(prev => prev === fid ? null : prev), 2500);

            addToast(`Statement for ${calc.farmerName} updated successfully!`);
        } catch (error) {
            console.error("Updating statement failed:", error);
            addToast('Failed to update statement: ' + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSingleBillClose = async (fid) => {
        const calc = calculations[fid];
        if (!calc || !calc.savedBillId) return;
        if (!window.confirm(`Delete the saved closing statement for ${calc.farmerName}? This will reverse the ledger settlement and restore the farmer's balance.`)) return;

        setIsSaving(true);
        try {
            const debitToReverse = calc.commissionAmount + parseFloat(calc.otherCharges || 0);

            // 1. Delete Ledger document
            const ledgerSnap = await getDocs(query(
                collection(db, COLLECTIONS.F_LEDGERS),
                where('refId', '==', calc.savedBillId)
            ));
            for (const docObj of ledgerSnap.docs) {
                await deleteDoc(doc(db, COLLECTIONS.F_LEDGERS, docObj.id));
            }

            // 2. Delete Bill Closing document
            await deleteDoc(doc(db, COLLECTIONS.F_BILL_CLOSINGS, calc.savedBillId));

            // 3. Revert Farmer Balance in Master (add back the debited amount)
            await updateDoc(doc(db, COLLECTIONS.F_FARMERS, fid), {
                balance: increment(debitToReverse)
            });

            // 4. Update local state (reset back to unsaved, recalculating values)
            setCalculations(prev => {
                const updated = { ...prev };
                updated[fid] = {
                    ...updated[fid],
                    isSaved: false,
                    savedBillId: null,
                    isEditing: false
                };
                return updated;
            });

            addToast(`Deleted statement for ${calc.farmerName} and reversed balance.`);
        } catch (error) {
            console.error("Deleting statement failed:", error);
            addToast('Failed to delete statement: ' + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscardUnsavedRow = (fid) => {
        const calc = calculations[fid];
        if (!calc) return;
        if (!window.confirm(t('confirmDiscardRow') || `Discard statement row for ${calc.farmerName}?`)) return;

        setCalculations(prev => {
            const copy = { ...prev };
            delete copy[fid];
            return copy;
        });
    };

    const handleViewStatementPreview = (fid) => {
        const calc = calculations[fid];
        if (!calc) return;

        const detailedItems = [];
        calc.purchases.forEach(p => {
            (p.items || []).forEach(item => {
                detailedItems.push({
                    date: p.date,
                    flowerName: item.flowerName,
                    flowerNameTa: item.flowerNameTa || item.nameTa,
                    weight: item.weight,
                    rate: item.rate,
                    amount: item.amount
                });
            });
        });

        const detailedPayments = calc.payments.map(pay => ({
            date: pay.date,
            description: pay.notes || 'Cash Payment',
            amount: pay.amount
        }));

        setPreviewData({
            ...calc,
            detailedItems,
            detailedPayments
        });
        setPreviewFarmerId(fid);
    };

    const buildStatementRows = (detailedItems = [], detailedPayments = []) => {
        const dateMap = {};

        detailedItems.forEach(item => {
            const d = item.date || '';
            if (!dateMap[d]) dateMap[d] = { purchases: [], payments: [] };
            dateMap[d].purchases.push(item);
        });

        detailedPayments.forEach(pay => {
            const d = pay.date || '';
            if (!dateMap[d]) dateMap[d] = { purchases: [], payments: [] };
            dateMap[d].payments.push(pay);
        });

        const sortedDates = Object.keys(dateMap).sort((a, b) => a.localeCompare(b));

        const rows = [];
        sortedDates.forEach(date => {
            const { purchases, payments } = dateMap[date];
            const maxLen = Math.max(purchases.length, payments.length);
            for (let i = 0; i < maxLen; i++) {
                const pur = purchases[i];
                const pay = payments[i];
                
                let fName = '';
                if (pur) {
                    fName = getLocalizedFlowerName(pur.flowerName, pur);
                } else if (pay) {
                    const desc = pay.description || 'Cash Payment';
                    if (lang === 'ta') {
                        fName = (desc === 'Cash Payment' || desc === 'CREDIT' || desc === 'Cash') ? 'பணம் வரவு' : desc;
                    } else {
                        fName = desc;
                    }
                }

                rows.push({
                    date,
                    displayDate: i === 0 ? (date ? date.split('-').reverse().join('/') : '---') : '',
                    fName,
                    qty: pur && pur.weight !== undefined && pur.weight !== null ? Number(pur.weight) : null,
                    rate: pur && pur.rate !== undefined && pur.rate !== null ? Number(pur.rate) : null,
                    amount: pur && pur.amount !== undefined && pur.amount !== null ? Number(pur.amount) : null,
                    credit: pay && pay.amount !== undefined && pay.amount !== null ? Number(pay.amount) : null,
                });
            }
        });

        return rows;
    };

    const handlePrintStatement = () => {
        if (!previewData) return;
        
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (!printWindow) {
            addToast('Popup blocker prevented printing. Please allow popups.', 'error');
            return;
        }

        const statementRows = buildStatementRows(previewData.detailedItems, previewData.detailedPayments);

        let rowsHtml = '';
        let totalQty = 0;

        statementRows.forEach(r => {
            if (r.qty) totalQty += r.qty;

            rowsHtml += `
                <tr>
                    <td style="padding: 3px 2px;">${r.displayDate}</td>
                    <td style="padding: 3px 2px; font-weight: bold;">${r.fName}</td>
                    <td style="padding: 3px 2px; text-align: right;">${r.qty !== null ? r.qty.toFixed(3) : ''}</td>
                    <td style="padding: 3px 2px; text-align: right;">${r.rate !== null ? r.rate : ''}</td>
                    <td style="padding: 3px 2px; text-align: right;">${r.amount !== null ? r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                    <td style="padding: 3px 2px; text-align: right;">${r.credit !== null ? r.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                </tr>
            `;
        });

        const purchaseTotal = previewData.purchaseTotal || 0;
        const cashPaidTotal = previewData.cashPaidTotal || 0;
        const commissionAmount = previewData.commissionAmount || 0;
        const netBalance = previewData.netBalance || 0;

        const isTa = lang === 'ta';
        const farmerNameLoc = getLocalizedFarmerName(previewData);
        const lbl = {
            code: isTa ? 'குறியீடு' : 'CODE',
            name: isTa ? 'பெயர்' : 'NAME',
            advance: isTa ? 'முன்பணம்' : 'ADVANCE',
            date: isTa ? 'தேதி' : 'DATE',
            fname: isTa ? 'பூ விபரம்' : 'F.NAME',
            qty: isTa ? 'எடை' : 'QTY',
            rate: isTa ? 'விலை' : 'RATE',
            amount: isTa ? 'தொகை' : 'AMOUNT',
            credit: isTa ? 'வரவு' : 'CREDIT',
            openingBal: isTa ? 'ஆரம்ப நிலுவை' : 'Opening Balance',
            totalRow: isTa ? 'மொத்தம் :' : 'Total :',
            totalAmt: isTa ? 'மொத்த தொகை :' : 'TOTAL AMOUNT :',
            creditAmt: isTa ? 'வரவு தொகை :' : 'CREDIT AMOUNT :',
            commAmt: isTa ? 'கமிஷன் தொகை :' : 'COMMISION AMOUNT :',
            amtToGive: isTa ? 'தர வேண்டிய தொகை :' : 'AMOUNT TO GIVE :',
            balDue: isTa ? 'நிலுவை தொகை :' : 'BALANCE DUE :'
        };

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Farmer Statement - #${previewData.farmerDisplayId}</title>
                    <meta charset="utf-8" />
                    <style>
                        @page {
                            margin: 8mm;
                            size: auto;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0 auto;
                            padding: 15px;
                            width: 550px;
                            color: #000;
                            background: #fff;
                            font-size: 13px;
                            box-sizing: border-box;
                        }
                        .bill-box {
                            border: 1.5px solid #000;
                            padding: 15px;
                            background: #fff;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 12px;
                            line-height: 1.4;
                        }
                        .header .title {
                            font-size: 16px;
                            font-weight: bold;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                        }
                        .header .subtitle {
                            font-size: 11px;
                            font-weight: bold;
                        }
                        .header .address {
                            font-size: 11px;
                        }
                        .info-block {
                            margin-top: 10px;
                            margin-bottom: 12px;
                            font-size: 12px;
                            font-weight: bold;
                            border-top: 1px solid #000;
                            border-bottom: 1px solid #000;
                            padding: 6px 0;
                            line-height: 1.5;
                        }
                        .info-row {
                            display: flex;
                            justify-content: space-between;
                        }
                        table.bill-table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 12px;
                            margin-bottom: 14px;
                        }
                        table.bill-table th, table.bill-table td {
                            border: 1px solid #000;
                            padding: 5px 6px;
                        }
                        table.bill-table th {
                            font-weight: bold;
                            background: #fff;
                        }
                        table.bill-table tr.total-row td {
                            font-weight: bold;
                            border-top: 2px solid #000;
                            border-bottom: 2px solid #000;
                        }
                        .summary-box {
                            margin-top: 12px;
                            font-size: 12px;
                            font-weight: bold;
                            line-height: 1.8;
                            width: 100%;
                            display: flex;
                            flex-direction: column;
                            align-items: flex-end;
                        }
                        .summary-inner {
                            width: 280px;
                        }
                        .summary-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 2px 0;
                        }
                        .summary-row.balance {
                            border-top: 1.5px solid #000;
                            margin-top: 6px;
                            padding-top: 6px;
                            font-size: 14px;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="bill-box">
                        <div class="header">
                            <div class="title">${tenantData?.type || 'SRI VALLI FLOWER MERCHANT'}</div>
                            <div class="subtitle">CELL: ${tenantData?.phone1 || '9952535057'}&nbsp;&nbsp;&nbsp;&nbsp;<b>${tenantData?.name || 'S.V.M'}</b>&nbsp;&nbsp;&nbsp;&nbsp;CELL: ${tenantData?.phone2 || '9443247771'}</div>
                            <div class="address">${tenantData?.address || 'B-7, FLOWER MARKET, TINDIVANAM.'}</div>
                            
                            <div class="info-block">
                                <div class="info-row">
                                    <span>${lbl.code} : ${previewData.farmerDisplayId}</span>
                                    <span>${lbl.name} : ${farmerNameLoc}</span>
                                </div>
                                <div class="info-row">
                                    <span>${lbl.advance} : ${(previewData.openingBalance || 0).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>

                        <table class="bill-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left;">${lbl.date}</th>
                                    <th style="text-align: left;">${lbl.fname}</th>
                                    <th style="text-align: right;">${lbl.qty}</th>
                                    <th style="text-align: right;">${lbl.rate}</th>
                                    <th style="text-align: right;">${lbl.amount}</th>
                                    <th style="text-align: right;">${lbl.credit}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colspan="2">${lbl.openingBal}</td>
                                    <td style="text-align: right;">0</td>
                                    <td style="text-align: right;">0.00</td>
                                    <td style="text-align: right;">${(previewData.openingBalance || 0).toFixed(2)}</td>
                                    <td></td>
                                </tr>
                                ${rowsHtml}
                                <tr class="total-row">
                                    <td colspan="2"><b>${lbl.totalRow}</b></td>
                                    <td style="text-align: right;"><b>${totalQty.toFixed(3)}</b></td>
                                    <td></td>
                                    <td style="text-align: right;"><b>${purchaseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td>
                                    <td style="text-align: right;"><b>${cashPaidTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td>
                                </tr>
                            </tbody>
                        </table>

                        <div class="summary-box">
                            <div class="summary-inner">
                                <div class="summary-row">
                                    <span>${lbl.totalAmt}</span>
                                    <span>${purchaseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div class="summary-row">
                                    <span>${lbl.creditAmt}</span>
                                    <span>${cashPaidTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div class="summary-row">
                                    <span>${lbl.commAmt}</span>
                                    <span>${commissionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div class="summary-row balance">
                                    <span>${netBalance >= 0 ? lbl.amtToGive : lbl.balDue}</span>
                                    <span>${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handlePDFDownload = () => {
        if (!previewData) return;
        try {
            const statementRows = buildStatementRows(previewData.detailedItems, previewData.detailedPayments);
            const canvas = generateFarmerStatementCanvas(previewData, tenantData, statementRows, lang);
            
            const imgData = canvas.toDataURL('image/png');
            const doc = new jsPDF('p', 'mm', 'a4');
            
            const pdfWidth = 190;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            doc.addImage(imgData, 'PNG', 10, 10, pdfWidth, pdfHeight);
            doc.save(`Farmer_Statement_${(previewData.farmerName || 'Farmer').replace(/\s+/g, '_')}.pdf`);
            addToast('PDF downloaded successfully!');
        } catch (error) {
            console.error("PDF generation failed:", error);
            addToast('Failed to generate PDF: ' + error.message, 'error');
        }
    };

    const handleWhatsAppShare = () => {
        if (!previewData) return;
        const farmerObj = farmers.find(f => f.id === previewData.farmerId);
        if (!farmerObj || !farmerObj.contact) {
            addToast('Farmer contact number missing.', 'error');
            return;
        }

        const isTa = lang === 'ta';
        const farmerNameLoc = getLocalizedFarmerName(previewData);
        const balLabel = (previewData.netBalance || 0) >= 0 
            ? (isTa ? 'தர வேண்டிய தொகை' : 'Amount To Give') 
            : (isTa ? 'நிலுவை தொகை' : 'Balance Due');

        const formattedMsg = isTa ? `*விவசாயி கணக்கு அறிக்கை*
*கடை:* ${tenantData?.name || 'SVM Flowers'}
*விவசாயி:* ${farmerNameLoc} (${previewData.farmerDisplayId})
*காலம்:* ${fromDate.split('-').reverse().join('/')} முதல் ${toDate.split('-').reverse().join('/')}
----------------------------------
*ஆரம்ப நிலுவை:* ₹${previewData.openingBalance.toFixed(0)}
*மொத்த தொகை:* ₹${previewData.purchaseTotal.toFixed(2)}
*வரவு தொகை:* ₹${previewData.cashPaidTotal.toFixed(2)}
*கமிஷன்:* ₹${previewData.commissionAmount.toFixed(2)}
----------------------------------
*${balLabel}:* ₹${Math.abs(previewData.netBalance).toFixed(2)}
நன்றி!`
: `*FARMER STATEMENT*
*Shop:* ${tenantData?.name || 'SVM Flowers'}
*Farmer:* ${farmerNameLoc} (${previewData.farmerDisplayId})
*Period:* ${fromDate.split('-').reverse().join('/')} to ${toDate.split('-').reverse().join('/')}
----------------------------------
*Opening Bal:* ₹${previewData.openingBalance.toFixed(0)}
*Total Amount:* ₹${previewData.purchaseTotal.toFixed(2)}
*Credit Amount:* ₹${previewData.cashPaidTotal.toFixed(2)}
*Commission:* ₹${previewData.commissionAmount.toFixed(2)}
----------------------------------
*${balLabel}:* ₹${Math.abs(previewData.netBalance).toFixed(2)}
Thank you!`;

        const whatsappNumber = farmerObj.contact.length === 10 ? '91' + farmerObj.contact : farmerObj.contact;
        window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(formattedMsg)}`, '_blank');
        addToast('WhatsApp shared!');
    };

    const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return dateStr.split('-').reverse().join('/');
    };

    return (
        <div style={S.page}>
            {/* Toasts */}
            <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2">
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        className={`px-6 py-4 rounded-xl shadow-lg text-white font-bold text-sm transform transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
                            t.type === 'error' ? 'bg-red-500' : 'bg-green-500'
                        }`}
                    >
                        {t.message}
                    </div>
                ))}
            </div>

            {/* Print specific style overrides */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-area, .print-area * {
                        visibility: visible;
                    }
                    .print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            {/* ── Title Header ── */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <span style={{ fontSize: '22px' }}>📄</span>
                    <h2 style={S.title}>{t('farmerBillClose')}</h2>
                </div>
            </div>

            {/* ── Filter Reconcile Bar (Clone layout style from Outside Shop > Vendor) ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#fff7ed', padding: '16px 20px', borderRadius: '16px', border: '1px solid #fed7aa', marginBottom: '24px', flexWrap: 'wrap' }}>
                {/* From Date */}
                <div style={{ width: '190px' }}>
                    <label style={LABEL_S}>From Date</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Calendar size={14} style={{ position: 'absolute', left: '10px', color: '#ea580c' }} />
                        <input 
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            style={{ ...INPUT_S, paddingLeft: '32px' }}
                        />
                    </div>
                </div>

                {/* To Date */}
                <div style={{ width: '190px' }}>
                    <label style={LABEL_S}>To Date</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Calendar size={14} style={{ position: 'absolute', left: '10px', color: '#ea580c' }} />
                        <input 
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            style={{ ...INPUT_S, paddingLeft: '32px' }}
                        />
                    </div>
                </div>

                {/* Commission Filter */}
                <div style={{ width: '190px' }}>
                    <label style={LABEL_S}>{t('commType')}</label>
                    <select 
                        value={commTypeFilter} 
                        onChange={(e) => setCommTypeFilter(e.target.value)}
                        style={INPUT_S}
                    >
                        <option value="all">{t('all')}</option>
                        <option value="10% Flat">{t('tenPercentFlat')}</option>
                        <option value="15% Flat">{t('fifteenPercentFlat')}</option>
                        <option value="No Commission">{t('noCommission')}</option>
                    </select>
                </div>

                {/* Farmer Selection Dropdown */}
                <div style={{ width: '220px' }}>
                    <label style={LABEL_S}>{t('farmerName')}</label>
                    <select 
                        value={dropdownFarmerId} 
                        onChange={(e) => setDropdownFarmerId(e.target.value)}
                        style={INPUT_S}
                    >
                        <option value="all">
                            {t('allFarmers')}
                        </option>
                        {filteredFarmersForDropdown.map(f => (
                            <option key={f.id} value={f.id}>{f.name} (#{f.displayId})</option>
                        ))}
                    </select>
                </div>

                {/* Action Buttons */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {isCalculating && (
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#ea580c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="animate-spin" style={{ display: 'inline-block' }}>⏳</span> Calculating...
                        </span>
                    )}
                    {/* Global Save Button Removed */}
                </div>
            </div>

            {/* ── Statements Report Card ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', padding: '24px 16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#374151', margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('statement') || 'Statement'}
                </h3>
                
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ ...TH_S, whiteSpace: 'nowrap' }}>{t('farmerId') || 'Farmer ID'}</th>
                                <th style={{ ...TH_S, whiteSpace: 'nowrap' }}>{t('farmerName') || 'Farmer Name'}</th>
                                <th style={{ ...TH_S, textAlign: 'right', whiteSpace: 'nowrap' }}>Opening Bal</th>
                                <th style={{ ...TH_S, textAlign: 'right', whiteSpace: 'nowrap' }}>Purchases</th>
                                <th style={{ ...TH_S, textAlign: 'right', whiteSpace: 'nowrap' }}>Cash Paid</th>
                                <th style={{ ...TH_S, textAlign: 'center', whiteSpace: 'nowrap' }}>Comm %</th>
                                <th style={{ ...TH_S, textAlign: 'right', whiteSpace: 'nowrap' }}>{t('commission') || 'Commission'}</th>
                                <th style={{ ...TH_S, textAlign: 'right', whiteSpace: 'nowrap' }}>Other Charges</th>
                                <th style={{ ...TH_S, textAlign: 'right', whiteSpace: 'nowrap' }}>Closing Bal</th>
                                <th style={{ ...TH_S, textAlign: 'center', whiteSpace: 'nowrap' }}>{t('actions') || 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(calculations).length === 0 ? (
                                <tr>
                                    <td colSpan={10} style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
                                        {isCalculating ? 'Calculating statements...' : 'No statements found for the selected criteria.'}
                                    </td>
                                </tr>
                            ) : (
                                Object.keys(calculations).map((fid, idx) => {
                                    const calc = calculations[fid];
                                    return (
                                        <tr key={fid} style={{ background: fid === highlightedId ? '#fef08a' : (idx % 2 === 0 ? '#fff' : '#fafafa'), transition: 'background-color 0.5s ease' }}>
                                            <td style={{ ...TD_S, fontWeight: 700, color: '#ea580c', whiteSpace: 'nowrap' }}>
                                                #{calc.farmerDisplayId}
                                            </td>
                                            <td style={{ ...TD_S, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                {getLocalizedFarmerName(calc)}
                                            </td>
                                            <td style={{ ...TD_S, textAlign: 'right', fontWeight: 600, color: '#64748b' }}>{fmt(calc.openingBalance)}</td>
                                            <td style={{ ...TD_S, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmt(calc.purchaseTotal)}</td>
                                            <td style={{ ...TD_S, textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{fmt(calc.cashPaidTotal)}</td>
                                            <td style={{ ...TD_S, textAlign: 'center' }}>
                                                <input 
                                                    type="number" 
                                                    value={calc.commissionRate}
                                                    disabled={calc.isSaved && !calc.isEditing}
                                                    onChange={(e) => {
                                                        const valStr = e.target.value;
                                                        const newRate = parseFloat(valStr || 0);
                                                        const commAmt = parseFloat(((calc.purchaseTotal * newRate) / 100).toFixed(2));
                                                        setCalculations(prev => {
                                                            const currentCalc = prev[fid] || calc;
                                                            const net = currentCalc.openingBalance + currentCalc.purchaseTotal - currentCalc.cashPaidTotal - commAmt - parseFloat(currentCalc.otherCharges || 0);
                                                            return {
                                                                ...prev,
                                                                [fid]: {
                                                                    ...currentCalc,
                                                                    commissionRate: valStr,
                                                                    commissionAmount: commAmt,
                                                                    netBalance: net
                                                                }
                                                            };
                                                        });
                                                    }}
                                                    style={{ 
                                                        width: '56px', padding: '5px 8px', borderRadius: '6px', 
                                                        border: '1.5px solid #e2e8f0', fontSize: '13px', fontWeight: 600, 
                                                        textAlign: 'center', outline: 'none',
                                                        background: (calc.isSaved && !calc.isEditing) ? '#f1f5f9' : '#fff',
                                                        color: (calc.isSaved && !calc.isEditing) ? '#64748b' : '#1e293b',
                                                        cursor: (calc.isSaved && !calc.isEditing) ? 'not-allowed' : 'text'
                                                    }}
                                                />
                                            </td>
                                            <td style={{ ...TD_S, textAlign: 'right', fontWeight: 700, color: '#64748b' }}>
                                                {fmt(calc.commissionAmount)}
                                            </td>
                                            <td style={{ ...TD_S, textAlign: 'right' }}>
                                                <input 
                                                    type="number" 
                                                    value={calc.otherCharges}
                                                    disabled={calc.isSaved && !calc.isEditing}
                                                    onChange={(e) => {
                                                        const valStr = e.target.value;
                                                        const charges = parseFloat(valStr || 0);
                                                        setCalculations(prev => {
                                                            const currentCalc = prev[fid] || calc;
                                                            const net = currentCalc.openingBalance + currentCalc.purchaseTotal - currentCalc.cashPaidTotal - currentCalc.commissionAmount - charges;
                                                            return {
                                                                ...prev,
                                                                [fid]: {
                                                                    ...currentCalc,
                                                                    otherCharges: valStr,
                                                                    netBalance: net
                                                                }
                                                            };
                                                        });
                                                    }}
                                                    style={{ 
                                                        width: '70px', padding: '5px 8px', borderRadius: '6px', 
                                                        border: '1.5px solid #e2e8f0', fontSize: '13px', fontWeight: 600, 
                                                        textAlign: 'right', outline: 'none',
                                                        background: (calc.isSaved && !calc.isEditing) ? '#f1f5f9' : '#fff',
                                                        color: (calc.isSaved && !calc.isEditing) ? '#64748b' : '#1e293b',
                                                        cursor: (calc.isSaved && !calc.isEditing) ? 'not-allowed' : 'text'
                                                    }}
                                                />
                                            </td>
                                            <td style={{ ...TD_S, textAlign: 'right', fontWeight: 800, color: calc.netBalance < 0 ? '#ef4444' : '#ea580c', fontSize: '15px' }}>{fmt(calc.netBalance)}</td>
                                            <td style={{ ...TD_S, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                                    {/* Preview Button */}
                                                    <button 
                                                        onClick={() => handleViewStatementPreview(fid)}
                                                        title="Preview Statement"
                                                        style={{ 
                                                            width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                                                            background: '#fff7ed', color: '#ea580c', display: 'inline-flex',
                                                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = '#fff'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff7ed'; e.currentTarget.style.color = '#ea580c'; }}
                                                    >
                                                        <Eye size={14} />
                                                    </button>

                                                    {/* Save / Edit / Update Button */}
                                                    {calc.isSaved ? (
                                                        calc.isEditing ? (
                                                            <button 
                                                                onClick={() => handleUpdateSingleBillClose(fid)}
                                                                title="Save Changes"
                                                                style={{ 
                                                                    width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                                                                    background: '#ecfdf5', color: '#10b981', display: 'inline-flex',
                                                                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.color = '#10b981'; }}
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                        ) : (
                                                            isEditDeleteAllowed() && (
                                                                <button 
                                                                    onClick={() => {
                                                                        setCalculations(prev => ({
                                                                            ...prev,
                                                                            [fid]: { ...prev[fid], isEditing: true }
                                                                        }));
                                                                    }}
                                                                    title="Edit Statement"
                                                                    style={{ 
                                                                        width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                                                                        background: '#eff6ff', color: '#3b82f6', display: 'inline-flex',
                                                                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                                                    }}
                                                                    onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
                                                                    onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#3b82f6'; }}
                                                                >
                                                                    <Edit size={14} />
                                                                </button>
                                                            )
                                                        )
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleSaveSingleBillClose(fid)}
                                                            title="Save Statement"
                                                            style={{ 
                                                                width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                                                                background: '#ecfdf5', color: '#10b981', display: 'inline-flex',
                                                                alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.color = '#10b981'; }}
                                                        >
                                                            <Save size={14} />
                                                        </button>
                                                    )}

                                                    {/* Delete / Discard Button */}
                                                    {(!calc.isSaved || isEditDeleteAllowed()) && (
                                                        <button 
                                                            onClick={() => calc.isSaved ? handleDeleteSingleBillClose(fid) : handleDiscardUnsavedRow(fid)}
                                                            title={calc.isSaved ? "Delete Saved Statement" : "Discard Row"}
                                                            style={{ 
                                                                width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                                                                background: '#fef2f2', color: '#ef4444', display: 'inline-flex',
                                                                alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Preview Dialog Statement Modal ── */}
            {previewData && (() => {
                const isTa = lang === 'ta';
                const farmerNameLoc = getLocalizedFarmerName(previewData);
                const lbl = {
                    code: isTa ? 'குறியீடு' : 'CODE',
                    name: isTa ? 'பெயர்' : 'NAME',
                    advance: isTa ? 'முன்பணம்' : 'ADVANCE',
                    date: isTa ? 'தேதி' : 'DATE',
                    fname: isTa ? 'பூ விபரம்' : 'F.NAME',
                    qty: isTa ? 'எடை' : 'QTY',
                    rate: isTa ? 'விலை' : 'RATE',
                    amount: isTa ? 'தொகை' : 'AMOUNT',
                    credit: isTa ? 'வரவு' : 'CREDIT',
                    openingBal: isTa ? 'ஆரம்ப நிலுவை' : 'Opening Balance',
                    totalRow: isTa ? 'மொத்தம் :' : 'Total :',
                    totalAmt: isTa ? 'மொத்த தொகை :' : 'TOTAL AMOUNT :',
                    creditAmt: isTa ? 'வரவு தொகை :' : 'CREDIT AMOUNT :',
                    commAmt: isTa ? 'கமிஷன் தொகை :' : 'COMMISION AMOUNT :',
                    amtToGive: isTa ? 'தர வேண்டிய தொகை :' : 'AMOUNT TO GIVE :',
                    balDue: isTa ? 'நிலுவை தொகை :' : 'BALANCE DUE :',
                    headerTitle: isTa ? 'விவசாயி கணக்கு அறிக்கை' : 'Farmer Statement Preview'
                };
                return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyArea: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }} className="no-print">
                        <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '840px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', boxSizing: 'border-box' }}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', flexShrink: 0, boxSizing: 'border-box' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    📋 {lbl.headerTitle}
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button 
                                        onClick={handleWhatsAppShare}
                                        style={{
                                            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', color: '#16a34a', cursor: 'pointer', transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                                    >
                                        <WhatsAppIcon size={16} />
                                    </button>
                                    <button 
                                        onClick={handlePDFDownload}
                                        style={{
                                            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', color: '#2563eb', cursor: 'pointer', transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                                    >
                                        <Download size={16} />
                                    </button>
                                    <button 
                                        onClick={handlePrintStatement}
                                        style={{
                                            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                                    >
                                        <FileText size={16} />
                                    </button>
                                    <button 
                                        onClick={() => setPreviewData(null)}
                                        style={{
                                            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            borderRadius: '50%', border: '1px solid #cbd5e1', background: '#fff', color: '#94a3b8', cursor: 'pointer', marginLeft: '12px', transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.color = '#475569'; }}
                                        onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Statement content */}
                            <div className="print-area" style={{ padding: '24px', overflowY: 'auto', flex: 1, fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#000', boxSizing: 'border-box', width: '100%', background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                                <div style={{ background: '#fff', border: '1.5px solid #000', width: '100%', maxWidth: '650px', padding: '24px', boxSizing: 'border-box', height: 'fit-content' }}>
                                    {/* Letterhead */}
                                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                        <h2 style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', color: '#000', margin: '0 0 4px 0', letterSpacing: '0.04em' }}>{tenantData?.type || 'SRI VALLI FLOWER MERCHANT'}</h2>
                                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#000', margin: '0 0 4px 0' }}>
                                            CELL: {tenantData?.phone1 || '9952535057'} &nbsp;&nbsp;&nbsp;&nbsp; <strong style={{ fontSize: '13px' }}>{tenantData?.name || 'S.V.M'}</strong> &nbsp;&nbsp;&nbsp;&nbsp; CELL: {tenantData?.phone2 || '9443247771'}
                                        </p>
                                        <p style={{ fontSize: '11px', color: '#000', margin: 0 }}>{tenantData?.address || 'B-7, FLOWER MARKET, TINDIVANAM.'}</p>

                                        <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '6px 0', margin: '14px 0', fontSize: '12px', fontWeight: 700 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{lbl.code} : {previewData.farmerDisplayId}</span>
                                                <span>{lbl.name} : {farmerNameLoc}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                                <span>{lbl.advance} : {(previewData.openingBalance || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed transaction entries */}
                                    <div style={{ overflowX: 'auto' }}>
                                        {(() => {
                                            const modalRows = buildStatementRows(previewData.detailedItems, previewData.detailedPayments);
                                            let totalQty = 0;
                                            modalRows.forEach(r => { if (r.qty) totalQty += r.qty; });
                                            return (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#000' }}>
                                                    <thead>
                                                        <tr style={{ background: '#fff' }}>
                                                            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>{lbl.date}</th>
                                                            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', fontWeight: 800 }}>{lbl.fname}</th>
                                                            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>{lbl.qty}</th>
                                                            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>{lbl.rate}</th>
                                                            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>{lbl.amount}</th>
                                                            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>{lbl.credit}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            <td colSpan={2} style={{ border: '1px solid #000', padding: '6px 8px' }}>{lbl.openingBal}</td>
                                                            <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>0</td>
                                                            <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>0.00</td>
                                                            <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{(previewData.openingBalance || 0).toFixed(2)}</td>
                                                            <td style={{ border: '1px solid #000', padding: '6px 8px' }}></td>
                                                        </tr>
                                                        {modalRows.map((r, index) => (
                                                            <tr key={index}>
                                                                <td style={{ border: '1px solid #000', padding: '6px 8px' }}>{r.displayDate}</td>
                                                                <td style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700 }}>{r.fName}</td>
                                                                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{r.qty !== null ? r.qty.toFixed(3) : ''}</td>
                                                                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{r.rate !== null ? r.rate : ''}</td>
                                                                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{r.amount !== null ? r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                                                                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{r.credit !== null ? r.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                                                            </tr>
                                                        ))}
                                                        <tr style={{ fontWeight: 800, background: '#fff' }}>
                                                            <td colSpan={2} style={{ border: '1px solid #000', borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '7px 8px' }}>{lbl.totalRow}</td>
                                                            <td style={{ border: '1px solid #000', borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '7px 8px', textAlign: 'right' }}>{totalQty.toFixed(3)}</td>
                                                            <td style={{ border: '1px solid #000', borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '7px 8px' }}></td>
                                                            <td style={{ border: '1px solid #000', borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '7px 8px', textAlign: 'right' }}>{(previewData.purchaseTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td style={{ border: '1px solid #000', borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '7px 8px', textAlign: 'right' }}>{(previewData.cashPaidTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            );
                                        })()}
                                    </div>

                                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '13px', fontWeight: 700 }}>
                                        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{lbl.totalAmt}</span>
                                                <span>{(previewData.purchaseTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{lbl.creditAmt}</span>
                                                <span>{(previewData.cashPaidTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{lbl.commAmt}</span>
                                                <span>{(previewData.commissionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div style={{ borderTop: '1.5px solid #000', marginTop: '4px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800 }}>
                                                <span>{(previewData.netBalance || 0) >= 0 ? lbl.amtToGive : lbl.balDue}</span>
                                                <span>{Math.abs(previewData.netBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#fafafa', display: 'flex', justifyContent: 'flex-end', flexShrink: 0, boxSizing: 'border-box', width: '100%' }}>
                                <button 
                                    onClick={() => setPreviewData(null)}
                                    style={{
                                        padding: '10px 24px', background: '#ea580c', color: '#fff', borderRadius: '100px',
                                        fontWeight: 800, fontSize: '13px', border: 'none', textTransform: 'uppercase',
                                        letterSpacing: '0.05em', cursor: 'pointer', transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c2410c'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ea580c'}
                                >
                                    {t('close') || 'Close Preview'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default FarmerBillClose;
