'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type {
  createLocationSchema,
  createWarehouseSchema,
  updateWarehouseSchema,
} from '@probuild/shared';
import type { ComboOption } from '@/components/common/combobox';
import { api } from '@/lib/api/browser';
import { apiBody, apiQuery, unwrapAs } from '@/lib/api/errors';
import type {
  ActivityItem,
  Page,
  Warehouse,
  WarehouseDetail,
  WarehouseLocation,
  WarehouseRow,
  WarehouseStockRow,
  WarehouseSummary,
} from '@/lib/api/types';

type Filters = Record<string, string | number>;
type WarehouseInput = z.input<typeof createWarehouseSchema>;
type WarehouseUpdate = z.input<typeof updateWarehouseSchema>;
type LocationInput = z.input<typeof createLocationSchema>;

export const warehouseKeys = {
  all: ['warehouses'] as const,
  lists: () => [...warehouseKeys.all, 'list'] as const,
  list: (filters: Filters) => [...warehouseKeys.lists(), filters] as const,
  detail: (id: string) => [...warehouseKeys.all, 'detail', id] as const,
  summary: (id: string) => [...warehouseKeys.detail(id), 'summary'] as const,
  stock: (id: string, filters: Filters) => [...warehouseKeys.detail(id), 'stock', filters] as const,
  locations: (id: string) => [...warehouseKeys.detail(id), 'locations'] as const,
  activity: (id: string) => [...warehouseKeys.detail(id), 'activity'] as const,
};

export function useWarehouses(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: warehouseKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<WarehouseRow>>(await api.GET('/v1/warehouses', { params: { query: apiQuery(filters) } })),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 60_000,
  });
}

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: warehouseKeys.detail(id),
    queryFn: async () =>
      unwrapAs<WarehouseDetail>(await api.GET('/v1/warehouses/{id}', { params: { path: { id } } })),
  });
}

export async function searchWarehouseOptions(search: string): Promise<ComboOption[]> {
  const page = unwrapAs<Page<WarehouseRow>>(
    await api.GET('/v1/warehouses', {
      params: { query: apiQuery({ limit: 30, ...(search ? { search } : {}) }) },
    }),
  );
  return page.items
    .filter((warehouse) => warehouse.active)
    .map((warehouse) => ({
      value: warehouse.id,
      label: warehouse.name,
      description: `${warehouse.code}${warehouse.project ? ` · ${warehouse.project.name}` : ''}`,
    }));
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: WarehouseInput) =>
      unwrapAs<Warehouse>(await api.POST('/v1/warehouses', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() }),
  });
}

export function useUpdateWarehouse(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: WarehouseUpdate) =>
      unwrapAs<Warehouse>(
        await api.PATCH('/v1/warehouses/{id}', { params: { path: { id } }, body: apiBody(body) }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: warehouseKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() });
    },
  });
}

export function useWarehouseSummary(id: string) {
  return useQuery({
    queryKey: warehouseKeys.summary(id),
    queryFn: async () =>
      unwrapAs<WarehouseSummary>(
        await api.GET('/v1/warehouses/{id}/summary', { params: { path: { id } } }),
      ),
  });
}

export function useWarehouseStock(id: string, filters: Filters) {
  return useQuery({
    queryKey: warehouseKeys.stock(id, filters),
    queryFn: async () =>
      unwrapAs<Page<WarehouseStockRow>>(
        await api.GET('/v1/warehouses/{id}/stock', {
          params: { path: { id }, query: apiQuery(filters) },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useLocations(warehouseId: string) {
  return useQuery({
    queryKey: warehouseKeys.locations(warehouseId),
    queryFn: async () =>
      unwrapAs<WarehouseLocation[]>(
        await api.GET('/v1/warehouse-locations', { params: { query: { warehouseId } } }),
      ),
  });
}

export function useCreateLocation(warehouseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LocationInput) =>
      unwrapAs<WarehouseLocation>(await api.POST('/v1/warehouse-locations', { body: apiBody(body) })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: warehouseKeys.locations(warehouseId) });
      void queryClient.invalidateQueries({ queryKey: warehouseKeys.summary(warehouseId) });
    },
  });
}

export function useWarehouseActivity(id: string) {
  return useQuery({
    queryKey: warehouseKeys.activity(id),
    queryFn: async () =>
      unwrapAs<ActivityItem[]>(
        await api.GET('/v1/warehouses/{id}/activity', { params: { path: { id } } }),
      ),
  });
}
