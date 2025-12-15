'use client';

import { createContext, useEffect, useState } from 'react';
import { onAuthObserver, getUserDocument, login, logout, createUser, checkIfAdminExists } from '@/authentication/services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthObserver(async (user) => {
      if (user) {
        const data = await getUserDocument(user.uid);
        setUserData(data);
        setUser(user);
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
  // We only provide state (user, userData, loading).
  const value = { user, userData, loading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
