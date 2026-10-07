'use client';

import { Copy } from 'lucide-react';
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
import { toast } from '@/components/ui/toast';
import { copyToClipboard } from '@/lib/clipboard';
import { formatDateTime } from '@/lib/format';
import { resetLinkPath } from '../schemas';

export type ResetLink = { userName: string; token: string; expiresAt: string };

/** Shows the one-time token exactly once; closing the dialog discards it. */
export function ResetLinkDialog({
  link,
  onClose,
}: {
  link: ResetLink | null;
  onClose: () => void;
}) {
  const url = link ? `${window.location.origin}${resetLinkPath(link.token)}` : '';

  async function copy(): Promise<void> {
    const copied = await copyToClipboard(url);
    if (copied) toast.info('Reset link copied');
    else toast.error('Could not copy', 'Select the link and copy it manually.');
  }

  return (
    <Dialog open={link !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Reset link for {link?.userName}</DialogTitle>
          <DialogDescription>
            Give this link to the user through a secure channel. It works once.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Alert tone="warning" title="This link is shown only once">
            It expires {link ? formatDateTime(link.expiresAt) : ''}. Opening it signs the user out
            of every session. If you lose it, issue a new one.
          </Alert>
          <div className="flex gap-2">
            <Input
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="font-mono text-xs"
              aria-label="One-time reset link"
            />
            <Button onClick={() => void copy()}>
              <Copy className="size-3.5" aria-hidden />
              Copy
            </Button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
