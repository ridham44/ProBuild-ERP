import type { Metadata } from 'next';
import { WarehouseDetailView } from '@/features/warehouses/components/warehouse-detail-view';

export const metadata: Metadata = { title: 'Warehouse' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WarehouseDetailView id={id} />;
}
