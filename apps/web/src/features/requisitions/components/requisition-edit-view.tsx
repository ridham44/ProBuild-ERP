'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRequisition } from '../api/hooks';
import { RequisitionEditor } from './requisition-editor';

export function RequisitionEditView({ id }: { id: string }) {
  const requisition = useRequisition(id);
  if (requisition.isPending) return <Skeleton className="h-96 w-full" />;
  if (requisition.isError)
    return <QueryErrorState error={requisition.error} onRetry={() => void requisition.refetch()} />;
  if (requisition.data.status !== 'DRAFT') {
    return (
      <EmptyState
        title="Only drafts can be edited"
        description={`${requisition.data.number} has been submitted, so its lines are fixed. Copy it to start a new request.`}
        action={
          <Button asChild variant="primary">
            <Link href={`/procurement/requests/${id}`}>Back to requisition</Link>
          </Button>
        }
      />
    );
  }
  return <RequisitionEditor draft={requisition.data} />;
}
