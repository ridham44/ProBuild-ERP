import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CUSTOMER_SORT_FIELDS } from '@probuild/shared';
import type {
  CreateContactInput,
  CreateCustomerInput,
  CustomerListQuery,
  SessionUser,
  UpdateContactInput,
  UpdateCustomerInput,
} from '@probuild/shared';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny } from '../../common/list';
import { paginate } from '../../common/pagination';
import { ActivityService } from '../../engines/activity/activity.service';
import { AuditService } from '../../engines/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomersService extends AuditedService {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly activity: ActivityService,
  ) {
    super(prisma, audit);
  }

  list(user: SessionUser, query: CustomerListQuery) {
    const where: Prisma.CustomerWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...containsAny(query.search, ['name', 'code', 'tin', 'email']),
      ...(query.active === undefined ? {} : { active: query.active }),
    };
    return paginate(
      (args) => this.prisma.customer.findMany({ where, orderBy: buildOrderBy(query.sort, CUSTOMER_SORT_FIELDS, [{ code: 'asc' }]), ...args }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    const customer = await this.find(user, id);
    const [contacts, projects] = await Promise.all([
      this.prisma.contactPerson.findMany({
        where: { companyId: user.companyId, customerId: id, deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.project.count({ where: { companyId: user.companyId, customerId: id, deletedAt: null } }),
    ]);
    return { ...customer, contacts, projectCount: projects };
  }

  create(user: SessionUser, input: CreateCustomerInput) {
    return this.createAudited(user, 'Customer', (tx) => tx.customer.create({ data: { ...input, companyId: user.companyId } }));
  }

  async update(user: SessionUser, id: string, input: UpdateCustomerInput) {
    const before = await this.find(user, id);
    return this.updateAudited(user, 'Customer', before, (tx) => tx.customer.update({ where: { id }, data: input }));
  }

  async remove(user: SessionUser, id: string) {
    const before = await this.find(user, id);
    const projects = await this.prisma.project.count({ where: { customerId: id, companyId: user.companyId } });
    if (projects > 0) throw new BusinessRuleError('This customer has projects and cannot be deleted. Deactivate it instead.');
    await this.softDeleteAudited(user, 'Customer', before, (tx) =>
      tx.customer.update({ where: { id }, data: { deletedAt: new Date(), active: false } }),
    );
  }

  async listContacts(user: SessionUser, customerId: string) {
    await this.find(user, customerId);
    return this.prisma.contactPerson.findMany({
      where: { companyId: user.companyId, customerId, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      take: 200,
    });
  }

  async addContact(user: SessionUser, customerId: string, input: CreateContactInput) {
    await this.find(user, customerId);
    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) await tx.contactPerson.updateMany({ where: { customerId, isPrimary: true }, data: { isPrimary: false } });
      const created = await tx.contactPerson.create({ data: { ...input, companyId: user.companyId, customerId } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Customer', entityId: customerId,
        action: 'CONTACT_ADDED', after: { contactId: created.id, name: created.name },
      });
      return created;
    });
  }

  async updateContact(user: SessionUser, customerId: string, contactId: string, input: UpdateContactInput) {
    await this.find(user, customerId);
    const before = await this.prisma.contactPerson.findFirst({ where: { id: contactId, customerId, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('Contact', contactId);
    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.contactPerson.updateMany({ where: { customerId, isPrimary: true, id: { not: contactId } }, data: { isPrimary: false } });
      }
      const after = await tx.contactPerson.update({ where: { id: contactId }, data: input });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Customer', entityId: customerId,
        action: 'CONTACT_UPDATED', after: { contactId, name: after.name },
      });
      return after;
    });
  }

  async removeContact(user: SessionUser, customerId: string, contactId: string) {
    await this.find(user, customerId);
    const before = await this.prisma.contactPerson.findFirst({ where: { id: contactId, customerId, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('Contact', contactId);
    await this.prisma.$transaction(async (tx) => {
      await tx.contactPerson.update({ where: { id: contactId }, data: { deletedAt: new Date(), isPrimary: false } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Customer', entityId: customerId,
        action: 'CONTACT_REMOVED', after: { contactId, name: before.name },
      });
    });
  }

  async activityFor(user: SessionUser, id: string) {
    await this.find(user, id);
    return this.activity.forDocument({ companyId: user.companyId, entityType: 'Customer', entityId: id });
  }

  private async find(user: SessionUser, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!customer) throw new NotFoundError('Customer', id);
    return customer;
  }
}
