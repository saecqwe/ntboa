'use client';

import { createContext, useEffect, useState, useCallback } from 'react';
import { onAuthObserver, getUserDocument, login, logout, createUser, checkIfAdminExists } from '@/authentication/services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUserData = useCallback(async () => {
    if (user) {
      const data = await getUserDocument(user.uid);
      setUserData(data);
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthObserver(async (currentUser) => {
      if (currentUser) {
        try {
          // Force token refresh check against Firebase Auth backend
          await currentUser.getIdToken(true);
          const data = await getUserDocument(currentUser.uid);

          // If the account document no longer exists in Firestore or is disabled
          if (!data || data.status === 'Disabled') {
            console.warn("Account is inactive or deleted. Clearing session...");
            await logout();
            if (typeof window !== 'undefined') {
              localStorage.clear();
              sessionStorage.clear();
            }
            setUser(null);
            setUserData(null);
          } else {
            setUserData(data);
            setUser(currentUser);
          }
        } catch (error) {
          console.warn("Auth token invalid or user removed from Firebase Auth:", error);
          await logout().catch(() => {});
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
          }
          setUser(null);
          setUserData(null);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // The value provided to the context will no longer contain the direct service functions.
  // Components should import and use the service functions directly.
  // We only provide state (user, userData, loading) and a refresh method.
  const value = { user, userData, loading, refreshUserData };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
