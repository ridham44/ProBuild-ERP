import { BadRequestException } from '@nestjs/common';

/** Turns `field:dir` into a deterministic Prisma orderBy that always ends with `id` (cursor stability). */
export function buildOrderBy<F extends string>(
  sort: string | undefined,
  allowed: readonly F[],
  fallback: Array<Record<string, 'asc' | 'desc'>>,
): Array<Record<string, 'asc' | 'desc'>> {
  if (!sort) return [...fallback, { id: 'asc' }];
  const [field, dir] = sort.split(':') as [string, 'asc' | 'desc'];
  if (!(allowed as readonly string[]).includes(field)) {
    throw new BadRequestException(`Cannot sort by "${field}". Allowed: ${allowed.join(', ')}`);
  }
  return [{ [field]: dir }, { id: 'asc' }];
}

/** Case-insensitive "contains" across several columns. */
export function containsAny(search: string | undefined, fields: string[]): { OR?: Array<Record<string, unknown>> } {
  if (!search) return {};
  return { OR: fields.map((f) => ({ [f]: { contains: search, mode: 'insensitive' } })) };
}

/** Inclusive date range filter fragment for a DateTime column. */
export function dateRange(from?: Date, to?: Date): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}
