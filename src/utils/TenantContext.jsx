
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const TenantContext = createContext();

export const TenantProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [tenantId, setTenantId] = useState(null);
    const [tenantData, setTenantData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Determine tenantId. 
                // Option A: From user profile in Firestore
                // Option B: From custom claim (Identity Platform)
                // Option C: Derived from email (simple approach for now as per current Login.jsx)
                
                let tid = sessionStorage.getItem('fm_tenantId');
                
                if (!tid) {
                    // Try to fetch from a 'users' collection
                    try {
                        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
                        if (userSnap.exists()) {
                            tid = userSnap.data().tenantId;
                        } else {
                            // Fallback to extraction from email for backward compatibility with current mock
                            tid = currentUser.email.split('@')[0];
                        }
                    } catch (err) {
                        console.error("Error fetching user data:", err);
                        tid = currentUser.email.split('@')[0];
                    }
                }

                if (tid) {
                    setTenantId(tid);
                    sessionStorage.setItem('fm_tenantId', tid);
                    
                    // Fetch tenant settings
                    try {
                        const tenantSnap = await getDoc(doc(db, 'tenants', tid));
                        if (tenantSnap.exists()) {
                            setTenantData(tenantSnap.data());
                        } else {
                            // Try global settings as fallback if tenant-specific not yet created
                            const globalSnap = await getDoc(doc(db, 'system', 'settings'));
                            if (globalSnap.exists()) {
                                setTenantData(globalSnap.data());
                            }
                        }
                    } catch (err) {
                        console.error("Error fetching tenant data:", err);
                    }
                }
            } else {
                setTenantId(null);
                setTenantData(null);
                sessionStorage.removeItem('fm_tenantId');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const value = {
        user,
        tenantId,
        tenantData,
        loading,
        setTenantData
    };

    return (
        <TenantContext.Provider value={value}>
            {!loading && children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};
