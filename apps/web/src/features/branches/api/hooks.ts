'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/browser';
import type { BranchDto, Page } from '@/lib/api/types';
import type { z } from 'zod';
import type { createBranchSchema, updateBranchSchema } from '@probuild/shared';

type BranchInput = z.input<typeof createBranchSchema>;
type BranchUpdate = z.input<typeof updateBranchSchema>;
import { apiBody, unwrapAs } from '@/lib/api/errors';
import { branchKeys, type BranchFilters } from './keys';

export function useBranches(filters: BranchFilters, enabled = true) {
  return useQuery({
    queryKey: branchKeys.list(filters),
    queryFn: async () => unwrapAs<Page<BranchDto>>(await api.GET('/v1/branches', { params: { query: filters } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: BranchInput) => unwrapAs<BranchDto>(await api.POST('/v1/branches', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: branchKeys.lists() }),
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: BranchUpdate }) =>
      unwrapAs<BranchDto>(
        await api.PATCH(
'/v1/branches/{id}', {
          params: { path: { id: input.id } },
          body: apiBody(input.body),
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: branchKeys.lists() }),
  });
}
