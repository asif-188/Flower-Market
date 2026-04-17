
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
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

export { db };

const COLLECTIONS = {
  FARMERS: 'farmers',
  PRODUCTS: 'products',
  INTAKES: 'intakes',
  BUYERS: 'buyers',
  SALES: 'sales',
  VENDORS: 'vendors',
  OUTSIDE_PURCHASES: 'outside_purchases',
};

// Helper to get current tenant
export const getTenant = () => sessionStorage.getItem('fm_tenant') || 'default';

// --- Real-time Listeners (Hooks style or Callback style) ---
export const subscribeToCollection = (collectionName, callback, filterByTenant = false) => {
  let q = query(collection(db, collectionName));
  // If collection name is one of the new ones or requested, we could filter by tenantId
  // For now, let's keep it simple and just allow filtering if requested
  // In the future, we should migrate all collections to be tenant-aware.
  return onSnapshot(q, (snapshot) => {
    let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (filterByTenant) {
      data = data.filter(item => item.tenantId === getTenant());
    }
    callback(data);
  });
};

// --- FARMERS ---
// ... (existing farmer code remains) ...
// (I will use multi_replace if I need to skip blocks, but here I'll just append at the end and update the COLLECTIONS)

// --- FARMERS ---
export const getFarmers = async () => {
  const querySnapshot = await getDocs(collection(db, COLLECTIONS.FARMERS));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveFarmer = async (farmer) => {
  const { id, ...data } = farmer;
  if (id) {
    const farmerRef = doc(db, COLLECTIONS.FARMERS, id);
    await updateDoc(farmerRef, { ...data, updatedAt: serverTimestamp() });
  } else {
    await addDoc(collection(db, COLLECTIONS.FARMERS), { 
      ...data, 
      balance: data.balance || 0,
      createdAt: serverTimestamp() 
    });
  }
};

export const deleteFarmer = async (id) => {
  await deleteDoc(doc(db, COLLECTIONS.FARMERS, id));
};

// --- PRODUCTS ---
export const getProducts = async () => {
  const querySnapshot = await getDocs(collection(db, COLLECTIONS.PRODUCTS));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- INTAKE ---
export const saveIntake = async (intakeData) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.INTAKES), {
    ...intakeData,
    timestamp: serverTimestamp(),
    date: new Date().toISOString()
  });
  return { id: docRef.id, ...intakeData };
};

export const getIntakes = async () => {
  const q = query(collection(db, COLLECTIONS.INTAKES), orderBy('timestamp', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- BUYERS ---
export const getBuyers = async () => {
  const querySnapshot = await getDocs(collection(db, COLLECTIONS.BUYERS));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveBuyer = async (buyer) => {
  const { id, ...data } = buyer;
  if (id) {
    const buyerRef = doc(db, COLLECTIONS.BUYERS, id);
    await updateDoc(buyerRef, { ...data, updatedAt: serverTimestamp() });
  } else {
    await addDoc(collection(db, COLLECTIONS.BUYERS), { 
      ...data, 
      balance: data.balance || 0,
      createdAt: serverTimestamp() 
    });
  }
};

// --- SALES ---
export const saveSale = async (saleData) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.SALES), {
    ...saleData,
    timestamp: serverTimestamp()
  });
  return { id: docRef.id, ...saleData };
};

export const getSales = async () => {
  const q = query(collection(db, COLLECTIONS.SALES), orderBy('timestamp', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- VENDORS ---
export const getVendors = async () => {
  const querySnapshot = await getDocs(collection(db, COLLECTIONS.VENDORS));
  return querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(v => v.tenantId === getTenant());
};

export const saveVendor = async (vendor) => {
  const tenantId = getTenant();
  const { id, ...data } = vendor;
  if (id) {
    const vendorRef = doc(db, COLLECTIONS.VENDORS, id);
    await updateDoc(vendorRef, { ...data, tenantId, updatedAt: serverTimestamp() });
  } else {
    await addDoc(collection(db, COLLECTIONS.VENDORS), { 
      ...data, 
      displayId: data.displayId || Date.now().toString().slice(-4),
      balance: data.balance || 0,
      tenantId,
      createdAt: serverTimestamp() 
    });
  }
};

export const deleteVendor = async (id) => {
  await deleteDoc(doc(db, COLLECTIONS.VENDORS, id));
};

// --- OUTSIDE PURCHASES ---
export const saveOutsidePurchase = async (purchaseData) => {
  const tenantId = getTenant();
  const docRef = await addDoc(collection(db, COLLECTIONS.OUTSIDE_PURCHASES), {
    ...purchaseData,
    tenantId,
    timestamp: serverTimestamp()
  });
  return { id: docRef.id, ...purchaseData };
};

export const getOutsidePurchases = async () => {
  const q = query(collection(db, COLLECTIONS.OUTSIDE_PURCHASES), orderBy('timestamp', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(p => p.tenantId === getTenant());
};
