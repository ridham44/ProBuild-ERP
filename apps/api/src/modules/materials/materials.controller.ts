import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  approveMaterialRequestSchema,
  budgetVsActualQuerySchema,
  createMaterialIssueSchema,
  createMaterialRequestSchema,
  createMaterialReturnSchema,
  documentRejectionSchema,
  materialIssueListQuerySchema,
  materialRequestListQuerySchema,
  materialReturnListQuerySchema,
  reasonSchema,
  updateMaterialIssueSchema,
  updateMaterialRequestSchema,
  type SessionUser,
} from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { ClientMeta, CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { Returns } from '../../common/decorators/api-docs';
import {
  ActivityItemDto,
  BudgetVsActualDto,
  MaterialCostDto,
  MaterialIssueDetailDto,
  MaterialIssuePageDto,
  MaterialRequestDetailDto,
  MaterialRequestPageDto,
  MaterialReturnDetailDto,
  MaterialReturnPageDto,
} from '../../common/dto/responses.dto';
import { Idempotent } from '../../common/idempotency/idempotency.interceptor';
import { MaterialIssuesService } from './material-issues.service';
import { MaterialRequestsService } from './material-requests.service';
import { MaterialReturnsService } from './material-returns.service';
import { ProjectCostService } from './project-cost.service';

class MaterialRequestListQueryDto extends createZodDto(materialRequestListQuerySchema) {}
class CreateMaterialRequestDto extends createZodDto(createMaterialRequestSchema) {}
class UpdateMaterialRequestDto extends createZodDto(updateMaterialRequestSchema) {}
class ApproveMaterialRequestDto extends createZodDto(approveMaterialRequestSchema) {}
class RejectionDto extends createZodDto(documentRejectionSchema) {}
class ReasonDto extends createZodDto(reasonSchema) {}
class MaterialIssueListQueryDto extends createZodDto(materialIssueListQuerySchema) {}
class CreateMaterialIssueDto extends createZodDto(createMaterialIssueSchema) {}
class UpdateMaterialIssueDto extends createZodDto(updateMaterialIssueSchema) {}
class MaterialReturnListQueryDto extends createZodDto(materialReturnListQuerySchema) {}
class CreateMaterialReturnDto extends createZodDto(createMaterialReturnSchema) {}
class BudgetVsActualQueryDto extends createZodDto(budgetVsActualQuerySchema) {}

type Meta = { ip?: string; userAgent?: string };

@ApiTags('material-requests')
@Controller('material-requests')
export class MaterialRequestsController {
  constructor(private readonly requests: MaterialRequestsService) {}

  @Get()
  @Returns(MaterialRequestPageDto)
  @RequirePermission('inventory.request', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: MaterialRequestListQueryDto) {
    return this.requests.list(user, query);
  }

  @Post()
  @Returns(MaterialRequestDetailDto, { created: true })
  @RequirePermission('inventory.request', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateMaterialRequestDto) {
    return this.requests.create(user, body);
  }

  @Get(':id')
  @Returns(MaterialRequestDetailDto)
  @RequirePermission('inventory.request', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.get(user, id);
  }

  @Patch(':id')
  @Returns(MaterialRequestDetailDto)
  @RequirePermission('inventory.request', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateMaterialRequestDto) {
    return this.requests.update(user, id, body);
  }

  @Post(':id/submit')
  @Idempotent()
  @HttpCode(200)
  @Returns(MaterialRequestDetailDto)
  @RequirePermission('inventory.request', 'SUBMIT')
  submit(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.submit(user, id);
  }

  @Post(':id/approve')
  @Idempotent()
  @HttpCode(200)
  @Returns(MaterialRequestDetailDto)
  @RequirePermission('approvals.inbox', 'APPROVE')
  approve(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ApproveMaterialRequestDto, @ClientMeta() meta: Meta) {
    return this.requests.approve(user, id, body, meta);
  }

  @Post(':id/reject')
  @Idempotent()
  @HttpCode(200)
  @Returns(MaterialRequestDetailDto)
  @RequirePermission('approvals.inbox', 'REJECT')
  reject(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: RejectionDto, @ClientMeta() meta: Meta) {
    return this.requests.reject(user, id, body.comment, meta);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Returns(MaterialRequestDetailDto)
  @RequirePermission('inventory.request', 'CANCEL')
  cancel(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.requests.cancel(user, id, body.reason);
  }

  @Post(':id/close')
  @HttpCode(200)
  @Returns(MaterialRequestDetailDto)
  @RequirePermission('inventory.request', 'CLOSE')
  close(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.requests.close(user, id, body.reason);
  }

  @Get(':id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('inventory.request', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.activityFor(user, id);
  }
}

@ApiTags('material-issues')
@Controller('material-issues')
export class MaterialIssuesController {
  constructor(private readonly issues: MaterialIssuesService) {}

  @Get()
  @Returns(MaterialIssuePageDto)
  @RequirePermission('inventory.issue', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: MaterialIssueListQueryDto) {
    return this.issues.list(user, query);
  }

  @Post()
  @Returns(MaterialIssueDetailDto, { created: true })
  @RequirePermission('inventory.issue', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateMaterialIssueDto) {
    return this.issues.create(user, body);
  }

  @Get(':id')
  @Returns(MaterialIssueDetailDto)
  @RequirePermission('inventory.issue', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.issues.get(user, id);
  }

  @Patch(':id')
  @Returns(MaterialIssueDetailDto)
  @RequirePermission('inventory.issue', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateMaterialIssueDto) {
    return this.issues.update(user, id, body);
  }

  @Post(':id/post')
  @Idempotent()
  @HttpCode(200)
  @Returns(MaterialIssueDetailDto)
  @RequirePermission('inventory.issue', 'POST')
  post(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.issues.post(user, id);
  }

  @Post(':id/cancel')
  @Idempotent()
  @HttpCode(200)
  @Returns(MaterialIssueDetailDto)
  @RequirePermission('inventory.issue', 'CANCEL')
  cancel(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.issues.cancel(user, id, body.reason);
  }

  @Get(':id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('inventory.issue', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.issues.activityFor(user, id);
  }
}

@ApiTags('material-returns')
@Controller('material-returns')
export class MaterialReturnsController {
  constructor(private readonly returns: MaterialReturnsService) {}

  @Get()
  @Returns(MaterialReturnPageDto)
  @RequirePermission('inventory.return', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: MaterialReturnListQueryDto) {
    return this.returns.list(user, query);
  }

  @Post()
  @Returns(MaterialReturnDetailDto, { created: true })
  @RequirePermission('inventory.return', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateMaterialReturnDto) {
    return this.returns.create(user, body);
  }

  @Get(':id')
  @Returns(MaterialReturnDetailDto)
  @RequirePermission('inventory.return', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.returns.get(user, id);
  }

  @Post(':id/post')
  @Idempotent()
  @HttpCode(200)
  @Returns(MaterialReturnDetailDto)
  @RequirePermission('inventory.return', 'POST')
  post(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.returns.post(user, id);
  }

  @Post(':id/cancel')
  @Idempotent()
  @HttpCode(200)
  @Returns(MaterialReturnDetailDto)
  @RequirePermission('inventory.return', 'CANCEL')
  cancel(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.returns.cancel(user, id, body.reason);
  }

  @Get(':id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('inventory.return', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.returns.activityFor(user, id);
  }
}

@ApiTags('projects')
@Controller('projects')
export class ProjectCostController {
  constructor(private readonly cost: ProjectCostService) {}

  @Get(':id/budget-vs-actual')
  @Returns(BudgetVsActualDto)
  @RequirePermission('projects.budget', 'VIEW')
  budgetVsActual(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: BudgetVsActualQueryDto) {
    return this.cost.budgetVsActual(user, id, query);
  }

  @Get(':id/material-cost')
  @Returns(MaterialCostDto)
  @RequirePermission('projects.budget', 'VIEW')
  materialCost(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cost.materialCost(user, id);
  }
}
