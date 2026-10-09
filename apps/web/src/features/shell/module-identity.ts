import type { ModuleTone, PageModule } from '@/components/common/page-module';
import { findNavItem, NAV_GROUPS, type NavGroupId } from './nav-registry';

/**
 * One accent family per module so pages are recognisable at a glance without separate palettes: projects are
 * structural (navy), procurement is interactive document flow (cobalt), inventory is operational (teal) and finance
 * is analytical (violet).
 */
const GROUP_TONES: Record<NavGroupId, ModuleTone> = {
  workspace: 'primary',
  projects: 'navy',
  procurement: 'primary',
  inventory: 'accent',
  finance: 'violet',
  people: 'neutral',
  equipment: 'neutral',
  subcontractors: 'neutral',
  documents: 'neutral',
  administration: 'neutral',
};

export function moduleForPath(pathname: string): PageModule | null {
  const item = findNavItem(pathname);
  if (!item) return null;
  const group = NAV_GROUPS.find((entry) => entry.id === item.group);
  return { icon: item.icon, tone: GROUP_TONES[item.group], label: group?.label ?? item.label };
}
