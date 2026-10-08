'use client';

import { ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getCachedItem, searchItemOptions } from '@/features/items/api/hooks';
import type { BoqRow, CostCode, WbsRow } from '@/lib/api/types';
import { formatPHP } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  blankLine,
  duplicateLine,
  lineAmount,
  type LineDraft,
  type LineErrors,
} from '../model';

export type LineDimensions = {
  wbs: WbsRow[];
  costCodes: CostCode[];
  boq: BoqRow[];
};

type Column = 'item' | 'qty' | 'unit' | 'date' | 'cost';
const NAVIGABLE: Column[] = ['qty', 'unit', 'cost'];

function cellSelector(index: number, column: Column): string {
  return `[data-cell="${index}:${column}"]`;
}

function focusCell(root: HTMLElement | null, index: number, column: Column): boolean {
  const element = root?.querySelector<HTMLElement>(cellSelector(index, column));
  if (!element) return false;
  const target = element.matches('input, select') ? element : element.querySelector<HTMLElement>('input');
  target?.focus();
  if (target instanceof HTMLInputElement) target.select();
  return Boolean(target);
}

const cellInput =
  'h-8 rounded-sm border-transparent bg-transparent px-2 shadow-none hover:border-border-strong focus-visible:bg-surface';

function ErrorText({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-0.5 px-2 text-2xs font-medium text-danger">
      {message}
    </p>
  );
}

export type LineTableProps = {
  lines: LineDraft[];
  errors: Record<string, LineErrors>;
  /** Show validation messages (after a save or submit attempt). */
  showErrors: boolean;
  dimensions: LineDimensions;
  onChange: (lines: LineDraft[]) => void;
  disabled?: boolean;
};

/**
 * Editable requisition lines. The primary row holds what a buyer types all day (item, quantity, unit,
 * required date, estimate); project coding and justification sit in an expandable second row.
 * Enter moves down a column, arrow keys move between rows, and Enter on the last row adds a line.
 */
