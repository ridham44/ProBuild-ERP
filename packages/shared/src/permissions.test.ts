import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLES, expandRolePermissions } from './permissions';

function can(roleName: string, module: string, action: string): boolean {
  const grants = DEFAULT_ROLES[roleName] ?? [];
  return expandRolePermissions(grants).some((p) => p.module === module && p.action === action);
}

describe('DEFAULT_ROLES', () => {
  it('lets every role that raises material requests see the warehouses to issue from', () => {
    const requesters = Object.keys(DEFAULT_ROLES).filter((role) => can(role, 'inventory.request', 'CREATE'));

    expect(requesters).toContain('Site Engineer');
    for (const role of requesters) {
      expect(can(role, 'organization.warehouse', 'VIEW'), role).toBe(true);
    }
  });

  it('keeps the warehouse lookup read-only for requesting roles', () => {
    expect(can('Site Engineer', 'organization.warehouse', 'EDIT')).toBe(false);
    expect(can('Foreman', 'organization.warehouse', 'CREATE')).toBe(false);
  });
});
