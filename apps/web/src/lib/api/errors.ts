import { ApiError } from '@probuild/api-client';

export { ApiError, unwrap } from '@probuild/api-client';

type VoidResult = { error?: unknown; response: Response };

/** For 204 endpoints: succeeds when the response is ok, otherwise throws the problem-details error. */
export function unwrapVoid(result: VoidResult): void {
  if (result.response.ok && result.error === undefined) return;
  const problem = result.error as Partial<ApiError['problem']> | undefined;
  throw new ApiError({
    type: problem?.type ?? 'about:blank',
    title: problem?.title ?? result.response.statusText,
    status: problem?.status ?? result.response.status,
    ...(problem?.detail ? { detail: problem.detail } : {}),
    ...(problem?.errors ? { errors: problem.errors } : {}),
  });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export type ErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'rate-limited'
  | 'server'
  | 'network';

export function errorKind(error: unknown): ErrorKind {
  if (!isApiError(error)) return 'network';
  switch (error.status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not-found';
    case 409:
      return 'conflict';
    case 400:
    case 422:
      return 'validation';
    case 429:
      return 'rate-limited';
    default:
      return error.status >= 500 ? 'server' : 'validation';
  }
}

/** A message safe to show a user. Server errors never leak detail. */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!isApiError(error)) return 'Cannot reach the server. Check your connection and try again.';
  if (error.status >= 500) return fallback;
  if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  return error.problem.detail ?? error.problem.title ?? fallback;
}
