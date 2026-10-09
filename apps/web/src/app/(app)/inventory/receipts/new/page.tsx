import type { Metadata } from 'next';
import { GoodsReceiptNewView } from '@/features/goods-receipts/components/goods-receipt-new-view';

export const metadata: Metadata = { title: 'New goods receipt' };

export default function Page() {
  return <GoodsReceiptNewView />;
}
