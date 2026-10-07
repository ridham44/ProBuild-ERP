import type { Page } from '@probuild/shared';

type CursorArgs = { take: number; skip?: number; cursor?: { id: string } };

/**
 * Cursor pagination on `id`. The query MUST order by something deterministic ending in `id`.
 * Fetches limit+1 rows to learn whether another page exists.
 */
export async function paginate<T extends { id: string }>(
  query: (args: CursorArgs) => Promise<T[]>,
  params: { cursor?: string; limit: number },
): Promise<Page<T>> {
  const rows = await query({
    take: params.limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > params.limit;
  const items = hasMore ? rows.slice(0, params.limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? last.id : null };
}
