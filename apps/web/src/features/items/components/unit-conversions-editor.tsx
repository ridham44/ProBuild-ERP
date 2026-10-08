'use client';

import { Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api/errors';
import type { ItemDetail } from '@/lib/api/types';
import { formatQty } from '@/lib/format';
import { useDeleteUnitConversion, useSetUnitConversion, useUoms } from '../api/hooks';

const FACTOR = /^\d+(\.\d+)?$/;

/** Extra units an item can be bought or issued in, each defined as a factor of the base unit. */
export function UnitConversionsEditor({ item }: { item: ItemDetail }) {
  const uoms = useUoms();
  const save = useSetUnitConversion(item.id);
  const remove = useDeleteUnitConversion(item.id);
  const [unit, setUnit] = React.useState('');
  const [factor, setFactor] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const validFactor = FACTOR.test(factor) && Number(factor) > 0;
  const choices = (uoms.data?.items ?? []).filter((uom) => uom.code !== item.baseUnit);

  function add(): void {
    setError(null);
    if (!unit || !validFactor) {
      setError('Choose a unit and enter a factor greater than zero.');
      return;
    }
    save.mutate(
      { unit, factor },
      {
        onSuccess: () => {
          toast.success('Conversion saved', `1 ${unit} = ${formatQty(factor)} ${item.baseUnit}`);
          setUnit('');
          setFactor('');
        },
        onError: (cause) => setError(errorMessage(cause)),
      },
    );
  }

  return (
    <div className="space-y-2 rounded border border-border p-3">
      <p className="text-sm font-medium">Unit conversions</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {item.unitConversions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No extra units yet.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {item.unitConversions.map((conversion) => (
            <li key={conversion.id} className="flex items-center justify-between py-1.5">
              <span className="num">
                1 <span className="font-mono">{conversion.unit}</span> = {formatQty(conversion.factor)}{' '}
                <span className="font-mono">{item.baseUnit}</span>
              </span>
              <IconButton
                label={`Remove ${conversion.unit} conversion`}
                size="sm"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(conversion.unit, {
                    onError: (cause) => toast.error('Could not remove it', errorMessage(cause)),
                  })
                }
              >
                <Trash2 className="size-3.5" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
        <div className="w-36 space-y-1">
          <Label htmlFor="conv-unit">Unit</Label>
          <Select id="conv-unit" value={unit} onChange={(event) => setUnit(event.target.value)}>
            <option value="">Select</option>
            {choices.map((uom) => (
              <option key={uom.id} value={uom.code}>
                {uom.code}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-36 space-y-1">
          <Label htmlFor="conv-factor">Equals ({item.baseUnit})</Label>
          <Input
            id="conv-factor"
            inputMode="decimal"
            className="num text-right"
            value={factor}
            onChange={(event) => setFactor(event.target.value.replace(/[^\d.]/g, ''))}
          />
        </div>
        <Button onClick={add} loading={save.isPending}>
          <Plus className="size-3.5" aria-hidden />
          Add conversion
        </Button>
      </div>
    </div>
  );
}
