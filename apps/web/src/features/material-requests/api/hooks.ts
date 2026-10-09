'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type { createMaterialRequestSchema } from '@probuild/shared';
import type { ComboOption } from '@/components/common/combobox';
import { api } from '@/lib/api/browser';
import { apiBody, apiQuery, unwrapAs } from '@/lib/api/errors';
import type { ActivityItem, MaterialRequestDetail, MaterialRequestRow, Page } from '@/lib/api/types';
import { approvalKeys } from '@/features/approvals/api/keys';
import { notificationKeys } from '@/features/notifications/api/keys';
import { stockKeys } from '@/features/stock/api/hooks';

type Filters = Record<string, string | number>;
export type MaterialRequestInput = z.input<typeof createMaterialRequestSchema>;

export const mrKeys = {
  all: ['material-requests'] as const,
  lists: () => [...mrKeys.all, 'list'] as const,
  list: (filters: Filters) => [...mrKeys.lists(), filters] as const,
  detail: (id: string) => [...mrKeys.all, 'detail', id] as const,
  activity: (id: string) => [...mrKeys.detail(id), 'activity'] as const,
};

export function useMaterialRequests(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: mrKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<MaterialRequestRow>>(
        await api.GET('/v1/material-requests', { params: { query: apiQuery(filters) } }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMaterialRequest(id: string, enabled = true) {
  return useQuery({
    queryKey: mrKeys.detail(id),
    queryFn: async () =>
      unwrapAs<MaterialRequestDetail>(
        await api.GET('/v1/material-requests/{id}', { params: { path: { id } } }),
      ),
    enabled,
  });
}

export function useMaterialRequestActivity(id: string) {
  return useQuery({
    queryKey: mrKeys.activity(id),
    queryFn: async () =>
      unwrapAs<ActivityItem[]>(
        await api.GET('/v1/material-requests/{id}/activity', { params: { path: { id } } }),
      ),
  });
}

/** Approved requests with quantity left to issue, for the "new issue" picker. */
export async function searchIssuableRequestOptions(search: string): Promise<ComboOption[]> {
  const page = unwrapAs<Page<MaterialRequestRow>>(
    await api.GET('/v1/material-requests', {
      params: { query: apiQuery({ limit: 20, issuable: 'true', ...(search ? { search } : {}) }) },
    }),
  );
  return page.items.map((request) => ({
    value: request.id,
    label: request.number,
    description: `${request.project.code} · ${request.warehouse.name}`,
  }));
}

function useRefreshRequests() {
  const queryClient = useQueryClient();
  return (id: string) => {
    void queryClient.invalidateQueries({ queryKey: mrKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: mrKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: approvalKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    void queryClient.invalidateQueries({ queryKey: stockKeys.all });
  };
}

/** The API does not take an Idempotency-Key on create; a duplicate draft is harmless and can be cancelled. */
export function useCreateMaterialRequest() {
  const refresh = useRefreshRequests();
  return useMutation({
    mutationFn: async (body: MaterialRequestInput) =>
      unwrapAs<MaterialRequestDetail>(await api.POST('/v1/material-requests', { body: apiBody(body) })),
    onSuccess: (request) => refresh(request.id),
  });
}

export function useSubmitMaterialRequest(id: string) {
  const refresh = useRefreshRequests();
  return useMutation({
    mutationFn: async (idempotencyKey: string) =>
      unwrapAs<MaterialRequestDetail>(
        await api.POST('/v1/material-requests/{id}/submit', {
          params: { path: { id }, header: { 'Idempotency-Key': idempotencyKey } },
        }),
      ),
    onSuccess: () => refresh(id),
  });
}

export function useDecideMaterialRequest(id: string) {
  const refresh = useRefreshRequests();
  return useMutation({
    mutationFn: async (input: { decision: 'approve' | 'reject'; comment?: string; idempotencyKey: string }) => {
      const params = { path: { id }, header: { 'Idempotency-Key': input.idempotencyKey } };
      return input.decision === 'approve'
        ? unwrapAs<MaterialRequestDetail>(
            await api.POST('/v1/material-requests/{id}/approve', {
              params,
              body: apiBody(input.comment ? { comment: input.comment } : {}),
            }),
          )
        : unwrapAs<MaterialRequestDetail>(
            await api.POST('/v1/material-requests/{id}/reject', {
              params,
              body: apiBody({ comment: input.comment ?? '' }),
            }),
          );
    },
    onSuccess: () => refresh(id),
  });
}

export function useCancelOrCloseMaterialRequest(id: string) {
  const refresh = useRefreshRequests();
  return useMutation({
    mutationFn: async (input: { action: 'cancel' | 'close'; reason: string }) =>
      input.action === 'cancel'
        ? unwrapAs<MaterialRequestDetail>(
            await api.POST('/v1/material-requests/{id}/cancel', {
              params: { path: { id } },
              body: apiBody({ reason: input.reason }),
            }),
          )
        : unwrapAs<MaterialRequestDetail>(
            await api.POST('/v1/material-requests/{id}/close', {
              params: { path: { id } },
              body: apiBody({ reason: input.reason }),
            }),
          ),
    onSuccess: () => refresh(id),
  });
}
