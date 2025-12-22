'use client';

import RoleGuard from '@/features/authentication/components/RoleGuard';

export default function EvaluatorLayout({ children }) {
  return (
    <RoleGuard allowedRoles={['evaluator']}>
      {children}
    </RoleGuard>
  );
}
