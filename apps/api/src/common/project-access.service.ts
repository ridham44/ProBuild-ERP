import { Injectable } from '@nestjs/common';
import type { Project } from '@prisma/client';
import type { PermissionActionKey, SessionUser } from '@probuild/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from './access.service';
import { BusinessRuleError, NotFoundError } from './errors/domain-errors';

/** Loads a project inside the caller's company and enforces project-scoped permission on it. */
@Injectable()
export class ProjectAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** 404 when the project is not in the caller's company; 403 when it is but the scope excludes it. */
  async load(user: SessionUser, projectId: string, module: string, action: PermissionActionKey): Promise<Project> {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, companyId: user.companyId, deletedAt: null } });
    if (!project) throw new NotFoundError('Project', projectId);
    this.access.assertCan(user, module, action, { projectId });
    return project;
  }

  /** Master-data edits stay possible while a project is running or on hold, never after it ended. */
  assertNotEnded(project: Pick<Project, 'status' | 'code'>): void {
    if (project.status === 'CLOSED' || project.status === 'CANCELLED') {
      throw new BusinessRuleError(`Project ${project.code} is ${project.status.toLowerCase()} and can no longer be changed`);
    }
  }

  /** Procurement documents may only be raised against a project that is actively running. */
  assertActive(project: Pick<Project, 'status' | 'code'>): void {
    if (project.status !== 'ACTIVE') {
      throw new BusinessRuleError(`Project ${project.code} is ${project.status.toLowerCase().replace('_', ' ')}; procurement requires an ACTIVE project`);
    }
  }
}
