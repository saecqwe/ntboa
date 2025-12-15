'use client';
import { useContext } from 'react';
import { AuthContext } from '@/authentication/components/AuthProvider';

/**
 * Custom hook to access the authentication context.
 * @returns {{
 *   user: import('firebase/auth').User | null,
 *   userData: object | null,
 *   loading: boolean
 * }}
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
