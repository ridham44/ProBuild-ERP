import { z } from 'zod';
import { approvalViewSchema } from './responses';

/**
 * Response shapes of the Stage F-J endpoints (goods receipt + QC, stock, material request / issue / return, project cost).
 * Decimals are strings, timestamps ISO-8601 strings, ids UUID strings. Used for OpenAPI documentation and the generated client.
 */
const dec = z.string();
const ts = z.string();
const id = z.string();
const nullableTs = ts.nullable();
const text = z.string().nullable();
const ref = z.object({ id, code: z.string(), name: z.string() });
const nameRef = z.object({ id, name: z.string() });
const itemRef = z.object({ id, sku: z.string(), name: z.string(), baseUnit: z.string() });
const dimRefs = {
  wbsNode: ref.nullable(),
  costCode: ref.nullable(),
  boqItem: z.object({ id, itemNo: z.string(), description: z.string() }).nullable(),
};
const jsonList = z.array(z.record(z.string(), z.unknown())).nullable();

// ---- Goods receipt ------------------------------------------------------------------------------

export const qcInspectionResponseSchema = z.object({
  id, companyId: id, receiptLineId: id, inspectorId: id, result: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'QUARANTINED', 'PARTIAL']),
  outcome: z.enum(['PASS', 'FAIL', 'PARTIAL']), phase: z.enum(['RECEIVING', 'QUARANTINE_RELEASE']), acceptedQty: dec, rejectedQty: dec, quarantineQty: dec,
  reason: text, attachments: jsonList, checklist: jsonList, testResult: text, certificateNo: text, remarks: text, inspectedAt: ts, createdAt: ts, updatedAt: ts,
});

const grnBase = z.object({
  id, companyId: id, number: z.string(), orderId: id, supplierId: id, warehouseId: id, receiptDate: ts, supplierDrNo: text, vehicle: text, driver: text,
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'POSTED']), postedAt: nullableTs, receivedById: id, remarks: text,
  cancelledAt: nullableTs, cancelReason: text, overReceiptReason: text, overReceiptById: id.nullable(), createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const goodsReceiptLineResponseSchema = z.object({
  id, receiptId: id, orderLineId: id, itemId: id, lineNo: z.number().int(), receivedQty: dec, acceptedQty: dec, rejectedQty: dec, quarantineQty: dec,
  quarantineOpenQty: dec, overReceivedQty: dec, unit: z.string(), unitCost: dec, batchNo: z.string(), expiryDate: nullableTs,
  qcResult: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'QUARANTINED', 'PARTIAL']), locationId: id.nullable(), serialNos: z.array(z.string()), rejectionReason: text,
  createdAt: ts, updatedAt: ts,
  item: itemRef.extend({ trackBatch: z.boolean(), trackSerial: z.boolean(), trackExpiry: z.boolean() }),
  location: z.object({ id, code: z.string(), fullPath: z.string() }).nullable(),
  inspections: z.array(qcInspectionResponseSchema),
  ordered: dec, previouslyReceived: dec, remaining: dec, receivingNow: dec, overReceiving: z.boolean(),
});
export const goodsReceiptListRowSchema = grnBase.extend({
  supplier: ref, warehouse: ref, order: z.object({ id, number: z.string(), projectId: id }), _count: z.object({ lines: z.number().int() }),
});
export const goodsReceiptDetailResponseSchema = grnBase.extend({
  supplier: ref, warehouse: ref, order: z.object({ id, number: z.string(), status: z.string(), projectId: id }), project: ref,
  receivedBy: nameRef.nullable(), lines: z.array(goodsReceiptLineResponseSchema),
});
export const receivableLinesResponseSchema = z.object({
  orderId: id, orderNumber: z.string(), status: z.string(), receivable: z.boolean(), overReceiptTolerancePct: dec,
  lines: z.array(z.object({
    orderLineId: id, lineNo: z.number().int(), item: itemRef.extend({ trackBatch: z.boolean(), trackSerial: z.boolean(), trackExpiry: z.boolean() }),
    description: text, unit: z.string(), ordered: dec, previouslyReceived: dec, cancelled: dec, remaining: dec,
  })),
});

