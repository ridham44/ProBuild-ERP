import { Injectable } from '@nestjs/common';
import type { BudgetVsActualQuery, SessionUser } from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { dec, nonNegative, round2, ZERO } from '../../common/money';
import { ProjectAccessService } from '../../common/project-access.service';
import { PrismaService } from '../../prisma/prisma.service';

const OPEN_PO = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] as const;

/**
 * Budget vs actual by cost code for one project. Real aggregates only:
 *   budget    = sum of the CURRENT budget version's lines per cost code
 *   committed = value of purchase order quantity not yet received: remaining/qty x (line net + line tax) on open POs
 *               (APPROVED, SENT, PARTIALLY_RECEIVED); received goods stop being committed the moment they are received
 *   actual    = sum of ProjectCostLedger.totalCost (material issues add cost, returns and reversals subtract it)
 *   variance  = budget - committed - actual      utilisationPct = (committed + actual) / budget
 * Stock that has been received but not yet issued is inventory: it is neither committed nor actual cost.
 */
@Injectable()
export class ProjectCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async budgetVsActual(user: SessionUser, projectId: string, query: BudgetVsActualQuery) {
    const project = await this.projectAccess.load(user, projectId, 'projects.budget', 'VIEW');
    const showCommitted = this.access.can(user, 'procurement.order', 'VIEW', { projectId });
    const showActual = this.access.can(user, 'finance.ledger', 'VIEW', { projectId }) || this.access.can(user, 'projects.budget', 'VIEW', { projectId });

    const [budget, poLines, actuals] = await Promise.all([
      this.prisma.budget.findFirst({ where: { projectId, isCurrent: true }, include: { lines: { select: { costCodeId: true, amount: true } } } }),
      showCommitted
        ? this.prisma.purchaseOrderLine.findMany({
            where: { order: { projectId, companyId: user.companyId, deletedAt: null, status: { in: [...OPEN_PO] } } },
            select: { costCodeId: true, qty: true, cancelledQty: true, receivedQty: true, lineTotal: true, taxAmount: true },
          })
        : Promise.resolve(null),
      showActual ? this.prisma.projectCostLedger.groupBy({ by: ['costCodeId'], where: { companyId: user.companyId, projectId }, _sum: { totalCost: true } }) : Promise.resolve(null),
    ]);

    type Acc = { budget: ReturnType<typeof dec>; committed: ReturnType<typeof dec>; actual: ReturnType<typeof dec> };
    const rows = new Map<string, Acc>();
    const at = (key: string): Acc => {
      const existing = rows.get(key);
      if (existing) return existing;
      const fresh = { budget: ZERO, committed: ZERO, actual: ZERO };
      rows.set(key, fresh);
      return fresh;
    };
    for (const l of budget?.lines ?? []) {
      const row = at(l.costCodeId ?? 'none');
      row.budget = row.budget.plus(l.amount);
    }
    for (const l of poLines ?? []) {
      if (l.qty.isZero()) continue;
      const remaining = nonNegative(l.qty.minus(l.cancelledQty).minus(l.receivedQty));
      const row = at(l.costCodeId ?? 'none');
      row.committed = row.committed.plus(round2(remaining.div(l.qty).mul(l.lineTotal.plus(l.taxAmount))));
    }
    for (const a of actuals ?? []) {
      const row = at(a.costCodeId ?? 'none');
      row.actual = row.actual.plus(a._sum.totalCost ?? ZERO);
    }

    const codeIds = [...rows.keys()].filter((k) => k !== 'none');
    const codes = await this.prisma.costCode.findMany({ where: { id: { in: codeIds }, companyId: user.companyId }, select: { id: true, code: true, name: true, category: true } });
    const codeById = new Map(codes.map((c) => [c.id, c]));

