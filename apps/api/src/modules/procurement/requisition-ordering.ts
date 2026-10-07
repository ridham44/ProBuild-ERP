import type { Prisma } from '@prisma/client';
import { BusinessRuleError } from '../../common/errors/domain-errors';
import { Db } from '../../prisma/prisma.service';

/**
 * Quantity bookkeeping between a requisition and the purchase orders raised from it.
 *
 * PurchaseRequisitionLine.orderedQty = sum over live POs of (qty - cancelledQty): the quantity that is
 * already spoken for. It can never exceed the requisition line's qty. The check and the increment are ONE
 * conditional UPDATE, so two POs competing for the same remainder serialize on the row lock and the loser
 * matches zero rows (no read-then-write window).
 */
export async function reserveRequisitionQty(db: Db, requisitionLineId: string, qty: Prisma.Decimal, label: string): Promise<void> {
  const updated = await db.$executeRaw`UPDATE "PurchaseRequisitionLine"
    SET "orderedQty" = "orderedQty" + ${qty.toString()}::numeric, "updatedAt" = now()
    WHERE id = ${requisitionLineId} AND "orderedQty" + ${qty.toString()}::numeric <= "qty"`;
  if (updated === 0) {
    const line = await db.purchaseRequisitionLine.findUnique({ where: { id: requisitionLineId }, select: { qty: true, orderedQty: true } });
    const remaining = line ? line.qty.minus(line.orderedQty) : 0;
    throw new BusinessRuleError(`${label}: only ${remaining.toString()} remains to be ordered on the requisition line (requested ${qty.toString()})`, [
      { path: label, message: `Exceeds the remaining requisition quantity (${remaining.toString()})` },
    ]);
  }
}

export async function releaseRequisitionQty(db: Db, requisitionLineId: string, qty: Prisma.Decimal): Promise<void> {
  if (qty.lte(0)) return;
  await db.$executeRaw`UPDATE "PurchaseRequisitionLine"
    SET "orderedQty" = GREATEST("orderedQty" - ${qty.toString()}::numeric, 0), "updatedAt" = now()
    WHERE id = ${requisitionLineId}`;
}

/** Moves an approved requisition between APPROVED / PARTIALLY_ORDERED / ORDERED to match its lines. */
export async function refreshRequisitionOrdering(db: Db, requisitionId: string): Promise<void> {
  const pr = await db.purchaseRequisition.findUnique({
    where: { id: requisitionId },
    select: { status: true, lines: { select: { qty: true, orderedQty: true } } },
  });
  if (!pr || !['APPROVED', 'PARTIALLY_ORDERED', 'ORDERED'].includes(pr.status)) return;
  const anyOrdered = pr.lines.some((l) => l.orderedQty.gt(0));
  const allOrdered = pr.lines.length > 0 && pr.lines.every((l) => l.orderedQty.gte(l.qty));
  const next = allOrdered ? 'ORDERED' : anyOrdered ? 'PARTIALLY_ORDERED' : 'APPROVED';
  if (next !== pr.status) await db.purchaseRequisition.update({ where: { id: requisitionId }, data: { status: next } });
}