// ---- Stock queries ------------------------------------------------------------------------------

export const stockBalanceRowSchema = z.object({
  itemId: id, sku: z.string(), name: z.string(), baseUnit: z.string(), warehouseId: id, warehouseCode: z.string(), warehouseName: z.string(),
  onHand: dec, reserved: dec, committed: dec, available: dec, quarantine: dec, damaged: dec, inTransit: dec, avgCost: dec, value: dec, availableValue: dec,
  minStock: dec, belowMinimum: z.boolean(),
  locations: z.array(z.object({ locationId: id.nullable(), path: z.string(), qty: dec })),
});
export const valuationResponseSchema = z.object({
  groupBy: z.enum(['warehouse', 'category', 'item']), method: z.string(), totalValue: dec, truncated: z.boolean(),
  rows: z.array(z.object({ key: z.string(), label: z.string(), code: text, qty: dec, value: dec, availableValue: dec, quarantineValue: dec, damagedValue: dec })),
});
export const movementRowSchema = z.object({
  id, companyId: id, txnNo: z.string(), txnDate: ts, txnType: z.string(), warehouseId: id, locationId: id.nullable(), itemId: id, batchNo: z.string(), serialNo: text,
  stockStatus: z.enum(['AVAILABLE', 'QUARANTINE', 'DAMAGED', 'IN_TRANSIT']), qty: dec, unitCost: dec, value: dec, runningQty: dec, runningValue: dec,
  sourceType: z.string(), sourceId: id, projectId: id.nullable(), wbsNodeId: id.nullable(), costCodeId: id.nullable(), boqItemId: id.nullable(),
  costCenterId: id.nullable(), reversalOfId: id.nullable(), userId: id, remarks: text, createdAt: ts,
  direction: z.enum(['IN', 'OUT']),
  item: itemRef, warehouse: ref, location: z.object({ id, fullPath: z.string() }).nullable(),
  reference: z.object({ type: z.string(), id, number: text }),
  user: nameRef.nullable(),
});
export const batchRowSchema = z.object({
  id, itemId: id, batchNo: z.string(), lotNo: text, expiryDate: nullableTs, supplierId: id.nullable(), sku: z.string(), name: z.string(), baseUnit: z.string(),
  onHand: dec, available: dec, quarantine: dec, value: dec, expired: z.boolean(),
});
export const serialRowSchema = z.object({
  id, companyId: id, itemId: id, serialNo: z.string(), qrCode: text, status: z.enum(['IN_STOCK', 'ISSUED', 'IN_REPAIR', 'LOST', 'DAMAGED', 'DISPOSED']),
  warehouseId: id.nullable(), projectId: id.nullable(), assignedEmployeeId: id.nullable(), condition: z.string(), issuedAt: nullableTs, expectedReturnAt: nullableTs,
  createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
  item: z.object({ id, sku: z.string(), name: z.string() }), warehouse: ref.nullable(), project: ref.nullable(),
});
export const reconciliationResponseSchema = z.object({
  clean: z.boolean(), bucketsChecked: z.number().int(), checkedAt: ts,
  differences: z.array(z.object({
    warehouseId: id, itemId: id, batchNo: z.string(), stockStatus: z.string(), ledgerQty: dec, balanceQty: dec, ledgerValue: dec, balanceValue: dec,
    sku: z.string(), warehouseCode: z.string(), qtyDifference: dec, valueDifference: dec, negativeStock: z.boolean(),
  })),
});

// ---- Transfer / adjustment / count ----------------------------------------------------------------

