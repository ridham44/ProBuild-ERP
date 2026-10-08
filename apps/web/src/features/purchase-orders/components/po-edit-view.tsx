'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePurchaseOrder } from '../api/hooks';
import { PoEditForm } from './po-edit-form';

export function PoEditView({ id }: { id: string }) {
  const po = usePurchaseOrder(id);
  if (po.isPending) return <Skeleton className="h-96 w-full" />;
  if (po.isError) return <QueryErrorState error={po.error} onRetry={() => void po.refetch()} />;
  if (po.data.status !== 'DRAFT') {
    return (
      <EmptyState
        title="Only draft orders can be edited"
        description={`${po.data.number} has been submitted, so its lines and prices are fixed.`}
        action={
          <Button asChild variant="primary">
            <Link href={`/procurement/orders/${id}`}>Back to purchase order</Link>
          </Button>
        }
      />
    );
  }
  return <PoEditForm po={po.data} />;
}
