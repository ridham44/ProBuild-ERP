import { z } from 'zod';
import { activityItemSchema } from './common';

/**
 * Response shapes of the Stage B-E endpoints, used for OpenAPI documentation (and therefore the generated
 * client). Over the wire: decimals are strings, timestamps are ISO-8601 strings, ids are UUID strings.
 * Server-side serialization is not coerced through these; they describe what the API returns.
 */
const dec = z.string();
const ts = z.string();
const id = z.string();
const nullableTs = ts.nullable();
const text = z.string().nullable();
const ref = z.object({ id, code: z.string(), name: z.string() });
const nameRef = z.object({ id, name: z.string() });

export const pageOf = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const activityResponseSchema = z.array(activityItemSchema);

// ---- Approvals ------------------------------------------------------------------------------------

export const approvalStepViewSchema = z.object({
  step: z.number().int(),
  role: z.string(),
  state: z.enum(['APPROVED', 'REJECTED', 'CURRENT', 'WAITING', 'CANCELLED']),
  decidedBy: nameRef.nullable(),
  decidedAt: nullableTs,
  comment: text,
});
export const approvalViewSchema = z.object({
  id,
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']),
  amount: dec,
  currentStep: z.number().int(),
  totalSteps: z.number().int(),
  currentRole: text,
  requestedBy: nameRef,
  createdAt: ts,
  steps: z.array(approvalStepViewSchema),
});

// ---- Parties --------------------------------------------------------------------------------------

