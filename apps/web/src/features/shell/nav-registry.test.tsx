import type { Grant, SessionUser } from '@probuild/shared';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { CurrentUserProvider, useCan } from '@/features/auth/components/current-user';
import { canUser } from '@/features/auth/permissions';
import { NAV_ITEMS, findNavItem, getVisibleNav, isNavItemVisible } from './nav-registry';

function grant(module: string, action: Grant['action'], scope: Partial<Grant> = {}): Grant {
  return {
    module,
    action,
    companyId: null,
    branchId: null,
    projectId: null,
    warehouseId: null,
    ...scope,
  };
}

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'u1',
    email: 'user@example.com',
    name: 'Test User',
    companyId: 'c1',
    userType: 'INTERNAL',
    isSuperAdmin: false,
    mustChangePassword: false,
    roles: [],
    grants: [],
    ...overrides,
  };
}

const flatIds = (user: SessionUser, showPlanned = false) =>
  getVisibleNav(user, { showPlanned }).flatMap((group) => group.items.map((item) => item.id));

describe('canUser (mirrors the API access rules)', () => {
  it('allows only exact module and action pairs', () => {
    const user = makeUser({ grants: [grant('security.user', 'VIEW')] });
    expect(canUser(user, 'security.user', 'VIEW')).toBe(true);
    expect(canUser(user, 'security.user', 'EDIT')).toBe(false);
    expect(canUser(user, 'security.role', 'VIEW')).toBe(false);
  });

  it('treats super administrators as unrestricted', () => {
    expect(canUser(makeUser({ isSuperAdmin: true }), 'anything.at.all', 'CLOSE')).toBe(true);
  });

  it('respects scoped grants but ignores an unspecified record scope', () => {
    const user = makeUser({ grants: [grant('projects.project', 'VIEW', { projectId: 'p1' })] });
    expect(canUser(user, 'projects.project', 'VIEW')).toBe(true);
    expect(canUser(user, 'projects.project', 'VIEW', { projectId: 'p1' })).toBe(true);
    expect(canUser(user, 'projects.project', 'VIEW', { projectId: 'p2' })).toBe(false);
  });
});

describe('navigation filtering', () => {
  it('shows the dashboard to every signed-in user', () => {
    expect(flatIds(makeUser())).toEqual(['dashboard']);
  });

  it('shows an entry only when the user can VIEW its module', () => {
    const user = makeUser({
      grants: [grant('security.user', 'VIEW'), grant('organization.branch', 'EDIT')],
    });
    const ids = flatIds(user);
    expect(ids).toContain('users');
    expect(ids).not.toContain('branches');
    expect(ids).not.toContain('roles');
  });

  it('never lists unimplemented areas by default, even for super administrators', () => {
    const ids = flatIds(makeUser({ isSuperAdmin: true }));
    expect(ids).toContain('users');
    expect(ids).toContain('purchase-orders');
    expect(ids).not.toContain('goods-receipts');
    expect(ids).not.toContain('stock');
    for (const item of NAV_ITEMS.filter((entry) => ids.includes(entry.id)))
      expect(item.implemented).toBe(true);
  });

  it('lists planned areas as such only when explicitly requested (development aid)', () => {
    const groups = getVisibleNav(makeUser({ isSuperAdmin: true }), { showPlanned: true });
    const receipts = groups.flatMap((group) => group.items).find((item) => item.id === 'goods-receipts');
    expect(receipts?.planned).toBe(true);
  });

  it('keeps groups in directive order and drops empty groups', () => {
    const user = makeUser({
      grants: [grant('organization.company', 'VIEW'), grant('finance.ledger', 'VIEW')],
    });
    expect(getVisibleNav(user).map((group) => group.id)).toEqual([
      'workspace',
      'finance',
      'administration',
    ]);
  });

  it('exposes the per-item rule used by search', () => {
    const planned = NAV_ITEMS.find((item) => !item.implemented);
    expect(planned).toBeDefined();
    expect(
      isNavItemVisible(makeUser({ isSuperAdmin: true }), planned as NonNullable<typeof planned>),
    ).toBe(false);
  });

  it('resolves the active entry from a pathname', () => {
    expect(findNavItem('/')?.id).toBe('dashboard');
    expect(findNavItem('/admin/users')?.id).toBe('users');
    expect(findNavItem('/admin/users/123')?.id).toBe('users');
    expect(findNavItem('/nowhere')).toBeUndefined();
  });
});

describe('procurement and master-data entries', () => {
  it('shows each new screen only to roles that can view its module', () => {
    const buyer = makeUser({
      grants: [
        grant('procurement.requisition', 'VIEW'),
        grant('procurement.rfq', 'VIEW'),
        grant('procurement.order', 'VIEW'),
        grant('parties.supplier', 'VIEW'),
        grant('inventory.item', 'VIEW'),
      ],
    });
    expect(flatIds(buyer)).toEqual([
      'dashboard',
      'suppliers',
      'requests',
      'rfqs',
      'quotations',
      'purchase-orders',
      'items',
    ]);
    const engineer = makeUser({
      grants: [grant('projects.project', 'VIEW'), grant('projects.costcode', 'VIEW'), grant('procurement.requisition', 'VIEW')],
    });
    expect(flatIds(engineer)).toEqual(['dashboard', 'projects', 'cost-codes', 'requests']);
  });

  it('resolves detail and sub-routes to their entry, preferring the most specific', () => {
    expect(findNavItem('/projects/cost-codes')?.id).toBe('cost-codes');
    expect(findNavItem('/projects/abc')?.id).toBe('projects');
    expect(findNavItem('/procurement/orders/abc/edit')?.id).toBe('purchase-orders');
    expect(findNavItem('/procurement/requests/new')?.id).toBe('requests');
    expect(findNavItem('/inventory/warehouses/x')?.id).toBe('warehouses');
  });
});

describe('useCan', () => {
  function wrapperFor(user: SessionUser) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <CurrentUserProvider user={user}>{children}</CurrentUserProvider>;
    };
  }

  it('reads the current user grants', () => {
    const user = makeUser({ grants: [grant('approvals.inbox', 'APPROVE')] });
    const approve = renderHook(() => useCan('approvals.inbox', 'APPROVE'), {
      wrapper: wrapperFor(user),
    });
    const reject = renderHook(() => useCan('approvals.inbox', 'REJECT'), {
      wrapper: wrapperFor(user),
    });
    expect(approve.result.current).toBe(true);
    expect(reject.result.current).toBe(false);
  });

  it('throws outside a CurrentUserProvider', () => {
    expect(() => renderHook(() => useCan('x.y', 'VIEW'))).toThrow(/CurrentUserProvider/);
  });
});
