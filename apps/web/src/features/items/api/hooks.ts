'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateItemCategoryInput,
  CreateItemInput,
  CreateUomInput,
  SetItemUnitConversionInput,
  UpdateItemInput,
} from '@probuild/shared';
import type { ComboOption } from '@/components/common/combobox';
import { api } from '@/lib/api/browser';
import { apiBody, apiQuery, unwrapAs, unwrapVoid } from '@/lib/api/errors';
import type {
  ActivityItem,
  ItemCategory,
  ItemDetail,
  ItemRow,
  ItemStockSummary,
  Page,
  PriceHistoryRow,
  Uom,
} from '@/lib/api/types';

type Filters = Record<string, string | number>;

export const itemKeys = {
  all: ['items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  list: (filters: Filters) => [...itemKeys.lists(), filters] as const,
  detail: (id: string) => [...itemKeys.all, 'detail', id] as const,
  stock: (id: string) => [...itemKeys.detail(id), 'stock'] as const,
  prices: (id: string, filters: Filters) => [...itemKeys.detail(id), 'prices', filters] as const,
  activity: (id: string) => [...itemKeys.detail(id), 'activity'] as const,
  categories: () => ['item-categories'] as const,
  uoms: () => ['units-of-measure'] as const,
};

export function useItems(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: itemKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<ItemRow>>(await api.GET('/v1/items', { params: { query: apiQuery(filters) } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useItem(id: string, enabled = true) {
  return useQuery({
    queryKey: itemKeys.detail(id),
    queryFn: async () =>
      unwrapAs<ItemDetail>(await api.GET('/v1/items/{id}', { params: { path: { id } } })),
    enabled,
  });
}

const itemRowCache = new Map<string, ItemRow>();

/** Rows seen by recent searches, so a picker can read an item's units and costs after it is chosen. */
export function getCachedItem(id: string): ItemRow | undefined {
  return itemRowCache.get(id);
}

export async function searchItemRows(search: string): Promise<ItemRow[]> {
  const page = unwrapAs<Page<ItemRow>>(
    await api.GET('/v1/items', {
      params: { query: apiQuery({ limit: 25, active: 'true', ...(search ? { search } : {}) }) },
    }),
  );
  for (const row of page.items) itemRowCache.set(row.id, row);
  return page.items;
}

/** Item search for line tables and pickers; the label carries SKU so look-alike names stay distinguishable. */
export async function searchItemOptions(search: string): Promise<ComboOption[]> {
  const rows = await searchItemRows(search);
  return rows.map((item) => ({
    value: item.id,
    label: `${item.sku} · ${item.name}`,
    description: item.baseUnit,
  }));
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateItemInput) =>
      unwrapAs<ItemDetail>(await api.POST('/v1/items', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemKeys.lists() }),
  });
}

export function useUpdateItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateItemInput) =>
      unwrapAs<ItemDetail>(
        await api.PATCH('/v1/items/{id}', { params: { path: { id } }, body: apiBody(body) }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: itemKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },
  });
}

export function useSetUnitConversion(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SetItemUnitConversionInput) =>
      unwrapAs<{ id: string; unit: string; factor: string }>(
        await api.PUT('/v1/items/{id}/unit-conversions', { params: { path: { id } }, body: apiBody(body) }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemKeys.detail(id) }),
  });
}

export function useDeleteUnitConversion(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (unit: string) =>
      unwrapVoid(
        await api.DELETE('/v1/items/{id}/unit-conversions/{unit}', { params: { path: { id, unit } } }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemKeys.detail(id) }),
  });
}

export function useItemStock(id: string) {
  return useQuery({
    queryKey: itemKeys.stock(id),
    queryFn: async () =>
      unwrapAs<ItemStockSummary>(
        await api.GET('/v1/items/{id}/stock', { params: { path: { id }, query: apiQuery({}) } }),
      ),
  });
}

export function usePriceHistory(id: string, filters: Filters) {
  return useQuery({
    queryKey: itemKeys.prices(id, filters),
    queryFn: async () =>
      unwrapAs<Page<PriceHistoryRow>>(
        await api.GET('/v1/items/{id}/price-history', {
          params: { path: { id }, query: apiQuery(filters) },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useItemActivity(id: string) {
  return useQuery({
    queryKey: itemKeys.activity(id),
    queryFn: async () =>
      unwrapAs<ActivityItem[]>(await api.GET('/v1/items/{id}/activity', { params: { path: { id } } })),
  });
}

export function useItemCategories() {
  return useQuery({
    queryKey: itemKeys.categories(),
    queryFn: async () =>
      unwrapAs<Page<ItemCategory>>(
        await api.GET('/v1/item-categories', { params: { query: apiQuery({ limit: 100 }) } }),
      ),
    staleTime: 5 * 60_000,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateItemCategoryInput) =>
      unwrapAs<ItemCategory>(await api.POST('/v1/item-categories', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemKeys.categories() }),
  });
}

export function useUoms() {
  return useQuery({
    queryKey: itemKeys.uoms(),
    queryFn: async () =>
      unwrapAs<Page<Uom>>(
        await api.GET('/v1/units-of-measure', { params: { query: apiQuery({ limit: 100 }) } }),
      ),
    staleTime: 5 * 60_000,
  });
}

export function useCreateUom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateUomInput) =>
      unwrapAs<Uom>(await api.POST('/v1/units-of-measure', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemKeys.uoms() }),
  });
}
