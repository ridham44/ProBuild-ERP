'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type { createGoodsReceiptSchema, inspectionSchema, postGoodsReceiptSchema } from '@probuild/shared';
import type { ComboOption } from '@/components/common/combobox';
import { api } from '@/lib/api/browser';
import { apiBody, apiQuery, unwrapAs } from '@/lib/api/errors';
import type {
  ActivityItem,
  GoodsReceiptDetail,
  GoodsReceiptRow,
  Page,
  PurchaseOrderRow,
  ReceivableLines,
} from '@/lib/api/types';
import { itemKeys } from '@/features/items/api/hooks';
import { poKeys } from '@/features/purchase-orders/api/hooks';
import { stockKeys } from '@/features/stock/api/hooks';
import { warehouseKeys } from '@/features/warehouses/api/hooks';

type Filters = Record<string, string | number>;
export type GoodsReceiptInput = z.input<typeof createGoodsReceiptSchema>;
export type InspectionInput = z.input<typeof inspectionSchema>;
export type PostGoodsReceiptInput = z.input<typeof postGoodsReceiptSchema>;

export const grnKeys = {
  all: ['goods-receipts'] as const,
  lists: () => [...grnKeys.all, 'list'] as const,
  list: (filters: Filters) => [...grnKeys.lists(), filters] as const,
  detail: (id: string) => [...grnKeys.all, 'detail', id] as const,
  activity: (id: string) => [...grnKeys.detail(id), 'activity'] as const,
  receivable: (orderId: string) => [...grnKeys.all, 'receivable', orderId] as const,
};

export function useGoodsReceipts(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: grnKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<GoodsReceiptRow>>(
        await api.GET('/v1/goods-receipts', { params: { query: apiQuery(filters) } }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useGoodsReceipt(id: string, enabled = true) {
  return useQuery({
    queryKey: grnKeys.detail(id),
    queryFn: async () =>
      unwrapAs<GoodsReceiptDetail>(await api.GET('/v1/goods-receipts/{id}', { params: { path: { id } } })),
    enabled,
  });
}

export function useGoodsReceiptActivity(id: string) {
  return useQuery({
    queryKey: grnKeys.activity(id),
    queryFn: async () =>
      unwrapAs<ActivityItem[]>(
        await api.GET('/v1/goods-receipts/{id}/activity', { params: { path: { id } } }),
      ),
  });
}

export function useReceivableLines(orderId: string) {
  return useQuery({
    queryKey: grnKeys.receivable(orderId),
    queryFn: async () =>
      unwrapAs<ReceivableLines>(
        await api.GET('/v1/purchase-orders/{orderId}/receivable-lines', { params: { path: { orderId } } }),
      ),
    enabled: Boolean(orderId),
  });
}

const RECEIVABLE_STATUSES = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] as const;

/** Purchase orders goods can still be received against, for the "new receipt" picker. */
export async function searchReceivableOrderOptions(search: string): Promise<ComboOption[]> {
  const pages = await Promise.all(
    RECEIVABLE_STATUSES.map(async (status) =>
      unwrapAs<Page<PurchaseOrderRow>>(
        await api.GET('/v1/purchase-orders', {
          params: { query: apiQuery({ limit: 15, status, ...(search ? { search } : {}) }) },
        }),
      ),
    ),
  );
  return pages
    .flatMap((page) => page.items)
    .map((po) => ({
      value: po.id,
      label: po.number,
      description: `${po.supplier.name} · ${po.project.code}`,
    }));
}

function useRefreshReceipts() {
  const queryClient = useQueryClient();
  return (id: string) => {
    void queryClient.invalidateQueries({ queryKey: grnKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: grnKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: poKeys.all });
    void queryClient.invalidateQueries({ queryKey: stockKeys.all });
    void queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    void queryClient.invalidateQueries({ queryKey: itemKeys.all });
  };
}

/** The API does not take an Idempotency-Key on create; a draft receipt is harmless and can be cancelled. */
export function useCreateGoodsReceipt() {
  const refresh = useRefreshReceipts();
  return useMutation({
    mutationFn: async (body: GoodsReceiptInput) =>
      unwrapAs<GoodsReceiptDetail>(await api.POST('/v1/goods-receipts', { body: apiBody(body) })),
    onSuccess: (receipt) => refresh(receipt.id),
  });
}

export function useInspectReceiptLine(id: string) {
  const refresh = useRefreshReceipts();
  return useMutation({
    mutationFn: async (input: { lineId: string; body: InspectionInput }) =>
      unwrapAs<GoodsReceiptDetail>(
        await api.PUT('/v1/goods-receipts/{id}/lines/{lineId}/inspection', {
          params: { path: { id, lineId: input.lineId } },
          body: apiBody(input.body),
        }),
      ),
    onSuccess: () => refresh(id),
  });
}

export function usePostGoodsReceipt(id: string) {
  const refresh = useRefreshReceipts();
  return useMutation({
    mutationFn: async (input: { body: PostGoodsReceiptInput; idempotencyKey: string }) =>
      unwrapAs<GoodsReceiptDetail>(
        await api.POST('/v1/goods-receipts/{id}/post', {
          params: { path: { id }, header: { 'Idempotency-Key': input.idempotencyKey } },
          body: apiBody(input.body),
        }),
      ),
    onSuccess: () => refresh(id),
  });
}

export function useDecideQuarantine(id: string) {
  const refresh = useRefreshReceipts();
  return useMutation({
    mutationFn: async (input: { lineId: string; body: InspectionInput; idempotencyKey: string }) =>
      unwrapAs<GoodsReceiptDetail>(
        await api.POST('/v1/goods-receipts/{id}/lines/{lineId}/quarantine-decision', {
          params: { path: { id, lineId: input.lineId }, header: { 'Idempotency-Key': input.idempotencyKey } },
          body: apiBody(input.body),
        }),
      ),
    onSuccess: () => refresh(id),
  });
}

export function useCancelGoodsReceipt(id: string) {
  const refresh = useRefreshReceipts();
  return useMutation({
    mutationFn: async (input: { reason: string; idempotencyKey: string }) =>
      unwrapAs<GoodsReceiptDetail>(
        await api.POST('/v1/goods-receipts/{id}/cancel', {
          params: { path: { id }, header: { 'Idempotency-Key': input.idempotencyKey } },
          body: apiBody({ reason: input.reason }),
        }),
      ),
    onSuccess: () => refresh(id),
  });
}
