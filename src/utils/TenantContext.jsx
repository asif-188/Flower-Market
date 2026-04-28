
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
        let active = true; // Guard against StrictMode double-invocation and stale closures

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!active) return; // Discard if this effect instance was already cleaned up

            setUser(currentUser);
            if (currentUser) {
                let tid = sessionStorage.getItem('fm_tenantId');

                if (!tid) {
                    try {
                        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
                        if (!active) return; // Check again after every await
                        if (userSnap.exists()) {
                            tid = userSnap.data().tenantId;
                        } else {
                            tid = currentUser.email.split('@')[0];
                        }
                    } catch (err) {
                        if (!active) return;
                        console.error('Error fetching user data:', err);
                        tid = currentUser.email.split('@')[0];
                    }
                }

                if (tid && active) {
                    setTenantId(tid);
                    sessionStorage.setItem('fm_tenantId', tid);

                    // Fetch tenant settings
                    try {
                        const tenantSnap = await getDoc(doc(db, 'tenants', tid));
                        if (!active) return;
                        if (tenantSnap.exists()) {
                            setTenantData(tenantSnap.data());
                        } else {
                            const globalSnap = await getDoc(doc(db, 'system', 'settings'));
                            if (!active) return;
                            if (globalSnap.exists()) {
                                setTenantData(globalSnap.data());
                            }
                        }
                    } catch (err) {
                        if (!active) return;
                        console.error('Error fetching tenant data:', err);
                    }
                }
            } else {
                setTenantId(null);
                setTenantData(null);
                sessionStorage.removeItem('fm_tenantId');
            }

            if (active) setLoading(false);
        });

        return () => {
            active = false; // Prevent any in-flight async callbacks from committing state
            unsubscribe();
        };
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
