import type { Metadata } from 'next';
import { RequisitionDetailView } from '@/features/requisitions/components/requisition-detail-view';

export const metadata: Metadata = { title: 'Requisition' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequisitionDetailView id={id} />;
}
