import type { SessionUser } from '@probuild/shared';
import { AuditService } from '../engines/audit/audit.service';
import { Db, PrismaService } from '../prisma/prisma.service';

/**
 * Shared plumbing for feature services: one transaction per write, with the audit row inside it so a
 * change and its trail either both exist or neither does.
 */
export abstract class AuditedService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly audit: AuditService,
  ) {}

  protected createAudited<T extends { id: string }>(user: SessionUser, entityType: string, run: (tx: Db) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const created = await run(tx);
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType, entityId: created.id, action: 'CREATE', after: created });
      return created;
    });
  }

  protected updateAudited<T extends { id: string }>(user: SessionUser, entityType: string, before: unknown, run: (tx: Db) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const after = await run(tx);
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType, entityId: after.id, action: 'UPDATE', before, after });
      return after;
    });
  }

  protected softDeleteAudited(user: SessionUser, entityType: string, before: { id: string }, run: (tx: Db) => Promise<unknown>): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await run(tx);
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType, entityId: before.id, action: 'DELETE', before });
    });
  }
}
