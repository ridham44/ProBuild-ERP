'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/browser';
import { apiQuery, unwrapAs } from '@/lib/api/errors';
import type { MovementRow, Page, StockBalanceRow } from '@/lib/api/types';

type Filters = Record<string, string | number>;

export const stockKeys = {
  all: ['stock'] as const,
  balances: (filters: Filters) => [...stockKeys.all, 'balances', filters] as const,
  movements: (filters: Filters) => [...stockKeys.all, 'movements', filters] as const,
};

export function useStockBalances(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: stockKeys.balances(filters),
    queryFn: async () =>
      unwrapAs<Page<StockBalanceRow>>(
        await api.GET('/v1/inventory/stock-balances', { params: { query: apiQuery(filters) } }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useStockMovements(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: stockKeys.movements(filters),
    queryFn: async () =>
      unwrapAs<Page<MovementRow>>(
        await api.GET('/v1/inventory/movements', { params: { query: apiQuery(filters) } }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}
