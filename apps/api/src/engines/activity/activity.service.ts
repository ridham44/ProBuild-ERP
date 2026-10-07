import { Injectable } from '@nestjs/common';
import type { ActivityItem } from '@probuild/shared';
import { PrismaService } from '../../prisma/prisma.service';

export type ApprovalStepView = {
  step: number;
  role: string;
  state: 'APPROVED' | 'REJECTED' | 'CURRENT' | 'WAITING' | 'CANCELLED';
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  comment: string | null;
};

export type ApprovalView = {
  id: string;
  status: string;
  amount: string;
  currentStep: number;
  totalSteps: number;
  currentRole: string | null;
  requestedBy: { id: string; name: string };
  createdAt: string;
  steps: ApprovalStepView[];
};

const SUMMARIES: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Edited',
  DELETE: 'Deleted',
  SUBMIT: 'Submitted for approval',
  AUTO_APPROVE: 'Approved automatically (no approval workflow applies)',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  CANCEL: 'Cancelled',
  CLOSE: 'Closed',
  SEND: 'Sent to supplier',
  AWARD: 'Awarded',
  STATUS_CHANGE: 'Status changed',
};

function humanize(action: string): string {
  const text = action.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function changedFields(before: unknown, after: unknown): string[] {
  if (typeof before !== 'object' || before === null || typeof after !== 'object' || after === null) return [];
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const ignore = new Set(['updatedAt', 'createdAt']);
  return Object.keys(a).filter((k) => !ignore.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

function detailsFor(action: string, before: unknown, after: unknown): Record<string, unknown> | null {
  if (action === 'UPDATE') return { changedFields: changedFields(before, after) };
  if (typeof after === 'object' && after !== null && !Array.isArray(after)) {
    const keys = Object.keys(after);
    if (action !== 'CREATE' && keys.length > 0 && keys.length <= 8) return after as Record<string, unknown>;
  }
  return null;
}

/**
 * Builds the per-document timeline from the append-only audit trail and the approval actions, oldest
 * first, with actor names. The caller must already have authorized access to the document itself.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async forDocument(input: {
    companyId: string;
    entityType: string;
    entityId: string;
    /** Approval document type when the document runs through the approval engine. */
    approvalType?: string;
    limit?: number;
  }): Promise<ActivityItem[]> {
    const limit = input.limit ?? 200;
    const [audits, approvals] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          companyId: input.companyId,
          entityType: input.entityType,
          entityId: input.entityId,
          // Approval decisions appear below with their comments, so skip the engine's duplicate rows.
          NOT: { action: { startsWith: 'APPROVAL_' } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      input.approvalType
        ? this.prisma.approvalAction.findMany({
            where: { request: { companyId: input.companyId, documentType: input.approvalType, documentId: input.entityId } },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: limit,
            include: { request: { select: { stepRoles: true, totalSteps: true } } },
          })
        : Promise.resolve([]),
    ]);

    const userIds = [...new Set([...audits.map((a) => a.userId), ...approvals.map((a) => a.approverId)].filter((v): v is string => Boolean(v)))];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds }, companyId: input.companyId }, select: { id: true, name: true } })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name]));
    const actor = (id: string | null) => (id ? { id, name: names.get(id) ?? 'Unknown user' } : null);

    const items: Array<ActivityItem & { sortKey: number }> = [
      ...audits.map((a) => ({
        id: `audit:${a.id}`,
        at: a.createdAt.toISOString(),
        kind: 'AUDIT' as const,
        action: a.action,
        actor: actor(a.userId),
        summary: SUMMARIES[a.action] ?? humanize(a.action),
        reason: a.reason,
        details: detailsFor(a.action, a.before, a.after),
        sortKey: a.createdAt.getTime(),
      })),
      ...approvals.map((a) => {
        const roles = a.request.stepRoles as string[];
        const role = roles[a.stepOrder - 1];
        return {
          id: `approval:${a.id}`,
          at: a.createdAt.toISOString(),
          kind: 'APPROVAL' as const,
          action: a.decision,
          actor: actor(a.approverId),
          summary: `${a.decision === 'APPROVED' ? 'Approved' : 'Rejected'} at step ${a.stepOrder} of ${a.request.totalSteps}${role ? ` (${role})` : ''}`,
          reason: a.comment,
          details: { step: a.stepOrder, totalSteps: a.request.totalSteps, role: role ?? null },
          sortKey: a.createdAt.getTime(),
        };
      }),
    ];
    // Rows written in one transaction can share a timestamp; a decision is shown before the status change it caused.
    const rank = (i: { kind: string }) => (i.kind === 'APPROVAL' ? 0 : 1);
    items.sort((x, y) => x.sortKey - y.sortKey || rank(x) - rank(y) || x.id.localeCompare(y.id));
    return items.map(({ sortKey: _sortKey, ...rest }) => rest);
  }

  /** Approval requests for a document with per-step state, for the reusable approval timeline. */
  async approvalsFor(companyId: string, documentType: string, documentId: string): Promise<ApprovalView[]> {
    const requests = await this.prisma.approvalRequest.findMany({
      where: { companyId, documentType, documentId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        requestedBy: { select: { id: true, name: true } },
        actions: { orderBy: { createdAt: 'asc' }, include: { approver: { select: { id: true, name: true } } } },
      },
      take: 20,
    });
    return requests.map((r) => {
      const roles = r.stepRoles as string[];
      return {
        id: r.id,
        status: r.status,
        amount: r.amount.toFixed(2),
        currentStep: r.currentStep,
        totalSteps: r.totalSteps,
        currentRole: r.currentRole,
        requestedBy: r.requestedBy,
        createdAt: r.createdAt.toISOString(),
        steps: roles.map((role, i) => {
          const action = r.actions.find((a) => a.stepOrder === i + 1);
          const state: ApprovalStepView['state'] = action
            ? action.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED'
            : r.status === 'CANCELLED' ? 'CANCELLED'
            : r.status === 'PENDING' && r.currentStep === i + 1 ? 'CURRENT' : 'WAITING';
          return {
            step: i + 1,
            role,
            state,
            decidedBy: action ? action.approver : null,
            decidedAt: action ? action.createdAt.toISOString() : null,
            comment: action?.comment ?? null,
          };
        }),
      };
    });
  }
}
