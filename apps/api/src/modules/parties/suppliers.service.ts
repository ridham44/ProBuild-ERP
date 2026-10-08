import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SUPPLIER_SORT_FIELDS } from '@probuild/shared';
import type {
  CreateContactInput,
  CreateSupplierEvaluationInput,
  CreateSupplierInput,
  PaginationQuery,
  SessionUser,
  SetAccreditationInput,
  SupplierHistoryQuery,
  SupplierListQuery,
  UpdateContactInput,
  UpdateSupplierInput,
} from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny } from '../../common/list';
import { dec, ZERO } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ActivityService } from '../../engines/activity/activity.service';
import { AuditService } from '../../engines/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

const OPEN_PO = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] as const;
const COMMITTED_PO = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'] as const;

@Injectable()
export class SuppliersService extends AuditedService {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly activity: ActivityService,
  ) {
    super(prisma, audit);
  }

  list(user: SessionUser, query: SupplierListQuery) {
    const where: Prisma.SupplierWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...containsAny(query.search, ['name', 'code', 'tin', 'email']),
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.accredited === undefined ? {} : { accredited: query.accredited }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.vatStatus ? { vatStatus: query.vatStatus } : {}),
    };
    return paginate(
      (args) => this.prisma.supplier.findMany({ where, orderBy: buildOrderBy(query.sort, SUPPLIER_SORT_FIELDS, [{ code: 'asc' }]), ...args }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    const supplier = await this.find(user, id);
    const contacts = await this.prisma.contactPerson.findMany({
      where: { companyId: user.companyId, supplierId: id, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    });
    return { ...supplier, contacts };
  }

  create(user: SessionUser, input: CreateSupplierInput) {
    return this.createAudited(user, 'Supplier', (tx) => tx.supplier.create({ data: { ...input, companyId: user.companyId } }));
  }

  async update(user: SessionUser, id: string, input: UpdateSupplierInput) {
    const before = await this.find(user, id);
    return this.updateAudited(user, 'Supplier', before, (tx) => tx.supplier.update({ where: { id }, data: input }));
  }

  async remove(user: SessionUser, id: string) {
    const before = await this.find(user, id);
    const orders = await this.prisma.purchaseOrder.count({ where: { supplierId: id, companyId: user.companyId } });
    const quotations = await this.prisma.supplierQuotation.count({ where: { supplierId: id, companyId: user.companyId } });
    if (orders > 0 || quotations > 0) {
      throw new BusinessRuleError('This supplier has purchasing history and cannot be deleted. Deactivate it instead.');
    }
    await this.softDeleteAudited(user, 'Supplier', before, (tx) =>
      tx.supplier.update({ where: { id }, data: { deletedAt: new Date(), active: false } }),
    );
  }

  // ---- Accreditation ---------------------------------------------------------------------------

  async setAccreditation(user: SessionUser, id: string, input: SetAccreditationInput) {
    const before = await this.find(user, id);
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.supplier.update({
        where: { id },
        data: {
          accredited: input.accredited,
          accreditationNo: input.accredited ? (input.accreditationNo ?? null) : null,
          accreditationExpiry: input.accredited ? (input.accreditationExpiry ?? null) : null,
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId,
        userId: user.id,
        entityType: 'Supplier',
        entityId: id,
        action: input.accredited ? 'ACCREDIT' : 'REVOKE_ACCREDITATION',
        before: { accredited: before.accredited, accreditationNo: before.accreditationNo, accreditationExpiry: before.accreditationExpiry },
        after: { accredited: after.accredited, accreditationNo: after.accreditationNo, accreditationExpiry: after.accreditationExpiry },
        reason: input.notes ?? undefined,
      });
      return after;
    });
  }

  // ---- Contacts --------------------------------------------------------------------------------

  async listContacts(user: SessionUser, supplierId: string) {
    await this.find(user, supplierId);
    return this.prisma.contactPerson.findMany({
      where: { companyId: user.companyId, supplierId, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      take: 200,
    });
  }

  async addContact(user: SessionUser, supplierId: string, input: CreateContactInput) {
    await this.find(user, supplierId);
    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) await tx.contactPerson.updateMany({ where: { supplierId, isPrimary: true }, data: { isPrimary: false } });
      const created = await tx.contactPerson.create({ data: { ...input, companyId: user.companyId, supplierId } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Supplier', entityId: supplierId,
        action: 'CONTACT_ADDED', after: { contactId: created.id, name: created.name },
      });
      return created;
    });
  }

  async updateContact(user: SessionUser, supplierId: string, contactId: string, input: UpdateContactInput) {
    await this.find(user, supplierId);
    const before = await this.prisma.contactPerson.findFirst({ where: { id: contactId, supplierId, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('Contact', contactId);
    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.contactPerson.updateMany({ where: { supplierId, isPrimary: true, id: { not: contactId } }, data: { isPrimary: false } });
      }
      const after = await tx.contactPerson.update({ where: { id: contactId }, data: input });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Supplier', entityId: supplierId,
        action: 'CONTACT_UPDATED', after: { contactId, name: after.name },
      });
      return after;
    });
  }

  async removeContact(user: SessionUser, supplierId: string, contactId: string) {
    await this.find(user, supplierId);
    const before = await this.prisma.contactPerson.findFirst({ where: { id: contactId, supplierId, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('Contact', contactId);
    await this.prisma.$transaction(async (tx) => {
      await tx.contactPerson.update({ where: { id: contactId }, data: { deletedAt: new Date(), isPrimary: false } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Supplier', entityId: supplierId,
        action: 'CONTACT_REMOVED', after: { contactId, name: before.name },
      });
    });
  }

  // ---- Evaluations and performance ---------------------------------------------------------------

  async listEvaluations(user: SessionUser, supplierId: string, query: PaginationQuery) {
    await this.find(user, supplierId);
    return paginate(
      (args) =>
        this.prisma.supplierEvaluation.findMany({
          where: { companyId: user.companyId, supplierId },
          orderBy: [{ periodEnd: 'desc' }, { id: 'asc' }],
          ...args,
        }),
      query,
    );
  }

  async addEvaluation(user: SessionUser, supplierId: string, input: CreateSupplierEvaluationInput) {
    await this.find(user, supplierId);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.supplierEvaluation.create({
        data: { ...input, companyId: user.companyId, supplierId, evaluatedById: user.id },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Supplier', entityId: supplierId,
        action: 'EVALUATED', after: { evaluationId: created.id },
      });
      return created;
    });
  }

  /**
   * Derived entirely from real documents: purchase orders, posted goods receipts, RFQ invitations and
   * evaluations. A ratio with no underlying documents is null rather than a fabricated zero or 100%.
   */
  async performance(user: SessionUser, supplierId: string) {
    await this.find(user, supplierId);
    const companyId = user.companyId;
    const [committed, open, lastOrder, receipts, quality, evaluations, invited, quoted, awarded] = await Promise.all([
      this.prisma.purchaseOrder.aggregate({
        where: { companyId, supplierId, deletedAt: null, status: { in: [...COMMITTED_PO] } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.purchaseOrder.count({ where: { companyId, supplierId, deletedAt: null, status: { in: [...OPEN_PO] } } }),
      this.prisma.purchaseOrder.findFirst({
        where: { companyId, supplierId, deletedAt: null, status: { in: [...COMMITTED_PO] } },
        orderBy: { orderDate: 'desc' },
        select: { orderDate: true },
      }),
      this.prisma.goodsReceipt.findMany({
        where: { companyId, supplierId, deletedAt: null, status: 'POSTED', postedAt: { not: null }, order: { expectedDate: { not: null } } },
        select: { receiptDate: true, order: { select: { expectedDate: true } } },
        take: 5000,
      }),
      this.prisma.goodsReceiptLine.aggregate({
        where: { receipt: { companyId, supplierId, deletedAt: null, status: 'POSTED', postedAt: { not: null } } },
        _sum: { receivedQty: true, rejectedQty: true },
      }),
      this.prisma.supplierEvaluation.aggregate({
        where: { companyId, supplierId },
        _count: { _all: true },
        _avg: { priceScore: true, qualityScore: true, deliveryScore: true, responsivenessScore: true, complianceScore: true },
        _max: { periodEnd: true },
      }),
      this.prisma.rfqSupplier.count({ where: { supplierId, rfq: { companyId, deletedAt: null } } }),
      this.prisma.rfqSupplier.count({ where: { supplierId, status: 'QUOTED', rfq: { companyId, deletedAt: null } } }),
      this.prisma.rfqAward.count({ where: { companyId, supplierId } }),
    ]);

    const onTime = receipts.filter((r) => r.order.expectedDate && r.receiptDate <= r.order.expectedDate).length;
    const receivedQty = quality._sum.receivedQty ?? ZERO;
    const rejectedQty = quality._sum.rejectedQty ?? ZERO;
    const pct = (num: number, den: number): string | null => (den === 0 ? null : ((num / den) * 100).toFixed(2));
    const avg = (v: number | null): string | null => (v === null ? null : v.toFixed(2));
    const a = evaluations._avg;
    const scores = [a.priceScore, a.qualityScore, a.deliveryScore, a.responsivenessScore, a.complianceScore];
    const overall =
      evaluations._count._all === 0 || scores.some((s) => s === null)
        ? null
        : scores.reduce<number>((sum, v) => sum + (v ?? 0), 0) / scores.length;

    return {
      supplierId,
      orders: {
        count: committed._count._all,
        totalValue: dec(committed._sum.totalAmount).toFixed(2),
        openCount: open,
        lastOrderDate: lastOrder?.orderDate ?? null,
      },
      delivery: { receiptCount: receipts.length, onTimeCount: onTime, onTimeRatePct: pct(onTime, receipts.length) },
      quality: {
        receivedQty: receivedQty.toFixed(4),
        rejectedQty: rejectedQty.toFixed(4),
        rejectionRatePct: receivedQty.isZero() ? null : rejectedQty.div(receivedQty).mul(100).toFixed(2),
      },
      evaluations: {
        count: evaluations._count._all,
        latestPeriodEnd: evaluations._max.periodEnd ?? null,
        averages:
          evaluations._count._all === 0
            ? null
            : {
                price: avg(a.priceScore),
                quality: avg(a.qualityScore),
                delivery: avg(a.deliveryScore),
                responsiveness: avg(a.responsivenessScore),
                compliance: avg(a.complianceScore),
                overall: avg(overall),
              },
      },
      sourcing: {
        rfqsInvited: invited,
        quotationsSubmitted: quoted,
        awards: awarded,
        responseRatePct: pct(quoted, invited),
        winRatePct: pct(awarded, quoted),
      },
    };
  }

  /** Purchase orders for this supplier, limited to the projects the caller may view. */
  async purchaseHistory(user: SessionUser, supplierId: string, query: SupplierHistoryQuery) {
    await this.find(user, supplierId);
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId: user.companyId,
      supplierId,
      deletedAt: null,
      ...this.access.projectWhere(user, 'procurement.order', 'VIEW'),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...containsAny(query.search, ['number']),
    };
    return paginate(
      (args) =>
        this.prisma.purchaseOrder.findMany({
          where,
          orderBy: [{ orderDate: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            number: true,
            status: true,
            orderDate: true,
            expectedDate: true,
            totalAmount: true,
            currency: true,
            project: { select: { id: true, code: true, name: true } },
          },
          ...args,
        }),
      query,
    );
  }

  async activityFor(user: SessionUser, id: string) {
    await this.find(user, id);
    return this.activity.forDocument({ companyId: user.companyId, entityType: 'Supplier', entityId: id });
  }

  private async find(user: SessionUser, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!supplier) throw new NotFoundError('Supplier', id);
    return supplier;
  }
}