export function LineTable({ lines, errors, showErrors, dimensions, onChange, disabled }: LineTableProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const pendingFocus = React.useRef<{ index: number; column: Column } | null>(null);

  React.useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    focusCell(rootRef.current, target.index, target.column);
  });

  function update(key: string, patch: Partial<LineDraft>): void {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine(focusIndex?: number): void {
    const last = lines[lines.length - 1];
    onChange([...lines, blankLine(last?.requiredDate ? { requiredDate: last.requiredDate } : {})]);
    pendingFocus.current = { index: focusIndex ?? lines.length, column: 'item' };
  }

  function duplicate(index: number): void {
    const source = lines[index];
    if (!source) return;
    const copy = duplicateLine(source);
    onChange([...lines.slice(0, index + 1), copy, ...lines.slice(index + 1)]);
    pendingFocus.current = { index: index + 1, column: 'qty' };
  }

  function remove(index: number): void {
    const target = lines[index];
    if (!target) return;
    onChange(lines.filter((line) => line.key !== target.key));
    pendingFocus.current = lines.length > 1 ? { index: Math.max(0, index - 1), column: 'item' } : null;
  }

  function toggle(key: string): void {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function onCellKeyDown(event: React.KeyboardEvent<HTMLInputElement>, index: number, column: Column): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (index < lines.length - 1) focusCell(rootRef.current, index + 1, column);
      else addLine();
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && NAVIGABLE.includes(column)) {
      event.preventDefault();
      focusCell(rootRef.current, index + (event.key === 'ArrowDown' ? 1 : -1), column);
    }
  }

  function chooseItem(index: number, key: string, itemId: string | null): void {
    if (!itemId) {
      update(key, { itemId: '', sku: '', itemName: '', baseUnit: '', defaultUnitCost: '0' });
      return;
    }
    const item = getCachedItem(itemId);
    const line = lines[index];
    const cost = item && Number(item.lastPurchaseCost) > 0 ? item.lastPurchaseCost : (item?.standardCost ?? '0');
    update(key, {
      itemId,
      sku: item?.sku ?? '',
      itemName: item?.name ?? '',
      baseUnit: item?.baseUnit ?? '',
      defaultUnitCost: cost,
      unit: !line?.unit || line.unit === line.baseUnit ? (item?.baseUnit ?? line?.unit ?? '') : line.unit,
    });
    pendingFocus.current = { index, column: 'qty' };
  }

  const leafWbs = dimensions.wbs;
  return (
    <div ref={rootRef} className="rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-sm" aria-label="Requisition lines">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="w-14 border-b border-border bg-surface-muted px-2 py-2 font-medium">
                <span className="sr-only">Line</span>#
              </th>
              <th scope="col" className="border-b border-border bg-surface-muted px-2 py-2 font-medium">Item</th>
              <th scope="col" className="w-28 border-b border-border bg-surface-muted px-2 py-2 text-right font-medium">Quantity</th>
              <th scope="col" className="w-20 border-b border-border bg-surface-muted px-2 py-2 font-medium">Unit</th>
              <th scope="col" className="w-36 border-b border-border bg-surface-muted px-2 py-2 font-medium">Needed by</th>
              <th scope="col" className="w-32 border-b border-border bg-surface-muted px-2 py-2 text-right font-medium">Est. unit cost</th>
              <th scope="col" className="w-32 border-b border-border bg-surface-muted px-2 py-2 text-right font-medium">Amount</th>
              <th scope="col" className="w-20 border-b border-border bg-surface-muted px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const lineErrors = showErrors ? (errors[line.key] ?? {}) : {};
              const detailErrors = lineErrors.description || lineErrors.justification;
              const isOpen = expanded.has(line.key) || Boolean(detailErrors);
              const rowId = `line-${index}`;
              return (
                <React.Fragment key={line.key}>
                  <tr className="group/line align-top hover:bg-surface-muted/40" data-line={index}>
                    <td className="border-b border-border px-1 py-1.5">
                      <div className="flex items-center gap-0.5">
                        <IconButton
                          label={isOpen ? `Hide details for line ${index + 1}` : `Show details for line ${index + 1}`}
                          size="sm"
                          aria-expanded={isOpen}
                          onClick={() => toggle(line.key)}
                        >
                          <ChevronRight className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')} aria-hidden />
                        </IconButton>
                        <span className="num text-xs text-muted-foreground">{index + 1}</span>
                      </div>
                    </td>
                    <td className="border-b border-border px-1 py-1.5" data-cell={`${index}:item`}>
                      <EntityCombobox
                        entity="items"
                        id={`${rowId}-item`}
                        search={searchItemOptions}
                        value={line.itemId || null}
                        selectedLabel={line.itemId ? `${line.sku} · ${line.itemName}` : ''}
                        onChange={(value) => chooseItem(index, line.key, value)}
                        placeholder="Search SKU or name"
                        clearable={false}
                        disabled={disabled}
                        aria-invalid={lineErrors.itemId ? true : undefined}
                        aria-describedby={lineErrors.itemId ? `${rowId}-item-error` : undefined}
                      />
                      <ErrorText id={`${rowId}-item-error`} message={lineErrors.itemId} />
                    </td>
                    <td className="border-b border-border px-1 py-1.5">
                      <Input
                        data-cell={`${index}:qty`}
                        aria-label={`Quantity, line ${index + 1}`}
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={disabled}
                        value={line.qty}
                        aria-invalid={lineErrors.qty ? true : undefined}
                        aria-describedby={lineErrors.qty ? `${rowId}-qty-error` : undefined}
                        onChange={(event) => update(line.key, { qty: event.target.value.replace(/[^\d.]/g, '') })}
                        onKeyDown={(event) => onCellKeyDown(event, index, 'qty')}
                        className={cn(cellInput, 'num text-right')}
                      />
                      <ErrorText id={`${rowId}-qty-error`} message={lineErrors.qty} />
                    </td>
                    <td className="border-b border-border px-1 py-1.5">
                      <Input
                        data-cell={`${index}:unit`}
                        aria-label={`Unit, line ${index + 1}`}
                        list={line.baseUnit ? `${rowId}-units` : undefined}
                        autoComplete="off"
                        disabled={disabled}
                        maxLength={12}
                        value={line.unit}
                        aria-invalid={lineErrors.unit ? true : undefined}
                        aria-describedby={lineErrors.unit ? `${rowId}-unit-error` : undefined}
                        onChange={(event) => update(line.key, { unit: event.target.value })}
                        onKeyDown={(event) => onCellKeyDown(event, index, 'unit')}
                        className={cn(cellInput, 'font-mono text-xs')}
                      />
                      {line.baseUnit ? (
                        <datalist id={`${rowId}-units`}>
                          <option value={line.baseUnit} />
                        </datalist>
                      ) : null}
                      <ErrorText id={`${rowId}-unit-error`} message={lineErrors.unit} />
                    </td>
                    <td className="border-b border-border px-1 py-1.5">
                      <Input
                        data-cell={`${index}:date`}
                        type="date"
                        aria-label={`Needed by, line ${index + 1}`}
                        disabled={disabled}
                        value={line.requiredDate}
                        onChange={(event) => update(line.key, { requiredDate: event.target.value })}
                        className={cn(cellInput, 'text-xs')}
                      />
                    </td>
                    <td className="border-b border-border px-1 py-1.5">
                      <Input
                        data-cell={`${index}:cost`}
                        aria-label={`Estimated unit cost, line ${index + 1}`}
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={disabled}
                        placeholder={Number(line.defaultUnitCost) > 0 ? line.defaultUnitCost : '0.00'}
                        value={line.estimatedUnitCost}
                        aria-invalid={lineErrors.estimatedUnitCost ? true : undefined}
                        aria-describedby={lineErrors.estimatedUnitCost ? `${rowId}-cost-error` : undefined}
                        onChange={(event) => update(line.key, { estimatedUnitCost: event.target.value.replace(/[^\d.]/g, '') })}
                        onKeyDown={(event) => onCellKeyDown(event, index, 'cost')}
                        className={cn(cellInput, 'num text-right')}
                      />
                      <ErrorText id={`${rowId}-cost-error`} message={lineErrors.estimatedUnitCost} />
                    </td>
                    <td className="num border-b border-border px-2 py-1.5 pt-3 text-right font-medium">
                      {formatPHP(lineAmount(line))}
                    </td>
                    <td className="border-b border-border px-1 py-1.5">
                      <div className="flex justify-end gap-0.5">
                        <IconButton label={`Duplicate line ${index + 1}`} size="sm" disabled={disabled} onClick={() => duplicate(index)}>
                            <Copy className="size-3.5" aria-hidden />
                          </IconButton>
                        <IconButton label={`Remove line ${index + 1}`} size="sm" disabled={disabled} onClick={() => remove(index)}>
                            <Trash2 className="size-3.5" aria-hidden />
                          </IconButton>
                      </div>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="bg-surface-muted/40">
                      <td className="border-b border-border" />
                      <td colSpan={7} className="border-b border-border px-2 py-2">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <label className="space-y-0.5 text-xs text-muted-foreground lg:col-span-2">
                            Description
                            <Input
                              value={line.description}
                              disabled={disabled}
                              placeholder={line.itemName || 'Specific spec or brand'}
                              onChange={(event) => update(line.key, { description: event.target.value })}
                              aria-invalid={lineErrors.description ? true : undefined}
                            />
                            <ErrorText id={`${rowId}-desc-error`} message={lineErrors.description} />
                          </label>
                          <label className="space-y-0.5 text-xs text-muted-foreground">
                            WBS node
                            <Select value={line.wbsNodeId} disabled={disabled} onChange={(event) => update(line.key, { wbsNodeId: event.target.value })}>
                              <option value="">Not coded</option>
                              {leafWbs.map((node) => (
                                <option key={node.id} value={node.id}>
                                  {`${node.code} ${node.name}`}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <label className="space-y-0.5 text-xs text-muted-foreground">
                            Cost code
                            <Select value={line.costCodeId} disabled={disabled} onChange={(event) => update(line.key, { costCodeId: event.target.value })}>
                              <option value="">Not coded</option>
                              {dimensions.costCodes.map((code) => (
                                <option key={code.id} value={code.id}>
                                  {`${code.code} ${code.name}`}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <label className="space-y-0.5 text-xs text-muted-foreground">
                            BOQ item
                            <Select value={line.boqItemId} disabled={disabled} onChange={(event) => update(line.key, { boqItemId: event.target.value })}>
                              <option value="">Not linked</option>
                              {dimensions.boq.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {`${item.itemNo} ${item.description}`.slice(0, 60)}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <label className="space-y-0.5 text-xs text-muted-foreground lg:col-span-3">
                            Justification
                            <Input
                              value={line.justification}
                              disabled={disabled}
                              placeholder="Why this is needed, e.g. for 3rd floor slab pour"
                              onChange={(event) => update(line.key, { justification: event.target.value })}
                              aria-invalid={lineErrors.justification ? true : undefined}
                            />
                            <ErrorText id={`${rowId}-just-error`} message={lineErrors.justification} />
                          </label>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <Button onClick={() => addLine()} disabled={disabled}>
          <Plus className="size-3.5" aria-hidden />
          Add line
        </Button>
        <p className="text-xs text-muted-foreground">
          Tab moves across a row. Enter moves down the column; on the last row it adds a line. Up and down arrows switch rows.
        </p>
      </div>
    </div>
  );
}
