import { Suspense } from 'react';
import EvaluationDetailsPage from '@/features/evaluator/pages/EvaluationDetails';
import EvaluationDetailSkeleton from '@/ui/skeletons/EvaluationDetailSkeleton';

export default function Page() {
  return (
    <Suspense fallback={<EvaluationDetailSkeleton />}>
      <EvaluationDetailsPage />
    </Suspense>
  );
}
