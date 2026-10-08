import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  boqListQuerySchema,
  costCodeListQuerySchema,
  createBoqItemSchema,
  createCostCodeSchema,
  createEstimateSchema,
  createWbsNodeSchema,
  moveWbsNodeSchema,
  paginationQuerySchema,
  updateBoqItemSchema,
  updateCostCodeSchema,
  updateEstimateSchema,
  updateWbsNodeSchema,
  type SessionUser,
} from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { CostCodesService } from './cost-codes.service';
import { EstimatesService } from './estimates.service';
import { WbsService } from './wbs.service';
import { Returns, ReturnsNothing } from '../../common/decorators/api-docs';
import { ActivityItemDto, BoqItemDto, BoqPageDto, BudgetDetailDto, BudgetDto, CostCodeDto, CostCodePageDto, EstimateApprovalDto, EstimateDetailDto, EstimateDto, EstimatePageDto, WbsNodeDto, WbsRowDto } from '../../common/dto/responses.dto';

class CreateWbsDto extends createZodDto(createWbsNodeSchema) {}
class UpdateWbsDto extends createZodDto(updateWbsNodeSchema) {}
class MoveWbsDto extends createZodDto(moveWbsNodeSchema) {}
class CostCodeListQueryDto extends createZodDto(costCodeListQuerySchema) {}
class CreateCostCodeDto extends createZodDto(createCostCodeSchema) {}
class UpdateCostCodeDto extends createZodDto(updateCostCodeSchema) {}
class PageQueryDto extends createZodDto(paginationQuerySchema) {}
class CreateEstimateDto extends createZodDto(createEstimateSchema) {}
class UpdateEstimateDto extends createZodDto(updateEstimateSchema) {}
class CreateBoqItemDto extends createZodDto(createBoqItemSchema) {}
class UpdateBoqItemDto extends createZodDto(updateBoqItemSchema) {}
class BoqListQueryDto extends createZodDto(boqListQuerySchema) {}

@ApiTags('wbs')
@Controller()
export class WbsController {
  constructor(private readonly wbs: WbsService) {}

  @Get('projects/:projectId/wbs')
  @Returns(WbsRowDto, { array: true })
  @RequirePermission('projects.wbs', 'VIEW')
  tree(@CurrentUser() user: SessionUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.wbs.tree(user, projectId);
  }

  @Post('projects/:projectId/wbs')
  @Returns(WbsNodeDto, { created: true })
  @RequirePermission('projects.wbs', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() body: CreateWbsDto) {
    return this.wbs.create(user, projectId, body);
  }

  @Patch('wbs/:id')
  @Returns(WbsNodeDto)
  @RequirePermission('projects.wbs', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateWbsDto) {
    return this.wbs.update(user, id, body);
  }

  @Post('wbs/:id/move')
  @HttpCode(200)
  @Returns(WbsNodeDto)
  @RequirePermission('projects.wbs', 'EDIT')
  move(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: MoveWbsDto) {
    return this.wbs.move(user, id, body);
  }

  @Delete('wbs/:id')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('projects.wbs', 'DELETE')
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wbs.remove(user, id);
  }

  @Get('wbs/:id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('projects.wbs', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wbs.activityFor(user, id);
  }
}

@ApiTags('cost-codes')
@Controller('cost-codes')
export class CostCodesController {
  constructor(private readonly costCodes: CostCodesService) {}

  @Get()
  @Returns(CostCodePageDto)
  @RequirePermission('projects.costcode', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: CostCodeListQueryDto) {
    return this.costCodes.list(user, query);
  }

  @Post()
  @Returns(CostCodeDto, { created: true })
  @RequirePermission('projects.costcode', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateCostCodeDto) {
    return this.costCodes.create(user, body);
  }

  @Get(':id')
  @Returns(CostCodeDto)
  @RequirePermission('projects.costcode', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.costCodes.get(user, id);
  }

  @Patch(':id')
  @Returns(CostCodeDto)
  @RequirePermission('projects.costcode', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCostCodeDto) {
    return this.costCodes.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('projects.costcode', 'DELETE')
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.costCodes.remove(user, id);
  }

  @Get(':id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('projects.costcode', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.costCodes.activityFor(user, id);
  }
}

@ApiTags('estimates')
@Controller()
export class EstimatesController {
  constructor(private readonly estimates: EstimatesService) {}

  @Get('projects/:projectId/estimates')
  @Returns(EstimatePageDto)
  @RequirePermission('projects.estimate', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Param('projectId', ParseUUIDPipe) projectId: string, @Query() query: PageQueryDto) {
    return this.estimates.listEstimates(user, projectId, query);
  }

  @Post('projects/:projectId/estimates')
  @Returns(EstimateDto, { created: true })
  @RequirePermission('projects.estimate', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() body: CreateEstimateDto) {
    return this.estimates.createEstimate(user, projectId, body);
  }

  @Get('estimates/:id')
  @Returns(EstimateDetailDto)
  @RequirePermission('projects.estimate', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.getEstimate(user, id);
  }

  @Patch('estimates/:id')
  @Returns(EstimateDto)
  @RequirePermission('projects.estimate', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateEstimateDto) {
    return this.estimates.updateEstimate(user, id, body);
  }

  @Post('estimates/:id/items')
  @Returns(BoqItemDto, { created: true })
  @RequirePermission('projects.boq', 'CREATE')
  addItem(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: CreateBoqItemDto) {
    return this.estimates.addBoqItem(user, id, body);
  }

  @Post('estimates/:id/approve')
  @HttpCode(200)
  @Returns(EstimateApprovalDto)
  @RequirePermission('projects.estimate', 'APPROVE')
  approve(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.approveEstimate(user, id);
  }

  @Get('estimates/:id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('projects.estimate', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.activityFor(user, id);
  }

  @Get('projects/:projectId/boq')
  @Returns(BoqPageDto)
  @RequirePermission('projects.boq', 'VIEW')
  listBoq(@CurrentUser() user: SessionUser, @Param('projectId', ParseUUIDPipe) projectId: string, @Query() query: BoqListQueryDto) {
    return this.estimates.listBoq(user, projectId, query);
  }

  @Patch('boq-items/:id')
  @Returns(BoqItemDto)
  @RequirePermission('projects.boq', 'EDIT')
  updateItem(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateBoqItemDto) {
    return this.estimates.updateBoqItem(user, id, body);
  }

  @Delete('boq-items/:id')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('projects.boq', 'DELETE')
  removeItem(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.removeBoqItem(user, id);
  }

  @Get('projects/:projectId/budget')
  @Returns(BudgetDetailDto)
  @RequirePermission('projects.budget', 'VIEW')
  budget(
    @CurrentUser() user: SessionUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('version', new ParseIntPipe({ optional: true })) version?: number,
  ) {
    return this.estimates.currentBudget(user, projectId, version);
  }

  @Get('projects/:projectId/budgets')
  @Returns(BudgetDto, { array: true })
  @RequirePermission('projects.budget', 'VIEW')
  budgets(@CurrentUser() user: SessionUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.estimates.listBudgets(user, projectId);
  }
}
