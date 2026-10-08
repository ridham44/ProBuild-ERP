'use client';

import { newIdempotencyKey } from '@probuild/api-client';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { TextAreaField, TextField } from '@/components/common/form-controls';
import { FormField } from '@/components/common/form-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { searchWarehouseOptions, useWarehouse } from '@/features/warehouses/api/hooks';
import { saveErrorMessage } from '@/lib/api/errors';
import { formatPHP } from '@/lib/format';
import { useCreatePurchaseOrder } from '../api/hooks';

/** Raises a purchase order from an awarded quotation. Lines, prices and supplier come from the quotation. */
export function CreatePoFromQuotationDialog({
  open,
  onOpenChange,
  quotationId,
  supplierName,
  total,
  paymentTerms,
  defaultWarehouseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  supplierName: string;
  total: string;
  paymentTerms: string | null;
  defaultWarehouseId: string | null;
}) {
  const router = useRouter();
  const canPickWarehouse = useCan('organization.warehouse', 'VIEW');
  const create = useCreatePurchaseOrder();
  const [warehouseId, setWarehouseId] = React.useState(defaultWarehouseId ?? '');
  const [expectedDate, setExpectedDate] = React.useState('');
  const [terms, setTerms] = React.useState(paymentTerms ?? '');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const warehouse = useWarehouse(warehouseId);
  const key = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setWarehouseId(defaultWarehouseId ?? '');
      setTerms(paymentTerms ?? '');
      setError(null);
    }
  }, [open, defaultWarehouseId, paymentTerms]);

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (create.isPending) return;
    if (!warehouseId) {
      setError('Choose the warehouse this order is delivered to.');
      return;
    }
    setError(null);
    key.current ??= newIdempotencyKey();
    create.mutate(
      {
        idempotencyKey: key.current,
        body: {
          source: 'QUOTATION',
          quotationId,
          warehouseId,
          ...(expectedDate ? { expectedDate } : {}),
          ...(terms.trim() ? { paymentTerms: terms.trim() } : {}),
          ...(notes.trim() ? { terms: notes.trim() } : {}),
        },
      },
      {
        onSuccess: (po) => {
          key.current = null;
          toast.success('Purchase order created', `${po.number} is a draft. Review it, then submit for approval.`);
          router.push(`/procurement/orders/${po.id}`);
        },
        onError: (cause) =>
          setError(
            saveErrorMessage(cause),
          ),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (create.isPending ? undefined : onOpenChange(next))}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Create purchase order</DialogTitle>
          <DialogDescription>
            From the awarded quotation of {supplierName}, {formatPHP(total)}. The order is created as a draft.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <FormField label="Deliver to warehouse" required>
              {(field) => (
                <EntityCombobox
                  entity="warehouses"
                  id={field.id}
                  search={searchWarehouseOptions}
                  value={warehouseId || null}
                  {...(warehouse.data ? { selectedLabel: warehouse.data.name } : {})}
                  onChange={(value) => setWarehouseId(value ?? '')}
                  clearable={false}
                  disabled={!canPickWarehouse}
                  placeholder={canPickWarehouse ? 'Search warehouses' : 'Set on the requisition'}
                />
              )}
            </FormField>
            <TextField label="Expected delivery" type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
            <TextField label="Payment terms" value={terms} onChange={(event) => setTerms(event.target.value)} />
            <TextAreaField label="Terms and conditions" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={create.isPending}>
              Create purchase order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
