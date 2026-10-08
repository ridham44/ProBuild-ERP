import { ApiError } from '@probuild/api-client';

import { unwrap } from '@probuild/api-client';

export { ApiError, unwrap };

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

type AnyResult = { data?: unknown; error?: unknown; response: Response };

/**
 * Returns the response body typed with the shared Zod response schema. The generated OpenAPI document
 * still mis-describes some nullable and decimal fields (see the defect report), so response shapes come
 * from `@probuild/shared` and only routes, params and status handling come from the generated client.
 */
export function unwrapAs<T>(result: AnyResult): T {
  return unwrap(result) as unknown as T;
}

/** Request bodies are typed by the shared input schemas; this adapts them to the generated body type. */
export function apiBody(payload: unknown): never {
  return payload as never;
}

/** Drops empty filters and adapts the plain query object to the generated per-route query type. */
export function apiQuery(query: Record<string, unknown>): never {
  const cleaned = Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  return cleaned as never;
}

export type FieldIssue = { path: string; message: string };

/** Field-level problems from a ProblemDetails response, or an empty list for any other error. */
export function fieldIssues(error: unknown): FieldIssue[] {
  if (!isApiError(error)) return [];
  const raw: unknown = error.problem.errors;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is FieldIssue =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as FieldIssue).message === 'string' &&
      typeof (entry as FieldIssue).path === 'string',
  );
}

/** One readable sentence for a failed save: the field messages when present, otherwise the problem detail. */
export function saveErrorMessage(error: unknown): string {
  const issues = fieldIssues(error);
  return issues.length > 0 ? issues.map((issue) => issue.message).join('. ') : errorMessage(error);
}
