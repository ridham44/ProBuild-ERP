'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssignRoleInput, CreateUserInput } from '@probuild/shared';
import { api } from '@/lib/api/browser';
import { unwrap, unwrapVoid } from '@/lib/api/errors';
import { roleKeys } from '@/features/roles/api/keys';
import { userKeys } from './keys';

export function useUsers(search: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.list(search),
    queryFn: async () =>
      unwrap(await api.GET('/v1/users', { params: { query: search ? { search } : {} } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateUserInput) => unwrap(await api.POST('/v1/users', { body })),
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
      unwrap(
        await api.PUT('/v1/users/{id}/active', {
          params: { path: { id: input.id } },
          body: { active: input.active },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.lists() }),
  });
}

export function useIssuePasswordReset() {
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.POST('/v1/users/{id}/password-reset', { params: { path: { id } } })),
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; body: AssignRoleInput }) =>
      unwrap(
        await api.POST('/v1/users/{id}/roles', {
          params: { path: { id: input.userId } },
          body: input.body,
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