    const lines = [...rows.entries()]
      .filter(([key, v]) => query.includeUnbudgeted || v.budget.gt(0) || key === 'none')
      .map(([key, v]) => {
        const code = codeById.get(key);
        const spent = v.committed.plus(v.actual);
        return {
          costCode: code ? { id: code.id, code: code.code, name: code.name, category: code.category } : null,
          budget: v.budget.toFixed(2),
          committed: showCommitted ? v.committed.toFixed(2) : null,
          actual: showActual ? v.actual.toFixed(2) : null,
          variance: v.budget.minus(spent).toFixed(2),
          utilisationPct: v.budget.gt(0) ? spent.div(v.budget).mul(100).toDecimalPlaces(2).toFixed(2) : null,
          unbudgeted: v.budget.isZero() && !spent.isZero(),
        };
      })
      .sort((a, b) => (a.costCode?.code ?? '~').localeCompare(b.costCode?.code ?? '~'));

    const sum = (pick: (r: Acc) => ReturnType<typeof dec>) => [...rows.values()].reduce((s, r) => s.plus(pick(r)), ZERO);
    const totals = { budget: sum((r) => r.budget), committed: sum((r) => r.committed), actual: sum((r) => r.actual) };
    return {
      projectId: project.id,
      budget: budget ? { budgetId: budget.id, version: budget.version, totalAmount: budget.totalAmount.toFixed(2) } : null,
      totals: {
        budget: totals.budget.toFixed(2),
        committed: showCommitted ? totals.committed.toFixed(2) : null,
        actual: showActual ? totals.actual.toFixed(2) : null,
        variance: totals.budget.minus(totals.committed).minus(totals.actual).toFixed(2),
      },
      lines,
    };
  }

  /**
   * Material actual cost only: MATERIAL_ISSUE and MATERIAL_RETURN rows of the project cost ledger. Reversals keep the
   * txnType of the row they negate, so a cancelled issue nets out of "issued" and a cancelled return out of "returned".
   * Returns are stored as negative cost; they are reported as a positive amount and subtracted to give actual.
   */
  async materialCost(user: SessionUser, projectId: string) {
    const project = await this.projectAccess.load(user, projectId, 'projects.budget', 'VIEW');
    const showActual = this.access.can(user, 'finance.ledger', 'VIEW', { projectId }) || this.access.can(user, 'projects.budget', 'VIEW', { projectId });
    const rows = showActual
      ? await this.prisma.projectCostLedger.groupBy({
          by: ['costCodeId', 'txnType'],
          where: { companyId: user.companyId, projectId, txnType: { in: ['MATERIAL_ISSUE', 'MATERIAL_RETURN'] } },
          _sum: { totalCost: true },
        })
      : [];

    const byCode = new Map<string, { issued: ReturnType<typeof dec>; returned: ReturnType<typeof dec> }>();
    for (const r of rows) {
      const key = r.costCodeId ?? 'none';
      const entry = byCode.get(key) ?? { issued: ZERO, returned: ZERO };
      const amount = r._sum.totalCost ?? ZERO;
      if (r.txnType === 'MATERIAL_ISSUE') entry.issued = entry.issued.plus(amount);
      else entry.returned = entry.returned.plus(amount.neg());
      byCode.set(key, entry);
    }

    const codes = await this.prisma.costCode.findMany({
      where: { id: { in: [...byCode.keys()].filter((k) => k !== 'none') }, companyId: user.companyId },
      select: { id: true, code: true, name: true, category: true },
    });
    const codeById = new Map(codes.map((c) => [c.id, c]));

    const lines = [...byCode.entries()]
      .map(([key, v]) => ({ costCode: codeById.get(key) ?? null, issued: v.issued.toFixed(2), returned: v.returned.toFixed(2), actual: v.issued.minus(v.returned).toFixed(2) }))
      .sort((a, b) => (a.costCode?.code ?? '~').localeCompare(b.costCode?.code ?? '~'));
    const issued = [...byCode.values()].reduce((s, v) => s.plus(v.issued), ZERO);
    const returned = [...byCode.values()].reduce((s, v) => s.plus(v.returned), ZERO);
    return { projectId: project.id, issued: issued.toFixed(2), returned: returned.toFixed(2), actual: issued.minus(returned).toFixed(2), lines };
  }
}
