
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  where,
  setDoc,
  getDoc,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db } from "../firebase";

export { db };

export const COLLECTIONS = {
  FARMERS: 'farmers',
  PRODUCTS: 'products',
  INTAKES: 'intakes',
  BUYERS: 'buyers',
  SALES: 'sales',
  VENDORS: 'vendors',
  OUTSIDE_PURCHASES: 'outside_purchases',
  TENANTS: 'tenants',
  PAYMENTS: 'payments',
  SYSTEM: 'system',
  // ── Power Buy (fully isolated) ──
  PB_BUYERS: 'pb_buyers',
  PB_SALES: 'pb_sales',
  PB_PAYMENTS: 'pb_payments',
  PB_PRODUCTS: 'pb_products',
  WM_TEST_TRANSACTIONS: 'wm_test_transactions',
  // ── Salesman Module (Standalone) ──
  SALESMEN: 'salesmen',
  SALESMAN_CASH: 'salesman_cash',
  SALESMAN_PURCHASES: 'salesman_purchases',
  DAILY_CASH: 'salesman_daily_cash',
  FLOWER_PURCHASES: 'salesman_flower_purchases',
  CREDIT_TRANSFERS: 'salesman_credit_transfers',
  DAILY_LEDGERS: 'salesman_daily_ledgers',
};

// Helper to get current tenant
export const getTenant = () => {
    // Check session storage first (set during login)
    const tid = sessionStorage.getItem('fm_tenantId');
    if (tid) return tid;
    
    // Fallback if not in session (might happen on page refresh before context loads)
    // but ideally we should rely on TenantContext in React components.
    return 'default';
};

// --- Multi-Tenant CRUD Helpers ---

export const subscribeToCollection = (collectionName, callback, filterByTenant = true, startDate = null, endDate = null, dateField = 'date') => {
  const tenantId = getTenant();

  const constraints = [];
  if (filterByTenant) {
    constraints.push(where('tenantId', '==', tenantId));
  }
  if (startDate) {
    constraints.push(where(dateField, '>=', startDate));
  }
  if (endDate) {
    constraints.push(where(dateField, '<=', endDate));
  }

  // If we have range filters, order by the filter field first, otherwise order by createdAt
  const orderField = (startDate || endDate) ? dateField : 'createdAt';

  // Build the ordered query
  const orderedQ = query(
    collection(db, collectionName),
    ...constraints,
    orderBy(orderField, 'desc')
  );

  // Track the active unsubscribe so we can swap it out cleanly if needed
  let activeUnsub = null;

  const startFallback = () => {
    // Simple query without orderBy — no composite index required
    const fallbackQ = query(
      collection(db, collectionName),
      ...constraints
    );

    activeUnsub = onSnapshot(fallbackQ, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(data);
    });
  };

  // Start with the ordered query
  activeUnsub = onSnapshot(
    orderedQ,
    (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(data);
    },
    (error) => {
      // Only fall back when the error is a missing-index / permission error.
      // Crucially: unsubscribe the broken listener BEFORE starting a new one
      // to avoid triggering Firestore's internal watch-stream assertion.
      console.warn(`subscribeToCollection(${collectionName}) ordered query failed, using fallback:`, error.code, error.message);
      if (activeUnsub) { try { activeUnsub(); } catch (_) {} }
      startFallback();
    }
  );

  // Return a stable unsub handle that always cancels the currently active listener
  return () => { if (activeUnsub) { try { activeUnsub(); } catch (_) {} } };
};

// --- Generic Operations (to replace manual addDoc/updateDoc) ---

export const addData = async (colName, data) => {
    const tenantId = getTenant();
    return await addDoc(collection(db, colName), {
        ...data,
        tenantId,
        createdAt: serverTimestamp()
    });
};

export const updateData = async (colName, id, data) => {
    const tenantId = getTenant();
    const docRef = doc(db, colName, id);
    return await updateDoc(docRef, {
        ...data,
        tenantId, // Ensure it stays tied to tenant
        updatedAt: serverTimestamp()
    });
};

