import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Grant, SessionUser } from '@probuild/shared';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { AppConfig } from '../../config/config.service';
import { AuditService } from '../../engines/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

export const SESSION_COOKIE = 'pb_session';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const RESET_TOKEN_HOURS = 1;
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

// Verified against when the email is unknown so response time does not reveal which emails exist.
let dummyHash: Promise<string> | undefined;
const getDummyHash = (): Promise<string> => (dummyHash ??= argon2.hash('probuild-dummy-password'));

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type ClientMetaInfo = { ip?: string; userAgent?: string; requestId?: string };
export type ResolvedSession = { user: SessionUser; sessionId: string };

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
    meta: ClientMetaInfo,
  ): Promise<{ token: string; expiresAt: Date; user: SessionUser }> {
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    const locked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
    const valid = await argon2.verify(user?.passwordHash ?? (await getDummyHash()), password).catch(() => false);

    if (!user || !user.active || locked || !valid) {
      await this.recordFailure(user, locked, meta);
      // One generic message for unknown email, wrong password, inactive and locked accounts.
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.get('SESSION_TTL_HOURS') * 3_600_000);
    await this.prisma.$transaction(async (tx) => {
      await tx.session.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 250) },
      });
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
      await this.audit.record(tx, {
        companyId: user.companyId,
        userId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'LOGIN',
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
    });

    const sessionUser = await this.loadSessionUser(user.id);
    if (!sessionUser) throw new UnauthorizedException('Invalid email or password');
    return { token, expiresAt, user: sessionUser };
  }

  async logout(token: string, user: SessionUser, meta: ClientMetaInfo): Promise<void> {
    await this.prisma.session.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record(this.prisma, {
      companyId: user.companyId,
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'LOGOUT',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  }

  async resolveSession(token: string): Promise<ResolvedSession | null> {
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
    const user = await this.loadSessionUser(session.userId);
    if (!user) return null;
    if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }
    return { user, sessionId: session.id };
  }

  // ---- Password -----------------------------------------------------------------------------

  async changePassword(
    user: SessionUser,
    sessionId: string,
    input: { currentPassword: string; newPassword: string },
    meta: ClientMetaInfo,
  ): Promise<void> {
    const record = await this.prisma.user.findFirstOrThrow({ where: { id: user.id } });
    if (!(await argon2.verify(record.passwordHash, input.currentPassword).catch(() => false))) {
      await this.audit.record(this.prisma, {
        companyId: user.companyId,
        userId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'PASSWORD_CHANGE_FAILED',
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new BusinessRuleError('Current password is incorrect');
    }
    if (input.newPassword === input.currentPassword) throw new BusinessRuleError('Choose a password different from the current one');
    const emailName = user.email.split('@')[0]?.toLowerCase();
    if (emailName && emailName.length >= 4 && input.newPassword.toLowerCase().includes(emailName)) {
      throw new BusinessRuleError('Password must not contain your email name');
    }
    const passwordHash = await argon2.hash(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false } });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null, id: { not: sessionId } },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(tx, {
        companyId: user.companyId,
        userId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'PASSWORD_CHANGED',
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
    });
  }

  /** Admin-initiated reset. Returns the one-time token; the admin delivers it to the user out of band. */
  async issuePasswordReset(actor: SessionUser, targetUserId: string, meta: ClientMetaInfo): Promise<{ token: string; expiresAt: Date }> {
    const target = await this.prisma.user.findFirst({ where: { id: targetUserId, companyId: actor.companyId, deletedAt: null } });
    if (!target) throw new NotFoundError('User', targetUserId);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_HOURS * 3_600_000);
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({ where: { userId: target.id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.passwordResetToken.create({ data: { userId: target.id, tokenHash: hashToken(token), expiresAt, createdById: actor.id } });
      await this.audit.record(tx, {
        companyId: actor.companyId,
        userId: actor.id,
        entityType: 'User',
        entityId: target.id,
        action: 'PASSWORD_RESET_ISSUED',
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
    });
    return { token, expiresAt };
  }

  async confirmPasswordReset(token: string, newPassword: string, meta: ClientMetaInfo): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.active || record.user.deletedAt) {
      throw new BusinessRuleError('This reset link is invalid or has expired');
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count === 0) throw new BusinessRuleError('This reset link is invalid or has expired');
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
      });
      await tx.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record(tx, {
        companyId: record.user.companyId,
        userId: record.userId,
        entityType: 'User',
        entityId: record.userId,
        action: 'PASSWORD_RESET_COMPLETED',
        ip: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
    });
  }

  // ---- Sessions -----------------------------------------------------------------------------

  listSessions(user: SessionUser, currentSessionId: string) {
    return this.prisma.session
      .findMany({
        where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastSeenAt: 'desc' },
        select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true },
        take: 50,
      })
      .then((rows) => rows.map((r) => ({ ...r, current: r.id === currentSessionId })));
  }

  async revokeSession(user: SessionUser, sessionId: string): Promise<void> {
    const result = await this.prisma.session.updateMany({ where: { id: sessionId, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (result.count === 0) throw new NotFoundError('Session', sessionId);
    await this.audit.record(this.prisma, { companyId: user.companyId, userId: user.id, entityType: 'Session', entityId: sessionId, action: 'SESSION_REVOKED' });
  }

  async revokeOtherSessions(user: SessionUser, currentSessionId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null, id: { not: currentSessionId } },
      data: { revokedAt: new Date() },
    });
    await this.audit.record(this.prisma, {
      companyId: user.companyId,
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'OTHER_SESSIONS_REVOKED',
      after: { count: result.count },
    });
    return result.count;
  }

  // ---- Helpers ------------------------------------------------------------------------------

  private async recordFailure(
    user: { id: string; companyId: string; failedLoginCount: number } | null,
    locked: boolean,
    meta: ClientMetaInfo,
  ): Promise<void> {
    if (user && !locked) {
      const failures = user.failedLoginCount + 1;
      const lockNow = failures >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: lockNow ? 0 : failures, ...(lockNow ? { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : {}) },
      });
    }
    await this.audit.record(this.prisma, {
      companyId: user?.companyId,
      userId: user?.id,
      entityType: 'User',
      entityId: user?.id ?? 'unknown',
      action: locked ? 'LOGIN_BLOCKED_LOCKED' : 'LOGIN_FAILED',
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  }

  async loadSessionUser(userId: string): Promise<SessionUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, active: true, deletedAt: null, company: { active: true, deletedAt: null } },
      include: { userRoleAssignments: { include: { role: { include: { permissions: true } } } } },
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
      mustChangePassword: user.mustChangePassword,
      roles: [...new Set(user.userRoleAssignments.map((a) => a.role.name))],
      grants,
    };
  }
}
