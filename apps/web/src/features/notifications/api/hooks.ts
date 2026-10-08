'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/browser';
import type { NotificationPage } from '@/lib/api/types';
import { unwrapAs } from '@/lib/api/errors';
import { notificationKeys } from './keys';

const POLL_MS = 60_000;

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async () =>
      unwrapAs<NotificationPage>(await api.GET('/v1/notifications', { params: { query: { limit: 30 } } })),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapAs<{ updated: number }>(await api.POST('/v1/notifications/{id}/read', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.list() }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrapAs<{ updated: number }>(await api.POST('/v1/notifications/read-all')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.list() }),
  });
}
