import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const post = vi.fn();
const get = vi.fn();
vi.mock('@/lib/api/browser', () => ({ api: { POST: (...args: unknown[]) => post(...args), GET: (...args: unknown[]) => get(...args) } }));

const { requisitionKeys, useDecideRequisition, useRequisitions, useSubmitRequisition } = await import('./hooks');

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const ok = (data: unknown) => ({ data, response: new Response(null, { status: 200 }) });

describe('requisition hooks', () => {
  it('lists with the filters as the query and caches under the list key', async () => {
    get.mockResolvedValueOnce(ok({ items: [], nextCursor: null }));
    const client = new QueryClient();
    const { result } = renderHook(() => useRequisitions({ status: 'SUBMITTED', limit: 25, search: '' }), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/v1/requisitions', { params: { query: { status: 'SUBMITTED', limit: 25 } } });
    expect(client.getQueryData(requisitionKeys.list({ status: 'SUBMITTED', limit: 25, search: '' }))).toEqual({ items: [], nextCursor: null });
  });

  it('sends the caller’s Idempotency-Key on submit and refreshes the requisition', async () => {
    post.mockResolvedValueOnce(ok({ id: 'r1', status: 'SUBMITTED' }));
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useSubmitRequisition('r1'), { wrapper: wrapper(client) });
    await act(() => result.current.mutateAsync('key-123'));
    expect(post).toHaveBeenCalledWith('/v1/requisitions/{id}/submit', {
      params: { path: { id: 'r1' }, header: { 'Idempotency-Key': 'key-123' } },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: requisitionKeys.detail('r1') });
  });

  it('rejects with the comment as the required reason', async () => {
    post.mockResolvedValueOnce(ok({ id: 'r1', status: 'REJECTED' }));
    const client = new QueryClient();
    const { result } = renderHook(() => useDecideRequisition('r1'), { wrapper: wrapper(client) });
    await act(() => result.current.mutateAsync({ decision: 'reject', comment: 'Wrong grade of rebar', idempotencyKey: 'k2' }));
    expect(post).toHaveBeenLastCalledWith('/v1/requisitions/{id}/reject', {
      params: { path: { id: 'r1' }, header: { 'Idempotency-Key': 'k2' } },
      body: { comment: 'Wrong grade of rebar' },
    });
  });

  it('surfaces problem details as an ApiError', async () => {
    post.mockResolvedValueOnce({
      error: { type: 'about:blank', title: 'Conflict', status: 409, detail: 'A SUBMITTED requisition cannot be submitted; only drafts can' },
      response: new Response(null, { status: 409 }),
    });
    const client = new QueryClient();
    const { result } = renderHook(() => useSubmitRequisition('r1'), { wrapper: wrapper(client) });
    await expect(result.current.mutateAsync('k3')).rejects.toMatchObject({ status: 409 });
  });
});
