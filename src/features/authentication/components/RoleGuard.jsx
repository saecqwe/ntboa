'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/features/authentication/hooks/useAuth';
import { logout } from '@/features/authentication/services/authService';

const RoleGuard = ({ children, allowedRoles }) => {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // 1. Not logged in
    if (!user) {
        if (pathname.includes('/login')) return;
        if (pathname.startsWith('/admin')) router.replace('/admin/login');
        else if (pathname.startsWith('/referee')) router.replace('/referee/login');
        else if (pathname.startsWith('/evaluator')) router.replace('/evaluator/login');
        else router.replace('/');
        return;
    }

    // 2. Account disabled — sign out and send to login with a message
    if (userData?.status === 'Disabled') {
      logout().finally(() => {
        if (pathname.startsWith('/admin')) router.replace('/admin/login?disabled=1');
        else if (pathname.startsWith('/referee')) router.replace('/referee/login?disabled=1');
        else router.replace('/evaluator/login?disabled=1');
      });
      return;
    }

    // 3. Logged in, check roles
    if (userData) {
      if (pathname.includes('/login')) {
        if (userData.role === 'admin') router.replace('/admin/dashboard');
        else if (userData.role === 'referee') router.replace('/referee/home');
        else if (userData.role === 'evaluator') router.replace('/evaluator/home');
        return;
      }

      if (!allowedRoles.includes(userData.role)) {
        if (userData.role === 'admin') router.replace('/admin/dashboard');
        else if (userData.role === 'referee') router.replace('/referee/home');
        else if (userData.role === 'evaluator') router.replace('/evaluator/home');
        else router.replace('/');
      }
    }

  }, [user, userData, loading, router, pathname, allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user && !pathname.includes('/login')) return null;
  if (user && userData && !allowedRoles.includes(userData.role)) return null;
  // Don't render anything while a disabled user is being signed out
  if (user && userData?.status === 'Disabled') return null;

  return <>{children}</>;
};

export default RoleGuard;
