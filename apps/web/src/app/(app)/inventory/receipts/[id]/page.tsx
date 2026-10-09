import type { Metadata } from 'next';
import { GoodsReceiptDetailView } from '@/features/goods-receipts/components/goods-receipt-detail-view';

export const metadata: Metadata = { title: 'Goods receipt' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GoodsReceiptDetailView id={id} />;
}
