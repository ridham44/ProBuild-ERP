import { Injectable } from '@nestjs/common';
import { Db, PrismaService } from '../../prisma/prisma.service';

export type NotifyInput = {
  companyId: string;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
};

/** In-app notifications. Email/SMS/WhatsApp providers plug in behind this service later. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyUsers(userIds: string[], input: NotifyInput, db: Db = this.prisma): Promise<number> {
    if (userIds.length === 0) return 0;
    const result = await db.notification.createMany({
      data: [...new Set(userIds)].map((userId) => ({
        companyId: input.companyId,
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      })),
    });
    return result.count;
  }

  /** Notifies every active user holding the named role in the company. */
  async notifyRole(roleName: string, input: NotifyInput, db: Db = this.prisma): Promise<number> {
    const assignments = await db.userRoleAssignment.findMany({
      where: { role: { companyId: input.companyId, name: roleName }, user: { active: true, deletedAt: null } },
      select: { userId: true },
    });
    return this.notifyUsers(assignments.map((a) => a.userId), input, db);
  }
}
