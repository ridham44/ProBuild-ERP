'use client';

import { Plus, Trash2 } from 'lucide-react';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { searchItemOptions } from '@/features/items/api/hooks';

export type ItemQtyLine = {
  key: string;
  itemId: string;
  itemLabel: string;
  qty: string;
  note: string;
};

export type ItemQtyLineErrors = Partial<Record<'itemId' | 'qty', string>>;

let counter = 0;

export function blankItemQtyLine(): ItemQtyLine {
  counter += 1;
  return { key: `line-${Date.now().toString(36)}-${counter}`, itemId: '', itemLabel: '', qty: '', note: '' };
}

const QTY = /^\d+(\.\d{1,4})?$/;

export function validateItemQtyLine(line: ItemQtyLine): ItemQtyLineErrors {
  const errors: ItemQtyLineErrors = {};
  if (!line.itemId) errors.itemId = 'Choose an item';
  if (!QTY.test(line.qty) || Number(line.qty) <= 0) errors.qty = 'Above 0, up to 4 decimals';
  return errors;
}

/** Editable list of item and quantity rows, with an optional note per row. Rows are validated by the caller. */
export function ItemQtyLines({
  lines,
  errors,
  noteLabel,
  onChange,
}: {
  lines: ItemQtyLine[];
  errors: Record<string, ItemQtyLineErrors>;
  noteLabel: string;
  onChange: (lines: ItemQtyLine[]) => void;
}) {
  function patch(key: string, change: Partial<ItemQtyLine>): void {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...change } : line)));
  }
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="w-32 px-2 py-2 text-right font-medium">Quantity</th>
              <th className="px-2 py-2 font-medium">{noteLabel}</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const lineErrors = errors[line.key] ?? {};
              return (
                <tr key={line.key} className="border-t border-border align-top">
                  <td className="min-w-64 px-4 py-1.5">
                    <EntityCombobox
                      entity="items"
                      search={searchItemOptions}
                      value={line.itemId || null}
                      selectedLabel={line.itemLabel}
                      onChange={(value, option) => patch(line.key, { itemId: value ?? '', itemLabel: option?.label ?? '' })}
                      clearable={false}
                      placeholder="Search items"
                      aria-invalid={lineErrors.itemId ? true : undefined}
                      aria-describedby={undefined}
                    />
                    {lineErrors.itemId ? <p className="text-2xs font-medium text-danger">{lineErrors.itemId}</p> : null}
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`Quantity for line ${index + 1}`}
                      inputMode="decimal"
                      value={line.qty}
                      aria-invalid={lineErrors.qty ? true : undefined}
                      onChange={(event) => patch(line.key, { qty: event.target.value.replace(/[^\d.]/g, '') })}
                      className="num text-right"
                    />
                    {lineErrors.qty ? <p className="text-2xs font-medium text-danger">{lineErrors.qty}</p> : null}
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`${noteLabel} for line ${index + 1}`}
                      maxLength={300}
                      value={line.note}
                      onChange={(event) => patch(line.key, { note: event.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <IconButton
                      label={`Remove line ${index + 1}`}
                      size="sm"
                      disabled={lines.length === 1}
                      onClick={() => onChange(lines.filter((entry) => entry.key !== line.key))}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border p-2">
        <Button size="sm" onClick={() => onChange([...lines, blankItemQtyLine()])}>
          <Plus className="size-3.5" aria-hidden />
          Add line
        </Button>
      </div>
    </div>
  );
}
