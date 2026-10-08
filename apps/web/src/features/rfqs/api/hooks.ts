'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type {
  awardRfqSchema,
  createQuotationSchema,
  createRfqSchema,
  updateQuotationSchema,
  updateRfqSchema,
} from '@probuild/shared';
import { api } from '@/lib/api/browser';
import { apiBody, apiQuery, unwrapAs } from '@/lib/api/errors';
import type {
  ActivityItem,
  Comparison,
  Page,
  QuotationDetail,
  QuotationRow,
  RfqDetail,
  RfqRow,
} from '@/lib/api/types';
import { requisitionKeys } from '@/features/requisitions/api/hooks';

type Filters = Record<string, string | number>;
export type RfqInput = z.input<typeof createRfqSchema>;
export type RfqUpdate = z.input<typeof updateRfqSchema>;
export type QuotationInput = z.input<typeof createQuotationSchema>;
export type QuotationUpdate = z.input<typeof updateQuotationSchema>;
export type AwardInput = z.input<typeof awardRfqSchema>;

export const rfqKeys = {
  all: ['rfqs'] as const,
  lists: () => [...rfqKeys.all, 'list'] as const,
  list: (filters: Filters) => [...rfqKeys.lists(), filters] as const,
  detail: (id: string) => [...rfqKeys.all, 'detail', id] as const,
  comparison: (id: string) => [...rfqKeys.detail(id), 'comparison'] as const,
  activity: (id: string) => [...rfqKeys.detail(id), 'activity'] as const,
  quotations: () => ['quotations'] as const,
  quotationList: (filters: Filters) => [...rfqKeys.quotations(), 'list', filters] as const,
  quotation: (id: string) => [...rfqKeys.quotations(), 'detail', id] as const,
};

export function useRfqs(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: rfqKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<RfqRow>>(await api.GET('/v1/rfqs', { params: { query: apiQuery(filters) } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRfq(id: string, enabled = true) {
  return useQuery({
    queryKey: rfqKeys.detail(id),
    queryFn: async () =>
      unwrapAs<RfqDetail>(await api.GET('/v1/rfqs/{id}', { params: { path: { id } } })),
    enabled,
  });
}

export function useComparison(id: string, enabled = true) {
  return useQuery({
    queryKey: rfqKeys.comparison(id),
    queryFn: async () =>
      unwrapAs<Comparison>(await api.GET('/v1/rfqs/{id}/comparison', { params: { path: { id } } })),
    enabled,
  });
}

export function useRfqActivity(id: string) {
  return useQuery({
    queryKey: rfqKeys.activity(id),
    queryFn: async () =>
      unwrapAs<ActivityItem[]>(await api.GET('/v1/rfqs/{id}/activity', { params: { path: { id } } })),
  });
}

function useRefreshRfq() {
  const queryClient = useQueryClient();
  return (id: string) => {
    void queryClient.invalidateQueries({ queryKey: rfqKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: rfqKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: rfqKeys.quotations() });
    void queryClient.invalidateQueries({ queryKey: requisitionKeys.all });
  };
}

export function useCreateRfq() {
  const refresh = useRefreshRfq();
  return useMutation({
    mutationFn: async (body: RfqInput) =>
      unwrapAs<RfqDetail>(await api.POST('/v1/rfqs', { body: apiBody(body) })),
    onSuccess: (rfq) => refresh(rfq.id),
  });
}

export function useUpdateRfq(id: string) {
  const refresh = useRefreshRfq();
  return useMutation({
    mutationFn: async (body: RfqUpdate) =>
      unwrapAs<RfqDetail>(await api.PATCH('/v1/rfqs/{id}', { params: { path: { id } }, body: apiBody(body) })),
    onSuccess: () => refresh(id),
  });
}

export function useSendRfq(id: string) {
  const refresh = useRefreshRfq();
  return useMutation({
    mutationFn: async () =>
      unwrapAs<RfqDetail>(await api.POST('/v1/rfqs/{id}/send', { params: { path: { id } } })),
    onSuccess: () => refresh(id),
  });
}

export function useCloseOrCancelRfq(id: string) {
  const refresh = useRefreshRfq();
  return useMutation({
    mutationFn: async (input: { action: 'cancel' | 'close'; reason: string }) =>
      input.action === 'cancel'
        ? unwrapAs<RfqDetail>(
            await api.POST('/v1/rfqs/{id}/cancel', { params: { path: { id } }, body: apiBody({ reason: input.reason }) }),
          )
        : unwrapAs<RfqDetail>(
            await api.POST('/v1/rfqs/{id}/close', { params: { path: { id } }, body: apiBody({ reason: input.reason }) }),
          ),
    onSuccess: () => refresh(id),
  });
}

export function useAwardRfq(id: string) {
  const refresh = useRefreshRfq();
  return useMutation({
    mutationFn: async (input: AwardInput & { idempotencyKey: string }) => {
      const { idempotencyKey, ...body } = input;
      return unwrapAs<RfqDetail>(
        await api.POST('/v1/rfqs/{id}/award', {
          params: { path: { id }, header: { 'Idempotency-Key': idempotencyKey } },
          body: apiBody(body),
        }),
      );
    },
    onSuccess: () => refresh(id),
  });
}

export function useCreateQuotation(rfqId: string) {
  const refresh = useRefreshRfq();
  return useMutation({
    mutationFn: async (body: QuotationInput) =>
      unwrapAs<QuotationDetail>(
        await api.POST('/v1/rfqs/{id}/quotations', { params: { path: { id: rfqId } }, body: apiBody(body) }),
      ),
    onSuccess: () => refresh(rfqId),
  });
}

export function useReviseQuotation(rfqId: string, quotationId: string) {
  const refresh = useRefreshRfq();
  return useMutation({
    mutationFn: async (body: QuotationUpdate) =>
      unwrapAs<QuotationDetail>(
        await api.PUT('/v1/quotations/{id}', { params: { path: { id: quotationId } }, body: apiBody(body) }),
      ),
    onSuccess: () => refresh(rfqId),
  });
}

export function useQuotation(id: string, enabled = true) {
  return useQuery({
    queryKey: rfqKeys.quotation(id),
    queryFn: async () =>
      unwrapAs<QuotationDetail>(await api.GET('/v1/quotations/{id}', { params: { path: { id } } })),
    enabled,
  });
}

export function useQuotations(filters: Filters) {
  return useQuery({
    queryKey: rfqKeys.quotationList(filters),
    queryFn: async () =>
      unwrapAs<Page<QuotationRow>>(await api.GET('/v1/quotations', { params: { query: apiQuery(filters) } })),
    placeholderData: keepPreviousData,
  });
}
