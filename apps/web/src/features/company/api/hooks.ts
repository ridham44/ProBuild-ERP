'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/browser';
import type { CompanyUpdate } from '@/lib/api/contract';
import { unwrap } from '@/lib/api/errors';
import { companyKeys } from './keys';

export function useCompany(enabled = true) {
  return useQuery({
    queryKey: companyKeys.detail(),
    queryFn: async () => unwrap(await api.GET('/v1/company')),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CompanyUpdate) => unwrap(await api.PATCH('/v1/company', { body })),
    onSuccess: (company) => queryClient.setQueryData(companyKeys.detail(), company),
  });
}
