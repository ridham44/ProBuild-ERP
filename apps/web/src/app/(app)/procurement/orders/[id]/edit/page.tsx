import type { Metadata } from 'next';
import { PoEditView } from '@/features/purchase-orders/components/po-edit-view';

export const metadata: Metadata = { title: 'Edit purchase order' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PoEditView id={id} />;
}
