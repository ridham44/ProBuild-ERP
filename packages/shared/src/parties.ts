import { z } from 'zod';
import { PO_STATUSES } from './procurement';
import { dateSchema, idSchema, listQuerySchema, moneySchema, percentSchema, queryBooleanSchema } from './common';

const codeSchema = z.string().trim().min(1).max(30);
const nameSchema = z.string().trim().min(1).max(160);
const optionalText = (max: number) => z.string().trim().max(max).nullish();

export const VAT_STATUSES = ['VAT', 'NON_VAT', 'EXEMPT'] as const;
export const vatStatusSchema = z.enum(VAT_STATUSES);

// ---- Contacts (shared by customers and suppliers) ---------------------------------------------

export const createContactSchema = z.object({
  name: nameSchema,
  position: optionalText(120),
  email: z.string().trim().email().max(160).nullish(),
  phone: optionalText(40),
  isPrimary: z.boolean().optional(),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;
export const updateContactSchema = createContactSchema.partial();
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// ---- Suppliers --------------------------------------------------------------------------------

export const createSupplierSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  tin: optionalText(30),
  vatStatus: vatStatusSchema.optional(),
  address: optionalText(300),
  bankInfo: optionalText(300),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  category: optionalText(80),
  productCategories: optionalText(300),
  ewtCode: optionalText(20),
  email: z.string().trim().email().max(160).nullish(),
  phone: optionalText(40),
  notes: optionalText(1000),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export const updateSupplierSchema = createSupplierSchema.partial().extend({ active: z.boolean().optional() });
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const SUPPLIER_SORT_FIELDS = ['code', 'name', 'createdAt'] as const;
export const supplierListQuerySchema = listQuerySchema.extend({
  active: queryBooleanSchema.optional(),
  accredited: queryBooleanSchema.optional(),
  category: z.string().trim().max(80).optional(),
  vatStatus: vatStatusSchema.optional(),
});
export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>;

export const setAccreditationSchema = z
  .object({
    accredited: z.boolean(),
    accreditationNo: optionalText(60),
    accreditationExpiry: dateSchema.nullish(),
    notes: optionalText(500),
  })
  .refine((v) => !v.accredited || Boolean(v.accreditationNo), {
    message: 'An accreditation number is required to accredit a supplier',
    path: ['accreditationNo'],
  });
export type SetAccreditationInput = z.infer<typeof setAccreditationSchema>;

const scoreSchema = z.number().int().min(0).max(100);
export const createSupplierEvaluationSchema = z
  .object({
    periodStart: dateSchema,
    periodEnd: dateSchema,
    priceScore: scoreSchema,
    qualityScore: scoreSchema,
    deliveryScore: scoreSchema,
    responsivenessScore: scoreSchema,
    complianceScore: scoreSchema,
    rejectionRatePct: percentSchema.default('0'),
    notes: optionalText(1000),
  })
  .refine((v) => v.periodEnd >= v.periodStart, { message: 'periodEnd must not precede periodStart', path: ['periodEnd'] });
export type CreateSupplierEvaluationInput = z.infer<typeof createSupplierEvaluationSchema>;

export const supplierHistoryQuerySchema = listQuerySchema.extend({
  status: z.enum(PO_STATUSES).optional(),
  projectId: idSchema.optional(),
});
export type SupplierHistoryQuery = z.infer<typeof supplierHistoryQuerySchema>;

// ---- Customers --------------------------------------------------------------------------------

export const createCustomerSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  isCompany: z.boolean().optional(),
  tin: optionalText(30),
  vatStatus: vatStatusSchema.optional(),
  billingAddress: optionalText(300),
  siteAddress: optionalText(300),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  creditLimit: moneySchema.optional(),
  bankInfo: optionalText(300),
  email: z.string().trim().email().max(160).nullish(),
  phone: optionalText(40),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export const updateCustomerSchema = createCustomerSchema.partial().extend({ active: z.boolean().optional() });
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const CUSTOMER_SORT_FIELDS = ['code', 'name', 'createdAt'] as const;
export const customerListQuerySchema = listQuerySchema.extend({
  active: queryBooleanSchema.optional(),
});
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
