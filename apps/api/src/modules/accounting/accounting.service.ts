import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateJournalInput, SessionUser } from '@probuild/shared';
import { manilaMonthRange } from '@probuild/shared';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../common/errors/domain-errors';
import { paginate } from '../../common/pagination';
import { AuditService } from '../../engines/audit/audit.service';
import { JournalService } from '../../engines/journal/journal.service';
import { PrismaService } from '../../prisma/prisma.service';

const D = Prisma.Decimal;

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  debit: string;
  credit: string;
  balanceDebit: string;
  balanceCredit: string;
};

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly audit: AuditService,
  ) {}

  // ---- Chart of accounts ------------------------------------------------------------------

  listAccounts(user: SessionUser) {
    return this.prisma.account.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { code: 'asc' },
      take: 1000,
    });
  }

  async createAccount(
    user: SessionUser,
    input: { code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'; parentId?: string | null; isPostable: boolean },
  ) {
    if (input.parentId) {
      const parent = await this.prisma.account.findFirst({ where: { id: input.parentId, companyId: user.companyId, deletedAt: null } });
      if (!parent) throw new BusinessRuleError('Parent account not found');
    }
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.account.create({ data: { ...input, companyId: user.companyId } });
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType: 'Account', entityId: created.id, action: 'CREATE', after: created });
      return created;
    });
  }

  async updateAccount(user: SessionUser, id: string, input: { name?: string; active?: boolean; isPostable?: boolean }) {
    const before = await this.prisma.account.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('Account', id);
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.account.update({ where: { id }, data: input });
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType: 'Account', entityId: id, action: 'UPDATE', before, after });
      return after;
    });
  }

  // ---- Periods ----------------------------------------------------------------------------

  listPeriods(user: SessionUser, year?: number) {
    return this.prisma.accountingPeriod.findMany({
      where: { companyId: user.companyId, ...(year ? { year } : {}) },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 120,
    });
  }

  /** Creates the 12 monthly periods of a calendar year (open). Safe to call repeatedly. */
  async openYear(user: SessionUser, year: number) {
    const data = Array.from({ length: 12 }, (_, i) => {
      const { start, endExclusive } = manilaMonthRange(year, i + 1);
      return { companyId: user.companyId, year, month: i + 1, startDate: start, endDate: new Date(endExclusive.getTime() - 1) };
    });
    await this.prisma.accountingPeriod.createMany({ data, skipDuplicates: true });
    return this.listPeriods(user, year);
  }

  async setPeriodClosed(user: SessionUser, periodId: string, closed: boolean, reason?: string) {
    const period = await this.prisma.accountingPeriod.findFirst({ where: { id: periodId, companyId: user.companyId } });
    if (!period) throw new NotFoundError('Accounting period', periodId);
    if (period.closed === closed) throw new ConflictError(`Period is already ${closed ? 'closed' : 'open'}`);
    if (closed) {
      const earlierOpen = await this.prisma.accountingPeriod.count({
        where: { companyId: user.companyId, closed: false, startDate: { lt: period.startDate } },
      });
      if (earlierOpen > 0) throw new BusinessRuleError('Close earlier periods first');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.accountingPeriod.update({ where: { id: periodId }, data: { closed } });
      await this.audit.record(tx, {
        companyId: user.companyId,
        userId: user.id,
        entityType: 'AccountingPeriod',
        entityId: periodId,
        action: closed ? 'PERIOD_CLOSED' : 'PERIOD_REOPENED',
        before: { closed: period.closed },
        after: { closed },
        reason,
      });
      return updated;
    });
  }

  // ---- Journals ---------------------------------------------------------------------------

  async createManualJournal(user: SessionUser, input: CreateJournalInput) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await this.journal.post(tx, {
        companyId: user.companyId,
        entryDate: input.entryDate,
        description: input.description,
        sourceType: 'MANUAL',
        userId: user.id,
        lines: input.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo,
          projectId: l.projectId,
          wbsNodeId: l.wbsNodeId,
          costCodeId: l.costCodeId,
          costCenterId: l.costCenterId,
          departmentId: l.departmentId,
          branchId: l.branchId,
        })),
      });
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType: 'JournalEntry', entityId: entry.id, action: 'POST', after: { entryNo: entry.entryNo } });
      return this.getJournal(user, entry.id, tx);
    });
  }

  async reverseJournal(user: SessionUser, id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const reversal = await this.journal.reverse(tx, { companyId: user.companyId, entryId: id, userId: user.id, reason });
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType: 'JournalEntry', entityId: id, action: 'REVERSE', reason, after: { reversalId: reversal.id } });
      return this.getJournal(user, reversal.id, tx);
    });
  }

  async getJournal(user: SessionUser, id: string, db: Pick<PrismaService, 'journalEntry'> = this.prisma) {
    const entry = await db.journalEntry.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { createdAt: 'asc' } },
        reversalOf: { select: { id: true, entryNo: true } },
        reversedBy: { select: { id: true, entryNo: true } },
      },
    });
    if (!entry) throw new NotFoundError('Journal entry', id);
    return entry;
  }

  listJournals(
    user: SessionUser,
    query: { cursor?: string; limit: number; search?: string; from?: Date; to?: Date; sourceType?: string; accountId?: string; projectId?: string },
  ) {
    const where: Prisma.JournalEntryWhereInput = {
      companyId: user.companyId,
      ...(query.search ? { OR: [{ entryNo: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] } : {}),
      ...(query.from || query.to ? { entryDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.accountId || query.projectId
        ? { lines: { some: { ...(query.accountId ? { accountId: query.accountId } : {}), ...(query.projectId ? { projectId: query.projectId } : {}) } } }
        : {}),
    };
    return paginate(
      (args) =>
        this.prisma.journalEntry.findMany({
          where,
          orderBy: [{ entryDate: 'desc' }, { id: 'desc' }],
          include: { lines: { select: { debit: true } } },
          ...args,
        }),
      query,
    ).then((page) => ({
      ...page,
      items: page.items.map(({ lines, ...entry }) => ({
        ...entry,
        totalDebit: lines.reduce((sum, l) => sum.plus(l.debit), new D(0)).toString(),
      })),
    }));
  }

  // ---- Reports ----------------------------------------------------------------------------

  async trialBalance(user: SessionUser, query: { from?: Date; to: Date; projectId?: string; costCenterId?: string }) {
    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        entry: { companyId: user.companyId, entryDate: { ...(query.from ? { gte: query.from } : {}), lte: query.to } },
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.costCenterId ? { costCenterId: query.costCenterId } : {}),
      },
      _sum: { debit: true, credit: true },
    });
    const accounts = await this.prisma.account.findMany({
      where: { companyId: user.companyId, id: { in: grouped.map((g) => g.accountId) } },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: 'asc' },
    });
    const sums = new Map(grouped.map((g) => [g.accountId, g._sum]));

    let totalDebit = new D(0);
    let totalCredit = new D(0);
    const rows: TrialBalanceRow[] = accounts.map((a) => {
      const debit = sums.get(a.id)?.debit ?? new D(0);
      const credit = sums.get(a.id)?.credit ?? new D(0);
      const net = debit.minus(credit);
      totalDebit = totalDebit.plus(net.gt(0) ? net : 0);
      totalCredit = totalCredit.plus(net.lt(0) ? net.abs() : 0);
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        debit: debit.toString(),
        credit: credit.toString(),
        balanceDebit: net.gt(0) ? net.toString() : '0',
        balanceCredit: net.lt(0) ? net.abs().toString() : '0',
      };
    });
    return { rows, totalDebit: totalDebit.toString(), totalCredit: totalCredit.toString(), balanced: totalDebit.equals(totalCredit) };
  }

  /** Account ledger with a running balance, including the opening balance before `from`. */
  async generalLedger(user: SessionUser, query: { accountId: string; from?: Date; to?: Date; projectId?: string }) {
    const account = await this.prisma.account.findFirst({ where: { id: query.accountId, companyId: user.companyId } });
    if (!account) throw new NotFoundError('Account', query.accountId);
    const projectFilter = query.projectId ? { projectId: query.projectId } : {};

    let opening = new D(0);
    if (query.from) {
      const prior = await this.prisma.journalLine.aggregate({
        where: { accountId: account.id, ...projectFilter, entry: { companyId: user.companyId, entryDate: { lt: query.from } } },
        _sum: { debit: true, credit: true },
      });
      opening = (prior._sum.debit ?? new D(0)).minus(prior._sum.credit ?? new D(0));
    }
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        ...projectFilter,
        entry: { companyId: user.companyId, entryDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } },
      },
      include: { entry: { select: { id: true, entryNo: true, entryDate: true, description: true, sourceType: true, sourceId: true } } },
      orderBy: [{ entry: { entryDate: 'asc' } }, { createdAt: 'asc' }, { id: 'asc' }],
      take: 5000,
    });
    let running = opening;
    const rows = lines.map((l) => {
      running = running.plus(l.debit).minus(l.credit);
      return {
        lineId: l.id,
        entryId: l.entry.id,
        entryNo: l.entry.entryNo,
        entryDate: l.entry.entryDate,
        description: l.entry.description,
        memo: l.memo,
        sourceType: l.entry.sourceType,
        sourceId: l.entry.sourceId,
        debit: l.debit.toString(),
        credit: l.credit.toString(),
        balance: running.toString(),
      };
    });
    return { account: { id: account.id, code: account.code, name: account.name, type: account.type }, opening: opening.toString(), closing: running.toString(), rows };
  }
}
