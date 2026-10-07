import { z } from 'zod';
import {
  dateSchema,
  idSchema,
  listQuerySchema,
  nonNegativeDecimalSchema,
  percentSchema,
  positiveDecimalSchema,
  queryBooleanSchema,
} from './common';

const nameSchema = z.string().trim().min(1).max(160);
const optionalText = (max: number) => z.string().trim().max(max).nullish();

// ---- Units of measure ---------------------------------------------------------------------------

export const createUomSchema = z.object({
  code: z.string().trim().min(1).max(12),
  name: nameSchema,
});
export type CreateUomInput = z.infer<typeof createUomSchema>;
export const updateUomSchema = createUomSchema.partial();

// ---- Item categories ----------------------------------------------------------------------------

export const createItemCategorySchema = z.object({
  name: nameSchema,
  parentId: idSchema.nullish(),
});
export type CreateItemCategoryInput = z.infer<typeof createItemCategorySchema>;
export const updateItemCategorySchema = createItemCategorySchema.partial();

// ---- Items --------------------------------------------------------------------------------------

export const ITEM_TYPES = [
  'CONSUMABLE', 'NON_CONSUMABLE', 'SERIALIZED', 'BATCH_CONTROLLED', 'LOT_CONTROLLED', 'FIXED_ASSET', 'RETURNABLE',
] as const;
export const COST_CATEGORIES = ['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER'] as const;

/** FIFO and moving average exist in the database enum but are deliberately not exposed. */
export const SUPPORTED_COSTING_METHODS = ['WEIGHTED_AVERAGE', 'STANDARD'] as const;
export const costingMethodSchema = z.enum(SUPPORTED_COSTING_METHODS, {
  error: 'Costing method must be WEIGHTED_AVERAGE or STANDARD (FIFO and MOVING_AVERAGE are not supported)',
});

const itemBaseSchema = z.object({
  sku: z.string().trim().min(1).max(40),
  name: nameSchema,
  description: optionalText(1000),
  categoryId: idSchema.nullish(),
  preferredSupplierId: idSchema.nullish(),
  brand: optionalText(80),
  model: optionalText(80),
  specification: optionalText(500),
  itemType: z.enum(ITEM_TYPES).optional(),
  costCategory: z.enum(COST_CATEGORIES).optional(),
  trackBatch: z.boolean().optional(),
  trackSerial: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
  baseUnit: z.string().trim().min(1).max(12),
  purchaseUnit: z.string().trim().min(1).max(12).nullish(),
  issueUnit: z.string().trim().min(1).max(12).nullish(),
  conversionFactor: positiveDecimalSchema.optional(),
  barcode: optionalText(60),
  minStock: nonNegativeDecimalSchema.optional(),
  maxStock: nonNegativeDecimalSchema.optional(),
  reorderPoint: nonNegativeDecimalSchema.optional(),
  safetyStock: nonNegativeDecimalSchema.optional(),
  costingMethod: costingMethodSchema.optional(),
  standardCost: nonNegativeDecimalSchema.optional(),
  allowableWastePct: percentSchema.optional(),
});

type StockLevels = { minStock?: string; maxStock?: string; costingMethod?: string; standardCost?: string; trackExpiry?: boolean; trackBatch?: boolean };

/** Cross-field rules shared by create and (after merging with stored values) update. */
export function itemRuleIssues(v: StockLevels): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  if (v.minStock !== undefined && v.maxStock !== undefined && Number(v.maxStock) > 0 && Number(v.minStock) > Number(v.maxStock)) {
    issues.push({ path: 'maxStock', message: 'maxStock must be at least minStock when a maximum is set' });
  }
  if (v.costingMethod === 'STANDARD' && Number(v.standardCost ?? '0') <= 0) {
    issues.push({ path: 'standardCost', message: 'Standard costing requires a standard cost greater than 0' });
  }
  if (v.trackExpiry && !v.trackBatch) {
    issues.push({ path: 'trackExpiry', message: 'Expiry tracking requires batch tracking' });
  }
  return issues;
}

export const createItemSchema = itemBaseSchema.superRefine((v, ctx) => {
  for (const issue of itemRuleIssues(v)) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = itemBaseSchema.partial().extend({ active: z.boolean().optional() });
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const ITEM_SORT_FIELDS = ['sku', 'name', 'createdAt'] as const;
export const itemListQuerySchema = listQuerySchema.extend({
  categoryId: idSchema.optional(),
  active: queryBooleanSchema.optional(),
  itemType: z.enum(ITEM_TYPES).optional(),
  preferredSupplierId: idSchema.optional(),
  trackBatch: queryBooleanSchema.optional(),
  trackSerial: queryBooleanSchema.optional(),
});
export type ItemListQuery = z.infer<typeof itemListQuerySchema>;

export const setItemUnitConversionSchema = z.object({
  unit: z.string().trim().min(1).max(12),
  factor: positiveDecimalSchema,
});
export type SetItemUnitConversionInput = z.infer<typeof setItemUnitConversionSchema>;

export const priceHistoryQuerySchema = listQuerySchema.extend({
  supplierId: idSchema.optional(),
  source: z.enum(['QUOTATION', 'PURCHASE_ORDER']).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type PriceHistoryQuery = z.infer<typeof priceHistoryQuerySchema>;

// ---- Stock summaries ----------------------------------------------------------------------------

export const stockSummaryQuerySchema = z.object({ warehouseId: idSchema.optional() });

export const warehouseStockQuerySchema = listQuerySchema.extend({
  categoryId: idSchema.optional(),
  stockStatus: z.enum(['AVAILABLE', 'QUARANTINE', 'DAMAGED', 'IN_TRANSIT']).optional(),
});
export type WarehouseStockQuery = z.infer<typeof warehouseStockQuerySchema>;
