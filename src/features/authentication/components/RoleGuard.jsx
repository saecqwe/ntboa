'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/features/authentication/hooks/useAuth';

const RoleGuard = ({ children, allowedRoles }) => {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // 1. Not logged in
    if (!user) {
        // Allow access to login pages
        if (pathname.includes('/login')) {
            return;
        }
        // Determine where to redirect based on the section being accessed
        if (pathname.startsWith('/admin')) {
            router.replace('/admin/login');
        } else if (pathname.startsWith('/referee')) {
            router.replace('/referee/login');
        } else if (pathname.startsWith('/evaluator')) {
            router.replace('/evaluator/login');
        } else {
             router.replace('/'); // Default fallback
        }
        return;
    }

    // 2. Logged in, check roles
    if (userData) {
      // If user is on a login page but already logged in, redirect to their home
      if (pathname.includes('/login')) {
        if (userData.role === 'admin') router.replace('/admin/dashboard');
        else if (userData.role === 'referee') router.replace('/referee/home');
        else if (userData.role === 'evaluator') router.replace('/evaluator/home');
        return;
      }

      // Check if user's role is allowed for this route
      if (!allowedRoles.includes(userData.role)) {
         // Redirect to their appropriate home
         if (userData.role === 'admin') router.replace('/admin/dashboard');
         else if (userData.role === 'referee') router.replace('/referee/home');
         else if (userData.role === 'evaluator') router.replace('/evaluator/home');
         else router.replace('/'); // Fallback
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

  // If not logged in (and not on login page), don't render children (waiting for redirect)
  if (!user && !pathname.includes('/login')) {
      return null;
  }

  // If logged in but wrong role, don't render (waiting for redirect)
  if (user && userData && !allowedRoles.includes(userData.role)) {
      return null;
  }
  
  return <>{children}</>;
};

export default RoleGuard;
