'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssignRoleInput, CreateUserInput } from '@probuild/shared';
import { api } from '@/lib/api/browser';
import type { RoleAssignmentRow, UserDto } from '@/lib/api/types';
import { apiBody, unwrapAs, unwrapVoid } from '@/lib/api/errors';
import { roleKeys } from '@/features/roles/api/keys';
import { userKeys } from './keys';

export function useUsers(search: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.list(search),
    queryFn: async () =>
      unwrapAs<UserDto[]>(await api.GET('/v1/users', { params: { query: search ? { search } : {} } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateUserInput) => unwrapAs<UserDto>(await api.POST('/v1/users', { body: apiBody(body) })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
    },
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; active: boolean }) =>
      unwrapAs<UserDto>(
        await api.PUT(
'/v1/users/{id}/active', {
          params: { path: { id: input.id } },
          body: apiBody({ active: input.active }),
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.lists() }),
  });
}

export function useIssuePasswordReset() {
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapAs<{ token: string; expiresAt: string }>(await api.POST('/v1/users/{id}/password-reset', { params: { path: { id } } })),
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; body: AssignRoleInput }) =>
      unwrapAs<RoleAssignmentRow>(
        await api.POST(
'/v1/users/{id}/roles', {
          params: { path: { id: input.userId } },
          body: apiBody(input.body),
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
    },
  });
}

export function useRemoveAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; assignmentId: string }) =>
      unwrapVoid(
        await api.DELETE('/v1/users/{id}/roles/{assignmentId}', {
          params: { path: { id: input.userId, assignmentId: input.assignmentId } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
    },
  });
}
