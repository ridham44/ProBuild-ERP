'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, SessionUser } from '@probuild/shared';
import { api } from '@/lib/api/browser';
import { unwrap, unwrapVoid } from '@/lib/api/errors';
import { authKeys } from './keys';

export function useMe(initialData?: SessionUser) {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => unwrap(await api.GET('/v1/auth/me')),
    ...(initialData ? { initialData } : {}),
    staleTime: 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) =>
      unwrap(await api.POST('/v1/auth/login', { body: input })),
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(authKeys.me(), user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrapVoid(await api.POST('/v1/auth/logout')),
    onSettled: () => queryClient.clear(),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) =>
      unwrapVoid(await api.POST('/v1/auth/password', { body })),
  });
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: async (body: { token: string; newPassword: string }) =>
      unwrapVoid(await api.POST('/v1/auth/password-reset/confirm', { body })),
  });
}

export function useSessions() {
  return useQuery({
    queryKey: authKeys.sessions(),
    queryFn: async () => unwrap(await api.GET('/v1/auth/sessions')),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapVoid(await api.DELETE('/v1/auth/sessions/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.sessions() }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST('/v1/auth/sessions/revoke-others')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.sessions() }),
  });
}
