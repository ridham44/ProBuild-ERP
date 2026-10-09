'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type { createMaterialIssueSchema } from '@probuild/shared';
import { api } from '@/lib/api/browser';
import { apiBody, apiQuery, unwrapAs } from '@/lib/api/errors';
import type { ActivityItem, MaterialIssueDetail, MaterialIssueRow, Page } from '@/lib/api/types';
import { mrKeys } from '@/features/material-requests/api/hooks';
import { projectKeys } from '@/features/projects/api/keys';
import { stockKeys } from '@/features/stock/api/hooks';
import { warehouseKeys } from '@/features/warehouses/api/hooks';

type Filters = Record<string, string | number>;
export type MaterialIssueInput = z.input<typeof createMaterialIssueSchema>;

export const miKeys = {
  all: ['material-issues'] as const,
  lists: () => [...miKeys.all, 'list'] as const,
  list: (filters: Filters) => [...miKeys.lists(), filters] as const,
  detail: (id: string) => [...miKeys.all, 'detail', id] as const,
  activity: (id: string) => [...miKeys.detail(id), 'activity'] as const,
};

export function useMaterialIssues(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: miKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<MaterialIssueRow>>(
        await api.GET('/v1/material-issues', { params: { query: apiQuery(filters) } }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMaterialIssue(id: string, enabled = true) {
  return useQuery({
    queryKey: miKeys.detail(id),
    queryFn: async () =>
      unwrapAs<MaterialIssueDetail>(await api.GET('/v1/material-issues/{id}', { params: { path: { id } } })),
    enabled,
  });
}

export function useMaterialIssueActivity(id: string) {
  return useQuery({
    queryKey: miKeys.activity(id),
    queryFn: async () =>
      unwrapAs<ActivityItem[]>(
        await api.GET('/v1/material-issues/{id}/activity', { params: { path: { id } } }),
      ),
  });
}

function useRefreshIssues() {
  const queryClient = useQueryClient();
  return (id: string) => {
    void queryClient.invalidateQueries({ queryKey: miKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: miKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: mrKeys.all });
    void queryClient.invalidateQueries({ queryKey: stockKeys.all });
    void queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    void queryClient.invalidateQueries({ queryKey: projectKeys.all });
  };
}

/** The API does not take an Idempotency-Key on create; a duplicate draft is harmless and can be cancelled. */
export function useCreateMaterialIssue() {
  const refresh = useRefreshIssues();
  return useMutation({
    mutationFn: async (body: MaterialIssueInput) =>
      unwrapAs<MaterialIssueDetail>(await api.POST('/v1/material-issues', { body: apiBody(body) })),
    onSuccess: (issue) => refresh(issue.id),
  });
}

export function usePostMaterialIssue(id: string) {
  const refresh = useRefreshIssues();
  return useMutation({
    mutationFn: async (idempotencyKey: string) =>
      unwrapAs<MaterialIssueDetail>(
        await api.POST('/v1/material-issues/{id}/post', {
          params: { path: { id }, header: { 'Idempotency-Key': idempotencyKey } },
        }),
      ),
    onSuccess: () => refresh(id),
  });
}

export function useCancelMaterialIssue(id: string) {
  const refresh = useRefreshIssues();
  return useMutation({
    mutationFn: async (input: { reason: string; idempotencyKey: string }) =>
      unwrapAs<MaterialIssueDetail>(
        await api.POST('/v1/material-issues/{id}/cancel', {
          params: { path: { id }, header: { 'Idempotency-Key': input.idempotencyKey } },
          body: apiBody({ reason: input.reason }),
        }),
      ),
    onSuccess: () => refresh(id),
  });
}
