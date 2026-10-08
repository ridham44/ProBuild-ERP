import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ITEM_SORT_FIELDS, itemRuleIssues } from '@probuild/shared';
import type {
  CreateItemCategoryInput,
  CreateItemInput,
  CreateUomInput,
  ItemListQuery,
  PaginationQuery,
  PriceHistoryQuery,
  SessionUser,
  SetItemUnitConversionInput,
  UpdateItemInput,
} from '@probuild/shared';
import { z } from 'zod';
import type { updateItemCategorySchema, updateUomSchema } from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny } from '../../common/list';
import { dec, nonNegative, ZERO } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ActivityService } from '../../engines/activity/activity.service';
import { AuditService } from '../../engines/audit/audit.service';
import { StockLedgerService } from '../../engines/stock-ledger/stock-ledger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { baseUnitFactor } from './units';

const OPEN_PO_STATUSES = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] as const;
const PRICED_PO_STATUSES = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'] as const;
/** Fields that change the meaning of existing stock; frozen once the item has stock movements. */
const FROZEN_AFTER_STOCK = ['baseUnit', 'trackBatch', 'trackSerial', 'costingMethod'] as const;

type StockSummaryRow = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  onHand: Prisma.Decimal;
  reserved: Prisma.Decimal;
  committed: Prisma.Decimal;
  available: Prisma.Decimal;
  quarantine: Prisma.Decimal;
  damaged: Prisma.Decimal;
  inTransit: Prisma.Decimal;
  value: Prisma.Decimal;
};

export type PriceHistoryRow = {
  key: string;
  source: 'QUOTATION' | 'PURCHASE_ORDER';
  at: Date;
  supplier: { id: string; name: string };
  reference: string;
  referenceId: string;
  qty: string;
  unit: string | null;
  unitPrice: string;
  discountPct: string;
  taxPct: string;
  /** unitPrice after line discount, before tax. */
  netUnitPrice: string;
  currency: string;
};

