// Default chart of accounts and the well-known codes engines post to.
// Modules must reference ACCOUNT_CODES; never hardcode a code string elsewhere.

export const ACCOUNT_CODES = {
  CASH_ON_HAND: '1000',
  CASH_IN_BANK: '1010',
  ACCOUNTS_RECEIVABLE: '1100',
  RETENTION_RECEIVABLE: '1150',
  INVENTORY: '1200',
  INPUT_VAT: '1300',
  ADVANCES_TO_SUPPLIERS: '1350',
  CREDITABLE_WITHHOLDING_TAX: '1360',
  FIXED_ASSETS: '1500',
  ACCUMULATED_DEPRECIATION: '1590',
  ACCOUNTS_PAYABLE: '2000',
  OUTPUT_VAT: '2100',
  WITHHOLDING_TAX_PAYABLE: '2200',
  RETENTION_PAYABLE: '2300',
  ADVANCES_FROM_CUSTOMERS: '2400',
  PAYROLL_PAYABLE: '2500',
  GOVERNMENT_CONTRIBUTIONS_PAYABLE: '2510',
  EQUITY_CAPITAL: '3000',
  RETAINED_EARNINGS: '3100',
  CONTRACT_REVENUE: '4000',
  VARIATION_REVENUE: '4100',
  MATERIAL_COST: '5000',
  LABOR_COST: '5100',
  EQUIPMENT_COST: '5200',
  SUBCONTRACT_COST: '5300',
  OTHER_PROJECT_COST: '5900',
  OVERHEAD_EXPENSE: '6000',
  DEPRECIATION_EXPENSE: '6100',
  INVENTORY_ADJUSTMENT: '6200',
  FUEL_EXPENSE: '6300',
} as const;
export type AccountCode = (typeof ACCOUNT_CODES)[keyof typeof ACCOUNT_CODES];

export type DefaultAccount = {
  code: AccountCode;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
};

export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  { code: '1000', name: 'Cash on Hand', type: 'ASSET' },
  { code: '1010', name: 'Cash in Bank', type: 'ASSET' },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET' },
  { code: '1150', name: 'Retention Receivable', type: 'ASSET' },
  { code: '1200', name: 'Inventory', type: 'ASSET' },
  { code: '1300', name: 'Input VAT', type: 'ASSET' },
  { code: '1350', name: 'Advances to Suppliers', type: 'ASSET' },
  { code: '1360', name: 'Creditable Withholding Tax', type: 'ASSET' },
  { code: '1500', name: 'Property, Plant and Equipment', type: 'ASSET' },
  { code: '1590', name: 'Accumulated Depreciation', type: 'ASSET' },
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
  { code: '2100', name: 'Output VAT', type: 'LIABILITY' },
  { code: '2200', name: 'Withholding Tax Payable', type: 'LIABILITY' },
  { code: '2300', name: 'Retention Payable', type: 'LIABILITY' },
  { code: '2400', name: 'Advances from Customers', type: 'LIABILITY' },
  { code: '2500', name: 'Payroll Payable', type: 'LIABILITY' },
  { code: '2510', name: 'Government Contributions Payable', type: 'LIABILITY' },
  { code: '3000', name: 'Capital', type: 'EQUITY' },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY' },
  { code: '4000', name: 'Contract Revenue', type: 'REVENUE' },
  { code: '4100', name: 'Variation Revenue', type: 'REVENUE' },
  { code: '5000', name: 'Project Cost - Materials', type: 'EXPENSE' },
  { code: '5100', name: 'Project Cost - Labor', type: 'EXPENSE' },
  { code: '5200', name: 'Project Cost - Equipment', type: 'EXPENSE' },
  { code: '5300', name: 'Project Cost - Subcontractors', type: 'EXPENSE' },
  { code: '5900', name: 'Project Cost - Other', type: 'EXPENSE' },
  { code: '6000', name: 'Overhead Expense', type: 'EXPENSE' },
  { code: '6100', name: 'Depreciation Expense', type: 'EXPENSE' },
  { code: '6200', name: 'Inventory Adjustment / Shrinkage', type: 'EXPENSE' },
  { code: '6300', name: 'Fuel Expense', type: 'EXPENSE' },
];

/** Default Philippine tax codes. Rates are versioned rows in the DB, so these are only seeds. */
export const DEFAULT_TAX_CODES = [
  { code: 'VAT12', name: 'Value-Added Tax', kind: 'VAT', ratePct: '12', effectiveFrom: '2006-02-01' },
  { code: 'EWT-WC158', name: 'EWT - Goods (1%)', kind: 'EXPANDED_WITHHOLDING', ratePct: '1', effectiveFrom: '2018-01-01' },
  { code: 'EWT-WC160', name: 'EWT - Services (2%)', kind: 'EXPANDED_WITHHOLDING', ratePct: '2', effectiveFrom: '2018-01-01' },
  { code: 'EWT-WC100', name: 'EWT - Rentals (5%)', kind: 'EXPANDED_WITHHOLDING', ratePct: '5', effectiveFrom: '2018-01-01' },
  { code: 'WVAT5', name: 'Withholding VAT (5%)', kind: 'WITHHOLDING_VAT', ratePct: '5', effectiveFrom: '2018-01-01' },
  { code: 'PT3', name: 'Percentage Tax (3%)', kind: 'PERCENTAGE_TAX', ratePct: '3', effectiveFrom: '2023-07-01' },
] as const;
