import type {
  accountResponseSchema,
  approvalRequestListRowSchema,
  approvalViewSchema,
  approvalWorkflowResponseSchema,
  boqListRowSchema,
  branchResponseSchema,
  budgetVsActualResponseSchema,
  budgetDetailResponseSchema,
  budgetResponseSchema,
  companyResponseSchema,
  comparisonResponseSchema,
  contactResponseSchema,
  contractResponseSchema,
  costCodeResponseSchema,
  customerDetailResponseSchema,
  customerResponseSchema,
  estimateApprovalResponseSchema,
  estimateDetailResponseSchema,
  estimateListRowSchema,
  goodsReceiptDetailResponseSchema,
  goodsReceiptListRowSchema,
  itemCategoryResponseSchema,
  itemDetailResponseSchema,
  itemListRowSchema,
  itemStockSummaryResponseSchema,
  materialIssueDetailResponseSchema,
  materialIssueListRowSchema,
  materialRequestDetailResponseSchema,
  materialRequestListRowSchema,
  movementRowSchema,
  notificationResponseSchema,
  periodResponseSchema,
  priceHistoryRowSchema,
  projectDashboardResponseSchema,
  projectDetailResponseSchema,
  projectListRowSchema,
  projectMemberViewSchema,
  purchaseOrderDetailResponseSchema,
  purchaseOrderListRowSchema,
  quotationDetailResponseSchema,
  quotationListRowSchema,
  receivableLinesResponseSchema,
  requisitionDetailResponseSchema,
  requisitionListRowSchema,
  rfqDetailResponseSchema,
  rfqListRowSchema,
  roleAssignmentRowSchema,
  roleResponseSchema,
  sessionResponseSchema,
  stockBalanceRowSchema,
  supplierDetailResponseSchema,
  supplierEvaluationResponseSchema,
  supplierPerformanceResponseSchema,
  supplierPurchaseHistoryRowSchema,
  supplierResponseSchema,
  uomResponseSchema,
  userResponseSchema,
  warehouseDetailResponseSchema,
  warehouseListRowSchema,
  warehouseLocationResponseSchema,
  warehouseResponseSchema,
  warehouseStockRowSchema,
  warehouseSummaryResponseSchema,
  wbsRowSchema,
} from '@probuild/shared';
import type { ActivityItem, PermissionActionKey } from '@probuild/shared';
import type { z } from 'zod';

/** Response shapes, inferred from the shared Zod response schemas (the API's documented contract). */
type Out<S extends z.ZodTypeAny> = z.infer<S>;

export type Page<T> = { items: T[]; nextCursor: string | null };
export type NotificationPage = Page<NotificationDto> & { unread: number };

export type { ActivityItem };
export type ApprovalView = Out<typeof approvalViewSchema>;
export type ApprovalRequestDto = Out<typeof approvalRequestListRowSchema>;
export type ApprovalStatusKey = ApprovalRequestDto['status'];
export type WorkflowDto = Out<typeof approvalWorkflowResponseSchema>;
export type NotificationDto = Out<typeof notificationResponseSchema>;
export type SessionDto = Out<typeof sessionResponseSchema>;
export type PeriodDto = Out<typeof periodResponseSchema>;
export type AccountDto = Out<typeof accountResponseSchema>;
export type CompanyDto = Omit<Out<typeof companyResponseSchema>, 'vatStatus'> & {
  vatStatus: 'VAT' | 'NON_VAT' | 'EXEMPT';
};
export type CompanyUpdate = import('@probuild/shared').UpdateCompanyInput;
export type BranchDto = Out<typeof branchResponseSchema>;
export type UserDto = Out<typeof userResponseSchema>;
export type RoleDto = Omit<Out<typeof roleResponseSchema>, 'permissions'> & {
  permissions: Array<{ module: string; action: PermissionActionKey }>;
};
export type RoleAssignmentDto = UserDto['userRoleAssignments'][number];
export type RoleAssignmentRow = Out<typeof roleAssignmentRowSchema>;

export type Contact = Out<typeof contactResponseSchema>;
export type Supplier = Out<typeof supplierResponseSchema>;
export type SupplierDetail = Out<typeof supplierDetailResponseSchema>;
export type SupplierEvaluation = Out<typeof supplierEvaluationResponseSchema>;
export type SupplierPerformance = Out<typeof supplierPerformanceResponseSchema>;
export type SupplierPurchaseRow = Out<typeof supplierPurchaseHistoryRowSchema>;
export type Customer = Out<typeof customerResponseSchema>;
export type CustomerDetail = Out<typeof customerDetailResponseSchema>;

