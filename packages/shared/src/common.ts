import { z } from 'zod';

export const idSchema = z.string().uuid();

/** Money / quantity / rate values travel as decimal strings so no float ever touches them. */
export const decimalSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a decimal number'));

export const positiveDecimalSchema = decimalSchema.refine((v) => Number(v) > 0, 'Must be greater than 0');

/** ISO-8601 date or date-time string in, Date out. A string input keeps the OpenAPI schema representable. */
export const dateSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid ISO date')
  .transform((v) => new Date(v));

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

export const DOC_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'POSTED'] as const;
export const docStatusSchema = z.enum(DOC_STATUSES);

/** Dimensions every transaction carries where applicable. */
export const dimensionsSchema = z.object({
  projectId: idSchema.optional(),
  wbsNodeId: idSchema.optional(),
  costCodeId: idSchema.optional(),
  boqItemId: idSchema.optional(),
});

export const nonNegativeDecimalSchema = decimalSchema.refine((v) => Number(v) >= 0, 'Must be 0 or greater');

/** Quantities carry at most 4 decimal places (matches Decimal(18,4) columns). */
export const quantitySchema = decimalSchema
  .refine((v) => /^\d+(\.\d{1,4})?$/.test(v), 'Quantity must be positive with at most 4 decimal places')
  .refine((v) => Number(v) > 0, 'Must be greater than 0');

/** Unit prices/costs carry at most 4 decimal places and may be zero. */
export const unitPriceSchema = decimalSchema.refine(
  (v) => /^\d+(\.\d{1,4})?$/.test(v),
  'Must be 0 or greater with at most 4 decimal places',
);

/** Whole-currency amounts carry at most 2 decimal places. */
export const moneySchema = decimalSchema.refine(
  (v) => /^\d+(\.\d{1,2})?$/.test(v),
  'Must be 0 or greater with at most 2 decimal places',
);

/** Percentages 0-100 with up to 4 decimal places. */
export const percentSchema = decimalSchema.refine(
  (v) => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) <= 100,
  'Must be a percentage between 0 and 100',
);

/** Query-string booleans arrive as text. */
export const queryBooleanSchema = z.enum(['true', 'false']).transform((v) => v === 'true');

/** `field:asc` or `field:desc`; each list endpoint whitelists the fields it accepts. */
export const sortSchema = z.string().regex(/^[A-Za-z]+:(asc|desc)$/, 'Use field:asc or field:desc');

export const listQuerySchema = paginationQuerySchema.extend({ sort: sortSchema.optional() });
export type ListQuery = z.infer<typeof listQuerySchema>;

/** A reason is mandatory for destructive workflow actions (cancel, close, reject). */
export const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export type ReasonInput = z.infer<typeof reasonSchema>;

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const prioritySchema = z.enum(PRIORITIES);

/** One row of a document's activity timeline (audit trail + approval actions). */
export const activityItemSchema = z.object({
  id: z.string(),
  at: z.string(),
  kind: z.enum(['AUDIT', 'APPROVAL']),
  action: z.string(),
  actor: z.object({ id: z.string(), name: z.string() }).nullable(),
  summary: z.string(),
  reason: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
});
export type ActivityItem = z.infer<typeof activityItemSchema>;
