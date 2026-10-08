import type { Metadata } from 'next';
import { PurchaseOrdersView } from '@/features/purchase-orders/components/purchase-orders-view';

export const metadata: Metadata = { title: 'Purchase orders' };

export default function Page() {
  return <PurchaseOrdersView />;
}
