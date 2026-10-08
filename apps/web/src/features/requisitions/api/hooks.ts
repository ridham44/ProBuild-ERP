'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type { createRequisitionSchema, updateRequisitionSchema } from '@probuild/shared';
import { api } from '@/lib/api/browser';
import { apiBody, apiQuery, unwrapAs } from '@/lib/api/errors';
import type { ActivityItem, Page, RequisitionDetail, RequisitionRow } from '@/lib/api/types';
import { approvalKeys } from '@/features/approvals/api/keys';
import { notificationKeys } from '@/features/notifications/api/keys';

type Filters = Record<string, string | number>;
export type RequisitionInput = z.input<typeof createRequisitionSchema>;
export type RequisitionUpdate = z.input<typeof updateRequisitionSchema>;

export const requisitionKeys = {
  all: ['requisitions'] as const,
  lists: () => [...requisitionKeys.all, 'list'] as const,
  list: (filters: Filters) => [...requisitionKeys.lists(), filters] as const,
  detail: (id: string) => [...requisitionKeys.all, 'detail', id] as const,
  activity: (id: string) => [...requisitionKeys.detail(id), 'activity'] as const,
};

export function useRequisitions(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: requisitionKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<RequisitionRow>>(
        await api.GET('/v1/requisitions', { params: { query: apiQuery(filters) } }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRequisition(id: string, enabled = true) {
  return useQuery({
    queryKey: requisitionKeys.detail(id),
    queryFn: async () =>
      unwrapAs<RequisitionDetail>(await api.GET('/v1/requisitions/{id}', { params: { path: { id } } })),
    enabled,
  });
}

export function useRequisitionActivity(id: string) {
  return useQuery({
    queryKey: requisitionKeys.activity(id),
    queryFn: async () =>
      unwrapAs<ActivityItem[]>(
        await api.GET('/v1/requisitions/{id}/activity', { params: { path: { id } } }),
      ),
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return (id: string) => {
    void queryClient.invalidateQueries({ queryKey: requisitionKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: requisitionKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: approvalKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
  };
}

export function useCreateRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: RequisitionInput) =>
      unwrapAs<RequisitionDetail>(await api.POST('/v1/requisitions', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: requisitionKeys.lists() }),
  });
}

export function useUpdateRequisition(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (body: RequisitionUpdate) =>
      unwrapAs<RequisitionDetail>(
        await api.PATCH('/v1/requisitions/{id}', { params: { path: { id } }, body: apiBody(body) }),
      ),
    onSuccess: () => refresh(id),
  });
}

export async function submitRequisitionCall(id: string, idempotencyKey: string): Promise<RequisitionDetail> {
  return unwrapAs<RequisitionDetail>(
    await api.POST('/v1/requisitions/{id}/submit', {
      params: { path: { id }, header: { 'Idempotency-Key': idempotencyKey } },
    }),
  );
}

/** Idempotent: pass one key per user intent and reuse it when the same click is retried. */
export function useSubmitRequisition(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (idempotencyKey: string) =>
      unwrapAs<RequisitionDetail>(
        await api.POST('/v1/requisitions/{id}/submit', {
          params: { path: { id }, header: { 'Idempotency-Key': idempotencyKey } },
        }),
      ),
    onSuccess: () => refresh(id),
  });
}

export function useDecideRequisition(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { decision: 'approve' | 'reject'; comment?: string; idempotencyKey: string }) => {
      const params = { path: { id }, header: { 'Idempotency-Key': input.idempotencyKey } };
      return input.decision === 'approve'
        ? unwrapAs<RequisitionDetail>(
            await api.POST('/v1/requisitions/{id}/approve', {
              params,
              body: apiBody(input.comment ? { comment: input.comment } : {}),
            }),
          )
        : unwrapAs<RequisitionDetail>(
            await api.POST('/v1/requisitions/{id}/reject', {
              params,
              body: apiBody({ comment: input.comment ?? '' }),
            }),
          );
    },
    onSuccess: () => refresh(id),
  });
}

export function useCloseOrCancelRequisition(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { action: 'cancel' | 'close'; reason: string }) =>
      input.action === 'cancel'
        ? unwrapAs<RequisitionDetail>(
            await api.POST('/v1/requisitions/{id}/cancel', {
              params: { path: { id } },
              body: apiBody({ reason: input.reason }),
            }),
          )
        : unwrapAs<RequisitionDetail>(
            await api.POST('/v1/requisitions/{id}/close', {
              params: { path: { id } },
              body: apiBody({ reason: input.reason }),
            }),
          ),
    onSuccess: () => refresh(id),
  });
}
