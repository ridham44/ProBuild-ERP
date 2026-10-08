import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BatchListQuery,
  MovementQuery,
  ReconciliationQuery,
  SerialListQuery,
  SessionUser,
  StockBalanceQuery,
  ValuationQuery,
} from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { BusinessRuleError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny, dateRange } from '../../common/list';
import { dec, nonNegative, ZERO } from '../../common/money';
import { paginate } from '../../common/pagination';
import { StockLedgerService } from '../../engines/stock-ledger/stock-ledger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { baseUnitFactor } from './units';

const MODULE = 'inventory.stock';
const OPEN_PO = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] as const;
const MOVEMENT_SORT = ['txnDate', 'createdAt', 'qty'] as const;

/** Raw SQL returns numerics with their column scale ("51.0000"); normalise to the same form Prisma decimals serialise to. */
const n = (value: string): string => new Prisma.Decimal(value).toString();

type BalanceRow = {
  itemId: string; warehouseId: string; sku: string; name: string; baseUnit: string; minStock: string; warehouseCode: string; warehouseName: string;
  available: string; quarantine: string; damaged: string; inTransit: string; totalValue: string; availableValue: string; avgCost: string;
};

/** Reads over the stock ledger and balances. Everything here is derived data; nothing writes. */
@Injectable()
export class StockQueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly stock: StockLedgerService,
  ) {}

  // ---- Balances ----------------------------------------------------------------------------------

  /**
   * One row per item and warehouse. onHand = AVAILABLE stock; quarantine/damaged/inTransit are shown beside it.
   * reserved = approved, un-issued material request quantity; committed = open purchase order quantity (all in base units);
   * available = onHand - reserved. value = value of everything physically held (all statuses).
   * `locations` splits the available quantity by bin using ledger rows (stock without a bin is `unassigned`).
   * The cursor is a keyset over the chosen sort, so paging stays stable while stock moves.
   */
  async balances(user: SessionUser, query: StockBalanceQuery) {
    const scope = this.access.warehouseScope(user, MODULE, 'VIEW');
    if (query.warehouseId && scope !== 'ALL' && !scope.includes(query.warehouseId)) throw new ForbiddenException('You do not have stock permission for this warehouse');

    const sort = query.sort ?? 'sku:asc';
    const orderCols = sort === 'name:asc' ? ['i.name', 'i.sku', 'w.code'] : sort === 'warehouse:asc' ? ['w.code', 'i.sku', 'i.name'] : ['i.sku', 'w.code', 'i.name'];
    const order = Prisma.raw(`${orderCols[0]}, ${orderCols[1]}, sb."itemId", sb."warehouseId"`);

    const conditions: Prisma.Sql[] = [Prisma.sql`sb."companyId" = ${user.companyId}`, Prisma.sql`i."deletedAt" IS NULL`];
    if (scope !== 'ALL') conditions.push(scope.length === 0 ? Prisma.sql`FALSE` : Prisma.sql`sb."warehouseId" IN (${Prisma.join(scope)})`);
    if (query.warehouseId) conditions.push(Prisma.sql`sb."warehouseId" = ${query.warehouseId}`);
    if (query.itemId) conditions.push(Prisma.sql`sb."itemId" = ${query.itemId}`);
    if (query.categoryId) conditions.push(Prisma.sql`i."categoryId" = ${query.categoryId}`);
    if (query.projectId) conditions.push(Prisma.sql`w."projectId" = ${query.projectId}`);
    if (query.search) {
      const needle = query.search.toLowerCase();
      conditions.push(Prisma.sql`(strpos(lower(i.sku), ${needle}) > 0 OR strpos(lower(i.name), ${needle}) > 0 OR strpos(lower(coalesce(i.barcode, '')), ${needle}) > 0 OR strpos(lower(w.code), ${needle}) > 0)`);
    }
    const cursor = this.decodeCursor(query.cursor);
    if (cursor) {
      const sortKeys = sort === 'name:asc' ? [cursor.name, cursor.sku, cursor.whCode] : sort === 'warehouse:asc' ? [cursor.whCode, cursor.sku, cursor.name] : [cursor.sku, cursor.whCode, cursor.name];
      conditions.push(Prisma.sql`(${Prisma.raw(orderCols.join(', '))}, sb."itemId", sb."warehouseId") > (${Prisma.join(sortKeys)}, ${cursor.itemId}, ${cursor.warehouseId})`);
    }
    const having: Prisma.Sql[] = [];
    if (query.hideEmpty) having.push(Prisma.sql`SUM(sb."qtyOnHand") <> 0`);
    if (query.belowMinimum) having.push(Prisma.sql`i."minStock" > 0 AND COALESCE(SUM(sb."qtyOnHand") FILTER (WHERE sb."stockStatus" = 'AVAILABLE'), 0) <= i."minStock"`);

    const rows = await this.prisma.$queryRaw<BalanceRow[]>(Prisma.sql`
      SELECT sb."itemId", sb."warehouseId", i.sku, i.name, i."baseUnit", i."minStock"::text AS "minStock", w.code AS "warehouseCode", w.name AS "warehouseName",
        COALESCE(SUM(sb."qtyOnHand") FILTER (WHERE sb."stockStatus" = 'AVAILABLE'), 0)::text AS available,
        COALESCE(SUM(sb."qtyOnHand") FILTER (WHERE sb."stockStatus" = 'QUARANTINE'), 0)::text AS quarantine,
        COALESCE(SUM(sb."qtyOnHand") FILTER (WHERE sb."stockStatus" = 'DAMAGED'), 0)::text AS damaged,
        COALESCE(SUM(sb."qtyOnHand") FILTER (WHERE sb."stockStatus" = 'IN_TRANSIT'), 0)::text AS "inTransit",
        COALESCE(SUM(sb.value), 0)::text AS "totalValue",
        COALESCE(SUM(sb.value) FILTER (WHERE sb."stockStatus" = 'AVAILABLE'), 0)::text AS "availableValue",
        CASE WHEN COALESCE(SUM(sb."qtyOnHand"), 0) > 0 THEN (SUM(sb.value) / SUM(sb."qtyOnHand"))::numeric(18,4)::text ELSE '0' END AS "avgCost"
      FROM "StockBalance" sb
      JOIN "Item" i ON i.id = sb."itemId"
      JOIN "Warehouse" w ON w.id = sb."warehouseId"
      WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY sb."itemId", sb."warehouseId", i.sku, i.name, i."baseUnit", i."minStock", i."categoryId", w.code, w.name
      ${having.length ? Prisma.sql`HAVING ${Prisma.join(having, ' AND ')}` : Prisma.empty}
      ORDER BY ${order}
      LIMIT ${query.limit + 1}`);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const extras = await this.pageExtras(user.companyId, page);
    const items = page.map((r) => {
      const key = `${r.warehouseId}|${r.itemId}`;
      const onHand = dec(r.available);
      const reserved = extras.reserved.get(key) ?? ZERO;
      return {
        itemId: r.itemId, sku: r.sku, name: r.name, baseUnit: r.baseUnit, warehouseId: r.warehouseId, warehouseCode: r.warehouseCode, warehouseName: r.warehouseName,
        onHand: onHand.toString(), reserved: reserved.toString(), committed: (extras.committed.get(key) ?? ZERO).toString(), available: onHand.minus(reserved).toString(),
        quarantine: n(r.quarantine), damaged: n(r.damaged), inTransit: n(r.inTransit), avgCost: n(r.avgCost), value: n(r.totalValue), availableValue: n(r.availableValue),
        minStock: n(r.minStock), belowMinimum: dec(r.minStock).gt(0) && onHand.lte(dec(r.minStock)),
        locations: extras.locations.get(key) ?? [],
      };
    });
    const last = page[page.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ sku: last.sku, name: last.name, whCode: last.warehouseCode, itemId: last.itemId, warehouseId: last.warehouseId })).toString('base64url') : null,
    };
  }

  private decodeCursor(raw?: string): { sku: string; name: string; whCode: string; itemId: string; warehouseId: string } | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<string, unknown>;
      const { sku, name, whCode, itemId, warehouseId } = parsed;
      if ([sku, name, whCode, itemId, warehouseId].every((v) => typeof v === 'string')) {
        return { sku: sku as string, name: name as string, whCode: whCode as string, itemId: itemId as string, warehouseId: warehouseId as string };
      }
    } catch {
      /* falls through to the error below */
    }
    throw new BusinessRuleError('Invalid cursor');
  }

  private async pageExtras(companyId: string, page: BalanceRow[]) {
    const reserved = new Map<string, Prisma.Decimal>();
    const committed = new Map<string, Prisma.Decimal>();
    const locations = new Map<string, Array<{ locationId: string | null; path: string; qty: string }>>();
    if (page.length === 0) return { reserved, committed, locations };
    const itemIds = [...new Set(page.map((r) => r.itemId))];
    const warehouseIds = [...new Set(page.map((r) => r.warehouseId))];
    const pairs = new Set(page.map((r) => `${r.warehouseId}|${r.itemId}`));

    const [reservedMap, poLines, ledger, items] = await Promise.all([
      this.stock.reservedByBucket(this.prisma, { companyId, itemIds, warehouseIds }),
      this.prisma.purchaseOrderLine.findMany({
        where: { itemId: { in: itemIds }, order: { companyId, deletedAt: null, status: { in: [...OPEN_PO] }, warehouseId: { in: warehouseIds } } },
        select: { itemId: true, qty: true, cancelledQty: true, receivedQty: true, unit: true, order: { select: { warehouseId: true } } },
      }),
      this.prisma.stockLedger.groupBy({
        by: ['warehouseId', 'itemId', 'locationId'],
        where: { companyId, itemId: { in: itemIds }, warehouseId: { in: warehouseIds }, stockStatus: 'AVAILABLE' },
        _sum: { qty: true },
      }),
      this.prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, baseUnit: true, purchaseUnit: true, issueUnit: true, conversionFactor: true, unitConversions: { select: { unit: true, factor: true } } } }),
    ]);
    for (const [k, v] of reservedMap) if (pairs.has(k)) reserved.set(k, v);
    const itemById = new Map(items.map((i) => [i.id, i]));
    for (const l of poLines) {
      const item = itemById.get(l.itemId);
      if (!item) continue;
      const key = `${l.order.warehouseId}|${l.itemId}`;
      if (!pairs.has(key)) continue;
      const remaining = nonNegative(l.qty.minus(l.cancelledQty).minus(l.receivedQty)).mul(baseUnitFactor(item, item.unitConversions, l.unit));
      committed.set(key, (committed.get(key) ?? ZERO).plus(remaining));
    }
    const locIds = [...new Set(ledger.flatMap((g) => (g.locationId ? [g.locationId] : [])))];
    const locRows = locIds.length ? await this.prisma.warehouseLocation.findMany({ where: { id: { in: locIds } }, select: { id: true, fullPath: true } }) : [];
    const pathOf = new Map(locRows.map((l) => [l.id, l.fullPath]));
    for (const g of ledger) {
      const qty = g._sum.qty ?? ZERO;
      const key = `${g.warehouseId}|${g.itemId}`;
      if (!pairs.has(key) || qty.isZero()) continue;
      const list = locations.get(key) ?? [];
      list.push({ locationId: g.locationId, path: g.locationId ? (pathOf.get(g.locationId) ?? 'unknown') : 'unassigned', qty: qty.toString() });
      locations.set(key, list);
    }
    return { reserved, committed, locations };
  }

  // ---- Valuation ---------------------------------------------------------------------------------

  /** Inventory valuation (weighted-average or standard cost, as posted): quantity and value by warehouse, category or item. */
  async valuation(user: SessionUser, query: ValuationQuery) {
    const scope = this.access.warehouseScope(user, MODULE, 'VIEW');
    if (query.warehouseId && scope !== 'ALL' && !scope.includes(query.warehouseId)) throw new ForbiddenException('You do not have stock permission for this warehouse');
    const conditions: Prisma.Sql[] = [Prisma.sql`sb."companyId" = ${user.companyId}`, Prisma.sql`sb."qtyOnHand" <> 0`];
    if (scope !== 'ALL') conditions.push(scope.length === 0 ? Prisma.sql`FALSE` : Prisma.sql`sb."warehouseId" IN (${Prisma.join(scope)})`);
    if (query.warehouseId) conditions.push(Prisma.sql`sb."warehouseId" = ${query.warehouseId}`);
    if (query.categoryId) conditions.push(Prisma.sql`i."categoryId" = ${query.categoryId}`);

    const groups = {
      warehouse: { key: 'sb."warehouseId"', label: 'w.name', sub: 'w.code' },
      category: { key: `COALESCE(i."categoryId", 'none')`, label: `COALESCE(c.name, 'Uncategorised')`, sub: `''` },
      item: { key: 'sb."itemId"', label: 'i.name', sub: 'i.sku' },
    }[query.groupBy];
    const rows = await this.prisma.$queryRaw<Array<{ key: string; label: string; code: string; qty: string; value: string; available: string; quarantine: string; damaged: string }>>(Prisma.sql`
      SELECT ${Prisma.raw(groups.key)} AS key, ${Prisma.raw(groups.label)} AS label, ${Prisma.raw(groups.sub)} AS code,
        SUM(sb."qtyOnHand")::text AS qty, SUM(sb.value)::text AS value,
        COALESCE(SUM(sb.value) FILTER (WHERE sb."stockStatus" = 'AVAILABLE'), 0)::text AS available,
        COALESCE(SUM(sb.value) FILTER (WHERE sb."stockStatus" = 'QUARANTINE'), 0)::text AS quarantine,
        COALESCE(SUM(sb.value) FILTER (WHERE sb."stockStatus" = 'DAMAGED'), 0)::text AS damaged
      FROM "StockBalance" sb
      JOIN "Item" i ON i.id = sb."itemId"
      JOIN "Warehouse" w ON w.id = sb."warehouseId"
      LEFT JOIN "ItemCategory" c ON c.id = i."categoryId"
      WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY 1, 2, 3
      ORDER BY SUM(sb.value) DESC, 1
      LIMIT 500`);
    const total = rows.reduce((s, r) => s.plus(r.value), ZERO);
    return {
      groupBy: query.groupBy,
      method: 'WEIGHTED_AVERAGE_OR_STANDARD',
      totalValue: total.toString(),
      truncated: rows.length === 500,
      rows: rows.map((r) => ({ key: r.key, label: r.label, code: r.code || null, qty: n(r.qty), value: n(r.value), availableValue: n(r.available), quarantineValue: n(r.quarantine), damagedValue: n(r.damaged) })),
    };
  }

  // ---- Movements ---------------------------------------------------------------------------------

  /**
   * Ledger rows, newest first. runningQty / runningValue are the bucket balances (same warehouse, item, batch and status)
   * right after the row posted, as stored by the ledger.
   */
  async movements(user: SessionUser, query: MovementQuery) {
    const scope = this.access.warehouseScope(user, MODULE, 'VIEW');
    if (query.warehouseId && scope !== 'ALL' && !scope.includes(query.warehouseId)) throw new ForbiddenException('You do not have stock permission for this warehouse');
    const where: Prisma.StockLedgerWhereInput = {
      companyId: user.companyId,
      ...(scope === 'ALL' ? {} : { warehouseId: { in: scope } }),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.batchNo ? { batchNo: query.batchNo } : {}),
      ...(query.stockStatus ? { stockStatus: query.stockStatus } : {}),
      ...(query.txnType ? { txnType: query.txnType } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(dateRange(query.from, query.to) ? { txnDate: dateRange(query.from, query.to) } : {}),
      ...(query.search ? { OR: [{ txnNo: { contains: query.search, mode: 'insensitive' } }, { batchNo: { contains: query.search, mode: 'insensitive' } }, { item: { sku: { contains: query.search, mode: 'insensitive' } } }] } : {}),
    };
    const page = await paginate(
      (args) =>
        this.prisma.stockLedger.findMany({
          where,
          orderBy: buildOrderBy(query.sort, MOVEMENT_SORT, [{ txnDate: 'desc' }, { createdAt: 'desc' }, { txnNo: 'desc' }]),
          include: {
            item: { select: { id: true, sku: true, name: true, baseUnit: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            location: { select: { id: true, fullPath: true } },
          },
          ...args,
        }),
      query,
    );
    const [references, users] = await Promise.all([this.references(user.companyId, page.items), this.userNames(user.companyId, page.items.map((r) => r.userId))]);
    return {
      items: page.items.map((r) => ({
        ...r,
        direction: r.qty.gt(0) ? 'IN' : 'OUT',
        reference: references.get(`${r.sourceType}|${r.sourceId}`) ?? { type: r.sourceType, id: r.sourceId, number: null },
        user: users.get(r.userId) ?? null,
      })),
      nextCursor: page.nextCursor,
    };
  }

  private async references(companyId: string, rows: Array<{ sourceType: string; sourceId: string }>) {
    const ids = (type: string) => [...new Set(rows.filter((r) => r.sourceType === type).map((r) => r.sourceId))];
    const pick = { select: { id: true, number: true } };
    const lookups: Array<[string, Promise<Array<{ id: string; number: string }>>]> = [
      ['GOODS_RECEIPT', this.prisma.goodsReceipt.findMany({ where: { id: { in: ids('GOODS_RECEIPT') }, companyId }, ...pick })],
      ['MATERIAL_ISSUE', this.prisma.materialIssue.findMany({ where: { id: { in: ids('MATERIAL_ISSUE') }, companyId }, ...pick })],
      ['MATERIAL_RETURN', this.prisma.materialReturn.findMany({ where: { id: { in: ids('MATERIAL_RETURN') }, companyId }, ...pick })],
      ['WAREHOUSE_TRANSFER', this.prisma.warehouseTransfer.findMany({ where: { id: { in: ids('WAREHOUSE_TRANSFER') }, companyId }, ...pick })],
      ['STOCK_ADJUSTMENT', this.prisma.stockAdjustment.findMany({ where: { id: { in: ids('STOCK_ADJUSTMENT') }, companyId }, ...pick })],
      ['STOCK_COUNT', this.prisma.stockCount.findMany({ where: { id: { in: ids('STOCK_COUNT') }, companyId }, ...pick })],
    ];
    const out = new Map<string, { type: string; id: string; number: string | null }>();
    for (const [type, promise] of lookups) {
      for (const d of await promise) out.set(`${type}|${d.id}`, { type, id: d.id, number: d.number });
    }
    return out;
  }

  private async userNames(companyId: string, userIds: string[]) {
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(userIds)] }, companyId }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u]));
  }

  // ---- Batches and serials -----------------------------------------------------------------------

  async batches(user: SessionUser, query: BatchListQuery) {
    const scope = this.access.warehouseScope(user, MODULE, 'VIEW');
    if (query.warehouseId && scope !== 'ALL' && !scope.includes(query.warehouseId)) throw new ForbiddenException('You do not have stock permission for this warehouse');
    const joinConds: Prisma.Sql[] = [Prisma.sql`sb."itemId" = br."itemId"`, Prisma.sql`sb."batchNo" = br."batchNo"`, Prisma.sql`sb."companyId" = br."companyId"`];
    if (scope !== 'ALL') joinConds.push(scope.length === 0 ? Prisma.sql`FALSE` : Prisma.sql`sb."warehouseId" IN (${Prisma.join(scope)})`);
    if (query.warehouseId) joinConds.push(Prisma.sql`sb."warehouseId" = ${query.warehouseId}`);
    const where: Prisma.Sql[] = [Prisma.sql`br."companyId" = ${user.companyId}`];
    if (query.itemId) where.push(Prisma.sql`br."itemId" = ${query.itemId}`);
    if (query.expiringBefore) where.push(Prisma.sql`br."expiryDate" IS NOT NULL AND br."expiryDate" <= ${query.expiringBefore}`);
    if (query.search) {
      const needle = query.search.toLowerCase();
      where.push(Prisma.sql`(strpos(lower(br."batchNo"), ${needle}) > 0 OR strpos(lower(i.sku), ${needle}) > 0 OR strpos(lower(i.name), ${needle}) > 0)`);
    }
    if (query.cursor) where.push(Prisma.sql`(br."createdAt", br.id) < (SELECT "createdAt", id FROM "BatchRecord" WHERE id = ${query.cursor} AND "companyId" = ${user.companyId})`);
    const having: Prisma.Sql[] = [];
    if (query.hideEmpty) having.push(Prisma.sql`COALESCE(SUM(sb."qtyOnHand"), 0) > 0`);
    if (query.warehouseId) having.push(Prisma.sql`COUNT(sb.id) > 0`);
    const rows = await this.prisma.$queryRaw<Array<{ id: string; itemId: string; batchNo: string; lotNo: string | null; expiryDate: Date | null; supplierId: string | null; sku: string; name: string; baseUnit: string; onHand: string; available: string; quarantine: string; value: string }>>(Prisma.sql`
      SELECT br.id, br."itemId", br."batchNo", br."lotNo", br."expiryDate", br."supplierId", i.sku, i.name, i."baseUnit",
        COALESCE(SUM(sb."qtyOnHand"), 0)::text AS "onHand",
        COALESCE(SUM(sb."qtyOnHand") FILTER (WHERE sb."stockStatus" = 'AVAILABLE'), 0)::text AS available,
        COALESCE(SUM(sb."qtyOnHand") FILTER (WHERE sb."stockStatus" = 'QUARANTINE'), 0)::text AS quarantine,
        COALESCE(SUM(sb.value), 0)::text AS value
      FROM "BatchRecord" br
      JOIN "Item" i ON i.id = br."itemId"
      LEFT JOIN "StockBalance" sb ON ${Prisma.join(joinConds, ' AND ')}
      WHERE ${Prisma.join(where, ' AND ')}
      GROUP BY br.id, i.sku, i.name, i."baseUnit"
      ${having.length ? Prisma.sql`HAVING ${Prisma.join(having, ' AND ')}` : Prisma.empty}
      ORDER BY br."createdAt" DESC, br.id DESC
      LIMIT ${query.limit + 1}`);
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];
    const now = Date.now();
    return {
      items: items.map((r) => ({ ...r, onHand: n(r.onHand), available: n(r.available), quarantine: n(r.quarantine), value: n(r.value), expired: r.expiryDate ? r.expiryDate.getTime() <= now : false })),
      nextCursor: hasMore && last ? last.id : null,
    };
  }

  serials(user: SessionUser, query: SerialListQuery) {
    const scope = this.access.warehouseScope(user, MODULE, 'VIEW');
    const where: Prisma.SerialUnitWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...(scope === 'ALL' ? {} : { OR: [{ warehouseId: { in: scope } }, { warehouseId: null }] }),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { AND: [containsAny(query.search, ['serialNo'])] } : {}),
    };
    return paginate(
      (args) =>
        this.prisma.serialUnit.findMany({
          where,
          orderBy: buildOrderBy(query.sort, ['serialNo', 'createdAt', 'status'] as const, [{ serialNo: 'asc' }]),
          include: {
            item: { select: { id: true, sku: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            project: { select: { id: true, code: true, name: true } },
          },
          ...args,
        }),
      query,
    );
  }

  // ---- Reconciliation ----------------------------------------------------------------------------

  /**
   * Administrator-only audit: compares every StockBalance bucket with the sum of its StockLedger rows (quantity and value),
   * and lists buckets that exist on only one side or hold negative stock. An empty `differences` list means the cache is clean.
   */
  async reconcile(user: SessionUser, query: ReconciliationQuery) {
    if (!user.isSuperAdmin && !user.roles.includes('Company Admin')) throw new ForbiddenException('Stock reconciliation is restricted to administrators');
    const filters: Prisma.Sql[] = [Prisma.sql`"companyId" = ${user.companyId}`];
    if (query.warehouseId) filters.push(Prisma.sql`"warehouseId" = ${query.warehouseId}`);
    if (query.itemId) filters.push(Prisma.sql`"itemId" = ${query.itemId}`);
    const where = Prisma.join(filters, ' AND ');
    const rows = await this.prisma.$queryRaw<Array<{ warehouseId: string; itemId: string; batchNo: string; stockStatus: string; ledgerQty: string; balanceQty: string; ledgerValue: string; balanceValue: string; sku: string; warehouseCode: string }>>(Prisma.sql`
      WITH l AS (
        SELECT "warehouseId", "itemId", "batchNo", "stockStatus", SUM(qty) AS q, SUM(value) AS v FROM "StockLedger" WHERE ${where} GROUP BY 1, 2, 3, 4
      ), b AS (
        SELECT "warehouseId", "itemId", "batchNo", "stockStatus", "qtyOnHand" AS q, value AS v FROM "StockBalance" WHERE ${where}
      )
      SELECT COALESCE(l."warehouseId", b."warehouseId") AS "warehouseId", COALESCE(l."itemId", b."itemId") AS "itemId",
        COALESCE(l."batchNo", b."batchNo") AS "batchNo", COALESCE(l."stockStatus", b."stockStatus")::text AS "stockStatus",
        COALESCE(l.q, 0)::text AS "ledgerQty", COALESCE(b.q, 0)::text AS "balanceQty", COALESCE(l.v, 0)::text AS "ledgerValue", COALESCE(b.v, 0)::text AS "balanceValue",
        i.sku, w.code AS "warehouseCode"
      FROM l FULL OUTER JOIN b ON l."warehouseId" = b."warehouseId" AND l."itemId" = b."itemId" AND l."batchNo" = b."batchNo" AND l."stockStatus" = b."stockStatus"
      JOIN "Item" i ON i.id = COALESCE(l."itemId", b."itemId")
      JOIN "Warehouse" w ON w.id = COALESCE(l."warehouseId", b."warehouseId")
      WHERE COALESCE(l.q, 0) <> COALESCE(b.q, 0) OR COALESCE(l.v, 0) <> COALESCE(b.v, 0) OR COALESCE(b.q, 0) < 0
      ORDER BY i.sku, w.code
      LIMIT 500`);
    const checked = await this.prisma.stockBalance.count({ where: { companyId: user.companyId, ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}), ...(query.itemId ? { itemId: query.itemId } : {}) } });
    const differences = rows.map((r) => ({
      ...r,
      ledgerQty: n(r.ledgerQty), balanceQty: n(r.balanceQty), ledgerValue: n(r.ledgerValue), balanceValue: n(r.balanceValue),
      qtyDifference: dec(r.balanceQty).minus(r.ledgerQty).toString(),
      valueDifference: dec(r.balanceValue).minus(r.ledgerValue).toString(),
      negativeStock: dec(r.balanceQty).lt(0),
    }));
    return { clean: differences.length === 0, bucketsChecked: checked, differences, checkedAt: new Date().toISOString() };
  }
}
