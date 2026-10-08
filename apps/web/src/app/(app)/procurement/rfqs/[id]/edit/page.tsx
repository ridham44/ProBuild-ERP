import type { Metadata } from 'next';
import { RfqEditView } from '@/features/rfqs/components/rfq-edit-view';

export const metadata: Metadata = { title: 'Edit RFQ' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RfqEditView id={id} />;
}