@Injectable()
export class ItemsService extends AuditedService {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly activity: ActivityService,
    private readonly stock: StockLedgerService,
  ) {
    super(prisma, audit);
  }

  // ---- Units of measure --------------------------------------------------------------------------

  listUoms(user: SessionUser, query: PaginationQuery) {
    return paginate(
      (args) =>
        this.prisma.unitOfMeasure.findMany({
          where: { companyId: user.companyId, ...containsAny(query.search, ['code', 'name']) },
          orderBy: [{ code: 'asc' }, { id: 'asc' }],
          ...args,
        }),
      query,
    );
  }

  createUom(user: SessionUser, input: CreateUomInput) {
    return this.createAudited(user, 'UnitOfMeasure', (tx) => tx.unitOfMeasure.create({ data: { ...input, companyId: user.companyId } }));
  }

  async updateUom(user: SessionUser, id: string, input: z.infer<typeof updateUomSchema>) {
    const before = await this.prisma.unitOfMeasure.findFirst({ where: { id, companyId: user.companyId } });
    if (!before) throw new NotFoundError('Unit of measure', id);
    return this.updateAudited(user, 'UnitOfMeasure', before, (tx) => tx.unitOfMeasure.update({ where: { id }, data: input }));
  }

  // ---- Categories --------------------------------------------------------------------------------

  listCategories(user: SessionUser, query: PaginationQuery) {
    return paginate(
      (args) =>
        this.prisma.itemCategory.findMany({
          where: { companyId: user.companyId, deletedAt: null, ...containsAny(query.search, ['name']) },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          ...args,
        }),
      query,
    );
  }

  async createCategory(user: SessionUser, input: CreateItemCategoryInput) {
    if (input.parentId) await this.assertCategory(user, input.parentId);
    return this.createAudited(user, 'ItemCategory', (tx) => tx.itemCategory.create({ data: { ...input, companyId: user.companyId } }));
  }

  async updateCategory(user: SessionUser, id: string, input: z.infer<typeof updateItemCategorySchema>) {
    const before = await this.assertCategory(user, id);
    if (input.parentId) {
      if (input.parentId === id) throw new BusinessRuleError('A category cannot be its own parent');
      await this.assertCategory(user, input.parentId);
      await this.assertNoCategoryCycle(user, id, input.parentId);
    }
    return this.updateAudited(user, 'ItemCategory', before, (tx) => tx.itemCategory.update({ where: { id }, data: input }));
  }

  async removeCategory(user: SessionUser, id: string) {
    const before = await this.assertCategory(user, id);
    const [items, children] = await Promise.all([
      this.prisma.item.count({ where: { categoryId: id, deletedAt: null } }),
      this.prisma.itemCategory.count({ where: { parentId: id, deletedAt: null } }),
    ]);
    if (items > 0 || children > 0) throw new BusinessRuleError('The category still has items or sub-categories');
    await this.softDeleteAudited(user, 'ItemCategory', before, (tx) => tx.itemCategory.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  // ---- Items -------------------------------------------------------------------------------------

  list(user: SessionUser, query: ItemListQuery) {
    const where: Prisma.ItemWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...containsAny(query.search, ['sku', 'name', 'barcode', 'brand']),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.itemType ? { itemType: query.itemType } : {}),
      ...(query.preferredSupplierId ? { preferredSupplierId: query.preferredSupplierId } : {}),
      ...(query.trackBatch === undefined ? {} : { trackBatch: query.trackBatch }),
      ...(query.trackSerial === undefined ? {} : { trackSerial: query.trackSerial }),
    };
    return paginate(
      (args) =>
        this.prisma.item.findMany({
          where,
          orderBy: buildOrderBy(query.sort, ITEM_SORT_FIELDS, [{ sku: 'asc' }]),
          include: { category: { select: { id: true, name: true } } },
          ...args,
        }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        preferredSupplier: { select: { id: true, code: true, name: true } },
        unitConversions: { orderBy: { unit: 'asc' } },
      },
    });
    if (!item) throw new NotFoundError('Item', id);
    return item;
  }

  async create(user: SessionUser, input: CreateItemInput) {
    await this.assertRefs(user, input);
    return this.createAudited(user, 'Item', (tx) => tx.item.create({ data: { ...input, companyId: user.companyId } }));
  }

  async update(user: SessionUser, id: string, input: UpdateItemInput) {
    const before = await this.findRaw(user, id);
    await this.assertRefs(user, input);

    const merged = {
      minStock: input.minStock ?? before.minStock.toString(),
      maxStock: input.maxStock ?? before.maxStock.toString(),
      costingMethod: input.costingMethod ?? before.costingMethod,
      standardCost: input.standardCost ?? before.standardCost.toString(),
      trackBatch: input.trackBatch ?? before.trackBatch,
      trackExpiry: input.trackExpiry ?? before.trackExpiry,
    };
    const issues = itemRuleIssues(merged);
    if (issues.length > 0) throw new BusinessRuleError('Item settings are inconsistent', issues);

    const changesFrozen = FROZEN_AFTER_STOCK.filter((f) => input[f] !== undefined && input[f] !== before[f]);
    if (changesFrozen.length > 0) {
      const moved = await this.prisma.stockLedger.count({ where: { itemId: id, companyId: user.companyId } });
      if (moved > 0) {
        throw new BusinessRuleError(
          `${changesFrozen.join(', ')} cannot be changed after the item has stock movements`,
          changesFrozen.map((f) => ({ path: f, message: 'Locked because stock movements exist' })),
        );
      }
    }
    return this.updateAudited(user, 'Item', before, (tx) => tx.item.update({ where: { id }, data: input }));
  }

  async remove(user: SessionUser, id: string) {
    const before = await this.findRaw(user, id);
    const [moved, docs] = await Promise.all([
      this.prisma.stockLedger.count({ where: { itemId: id, companyId: user.companyId } }),
      this.prisma.purchaseRequisitionLine.count({ where: { itemId: id } }),
    ]);
    if (moved > 0 || docs > 0) throw new BusinessRuleError('This item is used by transactions and cannot be deleted. Deactivate it instead.');
    await this.softDeleteAudited(user, 'Item', before, (tx) => tx.item.update({ where: { id }, data: { deletedAt: new Date(), active: false } }));
  }

  // ---- Unit conversions --------------------------------------------------------------------------

  async setUnitConversion(user: SessionUser, itemId: string, input: SetItemUnitConversionInput) {
    const item = await this.findRaw(user, itemId);
    if (input.unit === item.baseUnit) throw new BusinessRuleError('The base unit always has a factor of 1');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.itemUnitConversion.upsert({
        where: { itemId_unit: { itemId, unit: input.unit } },
        create: { companyId: user.companyId, itemId, unit: input.unit, factor: input.factor },
        update: { factor: input.factor },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Item', entityId: itemId,
        action: 'UNIT_CONVERSION_SET', after: { unit: row.unit, factor: row.factor },
      });
      return row;
    });
  }

  async removeUnitConversion(user: SessionUser, itemId: string, unit: string) {
    await this.findRaw(user, itemId);
    const row = await this.prisma.itemUnitConversion.findUnique({ where: { itemId_unit: { itemId, unit } } });
    if (!row) throw new NotFoundError('Unit conversion', unit);
    await this.prisma.$transaction(async (tx) => {
      await tx.itemUnitConversion.delete({ where: { id: row.id } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Item', entityId: itemId,
        action: 'UNIT_CONVERSION_REMOVED', after: { unit },
      });
    });
  }

  // ---- Stock summary -----------------------------------------------------------------------------

  /**
   * Per-warehouse quantities in the item's base unit:
   *  - onHand:    AVAILABLE stock balance (quarantine/damaged/in-transit are shown separately)
   *  - reserved:  approved material requests not yet issued (StockLedgerService.availability)
   *  - committed: remaining quantity on approved/sent/part-received purchase orders (inbound, not yet in stock)
   *  - available: onHand - reserved (committed stock is not yet physically available)
   * Rows are limited to warehouses the caller may view stock for.
   */
  async stockSummary(user: SessionUser, itemId: string, warehouseId?: string) {
    const item = await this.findRaw(user, itemId);
    const scope = this.access.warehouseScope(user, 'inventory.stock', 'VIEW');
    const allowed = (id: string) => scope === 'ALL' || scope.includes(id);
    if (warehouseId && !allowed(warehouseId)) throw new ForbiddenException('You do not have stock permission for this warehouse');

    const conversions = await this.prisma.itemUnitConversion.findMany({ where: { itemId } });
    const scopeFilter = warehouseId ? { warehouseId } : scope === 'ALL' ? {} : { warehouseId: { in: scope } };

    const [balances, poLines] = await Promise.all([
      this.prisma.stockBalance.groupBy({
        by: ['warehouseId', 'stockStatus'],
        where: { companyId: user.companyId, itemId, ...scopeFilter },
        _sum: { qtyOnHand: true, value: true },
      }),
      this.prisma.purchaseOrderLine.findMany({
        where: { itemId, order: { companyId: user.companyId, deletedAt: null, status: { in: [...OPEN_PO_STATUSES] }, ...scopeFilter } },
        select: { qty: true, cancelledQty: true, receivedQty: true, unit: true, order: { select: { warehouseId: true } } },
      }),
    ]);

    const committedBy = new Map<string, Prisma.Decimal>();
    for (const line of poLines) {
      const remaining = nonNegative(line.qty.minus(line.cancelledQty).minus(line.receivedQty)).mul(baseUnitFactor(item, conversions, line.unit));
      committedBy.set(line.order.warehouseId, (committedBy.get(line.order.warehouseId) ?? ZERO).plus(remaining));
    }

    const ids = new Set<string>([...balances.map((b) => b.warehouseId), ...committedBy.keys()]);
    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: { in: [...ids] }, companyId: user.companyId },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });

    const rows: StockSummaryRow[] = [];
    for (const wh of warehouses) {
      const mine = balances.filter((b) => b.warehouseId === wh.id);
      const qtyOf = (status: string) => mine.find((b) => b.stockStatus === status)?._sum.qtyOnHand ?? ZERO;
      const valueOf = (status: string) => mine.find((b) => b.stockStatus === status)?._sum.value ?? ZERO;
      const availability = await this.stock.availability(this.prisma, { companyId: user.companyId, itemId, warehouseId: wh.id });
      rows.push({
        warehouseId: wh.id,
        warehouseCode: wh.code,
        warehouseName: wh.name,
        onHand: availability.onHand,
        reserved: availability.reserved,
        committed: committedBy.get(wh.id) ?? ZERO,
        available: availability.available,
        quarantine: qtyOf('QUARANTINE'),
        damaged: qtyOf('DAMAGED'),
        inTransit: qtyOf('IN_TRANSIT'),
        value: valueOf('AVAILABLE'),
      });
    }

    const sum = (pick: (r: StockSummaryRow) => Prisma.Decimal) => rows.reduce((s, r) => s.plus(pick(r)), ZERO);
    return {
      itemId,
      baseUnit: item.baseUnit,
      totals: {
        onHand: sum((r) => r.onHand),
        reserved: sum((r) => r.reserved),
        committed: sum((r) => r.committed),
        available: sum((r) => r.available),
        value: sum((r) => r.value),
      },
      warehouses: rows,
    };
  }

  // ---- Price history -----------------------------------------------------------------------------

  /**
   * Every price a supplier quoted or was ordered at for this item, newest first. Cursor is
   * `<iso date>|<source>|<id>` over the order (date desc, source asc, id desc).
   */
  async priceHistory(user: SessionUser, itemId: string, query: PriceHistoryQuery) {
    await this.findRaw(user, itemId);
    const cursor = this.parseCursor(query.cursor);
    // Cursor condition applied at line level: the tie-break id is the line id, the date lives on the parent.
    const after = (source: 'QUOTATION' | 'PURCHASE_ORDER', parent: 'quotation' | 'order', field: 'quoteDate' | 'orderDate') => {
      if (!cursor) return {};
      const tie = source === cursor.source ? { id: { lt: cursor.id } } : source > cursor.source ? {} : { id: { in: [] as string[] } };
      return { OR: [{ [parent]: { [field]: { lt: cursor.at } } }, { [parent]: { [field]: cursor.at }, ...tie }] };
    };
    const range = (field: 'quoteDate' | 'orderDate') => ({
      ...(query.from || query.to ? { [field]: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
    });
    const take = query.limit + 1;
    const wantQuotes = !query.source || query.source === 'QUOTATION';
    const wantOrders = !query.source || query.source === 'PURCHASE_ORDER';

    const [quoteLines, poLines] = await Promise.all([
      wantQuotes
        ? this.prisma.supplierQuotationLine.findMany({
            where: {
              itemId,
              quotation: { companyId: user.companyId, ...(query.supplierId ? { supplierId: query.supplierId } : {}), ...range('quoteDate') },
              ...after('QUOTATION', 'quotation', 'quoteDate'),
            },
            orderBy: [{ quotation: { quoteDate: 'desc' } }, { id: 'desc' }],
            take,
            include: {
              rfqLine: { select: { unit: true } },
              quotation: { select: { id: true, quoteNo: true, quoteDate: true, currency: true, supplier: { select: { id: true, name: true } }, rfq: { select: { number: true } } } },
            },
          })
        : [],
      wantOrders
        ? this.prisma.purchaseOrderLine.findMany({
            where: {
              itemId,
              order: {
                companyId: user.companyId,
                deletedAt: null,
                status: { in: [...PRICED_PO_STATUSES] },
                ...(query.supplierId ? { supplierId: query.supplierId } : {}),
                ...range('orderDate'),
              },
              ...after('PURCHASE_ORDER', 'order', 'orderDate'),
            },
            orderBy: [{ order: { orderDate: 'desc' } }, { id: 'desc' }],
            take,
            include: { order: { select: { id: true, number: true, orderDate: true, currency: true, supplier: { select: { id: true, name: true } } } } },
          })
        : [],
    ]);

    const rows: PriceHistoryRow[] = [
      ...quoteLines.map((l) => ({
        key: `${l.quotation.quoteDate.toISOString()}|QUOTATION|${l.id}`,
        source: 'QUOTATION' as const,
        at: l.quotation.quoteDate,
        supplier: l.quotation.supplier,
        reference: l.quotation.quoteNo ?? l.quotation.rfq.number,
        referenceId: l.quotation.id,
        qty: l.qty.toString(),
        unit: l.rfqLine.unit,
        unitPrice: l.unitPrice.toString(),
        discountPct: l.discountPct.toString(),
        taxPct: l.taxPct.toString(),
        netUnitPrice: l.unitPrice.mul(dec(100).minus(l.discountPct)).div(100).toString(),
        currency: l.quotation.currency,
      })),
      ...poLines.map((l) => ({
        key: `${l.order.orderDate.toISOString()}|PURCHASE_ORDER|${l.id}`,
        source: 'PURCHASE_ORDER' as const,
        at: l.order.orderDate,
        supplier: l.order.supplier,
        reference: l.order.number,
        referenceId: l.order.id,
        qty: l.qty.toString(),
        unit: l.unit,
        unitPrice: l.unitPrice.toString(),
        discountPct: l.discountPct.toString(),
        taxPct: l.taxPct.toString(),
        netUnitPrice: l.unitPrice.mul(dec(100).minus(l.discountPct)).div(100).toString(),
        currency: l.order.currency,
      })),
    ];
    rows.sort((a, b) => b.at.getTime() - a.at.getTime() || (a.source === b.source ? (a.key < b.key ? 1 : -1) : a.source < b.source ? -1 : 1));
    const page = rows.slice(0, query.limit);
    const hasMore = rows.length > query.limit;
    const last = page[page.length - 1];
    return { items: page.map(({ key: _key, ...row }) => row), nextCursor: hasMore && last ? last.key : null };
  }

  private parseCursor(raw?: string): { at: Date; source: 'QUOTATION' | 'PURCHASE_ORDER'; id: string } | null {
    if (!raw) return null;
    const [iso, source, id] = raw.split('|');
    const at = iso ? new Date(iso) : null;
    if (!at || Number.isNaN(at.getTime()) || !id || (source !== 'QUOTATION' && source !== 'PURCHASE_ORDER')) {
      throw new BusinessRuleError('Invalid cursor');
    }
    return { at, source, id };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.findRaw(user, id);
    return this.activity.forDocument({ companyId: user.companyId, entityType: 'Item', entityId: id });
  }

  // ---- helpers -----------------------------------------------------------------------------------

  private async findRaw(user: SessionUser, id: string) {
    const item = await this.prisma.item.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!item) throw new NotFoundError('Item', id);
    return item;
  }

  private async assertCategory(user: SessionUser, id: string) {
    const category = await this.prisma.itemCategory.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!category) throw new BusinessRuleError('Item category not found');
    return category;
  }

  private async assertNoCategoryCycle(user: SessionUser, id: string, newParentId: string): Promise<void> {
    let cursor: string | null = newParentId;
    for (let depth = 0; cursor && depth < 50; depth++) {
      if (cursor === id) throw new BusinessRuleError('This move would make the category its own ancestor');
      const parent: { parentId: string | null } | null = await this.prisma.itemCategory.findFirst({
        where: { id: cursor, companyId: user.companyId },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }

  private async assertRefs(user: SessionUser, input: { categoryId?: string | null; preferredSupplierId?: string | null }): Promise<void> {
    if (input.categoryId) await this.assertCategory(user, input.categoryId);
    if (input.preferredSupplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: input.preferredSupplierId, companyId: user.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!supplier) throw new BusinessRuleError('Preferred supplier not found');
    }
  }
}
