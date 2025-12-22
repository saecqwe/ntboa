'use client';

import RoleGuard from '@/features/authentication/components/RoleGuard';

export default function AdminLayout({ children }) {
  return (
    <RoleGuard allowedRoles={['admin']}>
      {children}
    </RoleGuard>
  );
}
