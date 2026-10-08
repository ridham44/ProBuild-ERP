'use client';

import * as React from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';

export type ReasonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  fieldLabel?: string;
  /** The API requires at least this many characters for a reason. */
  minLength?: number;
  required?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
};

/** Confirmation that records why. Cancel, close, reject and status changes all need a reason. */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  fieldLabel = 'Reason',
  minLength = 3,
  required = true,
  loading = false,
  error,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = React.useState('');
  const id = React.useId();
  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const trimmed = reason.trim();
  const valid = required
    ? trimmed.length >= minLength
    : trimmed.length === 0 || trimmed.length >= minLength;
  return (
    <Dialog open={open} onOpenChange={(next) => (loading ? undefined : onOpenChange(next))}>
      <DialogContent size="sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && !loading) onConfirm(trimmed);
          }}
          className="flex min-h-0 flex-col"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div className="space-y-1">
              <Label htmlFor={id} required={required}>
                {fieldLabel}
              </Label>
              <Textarea
                id={id}
                rows={3}
                maxLength={500}
                autoFocus
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              {required && trimmed.length > 0 && trimmed.length < minLength ? (
                <p className="text-xs text-danger">Enter at least {minLength} characters.</p>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={tone === 'danger' ? 'danger' : 'primary'}
              loading={loading}
              disabled={!valid}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
