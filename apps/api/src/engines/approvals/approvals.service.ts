import { ForbiddenException, Injectable } from '@nestjs/common';
import { ApprovalRequest, ApprovalStatus, Prisma } from '@prisma/client';
import type { ApprovalDecisionInput, SessionUser, UpsertWorkflowInput } from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { Db, PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

export type ApprovalHandler = {
  /** Runs inside the deciding transaction when the final step approves. */
  onApproved: (db: Db, request: ApprovalRequest) => Promise<void>;
  onRejected: (db: Db, request: ApprovalRequest) => Promise<void>;
};

export type SubmitInput = {
  companyId: string;
  documentType: string;
  documentId: string;
  documentNo?: string;
  projectId?: string | null;
  amount: Prisma.Decimal | string | number;
  requestedById: string;
};

export type SubmitResult =
  | { required: false; request: null }
  | { required: true; request: ApprovalRequest };

/**
 * Configurable approval workflows: amount band -> ordered approver roles.
 * Document modules call submit() and register a handler to react to the outcome.
 */
@Injectable()
export class ApprovalsService {
  private readonly handlers = new Map<string, ApprovalHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly access: AccessService,
  ) {}

  registerHandler(documentType: string, handler: ApprovalHandler): void {
    this.handlers.set(documentType, handler);
  }

  /** True when a workflow with a rule covering this amount is active; documents without one are approved directly. */
  async requiresApproval(db: Db, companyId: string, documentType: string, amount: Prisma.Decimal | string | number): Promise<boolean> {
    const value = new Prisma.Decimal(amount);
    const workflow = await db.approvalWorkflow.findUnique({
      where: { companyId_documentType: { companyId, documentType } },
      include: { rules: { include: { steps: true } } },
    });
    if (!workflow || !workflow.active) return false;
    const rule = workflow.rules.find((r) => value.gte(r.minAmount) && (r.maxAmount === null || value.lte(r.maxAmount)));
    return Boolean(rule && rule.steps.length > 0);
  }

  /** Returns required=false when no workflow/rule applies; the caller then approves the document directly. */
  async submit(db: Db, input: SubmitInput): Promise<SubmitResult> {
    const amount = new Prisma.Decimal(input.amount);
    const workflow = await db.approvalWorkflow.findUnique({
      where: { companyId_documentType: { companyId: input.companyId, documentType: input.documentType } },
      include: { rules: { include: { steps: { orderBy: { stepOrder: 'asc' } } } } },
    });
    if (!workflow || !workflow.active) return { required: false, request: null };

    const rule = workflow.rules.find((r) => amount.gte(r.minAmount) && (r.maxAmount === null || amount.lte(r.maxAmount)));
    if (!rule || rule.steps.length === 0) return { required: false, request: null };

    const existing = await db.approvalRequest.findFirst({
      where: { documentType: input.documentType, documentId: input.documentId, status: 'PENDING' },
    });
    if (existing) throw new BusinessRuleError('This document already has a pending approval request');

    const request = await db.approvalRequest.create({
      data: {
        companyId: input.companyId,
        documentType: input.documentType,
        documentId: input.documentId,
        documentNo: input.documentNo ?? null,
        projectId: input.projectId ?? null,
        amount,
        status: 'PENDING',
        currentStep: 1,
        totalSteps: rule.steps.length,
        stepRoles: rule.steps.map((s) => s.roleName),
        currentRole: rule.steps[0]?.roleName ?? null,
        requestedById: input.requestedById,
      },
    });
    await this.notifyCurrentApprover(db, request);
    return { required: true, request };
  }

  async decide(
    user: SessionUser,
    requestId: string,
    decision: Extract<ApprovalStatus, 'APPROVED' | 'REJECTED'>,
    input: ApprovalDecisionInput,
    meta: { ip?: string; userAgent?: string },
  ): Promise<ApprovalRequest> {
    return this.prisma.$transaction(async (tx) => {
      // Serialize concurrent decisions on the same request.
      await tx.$queryRaw`SELECT id FROM "ApprovalRequest" WHERE id = ${requestId} FOR UPDATE`;
      const request = await tx.approvalRequest.findFirst({ where: { id: requestId, companyId: user.companyId } });
      if (!request) throw new NotFoundError('Approval request', requestId);
      if (request.status !== 'PENDING') throw new BusinessRuleError('This request has already been decided');

      const roles = request.stepRoles as string[];
      const stepRole = roles[request.currentStep - 1];
      if (!user.isSuperAdmin && (!stepRole || !user.roles.includes(stepRole))) {
        throw new ForbiddenException(`Step ${request.currentStep} requires the ${stepRole ?? 'unknown'} role`);
      }
      if (request.requestedById === user.id && !user.isSuperAdmin) {
        throw new ForbiddenException('You cannot approve your own request');
      }
      this.access.assertCan(user, 'approvals.inbox', decision === 'APPROVED' ? 'APPROVE' : 'REJECT', { projectId: request.projectId });
      const already = await tx.approvalAction.findFirst({ where: { requestId, approverId: user.id } });
      if (already && !user.isSuperAdmin) throw new ForbiddenException('You have already acted on this request');

      await tx.approvalAction.create({
        data: {
          requestId,
          stepOrder: request.currentStep,
          approverId: user.id,
          decision,
          comment: input.comment ?? null,
          signature: input.signature ?? null,
          ip: meta.ip ?? null,
          device: meta.userAgent?.slice(0, 200) ?? null,
        },
      });

      const isFinal = decision === 'APPROVED' && request.currentStep >= request.totalSteps;
      const nextStatus: ApprovalStatus = decision === 'REJECTED' ? 'REJECTED' : isFinal ? 'APPROVED' : 'PENDING';
      const updated = await tx.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: nextStatus,
          currentStep: nextStatus === 'PENDING' ? request.currentStep + 1 : request.currentStep,
          currentRole: nextStatus === 'PENDING' ? (roles[request.currentStep] ?? null) : null,
        },
      });

      await this.audit.record(tx, {
        companyId: user.companyId,
        userId: user.id,
        entityType: request.documentType,
        entityId: request.documentId,
        action: `APPROVAL_${decision}`,
        after: { step: request.currentStep, comment: input.comment },
        reason: input.comment,
        ip: meta.ip,
      });

      const handler = this.handlers.get(request.documentType);
      if (nextStatus === 'APPROVED') await handler?.onApproved(tx, updated);
      if (nextStatus === 'REJECTED') await handler?.onRejected(tx, updated);
      if (nextStatus === 'PENDING') await this.notifyCurrentApprover(tx, updated);
      if (nextStatus !== 'PENDING') {
        await this.notifications.notifyUsers([request.requestedById], {
          companyId: request.companyId,
          type: 'APPROVAL_RESULT',
          title: `${request.documentNo ?? request.documentType} was ${nextStatus.toLowerCase()}`,
          entityType: request.documentType,
          entityId: request.documentId,
        }, tx);
      }
      return updated;
    });
  }

  async cancel(db: Db, companyId: string, documentType: string, documentId: string): Promise<void> {
    await db.approvalRequest.updateMany({
      where: { companyId, documentType, documentId, status: 'PENDING' },
      data: { status: 'CANCELLED', currentRole: null },
    });
  }

  async upsertWorkflow(user: SessionUser, input: UpsertWorkflowInput) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.approvalWorkflow.findUnique({
        where: { companyId_documentType: { companyId: user.companyId, documentType: input.documentType } },
        include: { rules: { include: { steps: true } } },
      });
      if (existing) await tx.approvalRule.deleteMany({ where: { workflowId: existing.id } });

      const workflow = await tx.approvalWorkflow.upsert({
        where: { companyId_documentType: { companyId: user.companyId, documentType: input.documentType } },
        create: { companyId: user.companyId, documentType: input.documentType, name: input.name, active: input.active },
        update: { name: input.name, active: input.active },
      });
      for (const rule of input.rules) {
        await tx.approvalRule.create({
          data: {
            workflowId: workflow.id,
            minAmount: rule.minAmount,
            maxAmount: rule.maxAmount ?? null,
            steps: { create: rule.steps.map((s, i) => ({ stepOrder: i + 1, roleName: s.roleName })) },
          },
        });
      }
      await this.audit.record(tx, {
        companyId: user.companyId,
        userId: user.id,
        entityType: 'ApprovalWorkflow',
        entityId: workflow.id,
        action: existing ? 'UPDATE' : 'CREATE',
        before: existing,
        after: input,
      });
      return tx.approvalWorkflow.findUniqueOrThrow({
        where: { id: workflow.id },
        include: { rules: { orderBy: { minAmount: 'asc' }, include: { steps: { orderBy: { stepOrder: 'asc' } } } } },
      });
    });
  }

  private async notifyCurrentApprover(db: Db, request: ApprovalRequest): Promise<void> {
    const roles = request.stepRoles as string[];
    const role = roles[request.currentStep - 1];
    if (!role) return;
    await this.notifications.notifyRole(role, {
      companyId: request.companyId,
      type: 'APPROVAL_PENDING',
      title: `Approval needed: ${request.documentNo ?? request.documentType}`,
      body: `Step ${request.currentStep} of ${request.totalSteps}`,
      entityType: request.documentType,
      entityId: request.documentId,
    }, db);
  }
}
