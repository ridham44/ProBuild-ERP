import { Injectable } from '@nestjs/common';
import { manilaParts } from '@probuild/shared';
import { Db } from '../../prisma/prisma.service';

/** Document type -> number prefix. Add new types here; format is PREFIX-YYYY-00001. */
export const DOC_PREFIXES: Record<string, string> = {
  STOCK_TXN: 'STK',
  JOURNAL: 'JE',
  PURCHASE_REQUISITION: 'PR',
  RFQ: 'RFQ',
  PURCHASE_ORDER: 'PO',
  GOODS_RECEIPT: 'GRN',
  SUPPLIER_INVOICE: 'SI',
  MATERIAL_REQUEST: 'MR',
  MATERIAL_ISSUE: 'MIV',
  MATERIAL_RETURN: 'MRT',
  WAREHOUSE_TRANSFER: 'WT',
  STOCK_ADJUSTMENT: 'SA',
  STOCK_COUNT: 'SC',
  CONTRACT: 'CT',
  VARIATION: 'VO',
  CLAIM: 'CLM',
  RFI: 'RFI',
  CLIENT_BILLING: 'BILL',
  COLLECTION: 'OR',
  PAYMENT: 'PV',
  EXPENSE: 'EXP',
  PAYROLL: 'PAY',
  SUBCONTRACT: 'SUB',
  SUBCONTRACT_CLAIM: 'SCL',
};

@Injectable()
export class NumberingService {
  /** Returns the next number for the document type; atomic via the sequence row lock. */
  async next(db: Db, companyId: string, docType: string, date: Date = new Date()): Promise<string> {
    const prefix = DOC_PREFIXES[docType] ?? docType.slice(0, 4).toUpperCase();
    const { year } = manilaParts(date);
    const key = { companyId_docType_year: { companyId, docType, year } };

    const seq = await db.documentSequence.upsert({
      where: key,
      create: { companyId, docType, prefix, year, nextNo: 2 },
      update: { nextNo: { increment: 1 } },
    });
    const issued = seq.nextNo - 1;
    return `${seq.prefix}-${year}-${String(issued).padStart(seq.padding, '0')}`;
  }
}
