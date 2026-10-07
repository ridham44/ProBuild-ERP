import type {
  AssignRoleInput,
  ApprovalDocumentType,
  CreateUserInput,
  LoginInput,
  PermissionActionKey,
  SessionUser,
} from '@probuild/shared';
import type { ProblemDetails } from '@probuild/api-client';

/**
 * Response typing for the endpoints this app calls.
 *
 * The generated OpenAPI schema does not yet describe success bodies (`content?: never`) and omits some
 * routes, so the generated client cannot type them. This file is the single place that bridges that gap;
 * when the API documents its responses, delete it and switch `createWebClient` to the generated `paths`.
 */

export type Page<T> = { items: T[]; nextCursor: string | null };

export type CompanyDto = {
  id: string;
  code: string;
  legalName: string;
  tradeName: string | null;
  type: string;
  tin: string | null;
  secNo: string | null;
  dtiNo: string | null;
  philgepsNo: string | null;
  doleRegistrationNo: string | null;
  businessPermitNo: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  vatStatus: 'VAT' | 'NON_VAT' | 'EXEMPT';
  baseCurrency: string;
  fiscalYearStartMonth: number;
  active: boolean;
  updatedAt: string;
};

export type CompanyUpdate = Partial<{
  legalName: string;
  tradeName: string | null;
  tin: string | null;
  secNo: string | null;
  dtiNo: string | null;
  philgepsNo: string | null;
  doleRegistrationNo: string | null;
  businessPermitNo: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  vatStatus: 'VAT' | 'NON_VAT' | 'EXEMPT';
  fiscalYearStartMonth: number;
}>;

export type BranchDto = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
export type BranchInput = { code: string; name: string; address?: string | null };
export type BranchUpdate = Partial<BranchInput> & { active?: boolean };

export type RoleAssignmentDto = {
  id: string;
  companyId: string | null;
  branchId: string | null;
  projectId: string | null;
  warehouseId: string | null;
  role: { id: string; name: string };
};

export type UserDto = {
  id: string;
  email: string;
  name: string;
  userType: SessionUser['userType'];
  active: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  userRoleAssignments: RoleAssignmentDto[];
};

export type RoleDto = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<{ module: string; action: PermissionActionKey }>;
  _count: { userRoleAssignments: number };
};

export type ApprovalActionDto = {
  id: string;
  stepOrder: number;
  approverId: string;
  decision: 'APPROVED' | 'REJECTED' | 'PENDING' | 'CANCELLED';
  comment: string | null;
  createdAt: string;
};

export type ApprovalStatusKey = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type ApprovalRequestDto = {
  id: string;
  documentType: string;
  documentId: string;
  documentNo: string | null;
  projectId: string | null;
  amount: string;
  status: ApprovalStatusKey;
  currentStep: number;
  currentRole: string | null;
  totalSteps: number;
  stepRoles: string[];
  requestedById: string;
  requestedBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  actions: ApprovalActionDto[];
};

export type ApprovalFilters = {
  status?: ApprovalStatusKey;
  mine?: boolean;
  documentType?: ApprovalDocumentType;
  cursor?: string;
  limit?: number;
  search?: string;
};

export type WorkflowDto = {
  id: string;
  documentType: string;
  name: string;
  active: boolean;
  rules: Array<{
    id: string;
    minAmount: string;
    maxAmount: string | null;
    steps: Array<{ id: string; stepOrder: number; roleName: string }>;
  }>;
};

export type WorkflowInput = {
  documentType: ApprovalDocumentType;
  name: string;
  active: boolean;
  rules: Array<{
    minAmount: string;
    maxAmount?: string | null;
    steps: Array<{ roleName: string }>;
  }>;
};

export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};
export type NotificationPage = Page<NotificationDto> & { unread: number };

export type SessionDto = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
};

export type PeriodDto = {
  id: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  closed: boolean;
};

export type PasswordResetDto = { token: string; expiresAt: string };

type JsonContent<R> = [R] extends [void]
  ? { content?: never }
  : { content: { 'application/json': R } };
