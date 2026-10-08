'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PermissionActionKey } from '@probuild/shared';
import { api } from '@/lib/api/browser';
import type { RoleDto } from '@/lib/api/types';
import { apiBody, unwrapAs } from '@/lib/api/errors';
import { roleKeys } from './keys';

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: roleKeys.lists(),
    queryFn: async () => unwrapAs<RoleDto[]>(await api.GET('/v1/roles')),
    enabled,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description?: string }) =>
      unwrapAs<RoleDto>(await api.POST('/v1/roles', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.lists() }),
  });
}

export function useSetRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      permissions: Array<{ module: string; action: PermissionActionKey }>;
    }) =>
      unwrapAs<RoleDto>(
        await api.PUT(
'/v1/roles/{id}/permissions', {
          params: { path: { id: input.id } },
          body: apiBody({ permissions: input.permissions }),
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.lists() }),
  });
}
