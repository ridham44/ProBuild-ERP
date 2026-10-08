'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  createSupplierEvaluationSchema,
  CreateContactInput,
  CreateSupplierInput,
  setAccreditationSchema,
  UpdateSupplierInput,
} from '@probuild/shared';
import type { z } from 'zod';
import type { ComboOption } from '@/components/common/combobox';
import { api } from '@/lib/api/browser';
import { apiBody, apiQuery, unwrapAs, unwrapVoid } from '@/lib/api/errors';
import type {
  ActivityItem,
  Contact,
  Page,
  Supplier,
  SupplierDetail,
  SupplierEvaluation,
  SupplierPerformance,
  SupplierPurchaseRow,
} from '@/lib/api/types';
import { supplierKeys, type SupplierFilters } from './keys';

type EvaluationInput = z.input<typeof createSupplierEvaluationSchema>;
type AccreditationInput = z.input<typeof setAccreditationSchema>;

export function useSuppliers(filters: SupplierFilters, enabled = true) {
  return useQuery({
    queryKey: supplierKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<Supplier>>(await api.GET('/v1/suppliers', { params: { query: apiQuery(filters) } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: supplierKeys.detail(id),
    queryFn: async () =>
      unwrapAs<SupplierDetail>(await api.GET('/v1/suppliers/{id}', { params: { path: { id } } })),
  });
}

/** Option search for supplier pickers (RFQ invitations, item preferred supplier). */
export async function searchSupplierOptions(search: string): Promise<ComboOption[]> {
  const page = unwrapAs<Page<Supplier>>(
    await api.GET('/v1/suppliers', {
      params: { query: apiQuery({ limit: 20, active: 'true', ...(search ? { search } : {}) }) },
    }),
  );
  return page.items.map((supplier) => ({
    value: supplier.id,
    label: supplier.name,
    description: `${supplier.code}${supplier.accredited ? ' · Accredited' : ''}`,
  }));
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateSupplierInput) =>
      unwrapAs<Supplier>(await api.POST('/v1/suppliers', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplierKeys.lists() }),
  });
}

export function useUpdateSupplier(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateSupplierInput) =>
      unwrapAs<Supplier>(
        await api.PATCH('/v1/suppliers/{id}', { params: { path: { id } }, body: apiBody(body) }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
    },
  });
}

export function useSetAccreditation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AccreditationInput) =>
      unwrapAs<Supplier>(
        await api.PUT('/v1/suppliers/{id}/accreditation', {
          params: { path: { id } },
          body: apiBody(body),
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
    },
  });
}

export function useSaveSupplierContact(supplierId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contactId?: string; body: Partial<CreateContactInput> }) =>
      input.contactId
        ? unwrapAs<Contact>(
            await api.PATCH('/v1/suppliers/{id}/contacts/{contactId}', {
              params: { path: { id: supplierId, contactId: input.contactId } },
              body: apiBody(input.body),
            }),
          )
        : unwrapAs<Contact>(
            await api.POST('/v1/suppliers/{id}/contacts', {
              params: { path: { id: supplierId } },
              body: apiBody(input.body),
            }),
          ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplierKeys.detail(supplierId) }),
  });
}

export function useDeleteSupplierContact(supplierId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: string) =>
      unwrapVoid(
        await api.DELETE('/v1/suppliers/{id}/contacts/{contactId}', {
          params: { path: { id: supplierId, contactId } },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplierKeys.detail(supplierId) }),
  });
}

export function useSupplierEvaluations(id: string) {
  return useQuery({
    queryKey: supplierKeys.evaluations(id),
    queryFn: async () =>
      unwrapAs<Page<SupplierEvaluation>>(
        await api.GET('/v1/suppliers/{id}/evaluations', {
          params: { path: { id }, query: apiQuery({ limit: 50 }) },
        }),
      ),
  });
}

export function useCreateEvaluation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: EvaluationInput) =>
      unwrapAs<SupplierEvaluation>(
        await api.POST('/v1/suppliers/{id}/evaluations', {
          params: { path: { id } },
          body: apiBody(body),
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.evaluations(id) });
      void queryClient.invalidateQueries({ queryKey: supplierKeys.performance(id) });
    },
  });
}

export function useSupplierPerformance(id: string) {
  return useQuery({
    queryKey: supplierKeys.performance(id),
    queryFn: async () =>
      unwrapAs<SupplierPerformance>(
        await api.GET('/v1/suppliers/{id}/performance', { params: { path: { id } } }),
      ),
  });
}

export function useSupplierHistory(id: string, filters: SupplierFilters) {
  return useQuery({
    queryKey: supplierKeys.history(id, filters),
    queryFn: async () =>
      unwrapAs<Page<SupplierPurchaseRow>>(
        await api.GET('/v1/suppliers/{id}/purchase-history', {
          params: { path: { id }, query: apiQuery(filters) },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useSupplierActivity(id: string) {
  return useQuery({
    queryKey: supplierKeys.activity(id),
    queryFn: async () =>
      unwrapAs<ActivityItem[]>(
        await api.GET('/v1/suppliers/{id}/activity', { params: { path: { id } } }),
      ),
  });
}
