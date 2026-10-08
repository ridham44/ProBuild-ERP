import type { Metadata } from 'next';
import { SuppliersView } from '@/features/suppliers/components/suppliers-view';

export const metadata: Metadata = { title: 'Suppliers' };

export default function SuppliersPage() {
  return <SuppliersView />;
}
