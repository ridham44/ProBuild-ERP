import type { Metadata } from 'next';
import { BranchesView } from '@/features/branches/components/branches-view';

export const metadata: Metadata = { title: 'Branches' };

export default function BranchesPage() {
  return <BranchesView />;
}
