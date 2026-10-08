import { Injectable } from '@nestjs/common';
import type { Item, Prisma } from '@prisma/client';
import type { RequisitionLineInput } from '@probuild/shared';
import { BusinessRuleError } from '../../common/errors/domain-errors';
import { dec, round2 } from '../../common/money';
import { Db } from '../../prisma/prisma.service';
import { allowedUnits, baseUnitFactor } from '../inventory/units';

export type ResolvedRequisitionLine = {
  input: RequisitionLineInput;
  item: Item;
  unit: string;
  estimatedUnitCost: Prisma.Decimal;
  estimatedAmount: Prisma.Decimal;
};

type Issue = { path: string; message: string };

/**
 * Cross-reference checks shared by requisitions, RFQs and purchase orders. Every id a client sends is
 * verified against the caller's company, and WBS / BOQ ids against the document's project, so a
 * foreign id can never be attached to a document.
 */
@Injectable()
export class ProcurementValidator {
  async resolveRequisitionLines(
    db: Db,
    ctx: { companyId: string; projectId: string },
    lines: RequisitionLineInput[],
  ): Promise<ResolvedRequisitionLine[]> {
    const ids = (pick: (l: RequisitionLineInput) => string | null | undefined) =>
      [...new Set(lines.map(pick).filter((v): v is string => Boolean(v)))];

    const [items, warehouses, wbsNodes, costCodes, boqItems] = await Promise.all([
      db.item.findMany({ where: { id: { in: ids((l) => l.itemId) }, companyId: ctx.companyId, deletedAt: null }, include: { unitConversions: true } }),
      db.warehouse.findMany({ where: { id: { in: ids((l) => l.warehouseId) }, companyId: ctx.companyId, deletedAt: null, active: true }, select: { id: true } }),
      db.wbsNode.findMany({ where: { id: { in: ids((l) => l.wbsNodeId) }, projectId: ctx.projectId, companyId: ctx.companyId, deletedAt: null }, select: { id: true } }),
      db.costCode.findMany({ where: { id: { in: ids((l) => l.costCodeId) }, companyId: ctx.companyId, deletedAt: null, active: true }, select: { id: true } }),
      db.boqItem.findMany({
        where: { id: { in: ids((l) => l.boqItemId) }, projectId: ctx.projectId, companyId: ctx.companyId, deletedAt: null },
        select: { id: true, estimate: { select: { status: true } } },
      }),
    ]);
    const itemById = new Map(items.map((i) => [i.id, i]));
    const found = {
      warehouse: new Set(warehouses.map((w) => w.id)),
      wbs: new Set(wbsNodes.map((w) => w.id)),
      costCode: new Set(costCodes.map((c) => c.id)),
      boq: new Map(boqItems.map((b) => [b.id, b.estimate.status])),
    };

    const issues: Issue[] = [];
    const resolved: ResolvedRequisitionLine[] = [];
    lines.forEach((line, i) => {
      const at = (field: string) => `lines.${i}.${field}`;
      const item = itemById.get(line.itemId);
      if (!item) {
        issues.push({ path: at('itemId'), message: 'Item not found in this company' });
        return;
      }
      if (!item.active) issues.push({ path: at('itemId'), message: `Item ${item.sku} is inactive` });
      if (line.warehouseId && !found.warehouse.has(line.warehouseId)) issues.push({ path: at('warehouseId'), message: 'Warehouse not found in this company' });
      if (line.wbsNodeId && !found.wbs.has(line.wbsNodeId)) issues.push({ path: at('wbsNodeId'), message: 'WBS node does not belong to this project' });
      if (line.costCodeId && !found.costCode.has(line.costCodeId)) issues.push({ path: at('costCodeId'), message: 'Cost code not found in this company' });
      if (line.boqItemId) {
        const status = found.boq.get(line.boqItemId);
        if (!status) issues.push({ path: at('boqItemId'), message: 'BOQ item does not belong to this project' });
        else if (status !== 'APPROVED') issues.push({ path: at('boqItemId'), message: 'BOQ item belongs to an estimate that is not approved' });
      }
      const unit = line.unit ?? item.purchaseUnit ?? item.baseUnit;
      if (!allowedUnits(item, item.unitConversions).has(unit)) {
        issues.push({ path: at('unit'), message: `Unit ${unit} is not defined for item ${item.sku}` });
      }
      // lastPurchaseCost and standardCost are per BASE unit; the line may be in a larger unit.
      const defaultCost = (item.lastPurchaseCost.gt(0) ? item.lastPurchaseCost : item.standardCost).mul(baseUnitFactor(item, item.unitConversions, unit));
      const estimatedUnitCost = line.estimatedUnitCost === undefined ? defaultCost : dec(line.estimatedUnitCost);
      resolved.push({ input: line, item, unit, estimatedUnitCost, estimatedAmount: round2(dec(line.qty).mul(estimatedUnitCost)) });
    });
    if (issues.length > 0) throw new BusinessRuleError('One or more references are invalid', issues);
    return resolved;
  }

  async assertWarehouse(db: Db, companyId: string, warehouseId: string | null | undefined, path = 'warehouseId'): Promise<void> {
    if (!warehouseId) return;
    const wh = await db.warehouse.findFirst({ where: { id: warehouseId, companyId, deletedAt: null, active: true }, select: { id: true } });
    if (!wh) throw new BusinessRuleError('Warehouse not found in this company', [{ path, message: 'Warehouse not found in this company' }]);
  }

  async assertSupplierUsable(db: Db, companyId: string, supplierId: string, path = 'supplierId'): Promise<void> {
    const supplier = await db.supplier.findFirst({ where: { id: supplierId, companyId, deletedAt: null }, select: { id: true, active: true, name: true } });
    if (!supplier) throw new BusinessRuleError('Supplier not found in this company', [{ path, message: 'Supplier not found in this company' }]);
    if (!supplier.active) throw new BusinessRuleError(`Supplier ${supplier.name} is inactive`, [{ path, message: 'Supplier is inactive' }]);
  }
}
