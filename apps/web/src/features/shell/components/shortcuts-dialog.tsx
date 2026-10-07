'use client';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';

export const SHORTCUTS: ReadonlyArray<{ keys: string[]; description: string }> = [
  { keys: ['Ctrl / ⌘', 'K'], description: 'Open search and quick navigation' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['['], description: 'Collapse or expand the sidebar' },
  { keys: ['G', 'D'], description: 'Go to dashboard' },
  { keys: ['G', 'A'], description: 'Go to approvals' },
  { keys: ['↑', '↓'], description: 'Move between rows in a table' },
  { keys: ['Enter'], description: 'Open the focused table row' },
  { keys: ['Space'], description: 'Select the focused row in a selectable table' },
  { keys: ['Esc'], description: 'Close dialogs, drawers and menus' },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts are ignored while you are typing in a field.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <dl className="divide-y divide-border">
            {SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.description}
                className="flex items-center justify-between gap-4 py-2"
              >
                <dt className="text-sm">{shortcut.description}</dt>
                <dd className="flex shrink-0 items-center gap-1">
                  {shortcut.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
