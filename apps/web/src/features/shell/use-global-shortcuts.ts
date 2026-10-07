'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type Handlers = {
  openPalette: () => void;
  openHelp: () => void;
  toggleSidebar: () => void;
};

const GO_TARGETS: Record<string, string> = { d: '/', a: '/approvals' };
const SEQUENCE_WINDOW_MS = 1200;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useGlobalShortcuts({ openPalette, openHelp, toggleSidebar }: Handlers): void {
  const router = useRouter();

  useEffect(() => {
    let goPressedAt = 0;

    function onKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openPalette();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === '?') {
        event.preventDefault();
        openHelp();
      } else if (key === '[') {
        toggleSidebar();
      } else if (key === 'g') {
        goPressedAt = Date.now();
      } else if (goPressedAt && Date.now() - goPressedAt < SEQUENCE_WINDOW_MS && GO_TARGETS[key]) {
        goPressedAt = 0;
        router.push(GO_TARGETS[key]);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openPalette, openHelp, toggleSidebar, router]);
}
