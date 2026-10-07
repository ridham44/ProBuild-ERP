import type { SessionUser } from '@probuild/shared';
import { getVisibleNav } from '@/features/shell/nav-registry';
import type { SearchResult } from './registry';

/** Built-in search over implemented pages the user may open. Works even when no domain registers a provider. */
export function searchNavigation(
  user: Pick<SessionUser, 'isSuperAdmin' | 'grants'>,
  query: string,
): SearchResult[] {
  const needle = query.trim().toLowerCase();
  const items = getVisibleNav(user).flatMap((group) =>
    group.items.map((item) => ({ item, group: group.label })),
  );
  return items
    .filter(
      ({ item, group }) =>
        needle === '' ||
        [item.label, group, ...(item.keywords ?? [])].some((text) =>
          text.toLowerCase().includes(needle),
        ),
    )
    .map(({ item, group }) => ({
      id: `nav:${item.id}`,
      title: item.label,
      subtitle: group,
      href: item.href,
      icon: item.icon,
    }));
}
