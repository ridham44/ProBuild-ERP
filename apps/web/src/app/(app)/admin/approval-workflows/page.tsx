import type { Metadata } from 'next';
import { WorkflowsView } from '@/features/approvals/components/workflows-view';

export const metadata: Metadata = { title: 'Approval workflows' };

export default function ApprovalWorkflowsPage() {
  return <WorkflowsView />;
}