export type Uom = Out<typeof uomResponseSchema>;
export type ItemCategory = Out<typeof itemCategoryResponseSchema>;
export type ItemRow = Out<typeof itemListRowSchema>;
export type ItemDetail = Out<typeof itemDetailResponseSchema>;
export type ItemStockSummary = Out<typeof itemStockSummaryResponseSchema>;
export type PriceHistoryRow = Out<typeof priceHistoryRowSchema>;

export type Warehouse = Out<typeof warehouseResponseSchema>;
export type WarehouseRow = Out<typeof warehouseListRowSchema>;
export type WarehouseDetail = Out<typeof warehouseDetailResponseSchema>;
export type WarehouseSummary = Out<typeof warehouseSummaryResponseSchema>;
export type WarehouseStockRow = Out<typeof warehouseStockRowSchema>;
export type WarehouseLocation = Out<typeof warehouseLocationResponseSchema>;

export type ProjectRow = Out<typeof projectListRowSchema>;
export type ProjectDetail = Out<typeof projectDetailResponseSchema>;
export type ProjectDashboard = Out<typeof projectDashboardResponseSchema>;
export type ProjectMember = Out<typeof projectMemberViewSchema>;
export type Contract = Out<typeof contractResponseSchema>;
export type WbsRow = Out<typeof wbsRowSchema>;
export type CostCode = Out<typeof costCodeResponseSchema>;
export type EstimateRow = Out<typeof estimateListRowSchema>;
export type EstimateDetail = Out<typeof estimateDetailResponseSchema>;
export type EstimateApproval = Out<typeof estimateApprovalResponseSchema>;
export type BoqRow = Out<typeof boqListRowSchema>;
export type Budget = Out<typeof budgetResponseSchema>;
export type BudgetDetail = Out<typeof budgetDetailResponseSchema>;

export type RequisitionRow = Out<typeof requisitionListRowSchema>;
export type RequisitionDetail = Out<typeof requisitionDetailResponseSchema>;
export type RequisitionLine = RequisitionDetail['lines'][number];
export type RfqRow = Out<typeof rfqListRowSchema>;
export type RfqDetail = Out<typeof rfqDetailResponseSchema>;
export type Comparison = Out<typeof comparisonResponseSchema>;
export type QuotationRow = Out<typeof quotationListRowSchema>;
export type QuotationDetail = Out<typeof quotationDetailResponseSchema>;
export type PurchaseOrderRow = Out<typeof purchaseOrderListRowSchema>;
export type PurchaseOrderDetail = Out<typeof purchaseOrderDetailResponseSchema>;
export type PurchaseOrderLine = PurchaseOrderDetail['lines'][number];

export type GoodsReceiptRow = Out<typeof goodsReceiptListRowSchema>;
export type GoodsReceiptDetail = Out<typeof goodsReceiptDetailResponseSchema>;
export type GoodsReceiptLine = GoodsReceiptDetail['lines'][number];
export type QcInspection = GoodsReceiptLine['inspections'][number];
export type ReceivableLines = Out<typeof receivableLinesResponseSchema>;
export type StockBalanceRow = Out<typeof stockBalanceRowSchema>;
export type MovementRow = Out<typeof movementRowSchema>;
export type MaterialRequestRow = Out<typeof materialRequestListRowSchema>;
export type MaterialRequestDetail = Out<typeof materialRequestDetailResponseSchema>;
export type MaterialRequestLine = MaterialRequestDetail['lines'][number];
export type MaterialIssueRow = Out<typeof materialIssueListRowSchema>;
export type MaterialIssueDetail = Out<typeof materialIssueDetailResponseSchema>;
export type MaterialIssueLine = MaterialIssueDetail['lines'][number];
export type BudgetVsActual = Out<typeof budgetVsActualResponseSchema>;

export type ApprovalFilters = {
  status?: ApprovalStatusKey;
  mine?: boolean;
  documentType?: ApprovalRequestDto['documentType'];
  projectId?: string;
  cursor?: string;
  limit?: number;
  search?: string;
};

export type ApprovalBase = Omit<ApprovalRequestDto, 'requestedBy' | 'actions'>;
export type WorkflowInput = import('@probuild/shared').UpsertWorkflowInput;
