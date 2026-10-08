import { Injectable } from '@nestjs/common';
import { CostCategory, CostTxnType, Prisma, ProjectCostLedger } from '@prisma/client';
import { BusinessRuleError } from '../../common/errors/domain-errors';
import { Db } from '../../prisma/prisma.service';

const D = Prisma.Decimal;
type Decimalish = Prisma.Decimal | string | number;

export type CostEntry = {
  companyId: string;
  projectId: string;
  branchId?: string | null;
  wbsNodeId?: string | null;
  boqItemId?: string | null;
  costCodeId?: string | null;
  departmentId?: string | null;
  costCategory: CostCategory;
  txnType: CostTxnType;
  txnDate: Date;
  supplierId?: string | null;
  employeeId?: string | null;
  subcontractorId?: string | null;
  warehouseId?: string | null;
  itemId?: string | null;
  quantity?: Decimalish;
  unitCost?: Decimalish;
  /** Signed. Credits (returns, reversals) are negative. */
  totalCost: Decimalish;
  taxAmount?: Decimalish;
  sourceType: string;
  sourceId: string;
  reference?: string;
  userId: string;
  reversalOfId?: string;
};

/**
 * Universal Project Cost Ledger. Material issues, payroll, equipment, subcontractor claims, expenses
 * and fuel all land here with the same dimensions, so cost control can drill from project to transaction.
 */
@Injectable()
export class CostLedgerService {
  async record(db: Db, entry: CostEntry): Promise<ProjectCostLedger> {
    const project = await db.project.findFirst({
      where: { id: entry.projectId, companyId: entry.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new BusinessRuleError('Project does not exist in this company');

    if (entry.wbsNodeId) {
      const wbs = await db.wbsNode.findFirst({ where: { id: entry.wbsNodeId, projectId: entry.projectId }, select: { id: true } });
      if (!wbs) throw new BusinessRuleError('WBS node does not belong to this project');
    }
    if (entry.boqItemId) {
      const boq = await db.boqItem.findFirst({ where: { id: entry.boqItemId, projectId: entry.projectId }, select: { id: true } });
      if (!boq) throw new BusinessRuleError('BOQ item does not belong to this project');
    }

    return db.projectCostLedger.create({
      data: {
        companyId: entry.companyId,
        projectId: entry.projectId,
        branchId: entry.branchId ?? null,
        wbsNodeId: entry.wbsNodeId ?? null,
        boqItemId: entry.boqItemId ?? null,
        costCodeId: entry.costCodeId ?? null,
        departmentId: entry.departmentId ?? null,
        costCategory: entry.costCategory,
        txnType: entry.txnType,
        txnDate: entry.txnDate,
        supplierId: entry.supplierId ?? null,
        employeeId: entry.employeeId ?? null,
        subcontractorId: entry.subcontractorId ?? null,
        warehouseId: entry.warehouseId ?? null,
        itemId: entry.itemId ?? null,
        quantity: new D(entry.quantity ?? 0),
        unitCost: new D(entry.unitCost ?? 0),
        totalCost: new D(entry.totalCost).toDecimalPlaces(2),
        taxAmount: new D(entry.taxAmount ?? 0),
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        reference: entry.reference ?? null,
        reversalOfId: entry.reversalOfId ?? null,
        userId: entry.userId,
      },
    });
  }

  /** Appends negating rows for every not-yet-reversed cost row of a source document. */
  async reverse(
    db: Db,
    input: { companyId: string; sourceType: string; sourceId: string; userId: string },
  ): Promise<ProjectCostLedger[]> {
    const rows = await db.projectCostLedger.findMany({
      where: { companyId: input.companyId, sourceType: input.sourceType, sourceId: input.sourceId, reversalOfId: null, reversedBy: { none: {} } },
    });
    const out: ProjectCostLedger[] = [];
    for (const row of rows) {
      out.push(
        await db.projectCostLedger.create({
          data: {
            companyId: row.companyId,
            branchId: row.branchId,
            projectId: row.projectId,
            wbsNodeId: row.wbsNodeId,
            boqItemId: row.boqItemId,
            costCodeId: row.costCodeId,
            departmentId: row.departmentId,
            costCategory: row.costCategory,
            txnType: row.txnType,
            txnDate: new Date(),
            supplierId: row.supplierId,
            employeeId: row.employeeId,
            subcontractorId: row.subcontractorId,
            warehouseId: row.warehouseId,
            itemId: row.itemId,
            quantity: row.quantity.neg(),
            unitCost: row.unitCost,
            totalCost: row.totalCost.neg(),
            taxAmount: row.taxAmount.neg(),
            sourceType: row.sourceType,
            sourceId: row.sourceId,
            reference: row.reference ? `Reversal of ${row.reference}` : 'Reversal',
            reversalOfId: row.id,
            userId: input.userId,
          },
        }),
      );
    }
    return out;
  }

  /** Actual cost for a project, optionally grouped. Reversals net out because they are negative rows. */
  async actualByProject(db: Db, companyId: string, projectId: string): Promise<Prisma.Decimal> {
    const sum = await db.projectCostLedger.aggregate({ where: { companyId, projectId }, _sum: { totalCost: true } });
    return sum._sum.totalCost ?? new D(0);
  }
}
