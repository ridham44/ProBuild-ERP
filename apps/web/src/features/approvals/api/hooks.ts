'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/browser';
import type { ApprovalFilters, WorkflowInput } from '@/lib/api/contract';
import { unwrap } from '@/lib/api/errors';
import { notificationKeys } from '@/features/notifications/api/keys';
import { approvalKeys } from './keys';

export function useApprovals(filters: ApprovalFilters, enabled = true) {
  return useQuery({
    queryKey: approvalKeys.list(filters),
    queryFn: async () => unwrap(await api.GET('/v1/approvals', { params: { query: filters } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export type DecisionInput = { id: string; decision: 'approve' | 'reject'; comment?: string };

export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, comment }: DecisionInput) => {
      const body = comment ? { comment } : {};
      return decision === 'approve'
        ? unwrap(await api.POST('/v1/approvals/{id}/approve', { params: { path: { id } }, body }))
        : unwrap(await api.POST('/v1/approvals/{id}/reject', { params: { path: { id } }, body }));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: approvalKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

export function useWorkflows(enabled = true) {
  return useQuery({
    queryKey: approvalKeys.workflows(),
    queryFn: async () => unwrap(await api.GET('/v1/approval-workflows')),
    enabled,
  });
}

export function useUpsertWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: WorkflowInput) =>
      unwrap(await api.PUT('/v1/approval-workflows', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: approvalKeys.workflows() }),
  });
}
