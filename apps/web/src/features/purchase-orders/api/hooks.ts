'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type { createPurchaseOrderSchema, updatePurchaseOrderSchema } from '@probuild/shared';
import { api } from '@/lib/api/browser';
import { apiBody, apiQuery, unwrapAs } from '@/lib/api/errors';
import type { ActivityItem, Page, PurchaseOrderDetail, PurchaseOrderRow } from '@/lib/api/types';
import { approvalKeys } from '@/features/approvals/api/keys';
import { notificationKeys } from '@/features/notifications/api/keys';
import { requisitionKeys } from '@/features/requisitions/api/hooks';
import { rfqKeys } from '@/features/rfqs/api/hooks';

type Filters = Record<string, string | number>;
export type PurchaseOrderInput = z.input<typeof createPurchaseOrderSchema>;
export type PurchaseOrderUpdate = z.input<typeof updatePurchaseOrderSchema>;

export const poKeys = {
  all: ['purchase-orders'] as const,
  lists: () => [...poKeys.all, 'list'] as const,
  list: (filters: Filters) => [...poKeys.lists(), filters] as const,
  detail: (id: string) => [...poKeys.all, 'detail', id] as const,
  activity: (id: string) => [...poKeys.detail(id), 'activity'] as const,
};

export function usePurchaseOrders(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: poKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<PurchaseOrderRow>>(
        await api.GET('/v1/purchase-orders', { params: { query: apiQuery(filters) } }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePurchaseOrder(id: string, enabled = true) {
  return useQuery({
    queryKey: poKeys.detail(id),
    queryFn: async () =>
      unwrapAs<PurchaseOrderDetail>(
        await api.GET('/v1/purchase-orders/{id}', { params: { path: { id } } }),
      ),
    enabled,
  });
}

export function usePurchaseOrderActivity(id: string) {
  return useQuery({
    queryKey: poKeys.activity(id),
    queryFn: async () =>
      unwrapAs<ActivityItem[]>(
        await api.GET('/v1/purchase-orders/{id}/activity', { params: { path: { id } } }),
      ),
  });
}

function useRefreshPo() {
  const queryClient = useQueryClient();
  return (id: string) => {
    void queryClient.invalidateQueries({ queryKey: poKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: poKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: approvalKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    void queryClient.invalidateQueries({ queryKey: requisitionKeys.all });
    void queryClient.invalidateQueries({ queryKey: rfqKeys.all });
  };
}

/** Idempotent: one key per user intent, reused when the same click is retried. */
export function useCreatePurchaseOrder() {
  const refresh = useRefreshPo();
  return useMutation({
    mutationFn: async (input: { body: PurchaseOrderInput; idempotencyKey: string }) =>
      unwrapAs<PurchaseOrderDetail>(
        await api.POST('/v1/purchase-orders', {
          params: { header: { 'Idempotency-Key': input.idempotencyKey } },
          body: apiBody(input.body),
        }),
      ),
    onSuccess: (po) => refresh(po.id),
  });
}

export function useUpdatePurchaseOrder(id: string) {
  const refresh = useRefreshPo();
  return useMutation({
    mutationFn: async (body: PurchaseOrderUpdate) =>
      unwrapAs<PurchaseOrderDetail>(
        await api.PATCH('/v1/purchase-orders/{id}', { params: { path: { id } }, body: apiBody(body) }),
      ),
    onSuccess: () => refresh(id),
  });
}

export function useSubmitPurchaseOrder(id: string) {
  const refresh = useRefreshPo();
  return useMutation({
    mutationFn: async (idempotencyKey: string) =>
      unwrapAs<PurchaseOrderDetail>(
        await api.POST('/v1/purchase-orders/{id}/submit', {
          params: { path: { id }, header: { 'Idempotency-Key': idempotencyKey } },
        }),
      ),
    onSuccess: () => refresh(id),
  });
}

export function useDecidePurchaseOrder(id: string) {
  const refresh = useRefreshPo();
  return useMutation({
    mutationFn: async (input: { decision: 'approve' | 'reject'; comment?: string; idempotencyKey: string }) => {
      const params = { path: { id }, header: { 'Idempotency-Key': input.idempotencyKey } };
      return input.decision === 'approve'
        ? unwrapAs<PurchaseOrderDetail>(
            await api.POST('/v1/purchase-orders/{id}/approve', {
              params,
              body: apiBody(input.comment ? { comment: input.comment } : {}),
            }),
          )
        : unwrapAs<PurchaseOrderDetail>(
            await api.POST('/v1/purchase-orders/{id}/reject', {
              params,
              body: apiBody({ comment: input.comment ?? '' }),
            }),
          );
    },
    onSuccess: () => refresh(id),
  });
}

export function useSendPurchaseOrder(id: string) {
  const refresh = useRefreshPo();
  return useMutation({
    mutationFn: async () =>
      unwrapAs<PurchaseOrderDetail>(
        await api.POST('/v1/purchase-orders/{id}/send', { params: { path: { id } } }),
      ),
    onSuccess: () => refresh(id),
  });
}

export function useCloseOrCancelPurchaseOrder(id: string) {
  const refresh = useRefreshPo();
  return useMutation({
    mutationFn: async (input: { action: 'cancel' | 'close'; reason: string }) =>
      input.action === 'cancel'
        ? unwrapAs<PurchaseOrderDetail>(
            await api.POST('/v1/purchase-orders/{id}/cancel', {
              params: { path: { id } },
              body: apiBody({ reason: input.reason }),
            }),
          )
        : unwrapAs<PurchaseOrderDetail>(
            await api.POST('/v1/purchase-orders/{id}/close', {
              params: { path: { id } },
              body: apiBody({ reason: input.reason }),
            }),
          ),
    onSuccess: () => refresh(id),
  });
}
