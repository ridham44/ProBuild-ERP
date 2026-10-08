'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/browser';
import type { ApprovalBase, ApprovalFilters, ApprovalRequestDto, Page, WorkflowDto, WorkflowInput } from '@/lib/api/types';
import { apiBody, unwrapAs } from '@/lib/api/errors';
import { notificationKeys } from '@/features/notifications/api/keys';
import { approvalKeys } from './keys';

export function useApprovals(filters: ApprovalFilters, enabled = true) {
  return useQuery({
    queryKey: approvalKeys.list(filters),
    queryFn: async () => unwrapAs<Page<ApprovalRequestDto>>(await api.GET('/v1/approvals', { params: { query: filters } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export type DecisionInput = { id: string; decision: 'approve' | 'reject'; comment?: string };

export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, comment }: DecisionInput) => {
      const body = apiBody(comment ? { comment } : {});
      return decision === 'approve'
        ? unwrapAs<ApprovalBase>(await api.POST('/v1/approvals/{id}/approve', { params: { path: { id } }, body }))
        : unwrapAs<ApprovalBase>(await api.POST('/v1/approvals/{id}/reject', { params: { path: { id } }, body }));
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
    queryFn: async () => unwrapAs<WorkflowDto[]>(await api.GET('/v1/approval-workflows')),
    enabled,
  });
}

export function useUpsertWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: WorkflowInput) =>
      unwrapAs<WorkflowDto>(await api.PUT('/v1/approval-workflows', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: approvalKeys.workflows() }),
  });
}
