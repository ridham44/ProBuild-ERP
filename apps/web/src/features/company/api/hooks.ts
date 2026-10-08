'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/browser';
import type { CompanyDto } from '@/lib/api/types';
import type { UpdateCompanyInput as CompanyUpdate } from '@probuild/shared';
import { apiBody, unwrapAs } from '@/lib/api/errors';
import { companyKeys } from './keys';

export function useCompany(enabled = true) {
  return useQuery({
    queryKey: companyKeys.detail(),
    queryFn: async () => unwrapAs<CompanyDto>(await api.GET('/v1/company')),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CompanyUpdate) => unwrapAs<CompanyDto>(await api.PATCH('/v1/company', { body: apiBody(body) })),
    onSuccess: (company) => queryClient.setQueryData(companyKeys.detail(), company),
  });
}
