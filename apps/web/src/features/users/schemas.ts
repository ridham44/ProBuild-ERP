import { createUserSchema } from '@probuild/shared';
import { z } from 'zod';

/** Admin-created accounts are internal staff; linked portal accounts need their party record first. */
export const userFormSchema = createUserSchema
  .pick({ email: true, name: true, password: true })
  .extend({ roleIds: z.array(z.string().uuid()) });
export type UserFormValues = z.input<typeof userFormSchema>;

export const resetLinkPath = (token: string): string =>
  `/reset-password?token=${encodeURIComponent(token)}`;
