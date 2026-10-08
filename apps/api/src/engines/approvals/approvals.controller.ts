import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { paginationQuerySchema, approvalDecisionSchema, approvalRequestFilterSchema, upsertWorkflowSchema, type SessionUser } from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { AccessService } from '../../common/access.service';
import { ClientMeta, CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { paginate } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalsService } from './approvals.service';
import { Returns } from '../../common/decorators/api-docs';
import { ApprovalRequestDto, ApprovalRequestPageDto, ApprovalWorkflowDto } from '../../common/dto/responses.dto';

class ApprovalDecisionDto extends createZodDto(approvalDecisionSchema) {}
class UpsertWorkflowDto extends createZodDto(upsertWorkflowSchema) {}
class ApprovalListQueryDto extends createZodDto(paginationQuerySchema.merge(approvalRequestFilterSchema)) {}

@ApiTags('approvals')
@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @Returns(ApprovalRequestPageDto)
  @RequirePermission('approvals.inbox', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: ApprovalListQueryDto) {
    const projectScope = this.access.projectScope(user, 'approvals.inbox', 'VIEW');
    const where: Prisma.ApprovalRequestWhereInput = {
      companyId: user.companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(projectScope === 'ALL' ? {} : { OR: [{ projectId: null }, { projectId: { in: projectScope } }] }),
      ...(query.mine ? { status: 'PENDING', currentRole: { in: user.isSuperAdmin ? undefined : user.roles } } : {}),
    };
    return paginate(
      (args) =>
        this.prisma.approvalRequest.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            requestedBy: { select: { id: true, name: true } },
            actions: { orderBy: { createdAt: 'asc' }, include: { approver: { select: { id: true, name: true } } } },
          },
          ...args,
        }),
      query,
    );
  }

  @Post(':id/approve')
  @Returns(ApprovalRequestDto, { created: true })
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
  @Returns(ApprovalRequestDto, { created: true })
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
  @Returns(ApprovalWorkflowDto, { array: true })
  @RequirePermission('security.workflow', 'VIEW')
  list(@CurrentUser() user: SessionUser) {
    return this.prisma.approvalWorkflow.findMany({
      where: { companyId: user.companyId },
      orderBy: { documentType: 'asc' },
      include: { rules: { orderBy: { minAmount: 'asc' }, include: { steps: { orderBy: { stepOrder: 'asc' } } } } },
    });
  }

  @Put()
  @Returns(ApprovalWorkflowDto)
  @RequirePermission('security.workflow', 'EDIT')
  upsert(@CurrentUser() user: SessionUser, @Body() body: UpsertWorkflowDto) {
    return this.approvals.upsertWorkflow(user, body);
  }
}
