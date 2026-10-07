import { z } from 'zod';
import { dateSchema, decimalSchema, idSchema, paginationQuerySchema } from './common';

export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

export const createAccountSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(160),
  type: z.enum(ACCOUNT_TYPES),
  parentId: idSchema.nullish(),
  isPostable: z.boolean().default(true),
});
export const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  active: z.boolean().optional(),
  isPostable: z.boolean().optional(),
});

export const journalLineInputSchema = z
  .object({
    accountId: idSchema,
    debit: decimalSchema.default('0'),
    credit: decimalSchema.default('0'),
    memo: z.string().max(300).optional(),
    projectId: idSchema.optional(),
    wbsNodeId: idSchema.optional(),
    costCodeId: idSchema.optional(),
    costCenterId: idSchema.optional(),
    departmentId: idSchema.optional(),
    branchId: idSchema.optional(),
  })
  .refine((l) => (Number(l.debit) > 0) !== (Number(l.credit) > 0), {
    message: 'Enter either a debit or a credit',
    path: ['debit'],
  });

export const createJournalSchema = z.object({
  entryDate: dateSchema,
  description: z.string().trim().min(1).max(300),
  lines: z.array(journalLineInputSchema).min(2).max(200),
});
export type CreateJournalInput = z.infer<typeof createJournalSchema>;

export const reverseJournalSchema = z.object({ reason: z.string().trim().min(3).max(300) });

export const journalListQuerySchema = paginationQuerySchema.extend({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  sourceType: z.string().max(60).optional(),
  accountId: idSchema.optional(),
  projectId: idSchema.optional(),
});

export const trialBalanceQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema,
  projectId: idSchema.optional(),
  costCenterId: idSchema.optional(),
});

export const generalLedgerQuerySchema = z.object({
  accountId: idSchema,
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  projectId: idSchema.optional(),
});

export const periodActionSchema = z.object({ reason: z.string().trim().min(3).max(300).optional() });
