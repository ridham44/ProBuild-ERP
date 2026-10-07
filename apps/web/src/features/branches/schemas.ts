import { createBranchSchema } from '@probuild/shared';
import type { z } from 'zod';

export const branchFormSchema = createBranchSchema;
export type BranchFormValues = z.input<typeof branchFormSchema>;
