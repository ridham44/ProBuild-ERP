import type { Metadata } from 'next';
import { CustomerDetailView } from '@/features/customers/components/customer-detail-view';

export const metadata: Metadata = { title: 'Customer' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetailView id={id} />;
}
