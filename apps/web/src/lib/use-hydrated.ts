'use client';

import { useSyncExternalStore } from 'react';

const subscribe = (): (() => void) => () => undefined;

/**
 * False during server render and until React has hydrated. Password forms keep their submit button
 * disabled until then so an early click cannot fall back to a native GET that puts credentials in the URL.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
