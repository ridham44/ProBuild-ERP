import type { ApprovalFilters } from '@/lib/api/types';

export const approvalKeys = {
  all: ['approvals'] as const,
  lists: () => [...approvalKeys.all, 'list'] as const,
  list: (filters: ApprovalFilters) => [...approvalKeys.lists(), filters] as const,
  workflows: () => [...approvalKeys.all, 'workflows'] as const,
};
