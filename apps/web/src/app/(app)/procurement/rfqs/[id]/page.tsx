import type { Metadata } from 'next';
import { RfqDetailView } from '@/features/rfqs/components/rfq-detail-view';

export const metadata: Metadata = { title: 'RFQ' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RfqDetailView id={id} />;
}
