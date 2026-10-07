import { Injectable } from '@nestjs/common';
import { JournalEntry, PartyType, Prisma } from '@prisma/client';
import { manilaMonthRange, manilaParts, type AccountCode } from '@probuild/shared';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { Db } from '../../prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';

const D = Prisma.Decimal;
type Decimalish = Prisma.Decimal | string | number;

export type JournalLineInput = {
  /** Either an account id or a well-known ACCOUNT_CODES value. */
  accountId?: string;
  accountCode?: AccountCode;
  debit?: Decimalish;
  credit?: Decimalish;
  memo?: string;
  branchId?: string | null;
  departmentId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  wbsNodeId?: string | null;
  costCodeId?: string | null;
  partyType?: PartyType;
  partyId?: string;
};

export type JournalInput = {
  companyId: string;
  entryDate: Date;
  description: string;
  lines: JournalLineInput[];
  sourceType?: string;
  sourceId?: string;
  userId: string;
};

/** Double-entry posting. Entries must balance, hit postable accounts, and fall in an open period. */
@Injectable()
export class JournalService {
  constructor(private readonly numbering: NumberingService) {}

  async post(db: Db, input: JournalInput): Promise<JournalEntry> {
    if (input.lines.length < 2) throw new BusinessRuleError('A journal entry needs at least two lines');

    const codes = [...new Set(input.lines.map((l) => l.accountCode).filter((c): c is AccountCode => !!c))];
    const ids = [...new Set(input.lines.map((l) => l.accountId).filter((i): i is string => !!i))];
    const accounts = await db.account.findMany({
      where: { companyId: input.companyId, deletedAt: null, OR: [{ code: { in: codes } }, { id: { in: ids } }] },
      select: { id: true, code: true, isPostable: true, active: true },
    });
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    const byId = new Map(accounts.map((a) => [a.id, a]));

    let totalDebit = new D(0);
    let totalCredit = new D(0);
    const lineData = input.lines.map((line, index) => {
      const account = line.accountId ? byId.get(line.accountId) : line.accountCode ? byCode.get(line.accountCode) : undefined;
      if (!account) throw new BusinessRuleError(`Line ${index + 1}: account not found`);
      if (!account.isPostable || !account.active) throw new BusinessRuleError(`Line ${index + 1}: account ${account.code} cannot be posted to`);
      const debit = new D(line.debit ?? 0).toDecimalPlaces(2);
      const credit = new D(line.credit ?? 0).toDecimalPlaces(2);
      if (debit.lt(0) || credit.lt(0)) throw new BusinessRuleError(`Line ${index + 1}: amounts cannot be negative`);
      if (debit.gt(0) === credit.gt(0)) throw new BusinessRuleError(`Line ${index + 1}: enter either a debit or a credit`);
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
      return {
        accountId: account.id,
        debit,
        credit,
        memo: line.memo ?? null,
        branchId: line.branchId ?? null,
        departmentId: line.departmentId ?? null,
        costCenterId: line.costCenterId ?? null,
        projectId: line.projectId ?? null,
        wbsNodeId: line.wbsNodeId ?? null,
        costCodeId: line.costCodeId ?? null,
        partyType: line.partyType ?? null,
        partyId: line.partyId ?? null,
      };
    });
    if (!totalDebit.equals(totalCredit)) {
      throw new BusinessRuleError(`Entry is out of balance: debits ${totalDebit.toString()} vs credits ${totalCredit.toString()}`);
    }

    const period = await this.openPeriodFor(db, input.companyId, input.entryDate);

    const entryNo = await this.numbering.next(db, input.companyId, 'JOURNAL', input.entryDate);
    return db.journalEntry.create({
      data: {
        companyId: input.companyId,
        entryNo,
        entryDate: input.entryDate,
        periodId: period.id,
        description: input.description,
        status: 'POSTED',
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        postedById: input.userId,
        lines: { create: lineData },
      },
    });
  }

  /** Finds the Manila-calendar period for a date, creating it open if missing, and rejects closed periods. */
  async openPeriodFor(db: Db, companyId: string, date: Date) {
    const { year, month } = manilaParts(date);
    const { start, endExclusive } = manilaMonthRange(year, month);
    const period = await db.accountingPeriod.upsert({
      where: { companyId_year_month: { companyId, year, month } },
      create: { companyId, year, month, startDate: start, endDate: new Date(endExclusive.getTime() - 1) },
      update: {},
    });
    if (period.closed) throw new BusinessRuleError(`Accounting period ${year}-${String(month).padStart(2, '0')} is closed`);
    return period;
  }

  /** Posts a mirror entry with debits/credits swapped and marks the original as reversed. */
  async reverse(db: Db, input: { companyId: string; entryId: string; userId: string; reason: string }): Promise<JournalEntry> {
    const original = await db.journalEntry.findFirst({
      where: { id: input.entryId, companyId: input.companyId },
      include: { lines: true },
    });
    if (!original) throw new NotFoundError('Journal entry', input.entryId);
    if (original.status === 'REVERSED') throw new BusinessRuleError('Journal entry is already reversed');

    const reversal = await this.post(db, {
      companyId: input.companyId,
      entryDate: new Date(),
      description: `Reversal of ${original.entryNo}: ${input.reason}`,
      sourceType: original.sourceType ?? undefined,
      sourceId: original.sourceId ?? undefined,
      userId: input.userId,
      lines: original.lines.map((l) => ({
        accountId: l.accountId,
        debit: l.credit,
        credit: l.debit,
        memo: l.memo ?? undefined,
        projectId: l.projectId,
        wbsNodeId: l.wbsNodeId,
        costCodeId: l.costCodeId,
        costCenterId: l.costCenterId,
        departmentId: l.departmentId,
        branchId: l.branchId,
        partyType: l.partyType ?? undefined,
        partyId: l.partyId ?? undefined,
      })),
    });
    await db.journalEntry.update({ where: { id: reversal.id }, data: { reversalOfId: original.id } });
    await db.journalEntry.update({ where: { id: original.id }, data: { status: 'REVERSED' } });
    return reversal;
  }
}
