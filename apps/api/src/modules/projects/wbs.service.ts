import { Injectable } from '@nestjs/common';
import type { WbsNode } from '@prisma/client';
import type { CreateWbsNodeInput, MoveWbsNodeInput, SessionUser, UpdateWbsNodeInput } from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { ProjectAccessService } from '../../common/project-access.service';
import { ActivityService } from '../../engines/activity/activity.service';
import { AuditService } from '../../engines/audit/audit.service';
import { Db, PrismaService } from '../../prisma/prisma.service';

const MAX_DEPTH = 10;

export type WbsRow = WbsNode & { depth: number; hasChildren: boolean };

@Injectable()
export class WbsService extends AuditedService {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly projectAccess: ProjectAccessService,
    private readonly activity: ActivityService,
  ) {
    super(prisma, audit);
  }

  /** The whole project tree flattened depth-first (siblings by sortOrder then code); clients rebuild nesting from parentId. */
  async tree(user: SessionUser, projectId: string): Promise<WbsRow[]> {
    await this.projectAccess.load(user, projectId, 'projects.wbs', 'VIEW');
    const nodes = await this.prisma.wbsNode.findMany({
      where: { projectId, companyId: user.companyId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      take: 5000,
    });
    const byParent = new Map<string | null, WbsNode[]>();
    for (const n of nodes) {
      const siblings = byParent.get(n.parentId) ?? [];
      siblings.push(n);
      byParent.set(n.parentId, siblings);
    }
    const out: WbsRow[] = [];
    const visit = (parentId: string | null, depth: number): void => {
      for (const n of byParent.get(parentId) ?? []) {
        out.push({ ...n, depth, hasChildren: (byParent.get(n.id) ?? []).length > 0 });
        visit(n.id, depth + 1);
      }
    };
    visit(null, 1);
    return out;
  }

  async create(user: SessionUser, projectId: string, input: CreateWbsNodeInput) {
    const project = await this.projectAccess.load(user, projectId, 'projects.wbs', 'CREATE');
    this.projectAccess.assertNotEnded(project);
    let level = 1;
    if (input.parentId) {
      const parent = await this.prisma.wbsNode.findFirst({ where: { id: input.parentId, projectId, deletedAt: null } });
      if (!parent) throw new BusinessRuleError('Parent WBS node does not belong to this project');
      level = parent.level + 1;
      if (level > MAX_DEPTH) throw new BusinessRuleError(`WBS cannot be deeper than ${MAX_DEPTH} levels`);
    }
    return this.createAudited(user, 'WbsNode', (tx) =>
      tx.wbsNode.create({
        data: {
          companyId: user.companyId,
          projectId,
          parentId: input.parentId ?? null,
          code: input.code,
          name: input.name,
          level,
          sortOrder: input.sortOrder ?? 0,
          weightPct: input.weightPct ?? '0',
        },
      }),
    );
  }

  async update(user: SessionUser, id: string, input: UpdateWbsNodeInput) {
    const before = await this.load(user, id, 'EDIT');
    return this.updateAudited(user, 'WbsNode', before, (tx) => tx.wbsNode.update({ where: { id }, data: input }));
  }

  /** Re-parents a node (and its subtree) within the same project; refuses cycles and over-deep trees. */
  async move(user: SessionUser, id: string, input: MoveWbsNodeInput) {
    const before = await this.load(user, id, 'EDIT');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${before.projectId} FOR UPDATE`;
      const nodes = await tx.wbsNode.findMany({ where: { projectId: before.projectId, deletedAt: null }, select: { id: true, parentId: true, level: true } });
      const byId = new Map(nodes.map((n) => [n.id, n]));
      let newLevel = 1;
      if (input.parentId) {
        const parent = byId.get(input.parentId);
        if (!parent) throw new BusinessRuleError('Target parent does not belong to this project');
        for (let cursor: string | null = input.parentId, hops = 0; cursor && hops < 100; hops++) {
          if (cursor === id) throw new BusinessRuleError('A WBS node cannot be moved under itself or one of its descendants');
          cursor = byId.get(cursor)?.parentId ?? null;
        }
        newLevel = parent.level + 1;
      }
      const delta = newLevel - before.level;
      const subtree = this.descendants(nodes, id);
      const deepest = Math.max(before.level, ...subtree.map((n) => n.level)) + delta;
      if (deepest > MAX_DEPTH) throw new BusinessRuleError(`WBS cannot be deeper than ${MAX_DEPTH} levels`);

      const moved = await tx.wbsNode.update({
        where: { id },
        data: { parentId: input.parentId, level: newLevel, ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }) },
      });
      if (delta !== 0) {
        for (const n of subtree) await tx.wbsNode.update({ where: { id: n.id }, data: { level: n.level + delta } });
      }
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'WbsNode', entityId: id,
        action: 'MOVE', before: { parentId: before.parentId, level: before.level }, after: { parentId: moved.parentId, level: moved.level },
      });
      return moved;
    });
  }

  async remove(user: SessionUser, id: string) {
    const before = await this.load(user, id, 'DELETE');
    const [children, boq, prLines, poLines, cost, stock] = await Promise.all([
      this.prisma.wbsNode.count({ where: { parentId: id, deletedAt: null } }),
      this.prisma.boqItem.count({ where: { wbsNodeId: id, deletedAt: null } }),
      this.prisma.purchaseRequisitionLine.count({ where: { wbsNodeId: id } }),
      this.prisma.purchaseOrderLine.count({ where: { wbsNodeId: id } }),
      this.prisma.projectCostLedger.count({ where: { wbsNodeId: id } }),
      this.prisma.stockLedger.count({ where: { wbsNodeId: id } }),
    ]);
    if (children + boq + prLines + poLines + cost + stock > 0) {
      throw new BusinessRuleError('This WBS node has children or is referenced by BOQ items or documents and cannot be deleted');
    }
    // The tombstone suffix frees the code for reuse while keeping the unique constraint intact.
    await this.softDeleteAudited(user, 'WbsNode', before, (tx) =>
      tx.wbsNode.update({ where: { id }, data: { deletedAt: new Date(), code: `${before.code}~del~${id.slice(0, 8)}` } }),
    );
  }

  async activityFor(user: SessionUser, id: string) {
    await this.load(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: 'WbsNode', entityId: id });
  }

  /** Validates that every WBS id exists and belongs to the project; used by procurement and BOQ. */
  static async assertInProject(db: Db, projectId: string, wbsNodeId: string | null | undefined): Promise<void> {
    if (!wbsNodeId) return;
    const found = await db.wbsNode.findFirst({ where: { id: wbsNodeId, projectId, deletedAt: null }, select: { id: true } });
    if (!found) throw new BusinessRuleError('WBS node does not belong to this project');
  }

  private async load(user: SessionUser, id: string, action: 'VIEW' | 'EDIT' | 'DELETE'): Promise<WbsNode> {
    const node = await this.prisma.wbsNode.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!node) throw new NotFoundError('WBS node', id);
    this.access.assertCan(user, 'projects.wbs', action, { projectId: node.projectId });
    return node;
  }

  private descendants(nodes: Array<{ id: string; parentId: string | null; level: number }>, rootId: string) {
    const out: Array<{ id: string; parentId: string | null; level: number }> = [];
    const queue = [rootId];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const n of nodes) {
        if (n.parentId === current) {
          out.push(n);
          queue.push(n.id);
        }
      }
    }
    return out;
  }
}
