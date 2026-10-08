import type { Metadata } from 'next';
import { RequisitionEditView } from '@/features/requisitions/components/requisition-edit-view';

export const metadata: Metadata = { title: 'Edit requisition' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequisitionEditView id={id} />;
}
