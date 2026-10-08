'use client';

import { useSearchParams } from 'next/navigation';
import { QueryErrorState } from '@/components/common/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useRequisition } from '../api/hooks';
import { RequisitionEditor } from './requisition-editor';

export function RequisitionNewView() {
  const from = useSearchParams().get('from');
  const seed = useRequisition(from ?? '', Boolean(from));
  if (from && seed.isPending) return <Skeleton className="h-96 w-full" />;
  if (from && seed.isError)
    return <QueryErrorState error={seed.error} onRetry={() => void seed.refetch()} />;
  return <RequisitionEditor key={from ?? 'blank'} draft={null} seed={seed.data ?? null} />;
}
