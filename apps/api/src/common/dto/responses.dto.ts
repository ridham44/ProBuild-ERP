import {
  activityItemSchema,
  approvalViewSchema,
  boqListRowSchema,
  budgetDetailResponseSchema,
  comparisonResponseSchema,
  contactResponseSchema,
  contractResponseSchema,
  costCodeResponseSchema,
  customerDetailResponseSchema,
  customerResponseSchema,
  estimateApprovalResponseSchema,
  estimateDetailResponseSchema,
  estimateListRowSchema,
  estimateResponseSchema,
  itemCategoryResponseSchema,
  itemDetailResponseSchema,
  itemListRowSchema,
  itemResponseSchema,
  itemStockSummaryResponseSchema,
  itemUnitConversionResponseSchema,
  pageOf,
  priceHistoryRowSchema,
  projectDashboardResponseSchema,
  projectDetailResponseSchema,
  projectListRowSchema,
  projectMemberResponseSchema,
  projectMemberViewSchema,
  projectResponseSchema,
  purchaseOrderDetailResponseSchema,
  purchaseOrderListRowSchema,
  quotationDetailResponseSchema,
  quotationListRowSchema,
  requisitionDetailResponseSchema,
  requisitionListRowSchema,
  rfqDetailResponseSchema,
  rfqListRowSchema,
  supplierDetailResponseSchema,
  supplierEvaluationResponseSchema,
  supplierPerformanceResponseSchema,
  supplierPurchaseHistoryRowSchema,
  supplierResponseSchema,
  uomResponseSchema,
  warehouseDetailResponseSchema,
  warehouseStockRowSchema,
  warehouseSummaryResponseSchema,
  wbsNodeResponseSchema,
  wbsRowSchema,
  budgetResponseSchema,
} from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';

// Response documentation classes. They exist so the OpenAPI document (and the generated client) carries
// explicit, named response shapes for every Stage B-E endpoint.

export class ActivityItemDto extends createZodDto(activityItemSchema) {}
export class ApprovalViewDto extends createZodDto(approvalViewSchema) {}

export class SupplierDto extends createZodDto(supplierResponseSchema) {}
export class SupplierDetailDto extends createZodDto(supplierDetailResponseSchema) {}
export class SupplierPageDto extends createZodDto(pageOf(supplierResponseSchema)) {}
export class ContactDto extends createZodDto(contactResponseSchema) {}
export class SupplierEvaluationDto extends createZodDto(supplierEvaluationResponseSchema) {}
export class SupplierEvaluationPageDto extends createZodDto(pageOf(supplierEvaluationResponseSchema)) {}
export class SupplierPerformanceDto extends createZodDto(supplierPerformanceResponseSchema) {}
export class SupplierPurchaseHistoryPageDto extends createZodDto(pageOf(supplierPurchaseHistoryRowSchema)) {}
export class CustomerDto extends createZodDto(customerResponseSchema) {}
export class CustomerDetailDto extends createZodDto(customerDetailResponseSchema) {}
export class CustomerPageDto extends createZodDto(pageOf(customerResponseSchema)) {}

export class UomDto extends createZodDto(uomResponseSchema) {}
export class UomPageDto extends createZodDto(pageOf(uomResponseSchema)) {}
export class ItemCategoryDto extends createZodDto(itemCategoryResponseSchema) {}
export class ItemCategoryPageDto extends createZodDto(pageOf(itemCategoryResponseSchema)) {}
export class ItemDto extends createZodDto(itemResponseSchema) {}
export class ItemDetailDto extends createZodDto(itemDetailResponseSchema) {}
export class ItemPageDto extends createZodDto(pageOf(itemListRowSchema)) {}
export class ItemUnitConversionDto extends createZodDto(itemUnitConversionResponseSchema) {}
export class ItemStockSummaryDto extends createZodDto(itemStockSummaryResponseSchema) {}
export class PriceHistoryPageDto extends createZodDto(pageOf(priceHistoryRowSchema)) {}
export class WarehouseDetailDto extends createZodDto(warehouseDetailResponseSchema) {}
export class WarehouseSummaryDto extends createZodDto(warehouseSummaryResponseSchema) {}
export class WarehouseStockPageDto extends createZodDto(pageOf(warehouseStockRowSchema)) {}

export class ProjectDto extends createZodDto(projectResponseSchema) {}
export class ProjectDetailDto extends createZodDto(projectDetailResponseSchema) {}
export class ProjectPageDto extends createZodDto(pageOf(projectListRowSchema)) {}
export class ProjectMemberDto extends createZodDto(projectMemberResponseSchema) {}
export class ProjectMemberViewDto extends createZodDto(projectMemberViewSchema) {}
export class ProjectDashboardDto extends createZodDto(projectDashboardResponseSchema) {}
export class ContractDto extends createZodDto(contractResponseSchema) {}
export class WbsRowDto extends createZodDto(wbsRowSchema) {}
export class WbsNodeDto extends createZodDto(wbsNodeResponseSchema) {}
export class CostCodeDto extends createZodDto(costCodeResponseSchema) {}
export class CostCodePageDto extends createZodDto(pageOf(costCodeResponseSchema)) {}
export class EstimateDto extends createZodDto(estimateResponseSchema) {}
export class EstimateDetailDto extends createZodDto(estimateDetailResponseSchema) {}
export class EstimatePageDto extends createZodDto(pageOf(estimateListRowSchema)) {}
export class EstimateApprovalDto extends createZodDto(estimateApprovalResponseSchema) {}
export class BoqItemDto extends createZodDto(boqListRowSchema.omit({ wbsNode: true, costCode: true })) {}
export class BoqPageDto extends createZodDto(pageOf(boqListRowSchema)) {}
export class BudgetDto extends createZodDto(budgetResponseSchema) {}
export class BudgetDetailDto extends createZodDto(budgetDetailResponseSchema) {}

export class RequisitionDetailDto extends createZodDto(requisitionDetailResponseSchema) {}
export class RequisitionPageDto extends createZodDto(pageOf(requisitionListRowSchema)) {}
export class RfqDetailDto extends createZodDto(rfqDetailResponseSchema) {}
export class RfqPageDto extends createZodDto(pageOf(rfqListRowSchema)) {}
export class QuotationDetailDto extends createZodDto(quotationDetailResponseSchema) {}
export class QuotationPageDto extends createZodDto(pageOf(quotationListRowSchema)) {}
export class ComparisonDto extends createZodDto(comparisonResponseSchema) {}
export class PurchaseOrderDetailDto extends createZodDto(purchaseOrderDetailResponseSchema) {}
export class PurchaseOrderPageDto extends createZodDto(pageOf(purchaseOrderListRowSchema)) {}
