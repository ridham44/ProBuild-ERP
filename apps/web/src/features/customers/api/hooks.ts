'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateContactInput, CreateCustomerInput, UpdateCustomerInput } from '@probuild/shared';
import type { ComboOption } from '@/components/common/combobox';
import { api } from '@/lib/api/browser';
import { apiBody, apiQuery, unwrapAs, unwrapVoid } from '@/lib/api/errors';
import type { ActivityItem, Contact, Customer, CustomerDetail, Page } from '@/lib/api/types';

type Filters = Record<string, string | number>;

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters: Filters) => [...customerKeys.lists(), filters] as const,
  detail: (id: string) => [...customerKeys.all, 'detail', id] as const,
  activity: (id: string) => [...customerKeys.detail(id), 'activity'] as const,
};

export function useCustomers(filters: Filters) {
  return useQuery({
    queryKey: customerKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<Customer>>(await api.GET('/v1/customers', { params: { query: apiQuery(filters) } })),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: async () =>
      unwrapAs<CustomerDetail>(await api.GET('/v1/customers/{id}', { params: { path: { id } } })),
  });
}

export async function searchCustomerOptions(search: string): Promise<ComboOption[]> {
  const page = unwrapAs<Page<Customer>>(
    await api.GET('/v1/customers', {
      params: { query: apiQuery({ limit: 20, active: 'true', ...(search ? { search } : {}) }) },
    }),
  );
  return page.items.map((customer) => ({
    value: customer.id,
    label: customer.name,
    description: customer.code,
  }));
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCustomerInput) =>
      unwrapAs<Customer>(await api.POST('/v1/customers', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.lists() }),
  });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateCustomerInput) =>
      unwrapAs<Customer>(
        await api.PATCH('/v1/customers/{id}', { params: { path: { id } }, body: apiBody(body) }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useSaveCustomerContact(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contactId?: string; body: Partial<CreateContactInput> }) =>
      input.contactId
        ? unwrapAs<Contact>(
            await api.PATCH('/v1/customers/{id}/contacts/{contactId}', {
              params: { path: { id: customerId, contactId: input.contactId } },
              body: apiBody(input.body),
            }),
          )
        : unwrapAs<Contact>(
            await api.POST('/v1/customers/{id}/contacts', {
              params: { path: { id: customerId } },
              body: apiBody(input.body),
            }),
          ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
  });
}

export function useDeleteCustomerContact(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: string) =>
      unwrapVoid(
        await api.DELETE('/v1/customers/{id}/contacts/{contactId}', {
          params: { path: { id: customerId, contactId } },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
  });
}

export function useCustomerActivity(id: string) {
  return useQuery({
    queryKey: customerKeys.activity(id),
    queryFn: async () =>
      unwrapAs<ActivityItem[]>(
        await api.GET('/v1/customers/{id}/activity', { params: { path: { id } } }),
      ),
  });
}
