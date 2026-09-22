import { Suspense } from 'react';
import EvaluationDetailPage from '@/features/admin/pages/Evaluation';
import EvaluationDetailSkeleton from '@/ui/skeletons/EvaluationDetailSkeleton';

export default function Page() {
  return (
    <Suspense fallback={<EvaluationDetailSkeleton />}>
      <EvaluationDetailPage />
    </Suspense>
  );
}
