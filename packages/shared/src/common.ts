import { z } from 'zod';

export const idSchema = z.string().uuid();

/** Money / quantity / rate values travel as decimal strings so no float ever touches them. */
export const decimalSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a decimal number'));

export const positiveDecimalSchema = decimalSchema.refine((v) => Number(v) > 0, 'Must be greater than 0');

export const dateSchema = z.coerce.date();

export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
  search: z.string().trim().max(100).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type Page<T> = { items: T[]; nextCursor: string | null };

export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  detail: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export const DOC_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED'] as const;
export const docStatusSchema = z.enum(DOC_STATUSES);

/** Dimensions every transaction carries where applicable. */
export const dimensionsSchema = z.object({
  projectId: idSchema.optional(),
  wbsNodeId: idSchema.optional(),
  costCodeId: idSchema.optional(),
  boqItemId: idSchema.optional(),
});
