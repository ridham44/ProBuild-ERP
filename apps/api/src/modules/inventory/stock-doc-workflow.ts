import type { SessionUser } from '@probuild/shared';
import { BusinessRuleError } from '../../common/errors/domain-errors';
import { ApprovalsService } from '../../engines/approvals/approvals.service';
import { AuditService } from '../../engines/audit/audit.service';
import { Db, PrismaService } from '../../prisma/prisma.service';

type Meta = { ip?: string; userAgent?: string };

/**
 * Moves a document SUBMITTED -> APPROVED | REJECTED. Returns how many rows moved (0 or 1) and whether the document
 * still exists, so a decision can tell "gone" from "no longer awaiting a decision".
 */
export type StatusMover = (db: Db, companyId: string, id: string, to: 'APPROVED' | 'REJECTED') => Promise<{ moved: number; exists: boolean }>;

/** Registers the approval-engine callbacks shared by every stock document that can run through a workflow. */
export function registerStockDocApproval(approvals: ApprovalsService, audit: AuditService, docType: string, label: string, move: StatusMover): void {
  const settle = async (db: Db, to: 'APPROVED' | 'REJECTED', companyId: string, id: string): Promise<void> => {
    const result = await move(db, companyId, id, to);
    if (result.moved === 1) {
      await audit.record(db, {
        companyId, userId: null, entityType: docType, entityId: id, action: 'STATUS_CHANGE', before: { status: 'SUBMITTED' }, after: { status: to },
      });
      return;
    }
    if (result.exists) throw new BusinessRuleError(`The ${label} is no longer awaiting approval`);
  };
  approvals.registerHandler(docType, {
    onApproved: (db, request) => settle(db, 'APPROVED', request.companyId, request.documentId),
    onRejected: (db, request) => settle(db, 'REJECTED', request.companyId, request.documentId),
  });
}

/** Finds the pending approval request of a document and records the user's decision on it. */
export async function decideStockDoc(
  prisma: PrismaService,
  approvals: ApprovalsService,
  user: SessionUser,
  docType: string,
  label: string,
  doc: { id: string; status: string },
  decision: 'APPROVED' | 'REJECTED',
  comment: string | undefined,
  meta: Meta,
): Promise<void> {
  if (doc.status !== 'SUBMITTED') throw new BusinessRuleError(`A ${doc.status} ${label} is not awaiting approval`);
  const request = await prisma.approvalRequest.findFirst({
    where: { companyId: user.companyId, documentType: docType, documentId: doc.id, status: 'PENDING' },
    select: { id: true },
  });
  if (!request) throw new BusinessRuleError(`There is no pending approval request for this ${label}`);
  await approvals.decide(user, request.id, decision, { comment }, meta);
}