// --- Specialized Helpers ---

// --- FARMERS ---
export const getFarmers = async () => {
  const tenantId = getTenant();
  const q = query(collection(db, COLLECTIONS.FARMERS), where('tenantId', '==', tenantId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveFarmer = async (farmer) => {
  const tenantId = getTenant();
  const { id, ...data } = farmer;
  if (id) {
    await updateData(COLLECTIONS.FARMERS, id, data);
  } else {
    await addData(COLLECTIONS.FARMERS, {
        ...data,
        balance: data.balance || 0
    });
  }
};

export const deleteFarmer = async (id) => {
  await deleteDoc(doc(db, COLLECTIONS.FARMERS, id));
};

// --- PRODUCTS ---
export const getProducts = async () => {
  const tenantId = getTenant();
  const q = query(collection(db, COLLECTIONS.PRODUCTS), where('tenantId', '==', tenantId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveProduct = async (product) => {
    const { id, ...data } = product;
    if (id) {
        await updateData(COLLECTIONS.PRODUCTS, id, data);
    } else {
        await addData(COLLECTIONS.PRODUCTS, data);
    }
};

// --- INTAKE ---
export const saveIntake = async (intakeData) => {
  const docRef = await addData(COLLECTIONS.INTAKES, {
    ...intakeData,
    date: new Date().toISOString()
  });
  return { id: docRef.id, ...intakeData };
};

export const getIntakes = async () => {
  const tenantId = getTenant();
  const q = query(collection(db, COLLECTIONS.INTAKES), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- BUYERS ---
export const getBuyers = async () => {
  const tenantId = getTenant();
  const q = query(collection(db, COLLECTIONS.BUYERS), where('tenantId', '==', tenantId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveBuyer = async (buyer) => {
  const { id, ...data } = buyer;
  if (id) {
    await updateData(COLLECTIONS.BUYERS, id, data);
  } else {
    await addData(COLLECTIONS.BUYERS, {
        ...data,
        balance: data.balance || 0
    });
  }
};

// --- SALES ---
export const saveSale = async (saleData) => {
  const docRef = await addData(COLLECTIONS.SALES, saleData);
  return { id: docRef.id, ...saleData };
};

export const getSales = async () => {
  const tenantId = getTenant();
  const q = query(collection(db, COLLECTIONS.SALES), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- VENDORS ---
export const getVendors = async () => {
    const tenantId = getTenant();
    const q = query(collection(db, COLLECTIONS.VENDORS), where('tenantId', '==', tenantId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveVendor = async (vendor) => {
  const { id, ...data } = vendor;
  if (id) {
    await updateData(COLLECTIONS.VENDORS, id, data);
  } else {
    await addData(COLLECTIONS.VENDORS, {
        ...data,
        displayId: data.displayId || Date.now().toString().slice(-4),
        balance: data.balance || 0
    });
  }
};

export const deleteVendor = async (id) => {
  await deleteDoc(doc(db, COLLECTIONS.VENDORS, id));
};

// --- OUTSIDE PURCHASES ---
export const saveOutsidePurchase = async (purchaseData) => {
  const docRef = await addData(COLLECTIONS.OUTSIDE_PURCHASES, purchaseData);
  return { id: docRef.id, ...purchaseData };
};

// --- PAYMENTS ---
export const savePayment = async (paymentData) => {
  const docRef = await addData(COLLECTIONS.PAYMENTS, paymentData);
  return { id: docRef.id, ...paymentData };
};

export const getOutsidePurchases = async () => {
  const tenantId = getTenant();
  const q = query(collection(db, COLLECTIONS.OUTSIDE_PURCHASES), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// ══════════════════════════════════════════════════════════════════════════════
// ── POWER BUY — Fully Isolated Collections ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// --- PB BUYERS ---
export const getPbBuyers = async () => {
  const tenantId = getTenant();
  const q = query(collection(db, COLLECTIONS.PB_BUYERS), where('tenantId', '==', tenantId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const savePbBuyer = async (buyer) => {
  const { id, ...data } = buyer;
  if (id) {
    await updateData(COLLECTIONS.PB_BUYERS, id, data);
  } else {
    await addData(COLLECTIONS.PB_BUYERS, {
      ...data,
      balance: data.balance || 0
    });
  }
};

export const deletePbBuyer = async (id) => {
  await deleteDoc(doc(db, COLLECTIONS.PB_BUYERS, id));
};

// --- PB PRODUCTS (Flowers) ---
export const getPbProducts = async () => {
  const tenantId = getTenant();
  const q = query(collection(db, COLLECTIONS.PB_PRODUCTS), where('tenantId', '==', tenantId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const savePbProduct = async (product) => {
  const { id, ...data } = product;
  if (id) {
    await updateData(COLLECTIONS.PB_PRODUCTS, id, data);
  } else {
    await addData(COLLECTIONS.PB_PRODUCTS, data);
  }
};

export const deletePbProduct = async (id) => {
  await deleteDoc(doc(db, COLLECTIONS.PB_PRODUCTS, id));
};

// --- PB SALES ---
export const savePbSale = async (saleData) => {
  const docRef = await addData(COLLECTIONS.PB_SALES, saleData);
  return { id: docRef.id, ...saleData };
};

export const getPbSales = async () => {
  const tenantId = getTenant();
  const q = query(collection(db, COLLECTIONS.PB_SALES), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- PB PAYMENTS ---
export const savePbPayment = async (paymentData) => {
  const docRef = await addData(COLLECTIONS.PB_PAYMENTS, paymentData);
  return { id: docRef.id, ...paymentData };
};

export const getPbPayments = async () => {
  const tenantId = getTenant();
  const q = query(collection(db, COLLECTIONS.PB_PAYMENTS), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- PB INVOICE COUNTER ---
// Uses a Firestore counter doc at system/pb_{tenantId}_counter with field `lastInvoice`
export const getNextPbInvoiceNo = async () => {
  const tenantId = getTenant();
  const counterRef = doc(db, 'system', `pb_${tenantId}_counter`);
  const snap = await getDoc(counterRef);
  const last = snap.exists() ? (snap.data().lastInvoice || 0) : 0;
  const next = last + 1;
  await setDoc(counterRef, { lastInvoice: next }, { merge: true });
  return `PB-${String(next).padStart(6, '0')}`;
};

// --- WEIGHT MACHINE STANDALONE TEST ---
export const saveWmTestPurchase = async (purchaseData) => {
  const docRef = await addData(COLLECTIONS.WM_TEST_TRANSACTIONS, {
    ...purchaseData,
    date: purchaseData.date || new Date().toISOString().split('T')[0]
  });
  return { id: docRef.id, ...purchaseData };
};

export const getWmTestPurchases = async () => {
  const tenantId = getTenant();
  const q = query(collection(db, COLLECTIONS.WM_TEST_TRANSACTIONS), where('tenantId', '==', tenantId));
  const querySnapshot = await getDocs(q);
  const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  // Sort by createdAt desc in-memory to prevent missing-index errors
  return results.sort((a, b) => {
    const tA = a.createdAt?.seconds || a.timestamp || 0;
    const tB = b.createdAt?.seconds || b.timestamp || 0;
    return (tB > tA) ? 1 : (tB < tA) ? -1 : 0;
  });
};

export const deleteWmTestPurchase = async (id) => {
  await deleteDoc(doc(db, COLLECTIONS.WM_TEST_TRANSACTIONS, id));
};

// --- SALESMEN MASTER ---
export const saveSalesman = async (salesman) => {
  const { id, ...data } = salesman;
  if (id) {
    await updateData(COLLECTIONS.SALESMEN, id, data);
  } else {
    await addData(COLLECTIONS.SALESMEN, {
      ...data,
      displayId: data.displayId || Date.now().toString().slice(-6),
      status: data.status || 'Active'
    });
  }
};

export const deleteSalesman = async (id) => {
  await deleteDoc(doc(db, COLLECTIONS.SALESMEN, id));
};

// --- SALESMAN CASH ISSUE ---
export const saveSalesmanCash = async (cashRecord) => {
  const { id, ...data } = cashRecord;
  if (id) {
    await updateData(COLLECTIONS.SALESMAN_CASH, id, data);
  } else {
    await addData(COLLECTIONS.SALESMAN_CASH, data);
  }
};

export const deleteSalesmanCash = async (id) => {
  await deleteDoc(doc(db, COLLECTIONS.SALESMAN_CASH, id));
};

// --- SALESMAN PURCHASES ---
export const saveSalesmanPurchase = async (purchaseRecord) => {
  const { id, ...data } = purchaseRecord;
  if (id) {
    await updateData(COLLECTIONS.SALESMAN_PURCHASES, id, data);
  } else {
    await addData(COLLECTIONS.SALESMAN_PURCHASES, data);
  }
};

export const deleteSalesmanPurchase = async (id) => {
  await deleteDoc(doc(db, COLLECTIONS.SALESMAN_PURCHASES, id));
};

// ── Daily Cash Received (Opening Cash from Owner) ──
export const saveDailyCash = async (record) => {
  const { id, ...data } = record;
  if (id) {
    const oldSnap = await getDoc(doc(db, COLLECTIONS.DAILY_CASH, id));
    if (oldSnap.exists()) {
      const oldAmount = oldSnap.data().amount || 0;
      const newAmount = data.amount || 0;
      const diff = newAmount - oldAmount;
      if (diff !== 0 && data.salesman_id) {
        await updateDoc(doc(db, COLLECTIONS.SALESMEN, data.salesman_id), {
          current_balance: increment(diff)
        });
      }
    }
    await updateData(COLLECTIONS.DAILY_CASH, id, data);
  } else {
    const amount = data.amount || 0;
    if (data.salesman_id) {
      await updateDoc(doc(db, COLLECTIONS.SALESMEN, data.salesman_id), {
        current_balance: increment(amount)
      });
    }
    await addData(COLLECTIONS.DAILY_CASH, data);
  }
};

export const deleteDailyCash = async (id) => {
  const snap = await getDoc(doc(db, COLLECTIONS.DAILY_CASH, id));
  if (snap.exists()) {
    const data = snap.data();
    const amount = data.amount || 0;
    if (data.salesman_id) {
      await updateDoc(doc(db, COLLECTIONS.SALESMEN, data.salesman_id), {
        current_balance: increment(-amount)
      });
    }
  }
  await deleteDoc(doc(db, COLLECTIONS.DAILY_CASH, id));
};

// ── Flower Purchases from Vendors ──
export const saveFlowerPurchase = async (purchase) => {
  const { id, ...data } = purchase;
  if (id) {
    const oldSnap = await getDoc(doc(db, COLLECTIONS.FLOWER_PURCHASES, id));
    if (oldSnap.exists()) {
      const oldData = oldSnap.data();
      const oldNetEffect = (oldData.total_amount || 0) - (oldData.amount_paid || 0);
      const newNetEffect = (data.total_amount || 0) - (data.amount_paid || 0);
      const diff = newNetEffect - oldNetEffect;
      if (diff !== 0 && data.vendor_id) {
        await updateDoc(doc(db, COLLECTIONS.VENDORS, data.vendor_id), {
          balance: increment(diff)
        });
      }
      
      const oldAmountPaid = oldData.amount_paid || 0;
      const newAmountPaid = data.amount_paid || 0;
      const diffPaid = newAmountPaid - oldAmountPaid;
      if (diffPaid !== 0 && data.salesman_id) {
        await updateDoc(doc(db, COLLECTIONS.SALESMEN, data.salesman_id), {
          current_balance: increment(-diffPaid)
        });
      }
    }
    await updateData(COLLECTIONS.FLOWER_PURCHASES, id, data);
  } else {
    const netEffect = (data.total_amount || 0) - (data.amount_paid || 0);
    if (netEffect !== 0 && data.vendor_id) {
      await updateDoc(doc(db, COLLECTIONS.VENDORS, data.vendor_id), {
        balance: increment(netEffect)
      });
    }
    const amountPaid = data.amount_paid || 0;
    if (amountPaid && data.salesman_id) {
      await updateDoc(doc(db, COLLECTIONS.SALESMEN, data.salesman_id), {
        current_balance: increment(-amountPaid)
      });
    }
    await addData(COLLECTIONS.FLOWER_PURCHASES, data);
  }
};

export const deleteFlowerPurchase = async (id) => {
  const snap = await getDoc(doc(db, COLLECTIONS.FLOWER_PURCHASES, id));
  if (snap.exists()) {
    const data = snap.data();
    const netEffect = (data.total_amount || 0) - (data.amount_paid || 0);
    if (netEffect !== 0 && data.vendor_id) {
      await updateDoc(doc(db, COLLECTIONS.VENDORS, data.vendor_id), {
        balance: increment(-netEffect)
      });
    }
    const amountPaid = data.amount_paid || 0;
    if (amountPaid && data.salesman_id) {
      await updateDoc(doc(db, COLLECTIONS.SALESMEN, data.salesman_id), {
        current_balance: increment(amountPaid)
      });
    }
  }
  await deleteDoc(doc(db, COLLECTIONS.FLOWER_PURCHASES, id));
};

// ── Salesman Credit Transfers ──
export const saveCreditTransfer = async (transfer) => {
  const { id, ...data } = transfer;
  if (id) {
    const oldSnap = await getDoc(doc(db, COLLECTIONS.CREDIT_TRANSFERS, id));
    if (oldSnap.exists()) {
      const oldData = oldSnap.data();
      const oldAmount = oldData.amount || 0;
      const newAmount = data.amount || 0;
      const diff = newAmount - oldAmount;
      
      if (oldData.from_salesman_id) {
        await updateDoc(doc(db, COLLECTIONS.SALESMEN, oldData.from_salesman_id), {
          current_balance: increment(-diff)
        });
      }
      if (oldData.to_salesman_id) {
        await updateDoc(doc(db, COLLECTIONS.SALESMEN, oldData.to_salesman_id), {
          current_balance: increment(diff)
        });
      }
    }
    await updateData(COLLECTIONS.CREDIT_TRANSFERS, id, data);
  } else {
    const amount = data.amount || 0;
    if (data.from_salesman_id) {
      await updateDoc(doc(db, COLLECTIONS.SALESMEN, data.from_salesman_id), {
        current_balance: increment(-amount)
      });
    }
    if (data.to_salesman_id) {
      await updateDoc(doc(db, COLLECTIONS.SALESMEN, data.to_salesman_id), {
        current_balance: increment(amount)
      });
    }
    await addData(COLLECTIONS.CREDIT_TRANSFERS, data);
  }
};

export const deleteCreditTransfer = async (id) => {
  const snap = await getDoc(doc(db, COLLECTIONS.CREDIT_TRANSFERS, id));
  if (snap.exists()) {
    const data = snap.data();
    const amount = data.amount || 0;
    if (data.from_salesman_id) {
      await updateDoc(doc(db, COLLECTIONS.SALESMEN, data.from_salesman_id), {
        current_balance: increment(amount)
      });
    }
    if (data.to_salesman_id) {
      await updateDoc(doc(db, COLLECTIONS.SALESMEN, data.to_salesman_id), {
        current_balance: increment(-amount)
      });
    }
  }
  await deleteDoc(doc(db, COLLECTIONS.CREDIT_TRANSFERS, id));
};

// ── Daily Ledgers ──
export const saveDailyLedger = async (ledger) => {
  const { id, ...data } = ledger;
  if (id) {
    await updateData(COLLECTIONS.DAILY_LEDGERS, id, data);
  } else {
    await addData(COLLECTIONS.DAILY_LEDGERS, data);
  }
};

export const deleteDailyLedger = async (id) => {
  await deleteDoc(doc(db, COLLECTIONS.DAILY_LEDGERS, id));
};



