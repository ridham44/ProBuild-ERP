import { ForbiddenException, Injectable } from '@nestjs/common';
import type { PermissionActionKey, SessionUser } from '@probuild/shared';

export type AccessScope = { projectId?: string | null; warehouseId?: string | null; branchId?: string | null };

/** 'ALL' means the user is unrestricted for that dimension; otherwise the allowed ids. */
export type ScopeIds = 'ALL' | string[];

type Dimension = 'projectId' | 'warehouseId' | 'branchId';

@Injectable()
export class AccessService {
  can(user: SessionUser, module: string, action: PermissionActionKey, scope: AccessScope = {}): boolean {
    if (user.isSuperAdmin) return true;
    return user.grants.some(
      (g) =>
        g.module === module &&
        g.action === action &&
        this.dimensionAllows(g.projectId, scope.projectId) &&
        this.dimensionAllows(g.warehouseId, scope.warehouseId) &&
        this.dimensionAllows(g.branchId, scope.branchId),
    );
  }

  /** Throws 403 unless the user may perform the action on this specific record's scope. */
  assertCan(user: SessionUser, module: string, action: PermissionActionKey, scope: AccessScope = {}): void {
    if (!this.can(user, module, action, scope)) {
      throw new ForbiddenException(`You do not have ${action} permission on ${module} for this record`);
    }
  }

  projectScope(user: SessionUser, module: string, action: PermissionActionKey): ScopeIds {
    return this.scopeIds(user, module, action, 'projectId');
  }

  warehouseScope(user: SessionUser, module: string, action: PermissionActionKey): ScopeIds {
    return this.scopeIds(user, module, action, 'warehouseId');
  }

  /** Prisma where-fragment restricting a `projectId` column to the user's allowed projects. */
  projectWhere(user: SessionUser, module: string, action: PermissionActionKey): { projectId?: { in: string[] } } {
    const scope = this.projectScope(user, module, action);
    return scope === 'ALL' ? {} : { projectId: { in: scope } };
  }

  /** Prisma where-fragment restricting a `warehouseId` column to the user's allowed warehouses. */
  warehouseWhere(user: SessionUser, module: string, action: PermissionActionKey): { warehouseId?: { in: string[] } } {
    const scope = this.warehouseScope(user, module, action);
    return scope === 'ALL' ? {} : { warehouseId: { in: scope } };
  }

  // A grant with a null scope column covers every value; an unspecified record scope is not checked.
  private dimensionAllows(grantValue: string | null, recordValue: string | null | undefined): boolean {
    return grantValue === null || recordValue === undefined || recordValue === null || grantValue === recordValue;
  }

  private scopeIds(user: SessionUser, module: string, action: PermissionActionKey, dim: Dimension): ScopeIds {
    if (user.isSuperAdmin) return 'ALL';
    const matching = user.grants.filter((g) => g.module === module && g.action === action);
    if (matching.some((g) => g[dim] === null)) return 'ALL';
    return [...new Set(matching.map((g) => g[dim]).filter((v): v is string => v !== null))];
  }
}
