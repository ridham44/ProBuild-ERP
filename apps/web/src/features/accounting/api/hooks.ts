'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/browser';
import type { PeriodDto } from '@/lib/api/types';
import { unwrapAs } from '@/lib/api/errors';
import { accountingKeys } from './keys';

export function usePeriods(year: number | undefined, enabled = true) {
  return useQuery({
    queryKey: accountingKeys.periods(year),
    queryFn: async () =>
      unwrapAs<PeriodDto[]>(await api.GET('/v1/accounting/periods', { params: { query: year ? { year } : {} } })),
    enabled,
  });
}
