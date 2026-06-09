
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
  serverTimestamp
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

export const subscribeToCollection = (collectionName, callback, filterByTenant = true) => {
  const tenantId = getTenant();

  // Build the ordered query (requires a Firestore composite index)
  const orderedQ = filterByTenant
    ? query(collection(db, collectionName), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'))
    : query(collection(db, collectionName), orderBy('createdAt', 'desc'));

  // Track the active unsubscribe so we can swap it out cleanly if needed
  let activeUnsub = null;

  const startFallback = () => {
    // Simple query without orderBy — no composite index required
    const fallbackQ = filterByTenant
      ? query(collection(db, collectionName), where('tenantId', '==', tenantId))
      : query(collection(db, collectionName));

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

