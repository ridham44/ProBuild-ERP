import { Injectable } from '@nestjs/common';
import { Prisma, StockLedger, StockStatus, StockTxnType } from '@prisma/client';
import { BusinessRuleError } from '../../common/errors/domain-errors';
import { Db } from '../../prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';

const D = Prisma.Decimal;
type Decimalish = Prisma.Decimal | string | number;

export type StockMovement = {
  companyId: string;
  txnDate: Date;
  txnType: StockTxnType;
  warehouseId: string;
  locationId?: string | null;
  itemId: string;
  batchNo?: string;
  serialNo?: string | null;
  stockStatus?: StockStatus;
  /** Signed: positive = stock in, negative = stock out. */
  qty: Decimalish;
  /** Required for inbound. For outbound it overrides the weighted-average cost (transfers, reversals). */
  unitCost?: Decimalish;
  sourceType: string;
  sourceId: string;
  projectId?: string | null;
  wbsNodeId?: string | null;
  costCodeId?: string | null;
  boqItemId?: string | null;
  costCenterId?: string | null;
  userId: string;
  remarks?: string;
  reversalOfId?: string;
  allowNegative?: boolean;
};

/**
 * The only code path allowed to change stock. Every movement appends an immutable StockLedger row and
 * updates the derived StockBalance in the same transaction. Callers pass the transaction client.
 */
@Injectable()
export class StockLedgerService {
  constructor(private readonly numbering: NumberingService) {}

  async post(db: Db, movements: StockMovement[]): Promise<StockLedger[]> {
    const rows: StockLedger[] = [];
    for (const movement of movements) {
      rows.push(await this.postOne(db, movement));
    }
    return rows;
  }

