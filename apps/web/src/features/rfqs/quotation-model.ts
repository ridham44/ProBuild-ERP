import type { QuotationInput } from './api/hooks';
import { computeLineMoney, isDecimal, sumDecimal, type LineMoney } from '@/lib/decimal';
import type { QuotationDetail, RfqDetail } from '@/lib/api/types';

export type QuoteLineDraft = {
  rfqLineId: string;
  /** Quantity the supplier offers; blank means the full RFQ quantity. */
  qty: string;
  unitPrice: string;
  discountPct: string;
  deliveryDate: string;
};

export type QuoteHeaderDraft = {
  quoteNo: string;
  quoteDate: string;
  validUntil: string;
  deliveryDays: string;
  paymentTerms: string;
  warranty: string;
  freight: string;
  taxPct: string;
};

export type QuoteErrors = {
  header: Partial<Record<keyof QuoteHeaderDraft | 'lines', string>>;
  lines: Record<string, Partial<Record<keyof QuoteLineDraft, string>>>;
  valid: boolean;
};

const MONEY = /^\d+(\.\d{1,2})?$/;
const PRICE = /^\d+(\.\d{1,4})?$/;
const QTY = /^\d+(\.\d{1,4})?$/;

/** A line counts as quoted once a unit price is typed; unpriced lines are left out (a partial quotation). */
export function isQuoted(line: QuoteLineDraft): boolean {
  return line.unitPrice.trim() !== '';
}

export function validateQuotation(
  header: QuoteHeaderDraft,
  lines: QuoteLineDraft[],
  rfq: Pick<RfqDetail, 'lines'>,
): QuoteErrors {
  const errors: QuoteErrors = { header: {}, lines: {}, valid: true };
  if (!header.quoteDate) errors.header.quoteDate = 'Enter the quotation date';
  if (header.validUntil && header.quoteDate && header.validUntil < header.quoteDate)
    errors.header.validUntil = 'Cannot be before the quotation date';
  if (header.freight.trim() !== '' && !MONEY.test(header.freight.trim())) errors.header.freight = 'Up to 2 decimals';
  if (header.taxPct.trim() === '' || !isDecimal(header.taxPct) || Number(header.taxPct) > 100)
    errors.header.taxPct = '0 to 100';
  if (header.deliveryDays.trim() !== '' && !/^\d{1,4}$/.test(header.deliveryDays.trim()))
    errors.header.deliveryDays = 'Whole days';
  const quoted = lines.filter(isQuoted);
  if (quoted.length === 0) errors.header.lines = 'Price at least one line';
  for (const line of quoted) {
    const rfqLine = rfq.lines.find((candidate) => candidate.id === line.rfqLineId);
    const lineErrors: QuoteErrors['lines'][string] = {};
    if (!PRICE.test(line.unitPrice.trim())) lineErrors.unitPrice = 'Up to 4 decimals';
    if (line.qty.trim() !== '') {
      if (!QTY.test(line.qty.trim()) || Number(line.qty) <= 0) lineErrors.qty = 'Must be above 0';
      else if (rfqLine && Number(line.qty) > Number(rfqLine.qty)) lineErrors.qty = `At most ${rfqLine.qty}`;
    }
    if (line.discountPct.trim() !== '' && (!isDecimal(line.discountPct) || Number(line.discountPct) > 100))
      lineErrors.discountPct = '0 to 100';
    if (Object.keys(lineErrors).length > 0) errors.lines[line.rfqLineId] = lineErrors;
  }
  errors.valid = Object.keys(errors.header).length === 0 && Object.keys(errors.lines).length === 0;
  return errors;
}

/** Net amount of one quoted line: qty x price less discount, before tax. */
export function quotedLineMoney(line: QuoteLineDraft, rfqQty: string, taxPct: string): LineMoney {
  const qty = line.qty.trim() === '' ? rfqQty : line.qty.trim();
  return computeLineMoney({ qty, unitPrice: line.unitPrice || '0', discountPct: line.discountPct || '0', taxPct: taxPct || '0' });
}

export function quotationTotals(
  header: QuoteHeaderDraft,
  lines: QuoteLineDraft[],
  rfq: Pick<RfqDetail, 'lines'>,
): { subtotal: string; tax: string; freight: string; total: string } {
  const monies = lines
    .filter(isQuoted)
    .map((line) => quotedLineMoney(line, rfq.lines.find((l) => l.id === line.rfqLineId)?.qty ?? '0', header.taxPct));
  const subtotal = sumDecimal(monies.map((money) => money.net));
  const tax = sumDecimal(monies.map((money) => money.tax));
  const freight = header.freight.trim() === '' ? '0.00' : header.freight.trim();
  return { subtotal, tax, freight, total: sumDecimal([subtotal, tax, freight]) };
}

export function buildQuotationPayload(
  supplierId: string,
  header: QuoteHeaderDraft,
  lines: QuoteLineDraft[],
): QuotationInput {
  return {
    supplierId,
    quoteDate: header.quoteDate,
    ...(header.quoteNo.trim() ? { quoteNo: header.quoteNo.trim() } : {}),
    ...(header.validUntil ? { validUntil: header.validUntil } : {}),
    ...(header.deliveryDays.trim() ? { deliveryDays: Number(header.deliveryDays) } : {}),
    ...(header.paymentTerms.trim() ? { paymentTerms: header.paymentTerms.trim() } : {}),
    ...(header.warranty.trim() ? { warranty: header.warranty.trim() } : {}),
    ...(header.freight.trim() ? { freight: header.freight.trim() } : {}),
    lines: lines.filter(isQuoted).map((line) => ({
      rfqLineId: line.rfqLineId,
      unitPrice: line.unitPrice.trim(),
      taxPct: header.taxPct.trim() || '0',
      ...(line.qty.trim() ? { qty: line.qty.trim() } : {}),
      ...(line.discountPct.trim() ? { discountPct: line.discountPct.trim() } : {}),
      ...(line.deliveryDate ? { deliveryDate: line.deliveryDate } : {}),
    })),
  };
}

export function draftFromQuotation(quotation: QuotationDetail, rfq: Pick<RfqDetail, 'lines'>): {
  header: QuoteHeaderDraft;
  lines: QuoteLineDraft[];
} {
  const taxPct = quotation.lines[0]?.taxPct ?? '12';
  return {
    header: {
      quoteNo: quotation.quoteNo ?? '',
      quoteDate: quotation.quoteDate.slice(0, 10),
      validUntil: quotation.validUntil ? quotation.validUntil.slice(0, 10) : '',
      deliveryDays: quotation.deliveryDays === null ? '' : String(quotation.deliveryDays),
      paymentTerms: quotation.paymentTerms ?? '',
      warranty: quotation.warranty ?? '',
      freight: Number(quotation.freight) > 0 ? quotation.freight : '',
      taxPct,
    },
    lines: rfq.lines.map((rfqLine) => {
      const quoted = quotation.lines.find((line) => line.rfqLineId === rfqLine.id);
      return {
        rfqLineId: rfqLine.id,
        qty: quoted && quoted.qty !== rfqLine.qty ? quoted.qty : '',
        unitPrice: quoted?.unitPrice ?? '',
        discountPct: quoted && Number(quoted.discountPct) > 0 ? quoted.discountPct : '',
        deliveryDate: quoted?.deliveryDate ? quoted.deliveryDate.slice(0, 10) : '',
      };
    }),
  };
}
