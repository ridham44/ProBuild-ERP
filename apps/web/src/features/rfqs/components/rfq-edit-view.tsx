'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRfq } from '../api/hooks';
import { RfqForm } from './rfq-form';

export function RfqEditView({ id }: { id: string }) {
  const rfq = useRfq(id);
  if (rfq.isPending) return <Skeleton className="h-96 w-full" />;
  if (rfq.isError) return <QueryErrorState error={rfq.error} onRetry={() => void rfq.refetch()} />;
  if (rfq.data.status !== 'DRAFT') {
    return (
      <EmptyState
        title="Only draft RFQs can be edited"
        description={`${rfq.data.number} has been sent, so its lines and suppliers are fixed.`}
        action={
          <Button asChild variant="primary">
            <Link href={`/procurement/rfqs/${id}`}>Back to RFQ</Link>
          </Button>
        }
      />
    );
  }
  return <RfqForm rfq={rfq.data} />;
}
