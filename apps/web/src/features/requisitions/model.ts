import type { RequisitionInput } from './api/hooks';
import { isDecimal, mulDecimal, sumDecimal } from '@/lib/decimal';
import { isBeforeManilaToday } from '@/lib/format';
import type { RequisitionDetail, WorkflowDto } from '@/lib/api/types';

/** One editable row of the requisition line table. Numbers are kept as decimal strings. */
export type LineDraft = {
  key: string;
  itemId: string;
  sku: string;
  itemName: string;
  baseUnit: string;
  /** Default cost the server would use when no estimate is typed (last purchase cost, else standard cost). */
  defaultUnitCost: string;
  description: string;
  qty: string;
  unit: string;
  requiredDate: string;
  estimatedUnitCost: string;
  wbsNodeId: string;
  costCodeId: string;
  boqItemId: string;
  justification: string;
};

export type LineErrors = Partial<
  Record<'itemId' | 'qty' | 'unit' | 'requiredDate' | 'estimatedUnitCost' | 'description' | 'justification', string>
>;

export type HeaderDraft = {
  projectId: string;
  warehouseId: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  requiredDate: string;
  purpose: string;
  remarks: string;
};

export type HeaderErrors = Partial<Record<'projectId' | 'requiredDate' | 'purpose' | 'remarks' | 'lines', string>>;

let counter = 0;
export function newLineKey(): string {
  counter += 1;
  return `line-${Date.now().toString(36)}-${counter}`;
}

export function blankLine(overrides: Partial<LineDraft> = {}): LineDraft {
  return {
    key: newLineKey(),
    itemId: '',
    sku: '',
    itemName: '',
    baseUnit: '',
    defaultUnitCost: '0',
    description: '',
    qty: '',
    unit: '',
    requiredDate: '',
    estimatedUnitCost: '',
    wbsNodeId: '',
    costCodeId: '',
    boqItemId: '',
    justification: '',
    ...overrides,
  };
}

/** A copy of a line with a fresh key; the item and quantities carry over so a buyer only edits the differences. */
export function duplicateLine(line: LineDraft): LineDraft {
  return { ...line, key: newLineKey() };
}

const QTY = /^\d+(\.\d{1,4})?$/;
const COST = /^\d+(\.\d{1,4})?$/;

export function validateLine(line: LineDraft): LineErrors {
  const errors: LineErrors = {};
  if (!line.itemId) errors.itemId = 'Choose an item';
  if (line.qty.trim() === '') errors.qty = 'Enter a quantity';
  else if (!QTY.test(line.qty.trim())) errors.qty = 'Up to 4 decimals';
  else if (Number(line.qty) <= 0) errors.qty = 'Must be above 0';
  if (!line.unit.trim()) errors.unit = 'Unit needed';
  else if (line.unit.length > 12) errors.unit = 'Too long';
  if (line.estimatedUnitCost.trim() !== '' && !COST.test(line.estimatedUnitCost.trim()))
    errors.estimatedUnitCost = 'Up to 4 decimals';
  if (line.description.length > 300) errors.description = 'Max 300 characters';
  if (line.justification.length > 500) errors.justification = 'Max 500 characters';
  return errors;
}

export function validateHeader(header: HeaderDraft, lines: LineDraft[]): HeaderErrors {
  const errors: HeaderErrors = {};
  if (!header.projectId) errors.projectId = 'Choose the project this is for';
  if (header.purpose.length > 300) errors.purpose = 'Max 300 characters';
  if (header.remarks.length > 1000) errors.remarks = 'Max 1000 characters';
  if (lines.length === 0) errors.lines = 'Add at least one line';
  return errors;
}

export type RequisitionValidation = {
  header: HeaderErrors;
  lines: Record<string, LineErrors>;
  valid: boolean;
};

export function validateRequisition(header: HeaderDraft, lines: LineDraft[]): RequisitionValidation {
  const headerErrors = validateHeader(header, lines);
  const lineErrors: Record<string, LineErrors> = {};
  for (const line of lines) {
    const errors = validateLine(line);
    if (Object.keys(errors).length > 0) lineErrors[line.key] = errors;
  }
  return {
    header: headerErrors,
    lines: lineErrors,
    valid: Object.keys(headerErrors).length === 0 && Object.keys(lineErrors).length === 0,
  };
}

/** The unit cost the server will use: the typed estimate, else the item's default. */
export function effectiveUnitCost(line: LineDraft): string {
  const typed = line.estimatedUnitCost.trim();
  return typed !== '' && isDecimal(typed) ? typed : line.defaultUnitCost;
}

export function lineAmount(line: LineDraft): string {
  return mulDecimal(line.qty.trim() === '' || !isDecimal(line.qty.trim()) ? '0' : line.qty, effectiveUnitCost(line));
}

export function estimatedTotal(lines: LineDraft[]): string {
  return sumDecimal(lines.map(lineAmount));
}

