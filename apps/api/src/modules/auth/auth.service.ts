import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Grant, SessionUser } from '@probuild/shared';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AppConfig } from '../../config/config.service';
import { AuditService } from '../../engines/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

export const SESSION_COOKIE = 'pb_session';

// Verified against when the email is unknown so response time does not reveal which emails exist.
let dummyHash: Promise<string> | undefined;
const getDummyHash = (): Promise<string> => (dummyHash ??= argon2.hash('probuild-dummy-password'));

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async login(
    email: string,
    password: string,
    meta: { ip?: string; userAgent?: string; requestId?: string },
  ): Promise<{ token: string; expiresAt: Date; user: SessionUser }> {
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    const valid = await argon2.verify(user?.passwordHash ?? (await getDummyHash()), password).catch(() => false);
    if (!user || !user.active || !valid) {
      await this.audit.record(this.prisma, {
        companyId: user?.companyId,
        userId: user?.id,
        entityType: 'User',
        entityId: user?.id ?? 'unknown',
        action: 'LOGIN_FAILED',
        ip: meta.ip,
        requestId: meta.requestId,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.get('SESSION_TTL_HOURS') * 3_600_000);
    await this.prisma.session.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 250) },
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.record(this.prisma, {
      companyId: user.companyId,
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'LOGIN',
      ip: meta.ip,
      requestId: meta.requestId,
    });

    const sessionUser = await this.loadSessionUser(user.id);
    if (!sessionUser) throw new UnauthorizedException('Invalid email or password');
    return { token, expiresAt, user: sessionUser };
  }

  async logout(token: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async resolveSession(token: string): Promise<SessionUser | null> {
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
    return this.loadSessionUser(session.userId);
  }

  async loadSessionUser(userId: string): Promise<SessionUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, active: true, deletedAt: null },
      include: {
        userRoleAssignments: { include: { role: { include: { permissions: true } } } },
      },
    });
    if (!user) return null;

    const grants: Grant[] = user.userRoleAssignments.flatMap((assignment) =>
      assignment.role.permissions.map((p) => ({
        module: p.module,
        action: p.action,
        companyId: assignment.companyId,
        branchId: assignment.branchId,
        projectId: assignment.projectId,
        warehouseId: assignment.warehouseId,
      })),
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      userType: user.userType,
      isSuperAdmin: user.isSuperAdmin,
      roles: [...new Set(user.userRoleAssignments.map((a) => a.role.name))],
      grants,
    };
  }
}
