
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
};

// --- Real-time Listeners (Hooks style or Callback style) ---
export const subscribeToCollection = (collectionName, callback) => {
  const q = query(collection(db, collectionName));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
};

// --- FARMERS ---
export const getFarmers = async () => {
  const querySnapshot = await getDocs(collection(db, COLLECTIONS.FARMERS));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveFarmer = async (farmer) => {
  if (farmer.id) {
    const farmerRef = doc(db, COLLECTIONS.FARMERS, farmer.id);
    await updateDoc(farmerRef, { ...farmer, updatedAt: serverTimestamp() });
  } else {
    await addDoc(collection(db, COLLECTIONS.FARMERS), { 
      ...farmer, 
      balance: farmer.balance || 0,
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
  if (buyer.id) {
    const buyerRef = doc(db, COLLECTIONS.BUYERS, buyer.id);
    await updateDoc(buyerRef, { ...buyer, updatedAt: serverTimestamp() });
  } else {
    await addDoc(collection(db, COLLECTIONS.BUYERS), { 
      ...buyer, 
      balance: buyer.balance || 0,
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
