import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Db } from '../../prisma/prisma.service';

export type AuditEntry = {
  companyId?: string | null;
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  sourceType?: string;
  sourceId?: string;
  ip?: string;
  requestId?: string;
};

const SENSITIVE_KEYS = new Set(['passwordHash', 'password', 'tokenHash', 'signature']);

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return JSON.parse(
    JSON.stringify(value, (key, v: unknown) => (SENSITIVE_KEYS.has(key) ? '[redacted]' : v)),
  ) as Prisma.InputJsonValue;
}

/** Append-only audit trail: before/after, user, time, reason, source transaction. */
@Injectable()
export class AuditService {
  async record(db: Db, entry: AuditEntry): Promise<void> {
    await db.auditLog.create({
      data: {
        companyId: entry.companyId ?? null,
        userId: entry.userId ?? null,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        before: toJson(entry.before),
        after: toJson(entry.after),
        reason: entry.reason ?? null,
        sourceType: entry.sourceType ?? null,
        sourceId: entry.sourceId ?? null,
        ip: entry.ip ?? null,
        requestId: entry.requestId ?? null,
      },
    });
  }
}
