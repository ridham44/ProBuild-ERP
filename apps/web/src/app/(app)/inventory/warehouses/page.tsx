import type { Metadata } from 'next';
import { WarehousesView } from '@/features/warehouses/components/warehouses-view';

export const metadata: Metadata = { title: 'Warehouses' };

export default function Page() {
  return <WarehousesView />;
}
