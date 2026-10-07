import { ForbiddenException, Injectable } from '@nestjs/common';
import { PermissionAction, Prisma } from '@prisma/client';
import { MODULES, type AssignRoleInput, type CreateUserInput, type SessionUser } from '@probuild/shared';
import * as argon2 from 'argon2';
import { AccessService } from '../../common/access.service';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../common/errors/domain-errors';
import { AuditService } from '../../engines/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

const userSelect = {
  id: true,
  email: true,
  name: true,
  userType: true,
  active: true,
  isSuperAdmin: true,
  lastLoginAt: true,
  createdAt: true,
  userRoleAssignments: {
    select: {
      id: true,
      companyId: true,
      branchId: true,
      projectId: true,
      warehouseId: true,
      role: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class SecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
  ) {}

  listUsers(user: SessionUser, search?: string) {
    return this.prisma.user.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      select: userSelect,
      orderBy: { name: 'asc' },
      take: 100,
    });
  }

  async createUser(actor: SessionUser, input: CreateUserInput) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictError('A user with this email already exists');

    const roles = await this.prisma.role.findMany({
      where: { id: { in: input.roleIds }, companyId: actor.companyId },
      include: { permissions: true },
    });
    if (roles.length !== input.roleIds.length) throw new BusinessRuleError('One or more roles do not exist');
    this.assertRolesGrantable(actor, roles);

    const passwordHash = await argon2.hash(input.password);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          companyId: actor.companyId,
          email: input.email,
          name: input.name,
          passwordHash,
          mustChangePassword: true,
          passwordChangedAt: null,
          userType: input.userType,
          customerId: input.customerId,
          supplierId: input.supplierId,
          subcontractorId: input.subcontractorId,
          employeeId: input.employeeId,
          userRoleAssignments: { create: input.roleIds.map((roleId) => ({ roleId })) },
        },
        select: userSelect,
      });
      await this.audit.record(tx, {
        companyId: actor.companyId,
        userId: actor.id,
        entityType: 'User',
        entityId: created.id,
        action: 'CREATE',
        after: created,
      });
      return created;
    });
  }

  async setActive(actor: SessionUser, userId: string, active: boolean) {
    if (actor.id === userId && !active) throw new BusinessRuleError('You cannot deactivate your own account');
    const target = await this.prisma.user.findFirst({ where: { id: userId, companyId: actor.companyId, deletedAt: null } });
    if (!target) throw new NotFoundError('User', userId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: userId }, data: { active }, select: userSelect });
      if (!active) await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record(tx, {
        companyId: actor.companyId,
        userId: actor.id,
        entityType: 'User',
        entityId: userId,
        action: active ? 'ACTIVATE' : 'DEACTIVATE',
        before: { active: target.active },
        after: { active },
      });
      return updated;
    });
  }

  async assignRole(actor: SessionUser, userId: string, input: AssignRoleInput) {
    const [target, role] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, companyId: actor.companyId, deletedAt: null } }),
      this.prisma.role.findFirst({ where: { id: input.roleId, companyId: actor.companyId }, include: { permissions: true } }),
    ]);
    if (!target) throw new NotFoundError('User', userId);
    if (!role) throw new NotFoundError('Role', input.roleId);
    this.assertRolesGrantable(actor, [role], { projectId: input.projectId, warehouseId: input.warehouseId, branchId: input.branchId });

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.userRoleAssignment.create({
        data: { userId, roleId: input.roleId, companyId: input.companyId, branchId: input.branchId, projectId: input.projectId, warehouseId: input.warehouseId },
      });
      await this.audit.record(tx, {
        companyId: actor.companyId,
        userId: actor.id,
        entityType: 'User',
        entityId: userId,
        action: 'ROLE_ASSIGNED',
        after: { role: role.name, scope: input },
      });
      return assignment;
    });
  }

  async removeAssignment(actor: SessionUser, userId: string, assignmentId: string): Promise<void> {
    const assignment = await this.prisma.userRoleAssignment.findFirst({
      where: { id: assignmentId, userId, user: { companyId: actor.companyId } },
      include: { role: true },
    });
    if (!assignment) throw new NotFoundError('Role assignment', assignmentId);
    await this.prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.delete({ where: { id: assignmentId } });
      await this.audit.record(tx, {
        companyId: actor.companyId,
        userId: actor.id,
        entityType: 'User',
        entityId: userId,
        action: 'ROLE_REMOVED',
        before: { role: assignment.role.name },
      });
    });
  }

  listRoles(user: SessionUser) {
    return this.prisma.role.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: 'asc' },
      include: { permissions: { select: { module: true, action: true } }, _count: { select: { userRoleAssignments: true } } },
    });
  }

  /** Replaces a role's permission set. System roles can be edited but not renamed or deleted. */
  async setRolePermissions(actor: SessionUser, roleId: string, permissions: Array<{ module: string; action: PermissionAction }>) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, companyId: actor.companyId }, include: { permissions: true } });
    if (!role) throw new NotFoundError('Role', roleId);
    if (role.isSystem && !actor.isSuperAdmin && ['Super Admin', 'Company Admin'].includes(role.name)) {
      throw new ForbiddenException('Only a super administrator can change the administrator roles');
    }
    this.access.assertCanGrant(actor, permissions);
    const known = new Set<string>(MODULES);
    const unknown = permissions.find((p) => !known.has(p.module));
    if (unknown) throw new BusinessRuleError(`Unknown module ${unknown.module}`);

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId, module: p.module, action: p.action })), skipDuplicates: true });
      await this.audit.record(tx, {
        companyId: actor.companyId,
        userId: actor.id,
        entityType: 'Role',
        entityId: roleId,
        action: 'PERMISSIONS_REPLACED',
        before: role.permissions.map((p) => `${p.module}:${p.action}`),
        after: permissions.map((p) => `${p.module}:${p.action}`),
      });
    });
    return this.listRoles(actor).then((roles) => roles.find((r) => r.id === roleId));
  }

  /** A role may only be handed out by someone who holds every permission in it over the target scope. */
  private assertRolesGrantable(
    actor: SessionUser,
    roles: Array<{ name: string; isSystem: boolean; permissions: Array<{ module: string; action: PermissionAction }> }>,
    scope: { projectId?: string | null; warehouseId?: string | null; branchId?: string | null } = {},
  ): void {
    for (const role of roles) {
      if (!actor.isSuperAdmin && role.isSystem && ['Super Admin', 'Company Admin'].includes(role.name)) {
        throw new ForbiddenException('Only a super administrator can assign the administrator roles');
      }
      this.access.assertCanGrant(actor, role.permissions, scope);
    }
  }

  async createRole(actor: SessionUser, name: string, description?: string) {
    const exists = await this.prisma.role.findUnique({ where: { companyId_name: { companyId: actor.companyId, name } } });
    if (exists) throw new ConflictError('A role with this name already exists');
    return this.prisma.role.create({ data: { companyId: actor.companyId, name, description } });
  }
}
