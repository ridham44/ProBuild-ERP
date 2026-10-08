import type { Metadata } from 'next';
import { ItemDetailView } from '@/features/items/components/item-detail-view';

export const metadata: Metadata = { title: 'Item' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemDetailView id={id} />;
}
