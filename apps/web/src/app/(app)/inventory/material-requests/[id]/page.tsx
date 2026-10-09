import type { Metadata } from 'next';
import { MaterialRequestDetailView } from '@/features/material-requests/components/material-request-detail-view';

export const metadata: Metadata = { title: 'Material request' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MaterialRequestDetailView id={id} />;
}
