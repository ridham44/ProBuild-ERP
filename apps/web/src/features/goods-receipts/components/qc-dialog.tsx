'use client';

import * as React from 'react';
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
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { GoodsReceiptLine } from '@/lib/api/types';
import { formatQty } from '@/lib/format';
import type { InspectionInput } from '../api/hooks';
import {
  blankInspection,
  buildInspectionBody,
  validateInspection,
  type InspectionDraft,
} from '../model';

export type QcMode = 'inspect' | 'decide';

const COPY: Record<QcMode, { title: string; confirm: string; pass: string; fail: string; partial: string }> = {
  inspect: {
    title: 'Record QC inspection',
    confirm: 'Save inspection',
    pass: 'Pass: accept everything not rejected at the dock',
    fail: 'Fail: reject everything',
    partial: 'Partial: split between accepted, rejected and quarantine',
  },
  decide: {
    title: 'Quarantine decision',
    confirm: 'Record decision',
    pass: 'Release all quarantined stock to available stock',
    fail: 'Reject all quarantined stock back to the supplier',
    partial: 'Partial: release some, reject some, keep the rest in quarantine',
  },
};

function cleanQty(value: string): string {
  return value.replace(/[^\d.]/g, '');
}

/** QC outcome for one receipt line: before posting it records the inspection, afterwards it decides quarantined stock. */
export function QcDialog({
  open,
  onOpenChange,
  mode,
  line,
  underInspection,
  loading,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: QcMode;
  line: GoodsReceiptLine | null;
  underInspection: string;
  loading: boolean;
  error: string | null;
  onSubmit: (body: InspectionInput) => void;
}) {
  const [draft, setDraft] = React.useState<InspectionDraft>(blankInspection);
  const [showErrors, setShowErrors] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setDraft(blankInspection());
      setShowErrors(false);
    }
  }, [open]);

  const copy = COPY[mode];
  const errors = validateInspection(draft, underInspection);
  const serialized = line?.item.trackSerial ?? false;
  const partialAllowed = !(mode === 'decide' && serialized);
  const patch = (change: Partial<InspectionDraft>): void => setDraft((current) => ({ ...current, ...change }));
  const shown = showErrors ? errors : {};

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (loading) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    onSubmit(buildInspectionBody(draft));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (loading ? undefined : onOpenChange(next))}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {line ? `${line.item.name} (${line.item.sku}). ` : ''}
            Quantity under inspection: {formatQty(underInspection, line?.unit)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <FormField label="Outcome" required>
              {(field) => (
                <Select {...field} value={draft.outcome} onChange={(event) => patch({ outcome: event.target.value as InspectionDraft['outcome'] })}>
                  <option value="PASS">{copy.pass}</option>
                  <option value="FAIL">{copy.fail}</option>
                  {partialAllowed ? <option value="PARTIAL">{copy.partial}</option> : null}
                </Select>
              )}
            </FormField>
            {draft.outcome === 'PARTIAL' ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ['acceptedQty', 'Accepted'],
                    ['rejectedQty', 'Rejected'],
                    ['quarantineQty', 'Quarantine'],
                  ] as const
                ).map(([field, label]) => (
                  <FormField key={field} label={label} error={shown[field]} required>
                    {(control) => (
                      <Input
                        {...control}
                        inputMode="decimal"
                        value={draft[field]}
                        onChange={(event) => patch({ [field]: cleanQty(event.target.value) })}
                        className="num text-right"
                      />
                    )}
                  </FormField>
                ))}
              </div>
            ) : null}
            <TextField
              label="Reason"
              maxLength={500}
              required={draft.outcome !== 'PASS'}
              hint="Required when goods are rejected or quarantined."
              value={draft.reason}
              error={shown.reason}
              onChange={(event) => patch({ reason: event.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Test result" maxLength={500} value={draft.testResult} onChange={(event) => patch({ testResult: event.target.value })} />
              <TextField label="Certificate no." maxLength={80} value={draft.certificateNo} onChange={(event) => patch({ certificateNo: event.target.value })} />
            </div>
            <TextAreaField label="Remarks" maxLength={1000} value={draft.remarks} onChange={(event) => patch({ remarks: event.target.value })} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              {copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
