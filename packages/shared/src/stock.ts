import { z } from 'zod';
import { dateSchema, decimalSchema, idSchema, listQuerySchema, quantitySchema } from './common';
import { zeroOrMoreQtySchema } from './receiving';

const optionalText = (max: number) => z.string().trim().max(max).nullish();
const unitSchema = z.string().trim().min(1).max(12);
const MAX_LINES = 500;

export const STOCK_STATUSES = ['AVAILABLE', 'QUARANTINE', 'DAMAGED', 'IN_TRANSIT'] as const;
export const stockStatusSchema = z.enum(STOCK_STATUSES);

/** Statuses shared by transfer, adjustment and count documents. */
export const STOCK_DOC_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED'] as const;
export const stockDocStatusSchema = z.enum(STOCK_DOC_STATUSES);

// ---- Balances, valuation, movements, batches, serials -------------------------------------------

export const STOCK_BALANCE_SORT_FIELDS = ['sku', 'name', 'warehouse'] as const;
export const stockBalanceQuerySchema = z.object({
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['sku:asc', 'name:asc', 'warehouse:asc']).optional(),
  warehouseId: idSchema.optional(),
  itemId: idSchema.optional(),
  categoryId: idSchema.optional(),
  projectId: idSchema.optional(),
  /** Only rows whose available quantity is at or below the item's minimum stock. */
  belowMinimum: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  /** Hide rows with nothing on hand in any status. */
  hideEmpty: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
export type StockBalanceQuery = z.infer<typeof stockBalanceQuerySchema>;

export const MOVEMENT_TYPES = [
  'OPENING', 'PURCHASE_RECEIPT', 'CUSTOMER_RETURN', 'PROJECT_RETURN', 'TRANSFER_IN', 'PRODUCTION_RECEIPT', 'PROJECT_ISSUE', 'TRANSFER_OUT',
  'SUPPLIER_RETURN', 'DAMAGE', 'SCRAP', 'CONSUMPTION', 'ASSET_CAPITALIZATION', 'ADJUSTMENT_GAIN', 'ADJUSTMENT_LOSS', 'COUNT_VARIANCE', 'REVERSAL',
] as const;
export const movementQuerySchema = listQuerySchema.extend({
  itemId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  projectId: idSchema.optional(),
  batchNo: z.string().trim().max(60).optional(),
  stockStatus: stockStatusSchema.optional(),
  txnType: z.enum(MOVEMENT_TYPES).optional(),
  sourceType: z.string().trim().max(60).optional(),
  sourceId: idSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type MovementQuery = z.infer<typeof movementQuerySchema>;

export const valuationQuerySchema = z.object({
  warehouseId: idSchema.optional(),
  categoryId: idSchema.optional(),
  groupBy: z.enum(['warehouse', 'category', 'item']).default('warehouse'),
});
export type ValuationQuery = z.infer<typeof valuationQuerySchema>;

export const batchListQuerySchema = listQuerySchema.extend({
  itemId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  /** Batches expiring on or before this date. */
  expiringBefore: dateSchema.optional(),
  hideEmpty: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
export type BatchListQuery = z.infer<typeof batchListQuerySchema>;

export const SERIAL_STATUSES = ['IN_STOCK', 'ISSUED', 'IN_REPAIR', 'LOST', 'DAMAGED', 'DISPOSED'] as const;
export const serialListQuerySchema = listQuerySchema.extend({
  itemId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  projectId: idSchema.optional(),
  status: z.enum(SERIAL_STATUSES).optional(),
});
export type SerialListQuery = z.infer<typeof serialListQuerySchema>;

// ---- Warehouse transfer -------------------------------------------------------------------------

export const transferLineSchema = z.object({
  itemId: idSchema,
  qty: quantitySchema,
  unit: unitSchema.optional(),
  batchNo: z.string().trim().max(60).optional(),
  serialNo: z.string().trim().min(1).max(80).nullish(),
});
export type TransferLineInput = z.infer<typeof transferLineSchema>;

const transferFields = z.object({
  fromWarehouseId: idSchema,
  toWarehouseId: idSchema,
  fromProjectId: idSchema.nullish(),
  toProjectId: idSchema.nullish(),
  transferDate: dateSchema.optional(),
  remarks: optionalText(1000),
  lines: z.array(transferLineSchema).min(1).max(MAX_LINES),
});
export const createTransferSchema = transferFields.refine((v) => v.fromWarehouseId !== v.toWarehouseId, {
  path: ['toWarehouseId'],
  message: 'Source and destination warehouse must differ',
});
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export const updateTransferSchema = transferFields.partial();
export type UpdateTransferInput = z.infer<typeof updateTransferSchema>;

export const stockDocListQuerySchema = listQuerySchema.extend({
  status: stockDocStatusSchema.optional(),
  warehouseId: idSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type StockDocListQuery = z.infer<typeof stockDocListQuerySchema>;
export const STOCK_DOC_SORT_FIELDS = ['number', 'createdAt', 'postedAt'] as const;

// ---- Stock adjustment ---------------------------------------------------------------------------

export const adjustmentLineSchema = z.object({
  itemId: idSchema,
  batchNo: z.string().trim().max(60).optional(),
  /** Signed change in base units. Positive = gain (needs a unit cost), negative = loss (valued at average cost). */
  qtyDelta: decimalSchema.refine((v) => /^-?\d+(\.\d{1,4})?$/.test(v) && Number(v) !== 0, 'Must be a non-zero number with at most 4 decimal places'),
  /** Gains only. Defaults to the average cost on hand, then the last purchase cost. */
  unitCost: decimalSchema.refine((v) => /^\d+(\.\d{1,4})?$/.test(v), 'Must be 0 or greater with at most 4 decimal places').optional(),
});
export type AdjustmentLineInput = z.infer<typeof adjustmentLineSchema>;

const adjustmentFields = z.object({
  warehouseId: idSchema,
  adjustDate: dateSchema.optional(),
  reason: z.string().trim().min(5).max(500),
  lines: z.array(adjustmentLineSchema).min(1).max(MAX_LINES),
});
export const createAdjustmentSchema = adjustmentFields;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export const updateAdjustmentSchema = adjustmentFields.omit({ warehouseId: true }).partial();
export type UpdateAdjustmentInput = z.infer<typeof updateAdjustmentSchema>;

// ---- Stock count --------------------------------------------------------------------------------

export const createCountSchema = z.object({
  warehouseId: idSchema,
  countDate: dateSchema.optional(),
  remarks: optionalText(1000),
  /** Limit the count sheet to one category or a set of items; omit to snapshot the whole warehouse. */
  categoryId: idSchema.optional(),
  itemIds: z.array(idSchema).max(500).optional(),
});
export type CreateCountInput = z.infer<typeof createCountSchema>;

export const recordCountSchema = z.object({
  lines: z
    .array(z.object({ lineId: idSchema, physicalQty: zeroOrMoreQtySchema, reason: optionalText(300) }))
    .min(1)
    .max(MAX_LINES),
});
export type RecordCountInput = z.infer<typeof recordCountSchema>;

// ---- Reconciliation -----------------------------------------------------------------------------

export const reconciliationQuerySchema = z.object({
  warehouseId: idSchema.optional(),
  itemId: idSchema.optional(),
});
export type ReconciliationQuery = z.infer<typeof reconciliationQuerySchema>;
