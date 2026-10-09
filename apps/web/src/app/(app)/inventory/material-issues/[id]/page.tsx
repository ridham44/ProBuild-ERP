import type { Metadata } from 'next';
import { MaterialIssueDetailView } from '@/features/material-issues/components/material-issue-detail-view';

export const metadata: Metadata = { title: 'Material issue' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MaterialIssueDetailView id={id} />;
}
