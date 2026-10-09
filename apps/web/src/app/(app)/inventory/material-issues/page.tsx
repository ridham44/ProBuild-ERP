import type { Metadata } from 'next';
import { MaterialIssuesView } from '@/features/material-issues/components/material-issues-view';

export const metadata: Metadata = { title: 'Material issues' };

export default function Page() {
  return <MaterialIssuesView />;
}
