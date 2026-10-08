import { Injectable } from '@nestjs/common';
import { BusinessRuleError } from '../../common/errors/domain-errors';
import { Db } from '../../prisma/prisma.service';

type Issue = { path: string; message: string };
export type DimensionRefs = { path: string; wbsNodeId?: string | null; costCodeId?: string | null; boqItemId?: string | null };

/**
 * Checks that the project dimensions a material document carries really belong where they claim to: WBS nodes and BOQ
 * items to the document's project, cost codes, employees and warehouses to the company.
 */
@Injectable()
export class MaterialDimensionsValidator {
  async assertHeader(
    db: Db,
    companyId: string,
    projectId: string,
    input: { warehouseId?: string | null; employeeId?: string | null; wbsNodeId?: string | null; costCodeId?: string | null },
  ): Promise<void> {
    const issues: Issue[] = [];
    if (input.warehouseId) {
      const wh = await db.warehouse.findFirst({ where: { id: input.warehouseId, companyId, deletedAt: null, active: true }, select: { projectId: true, code: true } });
      if (!wh) issues.push({ path: 'warehouseId', message: 'Warehouse not found in this company' });
      else if (wh.projectId && wh.projectId !== projectId) issues.push({ path: 'warehouseId', message: `Warehouse ${wh.code} is assigned to another project` });
    }
    if (input.employeeId) {
      const emp = await db.employee.findFirst({ where: { id: input.employeeId, companyId, deletedAt: null }, select: { id: true } });
      if (!emp) issues.push({ path: 'employeeId', message: 'Employee not found in this company' });
    }
    issues.push(...(await this.dimensionIssues(db, companyId, projectId, [{ path: '', wbsNodeId: input.wbsNodeId, costCodeId: input.costCodeId }])));
    if (issues.length > 0) throw new BusinessRuleError('Referenced records are invalid', issues);
  }

  async assertLines(db: Db, companyId: string, projectId: string, lines: DimensionRefs[]): Promise<void> {
    const issues = await this.dimensionIssues(db, companyId, projectId, lines);
    if (issues.length > 0) throw new BusinessRuleError('One or more lines reference invalid project dimensions', issues);
  }

  private async dimensionIssues(db: Db, companyId: string, projectId: string, lines: DimensionRefs[]): Promise<Issue[]> {
    const ids = (pick: (l: DimensionRefs) => string | null | undefined) => [...new Set(lines.map(pick).filter((v): v is string => Boolean(v)))];
    const [wbs, codes, boqs] = await Promise.all([
      db.wbsNode.findMany({ where: { id: { in: ids((l) => l.wbsNodeId) }, projectId, companyId, deletedAt: null }, select: { id: true } }),
      db.costCode.findMany({ where: { id: { in: ids((l) => l.costCodeId) }, companyId, deletedAt: null, active: true }, select: { id: true } }),
      db.boqItem.findMany({ where: { id: { in: ids((l) => l.boqItemId) }, projectId, companyId, deletedAt: null }, select: { id: true, estimate: { select: { status: true } } } }),
    ]);
    const okWbs = new Set(wbs.map((w) => w.id));
    const okCodes = new Set(codes.map((c) => c.id));
    const boqStatus = new Map(boqs.map((b) => [b.id, b.estimate.status]));
    const issues: Issue[] = [];
    for (const l of lines) {
      const at = (f: string) => (l.path ? `${l.path}.${f}` : f);
      if (l.wbsNodeId && !okWbs.has(l.wbsNodeId)) issues.push({ path: at('wbsNodeId'), message: 'WBS node does not belong to this project' });
      if (l.costCodeId && !okCodes.has(l.costCodeId)) issues.push({ path: at('costCodeId'), message: 'Cost code not found in this company' });
      if (l.boqItemId) {
        const status = boqStatus.get(l.boqItemId);
        if (!status) issues.push({ path: at('boqItemId'), message: 'BOQ item does not belong to this project' });
        else if (status !== 'APPROVED') issues.push({ path: at('boqItemId'), message: 'BOQ item belongs to an estimate that is not approved' });
      }
    }
    return issues;
  }
}
