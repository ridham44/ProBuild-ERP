import type { Metadata } from 'next';
import { PoDetailView } from '@/features/purchase-orders/components/po-detail-view';

export const metadata: Metadata = { title: 'Purchase order' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PoDetailView id={id} />;
}
