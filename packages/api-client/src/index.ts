import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from './schema';

export type { components, paths };
export type ProblemDetails = components['schemas']['ProblemDetails'];

/** Error thrown by `unwrap` so UI code can branch on status and field errors. */
export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }
  get status(): number {
    return this.problem.status;
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  /** Called on 401 so the app can redirect to login. */
  onUnauthorized?: () => void;
  fetch?: typeof fetch;
};

/** Creates a client that sends the httpOnly session cookie and attaches a request id and idempotency key support. */
export function createApiClient(options: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    credentials: 'include',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const middleware: Middleware = {
    onRequest({ request }) {
      request.headers.set('x-request-id', crypto.randomUUID());
      return request;
    },
    onResponse({ response }) {
      if (response.status === 401) options.onUnauthorized?.();
      return response;
    },
  };
  client.use(middleware);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Returns `data` or throws ApiError built from the problem-details body. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    const error = result.error as Partial<ProblemDetails> | undefined;
    throw new ApiError({
      type: error?.type ?? 'about:blank',
      title: error?.title ?? result.response.statusText,
      status: error?.status ?? result.response.status,
      ...(error?.detail ? { detail: error.detail } : {}),
      ...(error?.errors ? { errors: error.errors } : {}),
    });
  }
  return result.data;
}

/** Idempotency-Key header value for mutations that must not repeat. Generate once per user intent. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
