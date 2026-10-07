import { z } from 'zod';
import { PERMISSION_ACTIONS } from './permissions';

/** Minimum standard for every password the system accepts. */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const confirmPasswordResetSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const grantSchema = z.object({
  module: z.string(),
  action: z.enum(PERMISSION_ACTIONS),
  companyId: z.string().nullable(),
  branchId: z.string().nullable(),
  projectId: z.string().nullable(),
  warehouseId: z.string().nullable(),
});
export type Grant = z.infer<typeof grantSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  companyId: z.string(),
  userType: z.enum(['INTERNAL', 'CLIENT', 'SUPPLIER', 'SUBCONTRACTOR', 'EMPLOYEE']),
  isSuperAdmin: z.boolean(),
  mustChangePassword: z.boolean(),
  roles: z.array(z.string()),
  grants: z.array(grantSchema),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const createUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(120),
  password: passwordSchema,
  userType: z.enum(['INTERNAL', 'CLIENT', 'SUPPLIER', 'SUBCONTRACTOR', 'EMPLOYEE']).default('INTERNAL'),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  subcontractorId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  roleIds: z.array(z.string().uuid()).default([]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
  companyId: z.string().uuid().nullable().default(null),
  branchId: z.string().uuid().nullable().default(null),
  projectId: z.string().uuid().nullable().default(null),
  warehouseId: z.string().uuid().nullable().default(null),
});
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
