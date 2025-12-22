'use client';

import RoleGuard from '@/features/authentication/components/RoleGuard';

export default function RefereeLayout({ children }) {
  return (
    <RoleGuard allowedRoles={['referee']}>
      {children}
    </RoleGuard>
  );
}
