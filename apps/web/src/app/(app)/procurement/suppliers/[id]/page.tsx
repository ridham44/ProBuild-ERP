import type { Metadata } from 'next';
import { SupplierDetailView } from '@/features/suppliers/components/supplier-detail-view';

export const metadata: Metadata = { title: 'Supplier' };

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierDetailView id={id} />;
}