export const contactResponseSchema = z.object({
  id, companyId: id, customerId: id.nullable(), supplierId: id.nullable(), subcontractorId: id.nullable(),
  name: z.string(), position: text, email: text, phone: text, isPrimary: z.boolean(), createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const supplierResponseSchema = z.object({
  id, companyId: id, code: z.string(), name: z.string(), tin: text, vatStatus: z.enum(['VAT', 'NON_VAT', 'EXEMPT']), address: text, bankInfo: text,
  paymentTermsDays: z.number().int(), category: text, productCategories: text, accredited: z.boolean(), accreditationNo: text,
  accreditationExpiry: nullableTs, ewtCode: text, email: text, phone: text, notes: text, active: z.boolean(), createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const supplierDetailResponseSchema = supplierResponseSchema.extend({ contacts: z.array(contactResponseSchema) });
export const supplierEvaluationResponseSchema = z.object({
  id, companyId: id, supplierId: id, periodStart: ts, periodEnd: ts, priceScore: z.number().int(), qualityScore: z.number().int(),
  deliveryScore: z.number().int(), responsivenessScore: z.number().int(), complianceScore: z.number().int(), rejectionRatePct: dec,
  notes: text, evaluatedById: id.nullable(), createdAt: ts, updatedAt: ts,
});
export const supplierPerformanceResponseSchema = z.object({
  supplierId: id,
  orders: z.object({ count: z.number().int(), totalValue: dec, openCount: z.number().int(), lastOrderDate: nullableTs }),
  delivery: z.object({ receiptCount: z.number().int(), onTimeCount: z.number().int(), onTimeRatePct: dec.nullable() }),
  quality: z.object({ receivedQty: dec, rejectedQty: dec, rejectionRatePct: dec.nullable() }),
  evaluations: z.object({
    count: z.number().int(),
    latestPeriodEnd: nullableTs,
    averages: z.object({ price: dec.nullable(), quality: dec.nullable(), delivery: dec.nullable(), responsiveness: dec.nullable(), compliance: dec.nullable(), overall: dec.nullable() }).nullable(),
  }),
  sourcing: z.object({ rfqsInvited: z.number().int(), quotationsSubmitted: z.number().int(), awards: z.number().int(), responseRatePct: dec.nullable(), winRatePct: dec.nullable() }),
});
export const supplierPurchaseHistoryRowSchema = z.object({
  id, number: z.string(), status: z.string(), orderDate: ts, expectedDate: nullableTs, totalAmount: dec, currency: z.string(),
  project: ref,
});
export const customerResponseSchema = z.object({
  id, companyId: id, code: z.string(), name: z.string(), isCompany: z.boolean(), tin: text, vatStatus: z.enum(['VAT', 'NON_VAT', 'EXEMPT']),
  billingAddress: text, siteAddress: text, paymentTermsDays: z.number().int(), creditLimit: dec, bankInfo: text, email: text, phone: text,
  active: z.boolean(), createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const customerDetailResponseSchema = customerResponseSchema.extend({ contacts: z.array(contactResponseSchema), projectCount: z.number().int() });

// ---- Inventory ------------------------------------------------------------------------------------

export const uomResponseSchema = z.object({ id, companyId: id, code: z.string(), name: z.string(), createdAt: ts, updatedAt: ts });
export const itemCategoryResponseSchema = z.object({ id, companyId: id, parentId: id.nullable(), name: z.string(), createdAt: ts, updatedAt: ts, deletedAt: nullableTs });
export const itemUnitConversionResponseSchema = z.object({ id, companyId: id, itemId: id, unit: z.string(), factor: dec, createdAt: ts, updatedAt: ts });
export const itemResponseSchema = z.object({
  id, companyId: id, categoryId: id.nullable(), preferredSupplierId: id.nullable(), restrictedProjectId: id.nullable(), sku: z.string(), name: z.string(),
  description: text, brand: text, model: text, specification: text, itemType: z.string(), costCategory: z.string(), trackBatch: z.boolean(),
  trackSerial: z.boolean(), trackExpiry: z.boolean(), baseUnit: z.string(), purchaseUnit: text, issueUnit: text, conversionFactor: dec, barcode: text,
  qrCode: text, minStock: dec, maxStock: dec, reorderPoint: dec, safetyStock: dec, costingMethod: z.enum(['WEIGHTED_AVERAGE', 'STANDARD', 'FIFO', 'MOVING_AVERAGE']),
  standardCost: dec, lastPurchaseCost: dec, allowableWastePct: dec, active: z.boolean(), createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const itemListRowSchema = itemResponseSchema.extend({ category: nameRef.nullable() });
export const itemDetailResponseSchema = itemResponseSchema.extend({
  category: nameRef.nullable(),
  preferredSupplier: ref.nullable(),
  unitConversions: z.array(itemUnitConversionResponseSchema),
});
export const itemStockSummaryResponseSchema = z.object({
  itemId: id,
  baseUnit: z.string(),
  totals: z.object({ onHand: dec, reserved: dec, committed: dec, available: dec, value: dec }),
  warehouses: z.array(z.object({
    warehouseId: id, warehouseCode: z.string(), warehouseName: z.string(), onHand: dec, reserved: dec, committed: dec, available: dec,
    quarantine: dec, damaged: dec, inTransit: dec, value: dec,
  })),
});
export const priceHistoryRowSchema = z.object({
  source: z.enum(['QUOTATION', 'PURCHASE_ORDER']), at: ts, supplier: nameRef, reference: z.string(), referenceId: id, qty: dec, unit: text,
  unitPrice: dec, discountPct: dec, taxPct: dec, netUnitPrice: dec, currency: z.string(),
});

export const warehouseDetailResponseSchema = z.object({
  id, companyId: id, branchId: id.nullable(), projectId: id.nullable(), parentWarehouseId: id.nullable(), code: z.string(), name: z.string(),
  type: z.string(), address: text, managerId: id.nullable(), active: z.boolean(), createdAt: ts, updatedAt: ts,
  branch: ref.nullable(), project: ref.nullable(), parentWarehouse: ref.nullable(),
});
export const warehouseSummaryResponseSchema = z.object({
  warehouseId: id,
  locations: z.object({ total: z.number().int(), byLevel: z.array(z.object({ level: z.string(), count: z.number().int() })) }),
  stock: z.object({ distinctItems: z.number().int(), byStatus: z.array(z.object({ stockStatus: z.string(), qtyOnHand: dec, value: dec })) }),
});
export const warehouseStockRowSchema = z.object({
  id, warehouseId: id, itemId: id, batchNo: z.string(), stockStatus: z.string(), qtyOnHand: dec, value: dec, avgCost: dec, updatedAt: ts,
  item: z.object({ id, sku: z.string(), name: z.string(), baseUnit: z.string() }),
});

// ---- Projects -------------------------------------------------------------------------------------

export const projectResponseSchema = z.object({
  id, companyId: id, branchId: id.nullable(), customerId: id, costCenterId: id.nullable(), managerId: id.nullable(), code: z.string(), name: z.string(),
  type: z.string(), status: z.enum(['PIPELINE', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED']), sector: z.string(), fundingSource: text,
  location: text, currency: z.string(), contractAmount: dec, startDate: nullableTs, originalEndDate: nullableTs, revisedEndDate: nullableTs,
  retentionPct: dec, advancePct: dec, warrantyMonths: z.number().int(), ldRatePct: dec, paymentTerms: text, progressPct: dec,
  createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const projectListRowSchema = projectResponseSchema.extend({ customer: ref, manager: nameRef.nullable(), branch: ref.nullable() });
export const projectMemberResponseSchema = z.object({ id, projectId: id, userId: id, role: z.string(), createdAt: ts, updatedAt: ts });
export const projectMemberViewSchema = projectMemberResponseSchema.extend({ user: z.object({ id, name: z.string(), email: z.string() }) });
export const contractResponseSchema = z.object({
  id, companyId: id, projectId: id, number: z.string(), title: z.string(), contractType: z.string(), originalAmount: dec, currentAmount: dec,
  signedDate: nullableTs, noticeToProceed: nullableTs, clauses: text, status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED']),
  createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const projectDetailResponseSchema = projectListRowSchema.extend({
  projectMembers: z.array(projectMemberResponseSchema.extend({ user: nameRef })),
  activeContract: contractResponseSchema.nullable(),
});
export const projectDashboardResponseSchema = z.object({
  projectId: id,
  status: z.string(),
  progressPct: dec,
  financial: z.object({
    contractValue: dec,
    contractValueSource: z.enum(['CONTRACT', 'PROJECT']),
    budget: z.object({ budgetId: id, version: z.number().int(), totalAmount: dec }).nullable(),
    committed: dec.nullable(),
    actual: dec,
  }).nullable(),
  counts: z.object({ openRequisitions: z.number().int(), openPurchaseOrders: z.number().int(), wbsNodes: z.number().int(), boqItems: z.number().int(), teamMembers: z.number().int() }),
});
export const wbsRowSchema = z.object({
  id, companyId: id, projectId: id, parentId: id.nullable(), code: z.string(), name: z.string(), level: z.number().int(), sortOrder: z.number().int(),
  weightPct: dec, progressPct: dec, createdAt: ts, updatedAt: ts, depth: z.number().int(), hasChildren: z.boolean(),
});
export const wbsNodeResponseSchema = wbsRowSchema.omit({ depth: true, hasChildren: true });
export const costCodeResponseSchema = z.object({
  id, companyId: id, parentId: id.nullable(), code: z.string(), name: z.string(), category: z.enum(['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER']),
  active: z.boolean(), createdAt: ts, updatedAt: ts, deletedAt: nullableTs,
});
export const estimateResponseSchema = z.object({
  id, companyId: id, projectId: id, version: z.number().int(), type: z.string(), status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED']),
  name: text, overheadPct: dec, profitPct: dec, taxPct: dec, directCost: dec, totalAmount: dec, approvedAt: nullableTs, approvedById: id.nullable(),
  createdAt: ts, updatedAt: ts,
});
export const estimateListRowSchema = estimateResponseSchema.extend({ _count: z.object({ items: z.number().int() }) });
export const estimateDetailResponseSchema = estimateResponseSchema.extend({ itemCount: z.number().int() });
export const boqItemResponseSchema = z.object({
  id, companyId: id, estimateId: id, projectId: id, wbsNodeId: id.nullable(), costCodeId: id.nullable(), section: text, itemNo: z.string(),
  description: z.string(), costCategory: z.string(), unit: z.string(), quantity: dec, unitRate: dec, amount: dec, materialCost: dec, laborCost: dec,
  equipmentCost: dec, subcontractCost: dec, completedQty: dec, sortOrder: z.number().int(), createdAt: ts, updatedAt: ts,
});
export const boqListRowSchema = boqItemResponseSchema.extend({ wbsNode: ref.nullable(), costCode: ref.nullable() });
export const budgetLineResponseSchema = z.object({
  id, budgetId: id, projectId: id, wbsNodeId: id.nullable(), boqItemId: id.nullable(), costCodeId: id.nullable(), category: z.string(), quantity: dec.nullable(), amount: dec,
  createdAt: ts, updatedAt: ts,
});
export const budgetResponseSchema = z.object({
  id, companyId: id, projectId: id, version: z.number().int(), isCurrent: z.boolean(), isOriginal: z.boolean(), reason: text, totalAmount: dec,
  createdById: id.nullable(), createdAt: ts, updatedAt: ts,
});
export const budgetDetailResponseSchema = budgetResponseSchema.extend({
  lines: z.array(budgetLineResponseSchema.extend({
    boqItem: z.object({ id, itemNo: z.string(), description: z.string(), unit: z.string() }).nullable(),
    wbsNode: ref.nullable(),
    costCode: ref.nullable(),
  })),
});
export const estimateApprovalResponseSchema = z.object({ estimate: estimateResponseSchema, budget: budgetResponseSchema.extend({ lines: z.array(budgetLineResponseSchema) }) });

// ---- Procurement ----------------------------------------------------------------------------------

const itemRef = z.object({ id, sku: z.string(), name: z.string(), baseUnit: z.string() });
const dimRefs = {
  wbsNode: ref.nullable(),
  costCode: ref.nullable(),
  boqItem: z.object({ id, itemNo: z.string(), description: z.string() }).nullable(),
};

export const requisitionLineResponseSchema = z.object({
  id, requisitionId: id, lineNo: z.number().int(), itemId: id, description: text, justification: text, warehouseId: id.nullable(), wbsNodeId: id.nullable(),
  costCodeId: id.nullable(), boqItemId: id.nullable(), qty: dec, orderedQty: dec, unit: z.string(), estimatedUnitCost: dec, requiredDate: nullableTs,
  createdAt: ts, updatedAt: ts, item: itemRef, warehouse: ref.nullable(), ...dimRefs, remainingQty: dec, estimatedAmount: dec,
});
const requisitionBase = z.object({
  id, companyId: id, number: z.string(), projectId: id, warehouseId: id.nullable(), requesterId: id, priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  requiredDate: nullableTs, status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PARTIALLY_ORDERED', 'ORDERED', 'CANCELLED', 'CLOSED']),
  remarks: text, purpose: text, estimatedTotal: dec, submittedAt: nullableTs, approvedAt: nullableTs, rejectedAt: nullableTs, cancelledAt: nullableTs,
  cancelReason: text, closedAt: nullableTs, closeReason: text, createdAt: ts, updatedAt: ts,
});
export const requisitionListRowSchema = requisitionBase.extend({ project: ref, _count: z.object({ lines: z.number().int() }) });
export const requisitionDetailResponseSchema = requisitionBase.extend({
  project: z.object({ id, code: z.string(), name: z.string(), status: z.string() }),
  requester: nameRef.nullable(),
  lines: z.array(requisitionLineResponseSchema),
  rfqs: z.array(z.object({ id, number: z.string(), status: z.string(), dueDate: nullableTs })),
  purchaseOrders: z.array(z.object({ id, number: z.string(), status: z.string(), totalAmount: dec, supplier: nameRef })),
  approvals: z.array(approvalViewSchema),
});

const rfqBase = z.object({
  id, companyId: id, number: z.string(), requisitionId: id.nullable(), projectId: id, dueDate: nullableTs, status: z.enum(['DRAFT', 'SENT', 'QUOTED', 'AWARDED', 'CLOSED', 'CANCELLED']),
  awardedQuotationId: id.nullable(), remarks: text, deliveryRequirements: text, deliveryLocation: text, requiredDate: nullableTs, createdById: id.nullable(),
  sentAt: nullableTs, awardedAt: nullableTs, closedAt: nullableTs, cancelledAt: nullableTs, createdAt: ts, updatedAt: ts,
});
export const rfqListRowSchema = rfqBase.extend({
  project: ref,
  requisition: z.object({ id, number: z.string() }).nullable(),
  _count: z.object({ lines: z.number().int(), suppliers: z.number().int(), quotations: z.number().int() }),
});
export const rfqLineResponseSchema = z.object({
  id, rfqId: id, requisitionLineId: id.nullable(), lineNo: z.number().int(), itemId: id, description: text, qty: dec, unit: z.string(), requiredDate: nullableTs,
  item: z.object({ id, sku: z.string(), name: z.string(), baseUnit: z.string() }),
});
export const rfqAwardResponseSchema = z.object({
  id, companyId: id, rfqId: id, quotationId: id, supplierId: id, awardedById: id, awardedAt: ts, reason: text, totalAmount: dec, createdAt: ts, updatedAt: ts,
});
export const rfqDetailResponseSchema = rfqBase.extend({
  project: ref,
  requisition: z.object({ id, number: z.string(), status: z.string() }).nullable(),
  lines: z.array(rfqLineResponseSchema),
  suppliers: z.array(z.object({
    id, rfqId: id, supplierId: id, status: z.enum(['INVITED', 'SENT', 'QUOTED', 'DECLINED']), sentAt: nullableTs, respondedAt: nullableTs,
    supplier: z.object({ id, code: z.string(), name: z.string(), accredited: z.boolean() }),
  })),
  quotations: z.array(z.object({
    id, supplierId: id, quoteNo: text, quoteDate: ts, validUntil: nullableTs, status: z.enum(['SUBMITTED', 'AWARDED', 'NOT_AWARDED']), totalAmount: dec, currency: z.string(),
  })),
  award: rfqAwardResponseSchema.nullable(),
});

export const quotationLineResponseSchema = z.object({
  id, quotationId: id, rfqLineId: id, itemId: id, qty: dec, unitPrice: dec, discountPct: dec, discountAmount: dec, taxPct: dec, taxAmount: dec, lineTotal: dec,
  deliveryDate: nullableTs, brand: text, specification: text, remarks: text, createdAt: ts, updatedAt: ts,
});
const quotationBase = z.object({
  id, companyId: id, rfqId: id, supplierId: id, quoteNo: text, quoteDate: ts, validUntil: nullableTs, deliveryDays: z.number().int().nullable(),
  paymentTerms: text, warranty: text, currency: z.string(), status: z.enum(['SUBMITTED', 'AWARDED', 'NOT_AWARDED']), subtotal: dec, discountAmount: dec,
  freight: dec, taxAmount: dec, totalAmount: dec, createdById: id.nullable(), createdAt: ts, updatedAt: ts,
});
export const quotationListRowSchema = quotationBase.extend({ supplier: ref, rfq: z.object({ id, number: z.string() }) });
export const quotationDetailResponseSchema = quotationBase.extend({
  supplier: ref,
  rfq: z.object({ id, number: z.string(), status: z.string(), projectId: id }),
  lines: z.array(quotationLineResponseSchema.extend({
    item: z.object({ id, sku: z.string(), name: z.string() }),
    rfqLine: z.object({ id, lineNo: z.number().int(), qty: dec, unit: z.string() }),
  })),
});

export const comparisonOfferSchema = z.object({
  supplierId: id, quotationId: id, qty: dec, unitPrice: dec, discountPct: dec, taxPct: dec, netUnitPrice: dec, lineTotal: dec, taxAmount: dec,
  deliveryDate: nullableTs, brand: text, specification: text, isLowestPrice: z.boolean(), isFastestDelivery: z.boolean(), isPreferredSupplier: z.boolean(),
  isShortQuote: z.boolean(), varianceFromLowestPct: dec.nullable(), varianceFromLowestAmount: dec.nullable(),
});
export const comparisonResponseSchema = z.object({
  rfqId: id,
  number: z.string(),
  status: z.string(),
  awardedQuotationId: id.nullable(),
  suppliers: z.array(z.object({
    supplierId: id, code: z.string(), name: z.string(), quotationId: id, quoteNo: text, quoteDate: ts, validUntil: nullableTs, isExpired: z.boolean(),
    deliveryDays: z.number().int().nullable(), paymentTerms: text, currency: z.string(), subtotal: dec, discountAmount: dec, freight: dec, taxAmount: dec,
    totalAmount: dec, quotedLines: z.number().int(), coversAllLines: z.boolean(), isLowestTotal: z.boolean(), varianceFromLowestTotalPct: dec.nullable(),
    status: z.enum(['SUBMITTED', 'AWARDED', 'NOT_AWARDED']),
  })),
  lines: z.array(z.object({
    rfqLineId: id, lineNo: z.number().int(), item: z.object({ id, sku: z.string(), name: z.string() }), description: text, qty: dec, unit: z.string(),
    requiredDate: nullableTs, lowestNetUnitPrice: dec.nullable(), fastestDeliveryDate: nullableTs, offers: z.array(comparisonOfferSchema),
  })),
});

export const purchaseOrderLineResponseSchema = z.object({
  id, orderId: id, itemId: id, wbsNodeId: id.nullable(), costCodeId: id.nullable(), boqItemId: id.nullable(), requisitionLineId: id.nullable(),
  quotationLineId: id.nullable(), lineNo: z.number().int(), description: text, deliveryDate: nullableTs, qty: dec, cancelledQty: dec, receivedQty: dec,
  invoicedQty: dec, unit: z.string(), unitPrice: dec, taxPct: dec, discountPct: dec, discountAmount: dec, taxAmount: dec, lineTotal: dec,
  createdAt: ts, updatedAt: ts, item: itemRef, ...dimRefs, openQty: dec,
});
const purchaseOrderBase = z.object({
  id, companyId: id, number: z.string(), supplierId: id, projectId: id, warehouseId: id, requisitionId: id.nullable(), quotationId: id.nullable(),
  rfqId: id.nullable(), currency: z.string(), submittedAt: nullableTs, approvedAt: nullableTs, rejectedAt: nullableTs, sentAt: nullableTs,
  cancelledAt: nullableTs, cancelReason: text, closedAt: nullableTs, orderDate: ts, expectedDate: nullableTs, deliveryLocation: text, paymentTerms: text,
  terms: text, status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED']),
  subtotal: dec, discount: dec, freight: dec, taxAmount: dec, totalAmount: dec, createdById: id, createdAt: ts, updatedAt: ts,
});
export const purchaseOrderListRowSchema = purchaseOrderBase.extend({
  supplier: ref, project: ref, warehouse: ref, _count: z.object({ lines: z.number().int() }),
});
export const purchaseOrderDetailResponseSchema = purchaseOrderBase.extend({
  supplier: z.object({ id, code: z.string(), name: z.string(), tin: text, paymentTermsDays: z.number().int() }),
  project: ref,
  warehouse: ref,
  requisition: z.object({ id, number: z.string(), status: z.string() }).nullable(),
  rfq: z.object({ id, number: z.string(), status: z.string() }).nullable(),
  lines: z.array(purchaseOrderLineResponseSchema),
  receipts: z.array(z.object({ id, number: z.string(), status: z.string(), receiptDate: ts, postedAt: nullableTs })),
  approvals: z.array(approvalViewSchema),
  activity: activityResponseSchema,
});