type ResponseOf<R> = { headers: { [name: string]: unknown } } & JsonContent<R>;
type QueryPart<Q> = [Q] extends [never] ? { query?: never } : { query?: Q };
type PathPart<P> = [P] extends [never] ? { path?: never } : { path: P };
type BodyPart<B> = [B] extends [never]
  ? { requestBody?: never }
  : { requestBody: { content: { 'application/json': B } } };

type Op<R, Q = never, B = never, P = never> = {
  parameters: QueryPart<Q> & PathPart<P> & { header?: never; cookie?: never };
  responses: {
    200: ResponseOf<R>;
    default: {
      headers: { [name: string]: unknown };
      content: { 'application/problem+json': ProblemDetails };
    };
  };
} & BodyPart<B>;

type Item<M> = { parameters: { query?: never; header?: never; path?: never; cookie?: never } } & M;

type Id = { id: string };
type SearchPage = { cursor?: string; limit?: number; search?: string };

export interface WebPaths {
  '/v1/auth/login': Item<{ post: Op<SessionUser, never, LoginInput> }>;
  '/v1/auth/logout': Item<{ post: Op<void> }>;
  '/v1/auth/me': Item<{ get: Op<SessionUser> }>;
  '/v1/auth/password': Item<{
    post: Op<void, never, { currentPassword: string; newPassword: string }>;
  }>;
  '/v1/auth/password-reset/confirm': Item<{
    post: Op<void, never, { token: string; newPassword: string }>;
  }>;
  '/v1/auth/sessions': Item<{ get: Op<SessionDto[]> }>;
  '/v1/auth/sessions/{id}': Item<{ delete: Op<void, never, never, Id> }>;
  '/v1/auth/sessions/revoke-others': Item<{ post: Op<{ revoked: number }> }>;
  '/v1/notifications': Item<{ get: Op<NotificationPage, SearchPage> }>;
  '/v1/notifications/read-all': Item<{ post: Op<{ updated: number }> }>;
  '/v1/notifications/{id}/read': Item<{ post: Op<{ updated: number }, never, never, Id> }>;
  '/v1/company': Item<{ get: Op<CompanyDto>; patch: Op<CompanyDto, never, CompanyUpdate> }>;
  '/v1/branches': Item<{
    get: Op<Page<BranchDto>, SearchPage>;
    post: Op<BranchDto, never, BranchInput>;
  }>;
  '/v1/branches/{id}': Item<{ patch: Op<BranchDto, never, BranchUpdate, Id> }>;
  '/v1/users': Item<{
    get: Op<UserDto[], { search?: string }>;
    post: Op<UserDto, never, CreateUserInput>;
  }>;
  '/v1/users/{id}/active': Item<{ put: Op<UserDto, never, { active: boolean }, Id> }>;
  '/v1/users/{id}/password-reset': Item<{ post: Op<PasswordResetDto, never, never, Id> }>;
  '/v1/users/{id}/roles': Item<{ post: Op<RoleAssignmentDto, never, AssignRoleInput, Id> }>;
  '/v1/users/{id}/roles/{assignmentId}': Item<{
    delete: Op<void, never, never, { id: string; assignmentId: string }>;
  }>;
  '/v1/roles': Item<{
    get: Op<RoleDto[]>;
    post: Op<RoleDto, never, { name: string; description?: string }>;
  }>;
  '/v1/roles/{id}/permissions': Item<{
    put: Op<
      RoleDto,
      never,
      { permissions: Array<{ module: string; action: PermissionActionKey }> },
      Id
    >;
  }>;
  '/v1/approvals': Item<{ get: Op<Page<ApprovalRequestDto>, ApprovalFilters> }>;
  '/v1/approvals/{id}/approve': Item<{
    post: Op<ApprovalRequestDto, never, { comment?: string }, Id>;
  }>;
  '/v1/approvals/{id}/reject': Item<{
    post: Op<ApprovalRequestDto, never, { comment?: string }, Id>;
  }>;
  '/v1/approval-workflows': Item<{
    get: Op<WorkflowDto[]>;
    put: Op<WorkflowDto, never, WorkflowInput>;
  }>;
  '/v1/accounting/periods': Item<{ get: Op<PeriodDto[], { year?: number }> }>;
}
