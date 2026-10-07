import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { paginationQuerySchema, approvalDecisionSchema, approvalRequestFilterSchema, upsertWorkflowSchema, type SessionUser } from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { ClientMeta, CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { paginate } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalsService } from './approvals.service';

class ApprovalDecisionDto extends createZodDto(approvalDecisionSchema) {}
class UpsertWorkflowDto extends createZodDto(upsertWorkflowSchema) {}
class ApprovalListQueryDto extends createZodDto(paginationQuerySchema.merge(approvalRequestFilterSchema)) {}

@ApiTags('approvals')
@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermission('approvals.inbox', 'VIEW')
  async list(@CurrentUser() user: SessionUser, @Query() query: ApprovalListQueryDto) {
    const where = {
      companyId: user.companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
    };
    const page = await paginate(
      (args) =>
        this.prisma.approvalRequest.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: { requestedBy: { select: { id: true, name: true } }, actions: { orderBy: { createdAt: 'asc' } } },
          ...args,
        }),
      query,
    );
    if (!query.mine) return page;
    const mine = page.items.filter(
      (r) => r.status === 'PENDING' && (user.isSuperAdmin || user.roles.includes((r.stepRoles as string[])[r.currentStep - 1] ?? '')),
    );
    return { items: mine, nextCursor: page.nextCursor };
  }

  @Post(':id/approve')
  @RequirePermission('approvals.inbox', 'APPROVE')
  approve(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApprovalDecisionDto,
    @ClientMeta() meta: { ip?: string; userAgent?: string },
  ) {
    return this.approvals.decide(user, id, 'APPROVED', body, meta);
  }

  @Post(':id/reject')
  @RequirePermission('approvals.inbox', 'REJECT')
  reject(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApprovalDecisionDto,
    @ClientMeta() meta: { ip?: string; userAgent?: string },
  ) {
    return this.approvals.decide(user, id, 'REJECTED', body, meta);
  }
}

@ApiTags('approvals')
@Controller('approval-workflows')
export class ApprovalWorkflowsController {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermission('security.workflow', 'VIEW')
  list(@CurrentUser() user: SessionUser) {
    return this.prisma.approvalWorkflow.findMany({
      where: { companyId: user.companyId },
      orderBy: { documentType: 'asc' },
      include: { rules: { orderBy: { minAmount: 'asc' }, include: { steps: { orderBy: { stepOrder: 'asc' } } } } },
    });
  }

  @Put()
  @RequirePermission('security.workflow', 'EDIT')
  upsert(@CurrentUser() user: SessionUser, @Body() body: UpsertWorkflowDto) {
    return this.approvals.upsertWorkflow(user, body);
  }
}
