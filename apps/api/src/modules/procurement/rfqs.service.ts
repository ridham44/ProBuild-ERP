import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RFQ_SORT_FIELDS } from '@probuild/shared';
import type {
  AwardRfqInput,
  CreateQuotationInput,
  CreateRfqInput,
  QuotationLineInput,
  QuotationListQuery,
  RfqListQuery,
  SessionUser,
  UpdateQuotationInput,
  UpdateRfqInput,
} from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny } from '../../common/list';
import { computeLine, dec, nonNegative, sumLines, variancePct } from '../../common/money';
import type { LineMoney } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ProjectAccessService } from '../../common/project-access.service';
import { ActivityService } from '../../engines/activity/activity.service';
import { AuditService } from '../../engines/audit/audit.service';
import { NumberingService } from '../../engines/numbering/numbering.service';
import { Db, PrismaService } from '../../prisma/prisma.service';

const MODULE = 'procurement.rfq';
const DOC = 'RFQ';
const DAY_MS = 86_400_000;

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

/**
 * RFQ workflow: DRAFT -> SENT -> QUOTED (first quotation) -> AWARDED (award record) -> CLOSED
 * DRAFT | SENT | QUOTED -> CANCELLED, SENT | QUOTED -> CLOSED (closed without an award).
 * Quotations can be entered and revised only while the RFQ is SENT or QUOTED.
 */
