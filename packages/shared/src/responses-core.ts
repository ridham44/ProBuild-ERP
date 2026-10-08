import { z } from 'zod';
import { sessionUserSchema } from './auth';

/** Response shapes for the foundation endpoints (auth, security, approvals, notifications, organization, accounting). */
const dec = z.string();
const ts = z.string();
const id = z.string();
const text = z.string().nullable();
const nullableTs = ts.nullable();

export const sessionUserResponseSchema = sessionUserSchema;
export const sessionResponseSchema = z.object({
  id, ip: text, userAgent: text, createdAt: ts, lastSeenAt: ts, expiresAt: ts, current: z.boolean(),
});
export const revokeOthersResponseSchema = z.object({ revoked: z.number().int() });
export const passwordResetIssuedSchema = z.object({ token: z.string(), expiresAt: ts });

const roleAssignmentSchema = z.object({
  id, companyId: id.nullable(), branchId: id.nullable(), projectId: id.nullable(), warehouseId: id.nullable(),
  role: z.object({ id, name: z.string() }),
});
export const userResponseSchema = z.object({
  id, email: z.string(), name: z.string(), userType: z.string(), active: z.boolean(), isSuperAdmin: z.boolean(),
  lastLoginAt: nullableTs, createdAt: ts, userRoleAssignments: z.array(roleAssignmentSchema),
});
export const roleAssignmentRowSchema = z.object({
  id, userId: id, roleId: id, companyId: id.nullable(), branchId: id.nullable(), projectId: id.nullable(), warehouseId: id.nullable(), createdAt: ts, updatedAt: ts,
});
const permissionRowSchema = z.object({ module: z.string(), action: z.string() });
export const roleBaseSchema = z.object({ id, companyId: id, name: z.string(), description: text, isSystem: z.boolean(), createdAt: ts, updatedAt: ts });
export const roleResponseSchema = roleBaseSchema.extend({
  permissions: z.array(permissionRowSchema),
  _count: z.object({ userRoleAssignments: z.number().int() }),
});

export const approvalActionViewSchema = z.object({
  id, requestId: id, stepOrder: z.number().int(), approverId: id, approver: z.object({ id, name: z.string() }), decision: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']),
  comment: text, ip: text, device: text, createdAt: ts,
});
export const approvalRequestBaseSchema = z.object({
  id, companyId: id, documentType: z.string(), documentId: id, documentNo: text, projectId: id.nullable(), amount: dec,
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']), currentStep: z.number().int(), currentRole: text, totalSteps: z.number().int(),
  stepRoles: z.array(z.string()), requestedById: id, createdAt: ts, updatedAt: ts,
});
export const approvalRequestListRowSchema = approvalRequestBaseSchema.extend({
  requestedBy: z.object({ id, name: z.string() }),
  actions: z.array(approvalActionViewSchema),
});
export const approvalWorkflowResponseSchema = z.object({
  id, companyId: id, documentType: z.string(), name: z.string(), active: z.boolean(), createdAt: ts, updatedAt: ts,
  rules: z.array(z.object({
    id, workflowId: id, minAmount: dec, maxAmount: dec.nullable(), createdAt: ts, updatedAt: ts,
    steps: z.array(z.object({ id, ruleId: id, stepOrder: z.number().int(), roleName: z.string(), createdAt: ts, updatedAt: ts })),
  })),
});
export const notificationResponseSchema = z.object({
  id, companyId: id, userId: id, channel: z.string(), type: z.string(), title: z.string(), body: text, entityType: text, entityId: id.nullable(),
  readAt: nullableTs, createdAt: ts, updatedAt: ts,
});
export const notificationPageSchema = z.object({ items: z.array(notificationResponseSchema), nextCursor: z.string().nullable(), unread: z.number().int() });
export const updatedCountSchema = z.object({ updated: z.number().int() });

// ---- Organization -----------------------------------------------------------------------------------

