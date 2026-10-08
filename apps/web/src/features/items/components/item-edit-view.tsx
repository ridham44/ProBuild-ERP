'use client';

import { QueryErrorState } from '@/components/common/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useItem } from '../api/hooks';
import { ItemForm } from './item-form';

export function ItemEditView({ id }: { id: string }) {
  const item = useItem(id);
  if (item.isPending) return <Skeleton className="h-96 w-full max-w-4xl" />;
  if (item.isError) return <QueryErrorState error={item.error} onRetry={() => void item.refetch()} />;
  return <ItemForm item={item.data} />;
}
