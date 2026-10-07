import type { SessionUser } from '@probuild/shared';
import type { LucideIcon } from 'lucide-react';

export type SearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  icon?: LucideIcon;
};

export type SearchContext = { user: SessionUser; signal: AbortSignal };

/** A domain registers one of these to make its records findable from the command palette. */
export type SearchProvider = {
  id: string;
  /** Group heading shown above this provider's results, e.g. "Purchase Orders". */
  group: string;
  /** Lower numbers render first. */
  order?: number;
  /** Minimum query length before the provider is called. */
  minQueryLength?: number;
  search: (query: string, context: SearchContext) => Promise<SearchResult[]> | SearchResult[];
};

const providers = new Map<string, SearchProvider>();
const listeners = new Set<() => void>();
let snapshot: SearchProvider[] = [];

function publish(): void {
  snapshot = [...providers.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  listeners.forEach((listener) => listener());
}

/** Returns an unregister function so features can clean up when unmounted. */
export function registerSearchProvider(provider: SearchProvider): () => void {
  providers.set(provider.id, provider);
  publish();
  return () => {
    providers.delete(provider.id);
    publish();
  };
}

export function subscribeSearchProviders(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSearchProviders(): SearchProvider[] {
  return snapshot;
}