  /** Moves stock between warehouses preserving original cost, batch and serial. */
  async transfer(
    db: Db,
    input: {
      companyId: string;
      txnDate: Date;
      fromWarehouseId: string;
      toWarehouseId: string;
      itemId: string;
      qty: Decimalish;
      batchNo?: string;
      serialNo?: string | null;
      sourceType: string;
      sourceId: string;
      userId: string;
      fromProjectId?: string | null;
      toProjectId?: string | null;
    },
  ): Promise<{ out: StockLedger; in: StockLedger }> {
    const qty = new D(input.qty);
    if (qty.lte(0)) throw new BusinessRuleError('Transfer quantity must be positive');
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new BusinessRuleError('Source and destination warehouse must differ');
    }
    const out = await this.postOne(db, {
      companyId: input.companyId,
      txnDate: input.txnDate,
      txnType: 'TRANSFER_OUT',
      warehouseId: input.fromWarehouseId,
      itemId: input.itemId,
      batchNo: input.batchNo,
      serialNo: input.serialNo,
      qty: qty.neg(),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      projectId: input.fromProjectId,
      userId: input.userId,
    });
    const inbound = await this.postOne(db, {
      companyId: input.companyId,
      txnDate: input.txnDate,
      txnType: 'TRANSFER_IN',
      warehouseId: input.toWarehouseId,
      itemId: input.itemId,
      batchNo: input.batchNo,
      serialNo: input.serialNo,
      qty,
      unitCost: out.unitCost,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      projectId: input.toProjectId,
      userId: input.userId,
    });
    return { out, in: inbound };
  }

  /** Appends opposite rows for every not-yet-reversed ledger row of a source document. */
  async reverse(
    db: Db,
    input: { companyId: string; sourceType: string; sourceId: string; userId: string; reason: string; txnDate?: Date },
  ): Promise<StockLedger[]> {
    const original = await db.stockLedger.findMany({
      where: {
        companyId: input.companyId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        txnType: { not: 'REVERSAL' },
        reversedBy: { none: {} },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (original.length === 0) throw new BusinessRuleError('No un-reversed stock movements found for this document');

    const rows: StockLedger[] = [];
    for (const row of original) {
      rows.push(
        await this.postOne(db, {
          companyId: row.companyId,
          txnDate: input.txnDate ?? new Date(),
          txnType: 'REVERSAL',
          warehouseId: row.warehouseId,
          locationId: row.locationId,
          itemId: row.itemId,
          batchNo: row.batchNo,
          serialNo: row.serialNo,
          stockStatus: row.stockStatus,
          qty: row.qty.neg(),
          unitCost: row.unitCost,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          projectId: row.projectId,
          wbsNodeId: row.wbsNodeId,
          costCodeId: row.costCodeId,
          boqItemId: row.boqItemId,
          costCenterId: row.costCenterId,
          userId: input.userId,
          remarks: `Reversal: ${input.reason}`,
          reversalOfId: row.id,
        }),
      );
    }
    return rows;
  }

  /** On-hand, reserved (approved requests not yet issued) and available for an item. */
  async availability(
    db: Db,
    input: { companyId: string; itemId: string; warehouseId?: string },
  ): Promise<{ onHand: Prisma.Decimal; reserved: Prisma.Decimal; available: Prisma.Decimal }> {
    const balance = await db.stockBalance.aggregate({
      where: {
        companyId: input.companyId,
        itemId: input.itemId,
        stockStatus: 'AVAILABLE',
        ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
      },
      _sum: { qtyOnHand: true },
    });
    const lines = await db.materialRequestLine.findMany({
      where: {
        itemId: input.itemId,
        request: {
          companyId: input.companyId,
          status: 'APPROVED',
          deletedAt: null,
          ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
        },
      },
      select: { qty: true, issuedQty: true },
    });
    const reserved = lines.reduce((sum, l) => sum.plus(Prisma.Decimal.max(l.qty.minus(l.issuedQty), 0)), new D(0));
    const onHand = balance._sum.qtyOnHand ?? new D(0);
    return { onHand, reserved, available: onHand.minus(reserved) };
  }

  private async postOne(db: Db, m: StockMovement): Promise<StockLedger> {
    const qty = new D(m.qty);
    if (qty.isZero()) throw new BusinessRuleError('Stock movement quantity cannot be zero');

    const batchNo = m.batchNo ?? '';
    const status = m.stockStatus ?? 'AVAILABLE';
    const item = await db.item.findFirst({
      where: { id: m.itemId, companyId: m.companyId, deletedAt: null },
      select: { id: true, sku: true, trackBatch: true, trackSerial: true, restrictedProjectId: true, costingMethod: true, standardCost: true },
    });
    if (!item) throw new BusinessRuleError('Item does not exist in this company');
    if (item.trackBatch && !batchNo) throw new BusinessRuleError(`Item ${item.sku} is batch-controlled: batch number required`);
    if (item.trackSerial && !m.serialNo) throw new BusinessRuleError(`Item ${item.sku} is serialized: serial number required`);
    if (item.restrictedProjectId && m.projectId && qty.lt(0) && item.restrictedProjectId !== m.projectId) {
      throw new BusinessRuleError(`Item ${item.sku} is restricted to another project`);
    }

    const warehouse = await db.warehouse.findFirst({
      where: { id: m.warehouseId, companyId: m.companyId, deletedAt: null, active: true },
      select: { id: true },
    });
    if (!warehouse) throw new BusinessRuleError('Warehouse does not exist or is inactive');

    // Make sure the balance row exists, then lock it. Creating-if-missing first means two concurrent
    // first postings for the same bucket queue on the unique key instead of racing on insert.
    await db.$executeRaw`INSERT INTO "StockBalance" ("id", "companyId", "warehouseId", "itemId", "batchNo", "stockStatus", "qtyOnHand", "value", "avgCost", "updatedAt")
      VALUES (gen_random_uuid()::text, ${m.companyId}, ${m.warehouseId}, ${m.itemId}, ${batchNo}, ${status}::"StockStatus", 0, 0, 0, now())
      ON CONFLICT ("warehouseId", "itemId", "batchNo", "stockStatus") DO NOTHING`;
    await db.$queryRaw`SELECT id FROM "StockBalance"
      WHERE "warehouseId" = ${m.warehouseId} AND "itemId" = ${m.itemId} AND "batchNo" = ${batchNo}
        AND "stockStatus"::text = ${status} FOR UPDATE`;
    const balance = await db.stockBalance.findUnique({
      where: { warehouseId_itemId_batchNo_stockStatus: { warehouseId: m.warehouseId, itemId: m.itemId, batchNo, stockStatus: status } },
    });
    const onHand = balance?.qtyOnHand ?? new D(0);
    const onHandValue = balance?.value ?? new D(0);
    const avgCost = balance?.avgCost ?? new D(0);

    const { unitCost, value } = this.priceMovement({
      qty,
      onHand,
      onHandValue,
      avgCost,
      explicitCost: m.unitCost === undefined ? undefined : new D(m.unitCost),
      standardCost: item.costingMethod === 'STANDARD' ? item.standardCost : undefined,
      allowNegative: m.allowNegative ?? false,
      itemSku: item.sku,
    });

    const newQty = onHand.plus(qty);
    const newValue = onHandValue.plus(value);
    const newAvg = newQty.gt(0) ? newValue.div(newQty).toDecimalPlaces(4) : avgCost;

    await db.stockBalance.upsert({
      where: { warehouseId_itemId_batchNo_stockStatus: { warehouseId: m.warehouseId, itemId: m.itemId, batchNo, stockStatus: status } },
      create: {
        companyId: m.companyId,
        warehouseId: m.warehouseId,
        itemId: m.itemId,
        batchNo,
        stockStatus: status,
        qtyOnHand: newQty,
        value: newValue,
        avgCost: newAvg,
      },
      update: { qtyOnHand: newQty, value: newValue, avgCost: newAvg },
    });

    const txnNo = await this.numbering.next(db, m.companyId, 'STOCK_TXN');
    return db.stockLedger.create({
      data: {
        companyId: m.companyId,
        txnNo,
        txnDate: m.txnDate,
        txnType: m.txnType,
        warehouseId: m.warehouseId,
        locationId: m.locationId ?? null,
        itemId: m.itemId,
        batchNo,
        serialNo: m.serialNo ?? null,
        stockStatus: status,
        qty,
        unitCost,
        value,
        runningQty: newQty,
        runningValue: newValue,
        sourceType: m.sourceType,
        sourceId: m.sourceId,
        projectId: m.projectId ?? null,
        wbsNodeId: m.wbsNodeId ?? null,
        costCodeId: m.costCodeId ?? null,
        boqItemId: m.boqItemId ?? null,
        costCenterId: m.costCenterId ?? null,
        reversalOfId: m.reversalOfId ?? null,
        userId: m.userId,
        remarks: m.remarks ?? null,
      },
    });
  }

  private priceMovement(input: {
    qty: Prisma.Decimal;
    onHand: Prisma.Decimal;
    onHandValue: Prisma.Decimal;
    avgCost: Prisma.Decimal;
    explicitCost?: Prisma.Decimal;
    standardCost?: Prisma.Decimal;
    allowNegative: boolean;
    itemSku: string;
  }): { unitCost: Prisma.Decimal; value: Prisma.Decimal } {
    const { qty, onHand } = input;
    if (qty.gt(0)) {
      if (input.explicitCost === undefined) throw new BusinessRuleError('Unit cost is required for inbound stock');
      if (input.explicitCost.lt(0)) throw new BusinessRuleError('Unit cost cannot be negative');
      return { unitCost: input.explicitCost, value: qty.mul(input.explicitCost).toDecimalPlaces(2) };
    }

    if (onHand.plus(qty).lt(0) && !input.allowNegative) {
      throw new BusinessRuleError(
        `Insufficient stock for ${input.itemSku}: on hand ${onHand.toString()}, requested ${qty.abs().toString()}`,
      );
    }
    const unitCost = input.explicitCost ?? input.standardCost ?? input.avgCost;
    // Issuing the entire balance drains the remaining value exactly, leaving no rounding residue.
    const drainsBalance = qty.abs().equals(onHand) && input.explicitCost === undefined;
    const value = drainsBalance ? input.onHandValue.neg() : qty.mul(unitCost).toDecimalPlaces(2);
    return { unitCost: drainsBalance && !onHand.isZero() ? input.onHandValue.div(onHand).toDecimalPlaces(4) : unitCost, value };
  }
}
