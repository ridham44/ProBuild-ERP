import type { Grant, PermissionActionKey, SessionUser } from '@probuild/shared';

export type AccessScope = {
  projectId?: string | null;
  warehouseId?: string | null;
  branchId?: string | null;
};

type UserGrants = Pick<SessionUser, 'isSuperAdmin' | 'grants'>;

/** A grant with a null scope column covers every value; an unspecified record scope is not checked. */
function dimensionAllows(
  grantValue: string | null,
  recordValue: string | null | undefined,
): boolean {
  return (
    grantValue === null ||
    recordValue === undefined ||
    recordValue === null ||
    grantValue === recordValue
  );
}

function grantMatches(
  grant: Grant,
  module: string,
  action: PermissionActionKey,
  scope: AccessScope,
): boolean {
  return (
    grant.module === module &&
    grant.action === action &&
    dimensionAllows(grant.projectId, scope.projectId) &&
    dimensionAllows(grant.warehouseId, scope.warehouseId) &&
    dimensionAllows(grant.branchId, scope.branchId)
  );
}

/**
 * Mirrors AccessService.can in the API. This only decides what to show; the API remains the authority
 * and rejects anything the user may not do.
 */
export function canUser(
  user: UserGrants,
  module: string,
  action: PermissionActionKey,
  scope: AccessScope = {},
): boolean {
  if (user.isSuperAdmin) return true;
  return user.grants.some((grant) => grantMatches(grant, module, action, scope));
}
