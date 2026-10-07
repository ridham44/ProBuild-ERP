import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';

const MAX_RETRIES = 2;

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors (4xx) will not change on retry; only transient failures are retried.
        retry: (failureCount, error) =>
          isApiError(error) && error.status < 500 ? false : failureCount < MAX_RETRIES,
      },
      mutations: { retry: false },
    },
  });
}
