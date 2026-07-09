import React, { useState, useEffect, useContext } from 'react';
import { Calendar, User, FileText, Download, MessageCircle, Lock, Unlock, Eye, Sparkles, X, Save, Trash2, Edit, Check } from 'lucide-react';
import { subscribeToCollection, saveFBillClosing, saveFLedger, COLLECTIONS, db, addData } from '../utils/storage';
import { useTenant } from '../utils/TenantContext';
import { collection, query, where, getDocs, doc, updateDoc, increment, addDoc, deleteDoc } from 'firebase/firestore';
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
    const { t } = useContext(LangContext);
    const [farmers, setFarmers] = useState([]);
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

    // Load farmers list
    useEffect(() => {
        const unsubscribe = subscribeToCollection(COLLECTIONS.F_FARMERS, setFarmers);
        return () => unsubscribe();
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

    useEffect(() => {
        let active = true;
        
        const load = async () => {
            if (farmers.length === 0 || selectedFarmerIds.length === 0) {
                setCalculations({});
                return;
            }
            setIsCalculating(true);
            try {
                const tenantId = sessionStorage.getItem('fm_tenantId') || 'default';
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
            const tenantId = sessionStorage.getItem('fm_tenantId') || 'default';
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
            const tenantId = sessionStorage.getItem('fm_tenantId') || 'default';

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

    const handleUpdateSingleBillClose = async (fid) => {
        const calc = calculations[fid];
        if (!calc || !calc.savedBillId) return;
        if (!window.confirm(`Save changes for ${calc.farmerName}?`)) return;

        setIsSaving(true);
        try {
            const tenantId = sessionStorage.getItem('fm_tenantId') || 'default';
            const closeDocRef = doc(db, COLLECTIONS.F_BILL_CLOSINGS, calc.savedBillId);

            // 1. Update Bill Closing document
            await updateDoc(closeDocRef, {
                commissionRate: parseFloat(calc.commissionRate || 0),
                commissionAmount: calc.commissionAmount,
                otherCharges: parseFloat(calc.otherCharges || 0),
                netBalance: calc.netBalance
            });

            // 2. Find and update corresponding Ledger Entry
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

    const handlePrintStatement = () => {
        if (!previewData) return;
        
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (!printWindow) {
            addToast('Popup blocker prevented printing. Please allow popups.', 'error');
            return;
        }

        const formattedFrom = fromDate.split('-').reverse().join('/');
        const formattedTo = toDate.split('-').reverse().join('/');
        const generatedDate = new Date().toLocaleDateString('en-IN');

        let rowsHtml = '';
        
        // Opening balance row
        rowsHtml += `
            <tr style="border-bottom: 1px solid #000; background: #fafafa;">
                <td style="padding: 10px 12px; color: #777;">---</td>
                <td style="padding: 10px 12px; font-weight: bold;">Opening Balance</td>
                <td style="padding: 10px 12px; text-align: right; color: #777;">---</td>
                <td style="padding: 10px 12px; text-align: right; color: #777;">---</td>
                <td style="padding: 10px 12px; text-align: right; color: #777;">---</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: bold;">₹${previewData.openingBalance.toLocaleString('en-IN')}</td>
            </tr>
        `;

        // Purchase items
        previewData.detailedItems.forEach(item => {
            rowsHtml += `
                <tr style="border-bottom: 1px solid #000;">
                    <td style="padding: 10px 12px;">${item.date.split('-').reverse().join('/')}</td>
                    <td style="padding: 10px 12px; font-weight: 600;">${item.flowerName}</td>
                    <td style="padding: 10px 12px; text-align: right;">${item.weight} KG</td>
                    <td style="padding: 10px 12px; text-align: right;">₹${item.rate}</td>
                    <td style="padding: 10px 12px; text-align: right; color: #777;">---</td>
                    <td style="padding: 10px 12px; text-align: right; color: #16a34a; font-weight: bold;">₹${item.amount.toLocaleString('en-IN')}</td>
                </tr>
            `;
        });

        // Payments
        previewData.detailedPayments.forEach(pay => {
            rowsHtml += `
                <tr style="border-bottom: 1px solid #000;">
                    <td style="padding: 10px 12px;">${pay.date.split('-').reverse().join('/')}</td>
                    <td style="padding: 10px 12px; font-weight: 600;">${pay.description}</td>
                    <td style="padding: 10px 12px; text-align: right; color: #777;">---</td>
                    <td style="padding: 10px 12px; text-align: right; color: #777;">---</td>
                    <td style="padding: 10px 12px; text-align: right; color: #ef4444; font-weight: bold;">₹${pay.amount.toLocaleString('en-IN')}</td>
                    <td style="padding: 10px 12px; text-align: right; color: #777;">---</td>
                </tr>
            `;
        });

        // Commission Summary Row
        if (previewData.commissionAmount > 0) {
            rowsHtml += `
                <tr style="background: #fff1f2; border-bottom: 1px solid #000;">
                    <td colspan="4" style="padding: 10px 12px; text-align: right; font-weight: bold; color: #b91c1c;">Less: Commission (${previewData.commissionRate}%)</td>
                    <td style="padding: 10px 12px; text-align: right; color: #ef4444; font-weight: bold;">₹${previewData.commissionAmount.toLocaleString('en-IN')}</td>
                    <td style="padding: 10px 12px; text-align: right; color: #777;">---</td>
                </tr>
            `;
        }

        // Other Charges Summary Row
        if (previewData.otherCharges > 0) {
            rowsHtml += `
                <tr style="background: #fff1f2; border-bottom: 1px solid #000;">
                    <td colspan="4" style="padding: 10px 12px; text-align: right; font-weight: bold; color: #b91c1c;">Less: Other Charges</td>
                    <td style="padding: 10px 12px; text-align: right; color: #ef4444; font-weight: bold;">₹${parseFloat(previewData.otherCharges).toLocaleString('en-IN')}</td>
                    <td style="padding: 10px 12px; text-align: right; color: #777;">---</td>
                </tr>
            `;
        }

        // Final Closing Row
        const finalDebit = (previewData.cashPaidTotal + previewData.commissionAmount + parseFloat(previewData.otherCharges || 0));
        const finalCredit = previewData.purchaseTotal;

        rowsHtml += `
            <tr style="background: #fff7ed; font-weight: bold; border-top: 2px solid #000; border-bottom: 2px solid #000;">
                <td colspan="4" style="padding: 10px 12px; text-align: right; font-weight: 800; color: #ea580c;">Net Closing Balance</td>
                <td style="padding: 10px 12px; text-align: right; color: #ef4444; font-weight: 800;">₹${finalDebit.toLocaleString('en-IN')}</td>
                <td style="padding: 10px 12px; text-align: right; color: #16a34a; font-weight: 800;">₹${finalCredit.toLocaleString('en-IN')}</td>
            </tr>
        `;

        const netBalColor = previewData.netBalance >= 0 ? '#16a34a' : '#ef4444';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Farmer Statement Preview - #${previewData.farmerDisplayId}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 40px;
                            color: #333;
                            background: #fff;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px solid #000;
                            padding-bottom: 15px;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 26px;
                            color: #ea580c;
                            font-weight: 900;
                            letter-spacing: -0.02em;
                        }
                        .header p {
                            margin: 4px 0 0 0;
                            font-size: 12px;
                            color: #555;
                        }
                        .details-table {
                            width: 100%;
                            margin-bottom: 20px;
                            font-size: 14px;
                            border-bottom: 1px solid #ddd;
                            padding-bottom: 10px;
                        }
                        .details-table td {
                            padding: 4px 0;
                        }
                        .statement-table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 13px;
                            margin-bottom: 30px;
                        }
                        .statement-table th {
                            background: #fff7ed;
                            color: #ea580c;
                            font-weight: bold;
                            border-bottom: 2px solid #fed7aa;
                            padding: 10px 12px;
                            text-align: left;
                        }
                        .statement-table td {
                            border-bottom: 1px solid #eee;
                        }
                        .footer-section {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            margin-top: 30px;
                        }
                        .timestamp-info {
                            font-size: 12px;
                            color: #666;
                        }
                        .summary-card {
                            border: 1.5px solid #cbd5e1;
                            border-radius: 12px;
                            padding: 15px 20px;
                            background: #f8fafc;
                            width: 300px;
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                            font-size: 13px;
                        }
                        .summary-card .row {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        }
                        .summary-card .divider {
                            border-top: 1.5px dashed #cbd5e1;
                            margin: 4px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${tenantData?.name || 'SVM Flowers'}</h1>
                        <p style="font-weight: bold; text-transform: uppercase;">${tenantData?.type || ''}</p>
                        <p>${tenantData?.address || ''}</p>
                        <p>Phone: ${tenantData?.phone1 || ''} ${tenantData?.phone2 || ''}</p>
                    </div>

                    <table class="details-table">
                        <tr>
                            <td><strong>Farmer ID:</strong> <span style="color: #ea580c; font-weight: bold;">#${previewData.farmerDisplayId}</span></td>
                            <td style="text-align: right;"><strong>Date Range:</strong> ${formattedFrom} - ${formattedTo}</td>
                        </tr>
                        <tr>
                            <td><strong>Farmer Name:</strong> <span style="font-weight: bold; color: #1e293b;">${previewData.farmerName}</span></td>
                            <td></td>
                        </tr>
                    </table>

                    <table class="statement-table">
                        <thead>
                            <tr>
                                <th style="text-align: left;">Date</th>
                                <th style="text-align: left;">Particulars / Item</th>
                                <th style="text-align: right;">Weight</th>
                                <th style="text-align: right;">Rate</th>
                                <th style="text-align: right;">Debit (Paid)</th>
                                <th style="text-align: right;">Credit (Purch)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <div class="footer-section">
                        <div class="timestamp-info">
                            <span style="display: block; font-size: 10px; text-transform: uppercase; font-weight: bold; color: #999;">Statement generated on</span>
                            <span style="font-weight: bold; color: #444;">${generatedDate}</span>
                        </div>
                        
                        <div class="summary-card">
                            <div class="row">
                                <span style="color: #64748b; font-weight: bold;">TOTAL AMOUNT:</span>
                                <span style="font-weight: bold; color: #1e293b;">₹${previewData.purchaseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div class="row">
                                <span style="color: #64748b; font-weight: bold;">CREDIT AMOUNT:</span>
                                <span style="font-weight: bold; color: #1e293b;">₹${previewData.cashPaidTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div class="row">
                                <span style="color: #64748b; font-weight: bold;">COMMISSION AMOUNT:</span>
                                <span style="font-weight: bold; color: #1e293b;">₹${previewData.commissionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div class="row">
                                <span style="color: #64748b; font-weight: bold;">OTHER CHARGES:</span>
                                <span style="font-weight: bold; color: #1e293b;">₹${parseFloat(previewData.otherCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div class="divider"></div>
                            <div class="row">
                                <span style="color: #ea580c; font-weight: bold; text-transform: uppercase;">Net Amount:</span>
                                <span style="font-size: 17px; font-weight: 900; color: ${netBalColor};">₹${previewData.netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
            const doc = new jsPDF('p', 'mm', 'a4');
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(`${tenantData?.name || 'Flower Market'}`, 14, 15);
            doc.setFontSize(11);
            doc.setFont('Helvetica', 'normal');
            doc.text(`${tenantData?.type || ''} | ${tenantData?.address || ''}`, 14, 21);
            doc.text(`Phone: ${tenantData?.phone1 || ''} ${tenantData?.phone2 || ''}`, 14, 26);
            doc.line(14, 29, 196, 29);

            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('FARMER BILL STATEMENT', 14, 38);
            doc.setFontSize(10);
            doc.setFont('Helvetica', 'normal');
            doc.text(`Farmer ID: ${previewData.farmerDisplayId || ''}`, 14, 44);
            doc.text(`Farmer Name: ${previewData.farmerName || ''}`, 14, 49);
            
            const formatD = (dStr) => {
                if (!dStr) return '---';
                return dStr.split('-').reverse().join('/');
            };
            doc.text(`Period: ${formatD(fromDate)} to ${formatD(toDate)}`, 14, 54);

            const tableHeaders = [['Date', 'Particulars / Flower', 'Weight (KG)', 'Rate (₹)', 'Debit (Paid)', 'Credit (Purch)', 'Balance']];
            const tableData = [
                ['---', 'Opening Balance', '---', '---', '---', '---', `₹${(previewData.openingBalance || 0).toFixed(0)}`]
            ];

            (previewData.detailedItems || []).forEach(item => {
                tableData.push([
                    formatD(item.date),
                    item.flowerName || '',
                    `${item.weight || 0} KG`,
                    `₹${item.rate || 0}`,
                    '---',
                    `₹${(item.amount || 0).toFixed(0)}`,
                    '---'
                ]);
            });

            (previewData.detailedPayments || []).forEach(pay => {
                tableData.push([
                    formatD(pay.date),
                    pay.description || '',
                    '---',
                    '---',
                    `₹${(pay.amount || 0).toFixed(0)}`,
                    '---',
                    '---'
                ]);
            });

            if (previewData.commissionAmount > 0) {
                tableData.push([
                    '---',
                    `Less: Commission (${previewData.commissionRate || 0}%)`,
                    '---',
                    '---',
                    `₹${(previewData.commissionAmount || 0).toFixed(0)}`,
                    '---',
                    '---'
                ]);
            }
            if (previewData.otherCharges > 0) {
                tableData.push([
                    '---',
                    'Less: Other Charges',
                    '---',
                    '---',
                    `₹${(parseFloat(previewData.otherCharges || 0)).toFixed(0)}`,
                    '---',
                    '---'
                ]);
            }

            tableData.push([
                '---',
                'TOTAL / NET CLOSING',
                '---',
                '---',
                `₹${((previewData.cashPaidTotal || 0) + (previewData.commissionAmount || 0) + parseFloat(previewData.otherCharges || 0)).toFixed(0)}`,
                `₹${(previewData.purchaseTotal || 0).toFixed(0)}`,
                `₹${(previewData.netBalance || 0).toFixed(0)}`
            ]);

            autoTable(doc, {
                head: tableHeaders,
                body: tableData,
                startY: 60,
                theme: 'striped',
                headStyles: { fillColor: [234, 88, 12] }
            });

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

        const formattedMsg = `*FARMER STATEMENT*
*Shop:* ${tenantData?.name || 'SVM Flowers'}
*Farmer:* ${previewData.farmerName} (${previewData.farmerDisplayId})
*Period:* ${fromDate.split('-').reverse().join('/')} to ${toDate.split('-').reverse().join('/')}
----------------------------------
*Opening Bal:* ₹${previewData.openingBalance.toFixed(0)}
*Total Purchases:* ₹${previewData.purchaseTotal.toFixed(0)}
*Total Cash Paid:* ₹${previewData.cashPaidTotal.toFixed(0)}
*Commission:* ₹${previewData.commissionAmount.toFixed(0)}
*Other Charges:* ₹${parseFloat(previewData.otherCharges || 0).toFixed(0)}
----------------------------------
*Closing Bal:* ₹${previewData.netBalance.toFixed(0)}
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
                                        <tr key={fid} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                            <td style={{ ...TD_S, fontWeight: 700, color: '#ea580c', whiteSpace: 'nowrap' }}>
                                                #{calc.farmerDisplayId}
                                            </td>
                                            <td style={{ ...TD_S, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                {calc.farmerName}
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
            {previewData && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyArea: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }} className="no-print">
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '840px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', boxSizing: 'border-box' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', flexShrink: 0, boxSizing: 'border-box' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                📋 Farmer Statement Preview
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
                        <div className="print-area" style={{ padding: '32px 32px 48px', overflowY: 'auto', overflowX: 'hidden', flex: 1, fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#374151', boxSizing: 'border-box', width: '100%' }}>
                            {/* Letterhead */}
                            <div style={{ textAlign: 'center', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '20px', marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '24px', fontWeight: 850, letterSpacing: '-0.02em', color: '#ea580c', margin: '0 0 4px 0' }}>{tenantData?.name || 'SVM Flowers'}</h2>
                                <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px 0' }}>{tenantData?.type || ''}</p>
                                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 2px 0' }}>{tenantData?.address || ''}</p>
                                <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Phone: {tenantData?.phone1 || ''} {tenantData?.phone2 || ''}</p>
                            </div>

                            {/* Farmer Details */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '24px', fontSize: '13px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '14px' }}>
                                <div>
                                    <div><span style={{ color: '#64748b', fontWeight: 700 }}>Farmer ID:</span> <span style={{ color: '#ea580c', fontWeight: 800 }}>#{previewData.farmerDisplayId}</span></div>
                                    <div style={{ marginTop: '4px' }}><span style={{ color: '#64748b', fontWeight: 700 }}>Farmer Name:</span> <span style={{ color: '#1e293b', fontWeight: 800 }}>{previewData.farmerName}</span></div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div><span style={{ color: '#64748b', fontWeight: 700 }}>Date Range:</span> <span style={{ color: '#1e293b', fontWeight: 800 }}>{fromDate.split('-').reverse().join('/')} - {toDate.split('-').reverse().join('/')}</span></div>
                                </div>
                            </div>

                            {/* Detailed transaction entries */}
                            <div style={{ overflowX: 'auto', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: '#fff', boxSizing: 'border-box' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ background: '#fff7ed', borderBottom: '2px solid #fed7aa' }}>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 750, color: '#ea580c' }}>Date</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 750, color: '#ea580c' }}>Particulars / Item</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 750, color: '#ea580c' }}>Weight</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 750, color: '#ea580c' }}>Rate</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 750, color: '#ea580c' }}>Debit (Paid)</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 750, color: '#ea580c' }}>Credit (Purch)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                                            <td style={{ padding: '12px 16px', color: '#94a3b8' }}>---</td>
                                            <td style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Opening Balance</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8' }}>---</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8' }}>---</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8' }}>---</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>₹{previewData.openingBalance.toLocaleString('en-IN')}</td>
                                        </tr>
                                        {previewData.detailedItems.map((item, index) => (
                                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px 16px' }}>{item.date.split('-').reverse().join('/')}</td>
                                                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.flowerName}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{item.weight} KG</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>₹{item.rate}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8' }}>---</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>₹{item.amount.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                        {previewData.detailedPayments.map((pay, index) => (
                                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px 16px' }}>{pay.date.split('-').reverse().join('/')}</td>
                                                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{pay.description}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8' }}>---</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8' }}>---</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>₹{pay.amount.toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8' }}>---</td>
                                            </tr>
                                        ))}
                                        
                                        {/* Summary Rows */}
                                        {previewData.commissionAmount > 0 && (
                                            <tr style={{ background: '#fff1f2', borderBottom: '1px solid #fecdd3' }}>
                                                <td colSpan={4} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 750, color: '#b91c1c' }}>Less: Commission ({previewData.commissionRate}%)</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>₹{previewData.commissionAmount.toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8' }}>---</td>
                                            </tr>
                                        )}
                                        {previewData.otherCharges > 0 && (
                                            <tr style={{ background: '#fff1f2', borderBottom: '1px solid #fecdd3' }}>
                                                <td colSpan={4} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 750, color: '#b91c1c' }}>Less: Other Charges</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>₹{parseFloat(previewData.otherCharges).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8' }}>---</td>
                                            </tr>
                                        )}
 
                                        {/* Final Summary Row */}
                                        <tr style={{ background: '#fff7ed', fontWeight: 700, borderTop: '2px solid #fed7aa' }}>
                                            <td colSpan={4} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#ea580c' }}>Net Closing Balance</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444', fontWeight: 800 }}>₹{(previewData.cashPaidTotal + previewData.commissionAmount + parseFloat(previewData.otherCharges || 0)).toLocaleString('en-IN')}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#16a34a', fontWeight: 800 }}>₹{previewData.purchaseTotal.toLocaleString('en-IN')}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
 
                            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
                                <div>
                                    <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontWeight: 700 }}>Statement generated on</span>
                                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: 650, marginTop: '2px', display: 'block' }}>{new Date().toLocaleDateString('en-IN')}</span>
                                </div>
                                
                                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '18px 20px', background: '#f8fafc', width: '320px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', boxSizing: 'border-box' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Amount:</span>
                                        <span style={{ fontWeight: 800, color: '#1e293b' }}>₹{previewData.purchaseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Credit Amount:</span>
                                        <span style={{ fontWeight: 800, color: '#1e293b' }}>₹{previewData.cashPaidTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Commission Amount:</span>
                                        <span style={{ fontWeight: 800, color: '#1e293b' }}>₹{previewData.commissionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Other Charges:</span>
                                        <span style={{ fontWeight: 800, color: '#1e293b' }}>₹{parseFloat(previewData.otherCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div style={{ borderTop: '1.5px dashed #cbd5e1', margin: '4px 0' }}></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: '#ea580c', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Amount:</span>
                                        <span style={{ fontSize: '18px', fontWeight: 900, color: previewData.netBalance >= 0 ? '#16a34a' : '#ef4444' }}>
                                            ₹ {previewData.netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-6"></div>
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
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FarmerBillClose;