/** Request body for create and update. Blank optional fields are left out. */
export function buildRequisitionPayload(header: HeaderDraft, lines: LineDraft[]): RequisitionInput {
  return {
    projectId: header.projectId,
    priority: header.priority,
    ...(header.warehouseId ? { warehouseId: header.warehouseId } : {}),
    ...(header.requiredDate ? { requiredDate: header.requiredDate } : {}),
    ...(header.purpose.trim() ? { purpose: header.purpose.trim() } : {}),
    ...(header.remarks.trim() ? { remarks: header.remarks.trim() } : {}),
    lines: lines.map((line) => ({
      itemId: line.itemId,
      qty: line.qty.trim(),
      unit: line.unit.trim(),
      ...(line.description.trim() ? { description: line.description.trim() } : {}),
      ...(line.requiredDate ? { requiredDate: line.requiredDate } : {}),
      ...(header.warehouseId ? { warehouseId: header.warehouseId } : {}),
      ...(line.wbsNodeId ? { wbsNodeId: line.wbsNodeId } : {}),
      ...(line.costCodeId ? { costCodeId: line.costCodeId } : {}),
      ...(line.boqItemId ? { boqItemId: line.boqItemId } : {}),
      ...(line.justification.trim() ? { justification: line.justification.trim() } : {}),
      ...(line.estimatedUnitCost.trim() ? { estimatedUnitCost: line.estimatedUnitCost.trim() } : {}),
    })),
  };
}

export function headerFromDetail(detail: RequisitionDetail): HeaderDraft {
  return {
    projectId: detail.projectId,
    warehouseId: detail.warehouseId ?? '',
    priority: detail.priority,
    requiredDate: detail.requiredDate ? detail.requiredDate.slice(0, 10) : '',
    purpose: detail.purpose ?? '',
    remarks: detail.remarks ?? '',
  };
}

export function linesFromDetail(detail: RequisitionDetail): LineDraft[] {
  return detail.lines.map((line) =>
    blankLine({
      itemId: line.itemId,
      sku: line.item.sku,
      itemName: line.item.name,
      baseUnit: line.item.baseUnit,
      defaultUnitCost: line.estimatedUnitCost,
      description: line.description ?? '',
      qty: line.qty,
      unit: line.unit,
      requiredDate: line.requiredDate ? line.requiredDate.slice(0, 10) : '',
      estimatedUnitCost: line.estimatedUnitCost,
      wbsNodeId: line.wbsNodeId ?? '',
      costCodeId: line.costCodeId ?? '',
      boqItemId: line.boqItemId ?? '',
      justification: line.justification ?? '',
    }),
  );
}

export type RoutePreview =
  | { kind: 'steps'; roles: string[] }
  | { kind: 'automatic' }
  | { kind: 'unknown' };

/**
 * What approval route an amount will take, from the company's PR workflow. `unknown` when the workflow
 * list could not be read by this user; `automatic` when no active workflow rule matches (the server then
 * approves on submit).
 */
export function previewApprovalRoute(workflows: WorkflowDto[] | undefined, amount: string): RoutePreview {
  if (!workflows) return { kind: 'unknown' };
  const workflow = workflows.find((entry) => entry.documentType === 'PURCHASE_REQUISITION' && entry.active);
  if (!workflow) return { kind: 'automatic' };
  const rule = workflow.rules.find(
    (candidate) =>
      Number(amount) >= Number(candidate.minAmount) &&
      (candidate.maxAmount === null || Number(amount) <= Number(candidate.maxAmount)),
  );
  if (!rule || rule.steps.length === 0) return { kind: 'automatic' };
  return {
    kind: 'steps',
    roles: [...rule.steps].sort((a, b) => a.stepOrder - b.stepOrder).map((step) => step.roleName),
  };
}

/** PR statuses use the shared vocabulary; SUBMITTED means "awaiting approval". */
export function prStatusKey(status: string): string {
  return status === 'SUBMITTED' ? 'PENDING_APPROVAL' : status;
}

export type MappedServerErrors = {
  header: HeaderErrors;
  lines: Record<string, LineErrors>;
  /** Messages that do not belong to a field the editor shows. */
  general: string[];
};

const LINE_FIELD: Record<string, keyof LineErrors> = {
  itemId: 'itemId',
  qty: 'qty',
  unit: 'unit',
  requiredDate: 'requiredDate',
  estimatedUnitCost: 'estimatedUnitCost',
  description: 'description',
  justification: 'justification',
};

/** Routes ProblemDetails paths such as `lines.2.qty` onto the matching editor row and field. */
export function mapServerErrors(
  issues: Array<{ path: string; message: string }>,
  lines: LineDraft[],
): MappedServerErrors {
  const result: MappedServerErrors = { header: {}, lines: {}, general: [] };
  for (const issue of issues) {
    const parts = issue.path.split('.');
    if (parts[0] === 'lines' && parts.length >= 3) {
      const line = lines[Number(parts[1])];
      const field = LINE_FIELD[parts[2] ?? ''];
      if (line && field) {
        result.lines[line.key] = { ...result.lines[line.key], [field]: issue.message };
        continue;
      }
    }
    if (parts[0] === 'projectId' || parts[0] === 'requiredDate' || parts[0] === 'purpose' || parts[0] === 'remarks') {
      result.header[parts[0]] = issue.message;
      continue;
    }
    result.general.push(issue.path ? `${issue.path}: ${issue.message}` : issue.message);
  }
  return result;
}

/** Statuses where nothing has been ordered yet, so a passed needed-by date is still actionable. */
const PR_NOT_ORDERED_STATUSES: ReadonlySet<string> = new Set(['DRAFT', 'SUBMITTED', 'APPROVED']);

/** Overdue means the needed-by date has passed and nothing has been ordered against the request yet. */
export function isRequisitionOverdue(
  requisition: { status: string; requiredDate: string | null },
  now: Date = new Date(),
): boolean {
  return (
    PR_NOT_ORDERED_STATUSES.has(requisition.status) &&
    isBeforeManilaToday(requisition.requiredDate, now)
  );
}