@Injectable()
export class RfqsService extends AuditedService {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly projectAccess: ProjectAccessService,
    private readonly numbering: NumberingService,
    private readonly activity: ActivityService,
  ) {
    super(prisma, audit);
  }

  // ---- RFQ queries -------------------------------------------------------------------------------

  list(user: SessionUser, query: RfqListQuery) {
    const where: Prisma.RfqWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...this.access.projectWhere(user, MODULE, 'VIEW'),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.requisitionId ? { requisitionId: query.requisitionId } : {}),
      ...(query.supplierId ? { suppliers: { some: { supplierId: query.supplierId } } } : {}),
      ...containsAny(query.search, ['number', 'remarks']),
    };
    return paginate(
      (args) =>
        this.prisma.rfq.findMany({
          where,
          orderBy: buildOrderBy(query.sort, RFQ_SORT_FIELDS, [{ createdAt: 'desc' }]),
          include: {
            project: { select: { id: true, code: true, name: true } },
            requisition: { select: { id: true, number: true } },
            _count: { select: { lines: true, suppliers: true, quotations: true } },
          },
          ...args,
        }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    const rfq = await this.load(user, id, 'VIEW');
    const [lines, suppliers, quotations, award, project, requisition] = await Promise.all([
      this.prisma.rfqLine.findMany({ where: { rfqId: id }, orderBy: { lineNo: 'asc' }, include: { item: { select: { id: true, sku: true, name: true, baseUnit: true } } } }),
      this.prisma.rfqSupplier.findMany({ where: { rfqId: id }, orderBy: { createdAt: 'asc' }, include: { supplier: { select: { id: true, code: true, name: true, accredited: true } } } }),
      this.prisma.supplierQuotation.findMany({
        where: { rfqId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, supplierId: true, quoteNo: true, quoteDate: true, validUntil: true, status: true, totalAmount: true, currency: true },
      }),
      this.prisma.rfqAward.findUnique({ where: { rfqId: id } }),
      this.prisma.project.findUniqueOrThrow({ where: { id: rfq.projectId }, select: { id: true, code: true, name: true } }),
      rfq.requisitionId ? this.prisma.purchaseRequisition.findUnique({ where: { id: rfq.requisitionId }, select: { id: true, number: true, status: true } }) : Promise.resolve(null),
    ]);
    return { ...rfq, project, requisition, lines, suppliers, quotations, award };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.load(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: DOC, entityId: id });
  }

  // ---- RFQ commands ------------------------------------------------------------------------------

  async create(user: SessionUser, input: CreateRfqInput) {
    const pr = await this.prisma.purchaseRequisition.findFirst({ where: { id: input.requisitionId, companyId: user.companyId, deletedAt: null } });
    if (!pr) throw new BusinessRuleError('Requisition not found in this company', [{ path: 'requisitionId', message: 'Requisition not found in this company' }]);
    const project = await this.projectAccess.load(user, pr.projectId, MODULE, 'CREATE');
    this.projectAccess.assertActive(project);
    if (pr.status !== 'APPROVED' && pr.status !== 'PARTIALLY_ORDERED') {
      throw new BusinessRuleError(`An RFQ can only be raised from an approved requisition (this one is ${pr.status})`);
    }
    this.assertDueDate(input.dueDate);
    const lines = await this.resolveLines(this.prisma, pr.id, input.lines);
    await this.assertSuppliers(this.prisma, user.companyId, input.supplierIds);

    const id = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, user.companyId, DOC);
      const rfq = await tx.rfq.create({
        data: {
          companyId: user.companyId, number, requisitionId: pr.id, projectId: pr.projectId, dueDate: input.dueDate,
          requiredDate: input.requiredDate ?? null, deliveryRequirements: input.deliveryRequirements ?? null,
          deliveryLocation: input.deliveryLocation ?? null, remarks: input.remarks ?? null, createdById: user.id,
          lines: { create: lines },
          suppliers: { create: input.supplierIds.map((supplierId) => ({ supplierId })) },
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: rfq.id, action: 'CREATE',
        after: { number, requisitionId: pr.id, lines: lines.length, suppliers: input.supplierIds.length },
      });
      return rfq.id;
    });
    return this.get(user, id);
  }

  async update(user: SessionUser, id: string, input: UpdateRfqInput) {
    const preview = await this.load(user, id, 'EDIT');
    if (input.dueDate) this.assertDueDate(input.dueDate);
    const lines = input.lines && preview.requisitionId ? await this.resolveLines(this.prisma, preview.requisitionId, input.lines) : null;
    if (input.supplierIds) await this.assertSuppliers(this.prisma, user.companyId, input.supplierIds);

    await this.prisma.$transaction(async (tx) => {
      const before = await this.lock(tx, id);
      if (before.status !== 'DRAFT') throw new BusinessRuleError(`A ${before.status} RFQ cannot be edited; only drafts can`);
      if (lines) {
        await tx.rfqLine.deleteMany({ where: { rfqId: id } });
        await tx.rfqLine.createMany({ data: lines.map((l) => ({ ...l, rfqId: id })) });
      }
      if (input.supplierIds) {
        await tx.rfqSupplier.deleteMany({ where: { rfqId: id, supplierId: { notIn: input.supplierIds } } });
        const existing = await tx.rfqSupplier.findMany({ where: { rfqId: id }, select: { supplierId: true } });
        const have = new Set(existing.map((e) => e.supplierId));
        await tx.rfqSupplier.createMany({ data: input.supplierIds.filter((s) => !have.has(s)).map((supplierId) => ({ rfqId: id, supplierId })) });
      }
      await tx.rfq.update({
        where: { id },
        data: {
          dueDate: input.dueDate, requiredDate: input.requiredDate, deliveryRequirements: input.deliveryRequirements,
          deliveryLocation: input.deliveryLocation, remarks: input.remarks,
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'UPDATE',
        before: { dueDate: before.dueDate, remarks: before.remarks },
        after: { dueDate: input.dueDate, remarks: input.remarks, lines: lines?.length, suppliers: input.supplierIds?.length },
      });
    });
    return this.get(user, id);
  }

  async send(user: SessionUser, id: string) {
    await this.load(user, id, 'POST');
    await this.prisma.$transaction(async (tx) => {
      const rfq = await this.lock(tx, id);
      if (rfq.status !== 'DRAFT') throw new BusinessRuleError(`A ${rfq.status} RFQ cannot be sent; only drafts can`);
      if (rfq.dueDate) this.assertDueDate(rfq.dueDate);
      const [lines, suppliers] = await Promise.all([tx.rfqLine.count({ where: { rfqId: id } }), tx.rfqSupplier.count({ where: { rfqId: id } })]);
      if (lines === 0 || suppliers === 0) throw new BusinessRuleError('An RFQ needs at least one line and one supplier before it is sent');
      const now = new Date();
      await tx.rfqSupplier.updateMany({ where: { rfqId: id }, data: { status: 'SENT', sentAt: now } });
      await tx.rfq.update({ where: { id }, data: { status: 'SENT', sentAt: now } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'SEND',
        before: { status: 'DRAFT' }, after: { status: 'SENT', suppliers },
      });
    });
    return this.get(user, id);
  }

  async cancel(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CANCEL');
    await this.prisma.$transaction(async (tx) => {
      const rfq = await this.lock(tx, id);
      if (!['DRAFT', 'SENT', 'QUOTED'].includes(rfq.status)) throw new BusinessRuleError(`A ${rfq.status} RFQ cannot be cancelled`);
      await tx.rfq.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CANCEL',
        before: { status: rfq.status }, after: { status: 'CANCELLED' }, reason,
      });
    });
    return this.get(user, id);
  }

  async close(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CLOSE');
    await this.prisma.$transaction(async (tx) => {
      const rfq = await this.lock(tx, id);
      if (!['SENT', 'QUOTED', 'AWARDED'].includes(rfq.status)) throw new BusinessRuleError(`A ${rfq.status} RFQ cannot be closed`);
      await tx.rfq.update({ where: { id }, data: { status: 'CLOSED', closedAt: rfq.closedAt ?? new Date() } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CLOSE',
        before: { status: rfq.status }, after: { status: 'CLOSED' }, reason,
      });
    });
    return this.get(user, id);
  }

  // ---- Quotations --------------------------------------------------------------------------------

  listQuotations(user: SessionUser, query: QuotationListQuery) {
    const scope = this.access.projectWhere(user, MODULE, 'VIEW');
    const where: Prisma.SupplierQuotationWhereInput = {
      companyId: user.companyId,
      rfq: { deletedAt: null, ...scope },
      ...(query.rfqId ? { rfqId: query.rfqId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...containsAny(query.search, ['quoteNo']),
    };
    return paginate(
      (args) =>
        this.prisma.supplierQuotation.findMany({
          where,
          orderBy: [{ quoteDate: 'desc' }, { id: 'asc' }],
          include: { supplier: { select: { id: true, code: true, name: true } }, rfq: { select: { id: true, number: true } } },
          ...args,
        }),
      query,
    );
  }

  async getQuotation(user: SessionUser, id: string) {
    const quotation = await this.prisma.supplierQuotation.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        rfq: { select: { id: true, number: true, status: true, projectId: true } },
        lines: { orderBy: [{ rfqLine: { lineNo: 'asc' } }, { id: 'asc' }], include: { item: { select: { id: true, sku: true, name: true } }, rfqLine: { select: { id: true, lineNo: true, qty: true, unit: true } } } },
      },
    });
    if (!quotation) throw new NotFoundError('Quotation', id);
    this.access.assertCan(user, MODULE, 'VIEW', { projectId: quotation.rfq.projectId });
    return quotation;
  }

  async createQuotation(user: SessionUser, rfqId: string, input: CreateQuotationInput) {
    await this.load(user, rfqId, 'CREATE');
    const id = await this.prisma.$transaction(async (tx) => {
      const rfq = await this.lock(tx, rfqId);
      this.assertAcceptsQuotations(rfq.status);
      const invite = await tx.rfqSupplier.findUnique({ where: { rfqId_supplierId: { rfqId, supplierId: input.supplierId } } });
      if (!invite) throw new BusinessRuleError('This supplier was not invited to the RFQ', [{ path: 'supplierId', message: 'Supplier was not invited to this RFQ' }]);
      const existing = await tx.supplierQuotation.findUnique({ where: { rfqId_supplierId: { rfqId, supplierId: input.supplierId } } });
      if (existing) throw new ConflictError('This supplier already has a quotation on the RFQ; revise it instead');

      const priced = await this.priceLines(tx, rfqId, input.lines);
      const money = sumLines(priced.map((p) => p.money), input.freight ?? 0);
      const created = await tx.supplierQuotation.create({
        data: {
          companyId: user.companyId, rfqId, supplierId: input.supplierId, quoteNo: input.quoteNo ?? null, quoteDate: input.quoteDate,
          validUntil: input.validUntil ?? null, deliveryDays: input.deliveryDays ?? null, paymentTerms: input.paymentTerms ?? null,
          warranty: input.warranty ?? null, currency: input.currency ?? 'PHP', createdById: user.id,
          subtotal: money.subtotal, discountAmount: money.discount, freight: money.freight, taxAmount: money.tax, totalAmount: money.total,
          lines: { create: priced.map((p) => p.data) },
        },
      });
      await tx.rfqSupplier.update({ where: { id: invite.id }, data: { status: 'QUOTED', respondedAt: new Date() } });
      if (rfq.status === 'SENT') await tx.rfq.update({ where: { id: rfqId }, data: { status: 'QUOTED' } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: rfqId, action: 'QUOTATION_RECEIVED',
        after: { quotationId: created.id, supplierId: input.supplierId, total: created.totalAmount },
      });
      return created.id;
    });
    return this.getQuotation(user, id);
  }

  async updateQuotation(user: SessionUser, quotationId: string, input: UpdateQuotationInput) {
    const preview = await this.getQuotation(user, quotationId);
    this.access.assertCan(user, MODULE, 'EDIT', { projectId: preview.rfq.projectId });
    await this.prisma.$transaction(async (tx) => {
      const rfq = await this.lock(tx, preview.rfqId);
      this.assertAcceptsQuotations(rfq.status);
      const current = await tx.supplierQuotation.findUniqueOrThrow({ where: { id: quotationId } });
      if (current.status !== 'SUBMITTED') throw new BusinessRuleError(`A ${current.status} quotation cannot be revised`);
      const priced = await this.priceLines(tx, preview.rfqId, input.lines);
      const money = sumLines(priced.map((p) => p.money), input.freight ?? 0);
      await tx.supplierQuotationLine.deleteMany({ where: { quotationId } });
      const after = await tx.supplierQuotation.update({
        where: { id: quotationId },
        data: {
          quoteNo: input.quoteNo ?? null, quoteDate: input.quoteDate, validUntil: input.validUntil ?? null, deliveryDays: input.deliveryDays ?? null,
          paymentTerms: input.paymentTerms ?? null, warranty: input.warranty ?? null, currency: input.currency ?? 'PHP',
          subtotal: money.subtotal, discountAmount: money.discount, freight: money.freight, taxAmount: money.tax, totalAmount: money.total,
          lines: { create: priced.map((p) => p.data) },
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: preview.rfqId, action: 'QUOTATION_REVISED',
        before: { quotationId, total: current.totalAmount }, after: { quotationId, total: after.totalAmount },
      });
    });
    return this.getQuotation(user, quotationId);
  }

  // ---- Comparison and award ----------------------------------------------------------------------

  /**
   * Matrix of RFQ lines x quoted suppliers. All price math is Decimal. For each line:
   *  - lowest price: the lowest net unit price (unit price less line discount, before tax)
   *  - fastest delivery: earliest delivery date (line delivery date, else quote date + header lead days)
   *  - preferred: the supplier on the item's master record
   *  - variance: how far an offer is above the lowest, as a percentage (null when no baseline)
   */
  async comparison(user: SessionUser, rfqId: string) {
    const rfq = await this.load(user, rfqId, 'VIEW');
    const [lines, quotations, award] = await Promise.all([
      this.prisma.rfqLine.findMany({
        where: { rfqId },
        orderBy: { lineNo: 'asc' },
        include: { item: { select: { id: true, sku: true, name: true, preferredSupplierId: true } } },
      }),
      this.prisma.supplierQuotation.findMany({
        where: { rfqId },
        orderBy: { createdAt: 'asc' },
        include: { supplier: { select: { id: true, code: true, name: true } }, lines: true },
      }),
      this.prisma.rfqAward.findUnique({ where: { rfqId } }),
    ]);

    const effectiveDelivery = (q: (typeof quotations)[number], deliveryDate: Date | null): Date | null =>
      deliveryDate ?? (q.deliveryDays === null ? null : addDays(q.quoteDate, q.deliveryDays));

    const matrixLines = lines.map((line) => {
      const offers = quotations.flatMap((q) => {
        const ql = q.lines.find((l) => l.rfqLineId === line.id);
        if (!ql) return [];
        const netUnitPrice = ql.unitPrice.mul(dec(100).minus(ql.discountPct)).div(100);
        return [{ q, ql, netUnitPrice, delivery: effectiveDelivery(q, ql.deliveryDate) }];
      });
      const lowest = offers.length ? offers.reduce((m, o) => (o.netUnitPrice.lt(m) ? o.netUnitPrice : m), offers[0]!.netUnitPrice) : null;
      const dated = offers.filter((o) => o.delivery !== null);
      const fastest = dated.length ? dated.reduce((m, o) => (o.delivery!.getTime() < m ? o.delivery!.getTime() : m), dated[0]!.delivery!.getTime()) : null;
      return {
        rfqLineId: line.id,
        lineNo: line.lineNo,
        item: { id: line.item.id, sku: line.item.sku, name: line.item.name },
        description: line.description,
        qty: line.qty,
        unit: line.unit,
        requiredDate: line.requiredDate,
        lowestNetUnitPrice: lowest,
        fastestDeliveryDate: fastest === null ? null : new Date(fastest),
        offers: offers.map((o) => ({
          supplierId: o.q.supplierId,
          quotationId: o.q.id,
          qty: o.ql.qty,
          unitPrice: o.ql.unitPrice,
          discountPct: o.ql.discountPct,
          taxPct: o.ql.taxPct,
          netUnitPrice: o.netUnitPrice,
          lineTotal: o.ql.lineTotal,
          taxAmount: o.ql.taxAmount,
          deliveryDate: o.delivery,
          brand: o.ql.brand,
          specification: o.ql.specification,
          isLowestPrice: lowest !== null && o.netUnitPrice.eq(lowest),
          isFastestDelivery: fastest !== null && o.delivery !== null && o.delivery.getTime() === fastest,
          isPreferredSupplier: line.item.preferredSupplierId === o.q.supplierId,
          isShortQuote: o.ql.qty.lt(line.qty),
          varianceFromLowestPct: lowest === null ? null : variancePct(o.netUnitPrice, lowest),
          varianceFromLowestAmount: lowest === null ? null : o.netUnitPrice.minus(lowest),
        })),
      };
    });

    const today = new Date();
    const complete = quotations.map((q) => q.lines.length === lines.length && q.lines.every((l) => l.qty.gte(lines.find((x) => x.id === l.rfqLineId)?.qty ?? 0)));
    const completeTotals = quotations.filter((_, i) => complete[i]).map((q) => q.totalAmount);
    const lowestTotal = completeTotals.length ? completeTotals.reduce((m, t) => (t.lt(m) ? t : m), completeTotals[0]!) : null;

    return {
      rfqId,
      number: rfq.number,
      status: rfq.status,
      awardedQuotationId: award?.quotationId ?? null,
      suppliers: quotations.map((q, i) => ({
        supplierId: q.supplierId,
        code: q.supplier.code,
        name: q.supplier.name,
        quotationId: q.id,
        quoteNo: q.quoteNo,
        quoteDate: q.quoteDate,
        validUntil: q.validUntil,
        isExpired: q.validUntil !== null && q.validUntil.getTime() < today.getTime() - DAY_MS,
        deliveryDays: q.deliveryDays,
        paymentTerms: q.paymentTerms,
        currency: q.currency,
        subtotal: q.subtotal,
        discountAmount: q.discountAmount,
        freight: q.freight,
        taxAmount: q.taxAmount,
        totalAmount: q.totalAmount,
        quotedLines: q.lines.length,
        coversAllLines: complete[i] ?? false,
        isLowestTotal: (complete[i] ?? false) && lowestTotal !== null && q.totalAmount.eq(lowestTotal),
        varianceFromLowestTotalPct: (complete[i] ?? false) && lowestTotal !== null ? variancePct(q.totalAmount, lowestTotal) : null,
        status: q.status,
      })),
      lines: matrixLines,
    };
  }

  /** Awards the whole RFQ to one quotation: writes the award record and closes bidding. */
  async award(user: SessionUser, rfqId: string, input: AwardRfqInput) {
    await this.load(user, rfqId, 'APPROVE');
    await this.prisma.$transaction(async (tx) => {
      const rfq = await this.lock(tx, rfqId);
      if (!['SENT', 'QUOTED'].includes(rfq.status)) throw new BusinessRuleError(`A ${rfq.status} RFQ cannot be awarded`);
      const quotation = await tx.supplierQuotation.findFirst({ where: { id: input.quotationId, rfqId, companyId: user.companyId } });
      if (!quotation) throw new BusinessRuleError('Quotation does not belong to this RFQ', [{ path: 'quotationId', message: 'Quotation does not belong to this RFQ' }]);
      if (quotation.status !== 'SUBMITTED') throw new BusinessRuleError(`A ${quotation.status} quotation cannot be awarded`);
      if (quotation.validUntil && quotation.validUntil.getTime() < Date.now() - DAY_MS) {
        throw new BusinessRuleError('This quotation has expired; ask the supplier to revise its validity first');
      }
      const now = new Date();
      await tx.rfqAward.create({
        data: {
          companyId: user.companyId, rfqId, quotationId: quotation.id, supplierId: quotation.supplierId, awardedById: user.id,
          awardedAt: now, reason: input.reason ?? null, totalAmount: quotation.totalAmount,
        },
      });
      await tx.supplierQuotation.update({ where: { id: quotation.id }, data: { status: 'AWARDED' } });
      await tx.supplierQuotation.updateMany({ where: { rfqId, id: { not: quotation.id } }, data: { status: 'NOT_AWARDED' } });
      await tx.rfq.update({ where: { id: rfqId }, data: { status: 'AWARDED', awardedQuotationId: quotation.id, awardedAt: now, closedAt: now } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: rfqId, action: 'AWARD',
        before: { status: rfq.status }, after: { status: 'AWARDED', quotationId: quotation.id, supplierId: quotation.supplierId, total: quotation.totalAmount },
        reason: input.reason,
      });
    });
    return this.get(user, rfqId);
  }

  // ---- helpers -----------------------------------------------------------------------------------

  private assertAcceptsQuotations(status: string): void {
    if (status !== 'SENT' && status !== 'QUOTED') {
      throw new BusinessRuleError(`Quotations can only be entered while the RFQ is SENT or QUOTED (this one is ${status})`);
    }
  }

  private assertDueDate(dueDate: Date): void {
    if (dueDate.getTime() < Date.now() - DAY_MS) {
      throw new BusinessRuleError('The RFQ due date is in the past', [{ path: 'dueDate', message: 'Due date cannot be in the past' }]);
    }
  }

  private async assertSuppliers(db: Db, companyId: string, supplierIds: string[]): Promise<void> {
    const found = await db.supplier.findMany({ where: { id: { in: supplierIds }, companyId, deletedAt: null, active: true }, select: { id: true } });
    const ok = new Set(found.map((s) => s.id));
    const issues = supplierIds.flatMap((id, i) => (ok.has(id) ? [] : [{ path: `supplierIds.${i}`, message: 'Supplier not found, or inactive, in this company' }]));
    if (issues.length > 0) throw new BusinessRuleError('One or more suppliers cannot be invited', issues);
  }

  /** Validates RFQ lines against the requisition and defaults each quantity to what is still unordered. */
  private async resolveLines(db: Db, requisitionId: string, input: Array<{ requisitionLineId: string; qty?: string }>) {
    const prLines = await db.purchaseRequisitionLine.findMany({
      where: { id: { in: input.map((l) => l.requisitionLineId) }, requisitionId },
      include: { item: { select: { name: true } } },
    });
    const byId = new Map(prLines.map((l) => [l.id, l]));
    const issues: Array<{ path: string; message: string }> = [];
    const out = input.flatMap((line, i) => {
      const pl = byId.get(line.requisitionLineId);
      if (!pl) {
        issues.push({ path: `lines.${i}.requisitionLineId`, message: 'Line does not belong to the requisition' });
        return [];
      }
      const remaining = nonNegative(pl.qty.minus(pl.orderedQty));
      const qty = line.qty === undefined ? remaining : dec(line.qty);
      if (remaining.lte(0)) issues.push({ path: `lines.${i}.requisitionLineId`, message: 'This line has already been fully ordered' });
      else if (qty.gt(remaining)) issues.push({ path: `lines.${i}.qty`, message: `Exceeds the remaining requisition quantity (${remaining.toString()})` });
      return [{
        requisitionLineId: pl.id, lineNo: pl.lineNo, itemId: pl.itemId, description: pl.description ?? pl.item.name,
        qty, unit: pl.unit, requiredDate: pl.requiredDate,
      }];
    });
    if (issues.length > 0) throw new BusinessRuleError('One or more RFQ lines are invalid', issues);
    return out;
  }

  /** Prices quotation lines against the RFQ's lines (a supplier may quote less than requested, never more). */
  private async priceLines(db: Db, rfqId: string, input: QuotationLineInput[]) {
    const rfqLines = await db.rfqLine.findMany({ where: { rfqId } });
    const byId = new Map(rfqLines.map((l) => [l.id, l]));
    const issues: Array<{ path: string; message: string }> = [];
    const priced = input.flatMap((line, i) => {
      const rl = byId.get(line.rfqLineId);
      if (!rl) {
        issues.push({ path: `lines.${i}.rfqLineId`, message: 'Line does not belong to this RFQ' });
        return [];
      }
      const qty = line.qty === undefined ? rl.qty : dec(line.qty);
      if (qty.gt(rl.qty)) issues.push({ path: `lines.${i}.qty`, message: `A supplier cannot quote more than the RFQ quantity (${rl.qty.toString()})` });
      const money: LineMoney = computeLine({ qty, unitPrice: line.unitPrice, discountPct: line.discountPct, taxPct: line.taxPct });
      const data: Prisma.SupplierQuotationLineUncheckedCreateWithoutQuotationInput = {
        rfqLineId: rl.id, itemId: rl.itemId, qty, unitPrice: line.unitPrice,
        discountPct: line.discountPct ?? '0', discountAmount: money.discount, taxPct: line.taxPct ?? '0', taxAmount: money.tax, lineTotal: money.net,
        deliveryDate: line.deliveryDate ?? null, brand: line.brand ?? null, specification: line.specification ?? null, remarks: line.remarks ?? null,
      };
      return [{ data, money }];
    });
    if (issues.length > 0) throw new BusinessRuleError('One or more quotation lines are invalid', issues);
    return priced;
  }

  private async load(user: SessionUser, id: string, action: 'VIEW' | 'CREATE' | 'EDIT' | 'POST' | 'CANCEL' | 'CLOSE' | 'APPROVE') {
    const rfq = await this.prisma.rfq.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!rfq) throw new NotFoundError('RFQ', id);
    this.access.assertCan(user, MODULE, action, { projectId: rfq.projectId });
    return rfq;
  }

  private async lock(tx: Db, id: string) {
    await tx.$queryRaw`SELECT id FROM "Rfq" WHERE id = ${id} FOR UPDATE`;
    return tx.rfq.findUniqueOrThrow({ where: { id } });
  }
}
