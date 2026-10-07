import { upsertWorkflowSchema } from '@probuild/shared';
import type { z } from 'zod';

/** The shared schema plus one sanity rule the API leaves open: a band cannot end before it starts. */
export const workflowFormSchema = upsertWorkflowSchema.superRefine((value, context) => {
  value.rules.forEach((rule, index) => {
    if (rule.maxAmount && Number(rule.maxAmount) < Number(rule.minAmount)) {
      context.addIssue({
        code: 'custom',
        path: ['rules', index, 'maxAmount'],
        message: 'The upper limit must be at least the lower limit',
      });
    }
  });
});

export type WorkflowFormInput = z.input<typeof workflowFormSchema>;
export type WorkflowFormOutput = z.output<typeof workflowFormSchema>;
