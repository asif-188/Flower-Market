/**
 * Multi-Tenant Management Utilities
 * Handles tenant context, account management, and data isolation
 */

import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query,
  where,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db } from "../firebase";

// ── Tenant Context Management ──
export const getTenantId = () => sessionStorage.getItem('fm_tenantId') || null;
export const getTenantName = () => sessionStorage.getItem('fm_tenantName') || null;

export const setTenantContext = (tenantId, tenantName) => {
  sessionStorage.setItem('fm_tenantId', tenantId);
  sessionStorage.setItem('fm_tenantName', tenantName);
};

export const clearTenantContext = () => {
  sessionStorage.removeItem('fm_tenantId');
  sessionStorage.removeItem('fm_tenantName');
};

// ── Tenant Account Management ──
export const createTenantAccount = async (accountName, accountEmail, createdBy) => {
  try {
    const tenantRef = await addDoc(collection(db, 'tenants'), {
      name: accountName,
      email: accountEmail,
      createdBy,
      createdAt: serverTimestamp(),
      status: 'active',
      businessInfo: {
        name: accountName,
        type: 'Flower Market',
        address: '',
        phone1: '',
        phone2: ''
      }
    });
    return { id: tenantRef.id, name: accountName, email: accountEmail };
  } catch (error) {
    console.error('Error creating tenant account:', error);
    throw error;
  }
};

export const getTenantAccounts = async (userId) => {
  try {
    const q = query(collection(db, 'tenants'), where('createdBy', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching tenant accounts:', error);
    return [];
  }
};

export const getTenantById = async (tenantId) => {
  try {
    const docSnap = await getDocs(query(collection(db, 'tenants'), where('__name__', '==', tenantId)));
    if (docSnap.empty) return null;
    return { id: docSnap.docs[0].id, ...docSnap.docs[0].data() };
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return null;
  }
};

export const updateTenantBusinessInfo = async (tenantId, businessInfo) => {
  try {
    const tenantRef = doc(db, 'tenants', tenantId);
    await updateDoc(tenantRef, { businessInfo, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error('Error updating tenant business info:', error);
    throw error;
  }
};

// ── Data Migration (Move existing data to default tenant) ──
export const migrateExistingDataToTenant = async (tenantId) => {
  try {
    const batch = writeBatch(db);
    const collections = ['farmers', 'buyers', 'products', 'intakes', 'sales', 'payments'];
    
    for (const collName of collections) {
      const snapshot = await getDocs(collection(db, collName));
      snapshot.docs.forEach(docSnap => {
        const docRef = doc(db, collName, docSnap.id);
        batch.update(docRef, { tenantId, migratedAt: serverTimestamp() });
      });
    }
    
    await batch.commit();
    console.log('Data migration completed for tenant:', tenantId);
  } catch (error) {
    console.error('Error migrating data:', error);
    throw error;
  }
};

// ── Tenant-aware Query Helper ──
export const getTenantQuery = (collectionName, tenantId) => {
  return query(collection(db, collectionName), where('tenantId', '==', tenantId));
};
