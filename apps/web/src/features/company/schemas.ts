import { updateCompanySchema } from '@probuild/shared';
import type { z } from 'zod';

/** The API accepts partial updates; the screen always submits the full profile. */
export const companyFormSchema = updateCompanySchema.required({
  legalName: true,
  vatStatus: true,
  fiscalYearStartMonth: true,
});
export type CompanyFormValues = z.input<typeof companyFormSchema>;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const VAT_OPTIONS = [
  { value: 'VAT', label: 'VAT registered' },
  { value: 'NON_VAT', label: 'Non-VAT' },
  { value: 'EXEMPT', label: 'VAT exempt' },
] as const;
