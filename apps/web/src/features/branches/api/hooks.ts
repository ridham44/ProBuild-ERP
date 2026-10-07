'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/browser';
import type { BranchInput, BranchUpdate } from '@/lib/api/contract';
import { unwrap } from '@/lib/api/errors';
import { branchKeys, type BranchFilters } from './keys';

export function useBranches(filters: BranchFilters, enabled = true) {
  return useQuery({
    queryKey: branchKeys.list(filters),
    queryFn: async () => unwrap(await api.GET('/v1/branches', { params: { query: filters } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: BranchInput) => unwrap(await api.POST('/v1/branches', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: branchKeys.lists() }),
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: BranchUpdate }) =>
      unwrap(
        await api.PATCH('/v1/branches/{id}', {
          params: { path: { id: input.id } },
          body: input.body,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: branchKeys.lists() }),
  });
}