const stockDocStatus = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'POSTED']);
const transferBase = z.object({
  id, companyId: id, number: z.string(), fromWarehouseId: id, toWarehouseId: id, fromProjectId: id.nullable(), toProjectId: id.nullable(), transferDate: ts,
  status: stockDocStatus, postedAt: nullableTs, remarks: text, createdById: id.nullable(), submittedAt: nullableTs, approvedAt: nullableTs, rejectedAt: nullableTs,
  cancelledAt: nullableTs, cancelReason: text, createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const transferListRowSchema = transferBase.extend({ fromWarehouse: ref, toWarehouse: ref, _count: z.object({ lines: z.number().int() }) });
export const transferDetailResponseSchema = transferBase.extend({
  fromWarehouse: ref, toWarehouse: ref, approvals: z.array(approvalViewSchema),
  lines: z.array(z.object({
    id, transferId: id, itemId: id, qty: dec, unit: z.string(), batchNo: z.string(), serialNo: text, createdAt: ts, updatedAt: ts, item: itemRef,
  })),
});

const adjustmentBase = z.object({
  id, companyId: id, number: z.string(), warehouseId: id, adjustDate: ts, reason: z.string(), status: stockDocStatus, postedAt: nullableTs, createdById: id,
  submittedAt: nullableTs, approvedAt: nullableTs, rejectedAt: nullableTs, cancelledAt: nullableTs, cancelReason: text, createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const adjustmentListRowSchema = adjustmentBase.extend({ warehouse: ref, _count: z.object({ lines: z.number().int() }) });
export const adjustmentDetailResponseSchema = adjustmentBase.extend({
  warehouse: ref, approvals: z.array(approvalViewSchema),
  lines: z.array(z.object({
    id, adjustmentId: id, itemId: id, batchNo: z.string(), qtyDelta: dec, unitCost: dec, lineNo: z.number().int(), value: dec, createdAt: ts, updatedAt: ts, item: itemRef,
  })),
});

const countBase = z.object({
  id, companyId: id, number: z.string(), warehouseId: id, countDate: ts, status: stockDocStatus, postedAt: nullableTs, createdById: id, remarks: text,
  submittedAt: nullableTs, approvedAt: nullableTs, rejectedAt: nullableTs, cancelledAt: nullableTs, cancelReason: text, createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const countListRowSchema = countBase.extend({ warehouse: ref, _count: z.object({ lines: z.number().int() }) });
export const countDetailResponseSchema = countBase.extend({
  warehouse: ref, approvals: z.array(approvalViewSchema),
  summary: z.object({ lines: z.number().int(), counted: z.number().int(), varianceValue: dec, gainValue: dec, lossValue: dec }),
  lines: z.array(z.object({
    id, countId: id, itemId: id, batchNo: z.string(), systemQty: dec, physicalQty: dec, counted: z.boolean(), avgCost: dec, varianceQty: dec, varianceValue: dec,
    reason: text, createdAt: ts, updatedAt: ts, item: itemRef,
  })),
});

// ---- Material request -----------------------------------------------------------------------------

const mrBase = z.object({
  id, companyId: id, number: z.string(), projectId: id, warehouseId: id, requestedById: id, employeeId: id.nullable(), wbsNodeId: id.nullable(), costCodeId: id.nullable(),
  neededDate: nullableTs, status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'POSTED']), purpose: text, remarks: text,
  estimatedTotal: dec, submittedAt: nullableTs, approvedAt: nullableTs, rejectedAt: nullableTs, cancelledAt: nullableTs, cancelReason: text, closedAt: nullableTs,
  closeReason: text, createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const materialRequestListRowSchema = mrBase.extend({ project: ref, warehouse: ref, _count: z.object({ lines: z.number().int() }) });
export const materialRequestLineResponseSchema = z.object({
  id, requestId: id, itemId: id, wbsNodeId: id.nullable(), costCodeId: id.nullable(), boqItemId: id.nullable(), lineNo: z.number().int(), qty: dec, approvedQty: dec,
  issuedQty: dec, unit: z.string(), purpose: text, createdAt: ts, updatedAt: ts, item: itemRef, ...dimRefs, remainingQty: dec,
  stock: z.object({ onHand: dec, reservedByOthers: dec, available: dec }),
});
export const materialRequestDetailResponseSchema = mrBase.extend({
  project: z.object({ id, code: z.string(), name: z.string(), status: z.string() }), warehouse: ref, requester: nameRef.nullable(),
  employee: z.object({ id, code: z.string(), fullName: z.string() }).nullable(),
  lines: z.array(materialRequestLineResponseSchema),
  issues: z.array(z.object({ id, number: z.string(), status: z.string(), issueDate: ts, totalCost: dec })),
  approvals: z.array(approvalViewSchema),
});

// ---- Material issue / return ------------------------------------------------------------------------

const miBase = z.object({
  id, companyId: id, number: z.string(), projectId: id, warehouseId: id, requestId: id.nullable(), issueDate: ts, requestedBy: text, approvedById: id.nullable(),
  issuedById: id, receivedBy: text, vehicle: text, deliveryRef: text, signature: text, status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'POSTED']),
  postedAt: nullableTs, remarks: text, totalCost: dec, cancelledAt: nullableTs, cancelReason: text, createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const materialIssueListRowSchema = miBase.extend({
  project: ref, warehouse: ref, request: z.object({ id, number: z.string() }).nullable(), _count: z.object({ lines: z.number().int() }),
});
export const materialIssueLineResponseSchema = z.object({
  id, issueId: id, itemId: id, wbsNodeId: id.nullable(), costCodeId: id.nullable(), boqItemId: id.nullable(), locationId: id.nullable(), qty: dec, unit: z.string(),
  batchNo: z.string(), serialNo: text, unitCost: dec, totalCost: dec, baseQty: dec, lineNo: z.number().int(), requestLineId: id.nullable(), createdAt: ts, updatedAt: ts,
  item: itemRef, ...dimRefs, returnedQty: dec, returnableQty: dec,
});
export const materialIssueDetailResponseSchema = miBase.extend({
  project: ref, warehouse: ref, request: z.object({ id, number: z.string(), status: z.string() }).nullable(), issuedBy: nameRef.nullable(),
  returns: z.array(z.object({ id, number: z.string(), status: z.string(), returnDate: ts })),
  lines: z.array(materialIssueLineResponseSchema),
});

const mrtBase = z.object({
  id, companyId: id, number: z.string(), projectId: id, warehouseId: id, returnDate: ts, returnedById: id, issueId: id.nullable(), reason: text,
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'POSTED']), postedAt: nullableTs, cancelledAt: nullableTs, cancelReason: text,
  createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const materialReturnListRowSchema = mrtBase.extend({
  project: ref, warehouse: ref, issue: z.object({ id, number: z.string() }).nullable(), _count: z.object({ lines: z.number().int() }),
});
export const materialReturnDetailResponseSchema = mrtBase.extend({
  project: ref, warehouse: ref, issue: z.object({ id, number: z.string(), status: z.string() }).nullable(), returnedBy: nameRef.nullable(), totalCost: dec,
  lines: z.array(z.object({
    id, returnId: id, itemId: id, wbsNodeId: id.nullable(), costCodeId: id.nullable(), boqItemId: id.nullable(), qty: dec, unit: z.string(), batchNo: z.string(),
    serialNo: text, condition: z.enum(['GOOD', 'DAMAGED', 'QUARANTINE']), issueLineId: id.nullable(), unitCost: dec, totalCost: dec, baseQty: dec, createdAt: ts, updatedAt: ts, item: itemRef,
  })),
});

// ---- Project cost -----------------------------------------------------------------------------------

export const budgetVsActualResponseSchema = z.object({
  projectId: id,
  budget: z.object({ budgetId: id, version: z.number().int(), totalAmount: dec }).nullable(),
  totals: z.object({ budget: dec, committed: dec.nullable(), actual: dec.nullable(), variance: dec }),
  lines: z.array(z.object({
    costCode: z.object({ id, code: z.string(), name: z.string(), category: z.string() }).nullable(),
    budget: dec, committed: dec.nullable(), actual: dec.nullable(), variance: dec, utilisationPct: dec.nullable(), unbudgeted: z.boolean(),
  })),
});
