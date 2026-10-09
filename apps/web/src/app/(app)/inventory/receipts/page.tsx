import type { Metadata } from 'next';
import { GoodsReceiptsView } from '@/features/goods-receipts/components/goods-receipts-view';

export const metadata: Metadata = { title: 'Goods receipts' };

export default function Page() {
  return <GoodsReceiptsView />;
}
