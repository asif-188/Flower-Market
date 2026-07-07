
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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
                if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && sessionStorage.getItem('fm_logout_active') !== 'true') {
                    setUser({ email: 'kasi.vetrivel@poovanam.com', uid: 'mock-uid' });
                    setTenantId('kasi.vetrivel');
                    sessionStorage.setItem('fm_tenantId', 'kasi.vetrivel');
                    setTenantData({ name: 'SVM Flowers', type: 'Sri Valli Flower Merchant' });
                    if (active) setLoading(false);
                    return;
                }
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

    const [ownerModeActive, setOwnerModeActive] = useState(() => {
        const until = sessionStorage.getItem('fm_ownerModeUntil');
        if (until && parseInt(until) > Date.now()) {
            return true;
        }
        return false;
    });

    useEffect(() => {
        if (ownerModeActive) {
            const until = sessionStorage.getItem('fm_ownerModeUntil');
            const delay = until ? parseInt(until) - Date.now() : 15 * 60 * 1000;
            
            const timer = setTimeout(() => {
                sessionStorage.removeItem('fm_ownerModeUntil');
                setOwnerModeActive(false);
            }, Math.max(0, delay));
            
            return () => clearTimeout(timer);
        }
    }, [ownerModeActive]);

    const enableOwnerMode = (pin) => {
        if (pin === 'SVM2026') {
            const expiry = Date.now() + 15 * 60 * 1000;
            sessionStorage.setItem('fm_ownerModeUntil', expiry.toString());
            setOwnerModeActive(true);
            return true;
        }
        return false;
    };

    const disableOwnerMode = () => {
        sessionStorage.removeItem('fm_ownerModeUntil');
        setOwnerModeActive(false);
    };

    const isEditDeleteAllowed = () => {
        if (!tenantData?.ownerModeFeatureEnabled) return true;
        return ownerModeActive;
    };

    const logout = async () => {
        try {
            sessionStorage.removeItem('fm_ownerModeUntil');
            setOwnerModeActive(false);
            sessionStorage.setItem('fm_logout_active', 'true');
            await signOut(auth);
            setUser(null);
            setTenantId(null);
            setTenantData(null);
            sessionStorage.removeItem('fm_tenantId');
        } catch (err) {
            console.error('Error signing out:', err);
        }
    };

    const value = {
        user,
        tenantId,
        tenantData,
        loading,
        setTenantData,
        logout,
        ownerModeActive,
        enableOwnerMode,
        disableOwnerMode,
        isEditDeleteAllowed
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
