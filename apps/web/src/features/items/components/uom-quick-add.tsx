'use client';

import { Plus } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { errorMessage } from '@/lib/api/errors';
import { useCreateUom } from '../api/hooks';

/** Lets a buyer define a missing unit (bag, cu.m, pc) without leaving the item form. */
export function UomQuickAdd({ empty }: { empty: boolean }) {
  const canCreate = useCan('inventory.item', 'CREATE');
  const create = useCreateUom();
  const [open, setOpen] = React.useState(empty);
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  if (!canCreate) return null;
  if (!open && !empty) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-primary hover:underline"
      >
        Unit missing? Add one
      </button>
    );
  }

  function add(): void {
    if (!code.trim() || !name.trim()) return;
    create.mutate(
      { code: code.trim(), name: name.trim() },
      {
        onSuccess: () => {
          toast.success('Unit added', `${code.trim()} is now available in the unit lists.`);
          setCode('');
          setName('');
          setOpen(false);
        },
        onError: (error) => toast.error('Could not add the unit', errorMessage(error)),
      },
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded border border-dashed border-border-strong p-2">
      <div className="w-24 space-y-1">
        <Label htmlFor="uom-code">Code</Label>
        <Input id="uom-code" value={code} maxLength={12} onChange={(event) => setCode(event.target.value)} className="font-mono" />
      </div>
      <div className="w-48 space-y-1">
        <Label htmlFor="uom-name">Name</Label>
        <Input id="uom-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <Button onClick={add} loading={create.isPending} disabled={!code.trim() || !name.trim()}>
        <Plus className="size-3.5" aria-hidden />
        Add unit
      </Button>
      {empty ? null : (
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      )}
    </div>
  );
}