export const companyResponseSchema = z.object({
  id, code: z.string(), legalName: z.string(), tradeName: text, type: z.string(), parentCompanyId: id.nullable(), tin: text, secNo: text, dtiNo: text,
  philgepsNo: text, doleRegistrationNo: text, businessPermitNo: text, address: text, email: text, phone: text, vatStatus: z.string(), baseCurrency: z.string(),
  fiscalYearStartMonth: z.number().int(), overReceiptTolerancePct: dec, active: z.boolean(), createdAt: ts, updatedAt: ts,
});
export const branchResponseSchema = z.object({ id, companyId: id, code: z.string(), name: z.string(), address: text, active: z.boolean(), createdAt: ts, updatedAt: ts });
export const departmentResponseSchema = z.object({ id, companyId: id, code: z.string(), name: z.string(), active: z.boolean(), createdAt: ts, updatedAt: ts });
export const costCenterResponseSchema = departmentResponseSchema;
export const warehouseResponseSchema = z.object({
  id, companyId: id, branchId: id.nullable(), projectId: id.nullable(), parentWarehouseId: id.nullable(), code: z.string(), name: z.string(), type: z.string(),
  address: text, managerId: id.nullable(), active: z.boolean(), createdAt: ts, updatedAt: ts,
});
export const warehouseListRowSchema = warehouseResponseSchema.extend({
  branch: z.object({ id, name: z.string() }).nullable(),
  project: z.object({ id, name: z.string() }).nullable(),
});
export const warehouseLocationResponseSchema = z.object({
  id, companyId: id, warehouseId: id, parentId: id.nullable(), level: z.string(), code: z.string(), fullPath: z.string(), qrCode: text, active: z.boolean(),
  createdAt: ts, updatedAt: ts,
});
export const bankAccountResponseSchema = z.object({
  id, companyId: id, bankName: z.string(), branchName: text, accountName: z.string(), accountNo: z.string(), currency: z.string(), glAccountId: id.nullable(),
  openingBalance: dec, active: z.boolean(), createdAt: ts, updatedAt: ts,
});

// ---- Accounting -------------------------------------------------------------------------------------

export const accountResponseSchema = z.object({
  id, companyId: id, parentId: id.nullable(), code: z.string(), name: z.string(), type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  isPostable: z.boolean(), active: z.boolean(), createdAt: ts, updatedAt: ts,
});
export const periodResponseSchema = z.object({
  id, companyId: id, year: z.number().int(), month: z.number().int(), startDate: ts, endDate: ts, closed: z.boolean(), createdAt: ts, updatedAt: ts,
});
const journalStatus = z.enum(['DRAFT', 'POSTED', 'REVERSED']);
export const journalListRowSchema = z.object({
  id, companyId: id, entryNo: z.string(), entryDate: ts, periodId: id.nullable(), description: z.string(), status: journalStatus, sourceType: text,
  sourceId: text, reversalOfId: id.nullable(), postedById: id, createdAt: ts, totalDebit: dec,
});
export const journalPageSchema = z.object({ items: z.array(journalListRowSchema), nextCursor: z.string().nullable() });
export const journalDetailResponseSchema = journalListRowSchema.omit({ totalDebit: true }).extend({
  lines: z.array(z.object({
    id, entryId: id, accountId: id, debit: dec, credit: dec, memo: text, branchId: id.nullable(), departmentId: id.nullable(), costCenterId: id.nullable(),
    projectId: id.nullable(), wbsNodeId: id.nullable(), costCodeId: id.nullable(), partyType: text, partyId: id.nullable(), createdAt: ts,
    account: z.object({ code: z.string(), name: z.string() }),
  })),
  reversalOf: z.object({ id, entryNo: z.string() }).nullable(),
  reversedBy: z.array(z.object({ id, entryNo: z.string() })),
});
export const trialBalanceResponseSchema = z.object({
  rows: z.array(z.object({
    accountId: id, code: z.string(), name: z.string(), type: z.string(), debit: dec, credit: dec, balanceDebit: dec, balanceCredit: dec,
  })),
  totalDebit: dec,
  totalCredit: dec,
  balanced: z.boolean(),
});
export const generalLedgerResponseSchema = z.object({
  account: z.object({ id, code: z.string(), name: z.string(), type: z.string() }),
  opening: dec,
  closing: dec,
  rows: z.array(z.object({
    lineId: id, entryId: id, entryNo: z.string(), entryDate: ts, description: z.string(), memo: text, sourceType: text, sourceId: text,
    debit: dec, credit: dec, balance: dec,
  })),
});

