import type { Metadata } from 'next';
import { MaterialIssueNewView } from '@/features/material-issues/components/material-issue-new-view';

export const metadata: Metadata = { title: 'New material issue' };

export default function Page() {
  return <MaterialIssueNewView />;
}
