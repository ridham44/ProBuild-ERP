import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  batchListQuerySchema,
  createAdjustmentSchema,
  createCountSchema,
  createTransferSchema,
  documentDecisionSchema,
  documentRejectionSchema,
  movementQuerySchema,
  reasonSchema,
  reconciliationQuerySchema,
  recordCountSchema,
  serialListQuerySchema,
  stockBalanceQuerySchema,
  stockDocListQuerySchema,
  updateAdjustmentSchema,
  updateTransferSchema,
  valuationQuerySchema,
  type SessionUser,
} from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { ClientMeta, CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { Returns } from '../../common/decorators/api-docs';
import {
  ActivityItemDto,
  AdjustmentDetailDto,
  AdjustmentPageDto,
  BatchPageDto,
  CountDetailDto,
  CountPageDto,
  MovementPageDto,
  ReconciliationDto,
  SerialPageDto,
  StockBalancePageDto,
  TransferDetailDto,
  TransferPageDto,
  ValuationDto,
} from '../../common/dto/responses.dto';
import { Idempotent } from '../../common/idempotency/idempotency.interceptor';
import { AdjustmentsService } from './adjustments.service';
import { CountsService } from './counts.service';
import { StockQueriesService } from './stock-queries.service';
import { TransfersService } from './transfers.service';

class StockBalanceQueryDto extends createZodDto(stockBalanceQuerySchema) {}
class ValuationQueryDto extends createZodDto(valuationQuerySchema) {}
class MovementQueryDto extends createZodDto(movementQuerySchema) {}
class BatchListQueryDto extends createZodDto(batchListQuerySchema) {}
class SerialListQueryDto extends createZodDto(serialListQuerySchema) {}
class ReconciliationQueryDto extends createZodDto(reconciliationQuerySchema) {}
class StockDocListQueryDto extends createZodDto(stockDocListQuerySchema) {}
class CreateTransferDto extends createZodDto(createTransferSchema) {}
class UpdateTransferDto extends createZodDto(updateTransferSchema) {}
class CreateAdjustmentDto extends createZodDto(createAdjustmentSchema) {}
class UpdateAdjustmentDto extends createZodDto(updateAdjustmentSchema) {}
class CreateCountDto extends createZodDto(createCountSchema) {}
class RecordCountDto extends createZodDto(recordCountSchema) {}
class DecisionDto extends createZodDto(documentDecisionSchema) {}
class RejectionDto extends createZodDto(documentRejectionSchema) {}
class ReasonDto extends createZodDto(reasonSchema) {}

type Meta = { ip?: string; userAgent?: string };

@ApiTags('stock')
@Controller()
export class StockController {
  constructor(private readonly queries: StockQueriesService) {}

  @Get('inventory/stock-balances')
  @Returns(StockBalancePageDto)
  @RequirePermission('inventory.stock', 'VIEW')
  balances(@CurrentUser() user: SessionUser, @Query() query: StockBalanceQueryDto) {
    return this.queries.balances(user, query);
  }

  @Get('inventory/valuation')
  @Returns(ValuationDto)
  @RequirePermission('inventory.stock', 'VIEW')
  valuation(@CurrentUser() user: SessionUser, @Query() query: ValuationQueryDto) {
    return this.queries.valuation(user, query);
  }

  @Get('inventory/movements')
  @Returns(MovementPageDto)
  @RequirePermission('inventory.stock', 'VIEW')
  movements(@CurrentUser() user: SessionUser, @Query() query: MovementQueryDto) {
    return this.queries.movements(user, query);
  }

  @Get('items/:id/movements')
  @Returns(MovementPageDto)
  @RequirePermission('inventory.stock', 'VIEW')
  itemMovements(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: MovementQueryDto) {
    return this.queries.movements(user, { ...query, itemId: id });
  }

  @Get('inventory/batches')
  @Returns(BatchPageDto)
  @RequirePermission('inventory.stock', 'VIEW')
  batches(@CurrentUser() user: SessionUser, @Query() query: BatchListQueryDto) {
    return this.queries.batches(user, query);
  }

  @Get('inventory/serials')
  @Returns(SerialPageDto)
  @RequirePermission('inventory.stock', 'VIEW')
  serials(@CurrentUser() user: SessionUser, @Query() query: SerialListQueryDto) {
    return this.queries.serials(user, query);
  }

  @Get('inventory/reconciliation')
  @Returns(ReconciliationDto)
  @RequirePermission('inventory.stock', 'ADJUST')
  reconciliation(@CurrentUser() user: SessionUser, @Query() query: ReconciliationQueryDto) {
    return this.queries.reconcile(user, query);
  }
}

@ApiTags('warehouse-transfers')
@Controller('warehouse-transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  @Returns(TransferPageDto)
  @RequirePermission('inventory.transfer', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: StockDocListQueryDto) {
    return this.transfers.list(user, query);
  }

  @Post()
  @Returns(TransferDetailDto, { created: true })
  @RequirePermission('inventory.transfer', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateTransferDto) {
    return this.transfers.create(user, body);
  }

  @Get(':id')
  @Returns(TransferDetailDto)
  @RequirePermission('inventory.transfer', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.transfers.get(user, id);
  }

  @Patch(':id')
  @Returns(TransferDetailDto)
  @RequirePermission('inventory.transfer', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateTransferDto) {
    return this.transfers.update(user, id, body);
  }

  @Post(':id/submit')
  @Idempotent()
  @HttpCode(200)
  @Returns(TransferDetailDto)
  @RequirePermission('inventory.transfer', 'SUBMIT')
  submit(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.transfers.submit(user, id);
  }

  @Post(':id/approve')
  @Idempotent()
  @HttpCode(200)
  @Returns(TransferDetailDto)
  @RequirePermission('approvals.inbox', 'APPROVE')
  approve(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: DecisionDto, @ClientMeta() meta: Meta) {
    return this.transfers.decide(user, id, 'APPROVED', body.comment, meta);
  }

  @Post(':id/reject')
  @Idempotent()
  @HttpCode(200)
  @Returns(TransferDetailDto)
  @RequirePermission('approvals.inbox', 'REJECT')
  reject(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: RejectionDto, @ClientMeta() meta: Meta) {
    return this.transfers.decide(user, id, 'REJECTED', body.comment, meta);
  }

  @Post(':id/post')
  @Idempotent()
  @HttpCode(200)
  @Returns(TransferDetailDto)
  @RequirePermission('inventory.transfer', 'POST')
  post(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.transfers.post(user, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Returns(TransferDetailDto)
  @RequirePermission('inventory.transfer', 'CANCEL')
  cancel(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.transfers.cancel(user, id, body.reason);
  }

  @Get(':id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('inventory.transfer', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.transfers.activityFor(user, id);
  }
}

@ApiTags('stock-adjustments')
@Controller('stock-adjustments')
export class AdjustmentsController {
  constructor(private readonly adjustments: AdjustmentsService) {}

  @Get()
  @Returns(AdjustmentPageDto)
  @RequirePermission('inventory.adjustment', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: StockDocListQueryDto) {
    return this.adjustments.list(user, query);
  }

  @Post()
  @Returns(AdjustmentDetailDto, { created: true })
  @RequirePermission('inventory.adjustment', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateAdjustmentDto) {
    return this.adjustments.create(user, body);
  }

  @Get(':id')
  @Returns(AdjustmentDetailDto)
  @RequirePermission('inventory.adjustment', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.adjustments.get(user, id);
  }

  @Patch(':id')
  @Returns(AdjustmentDetailDto)
  @RequirePermission('inventory.adjustment', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateAdjustmentDto) {
    return this.adjustments.update(user, id, body);
  }

  @Post(':id/submit')
  @Idempotent()
  @HttpCode(200)
  @Returns(AdjustmentDetailDto)
  @RequirePermission('inventory.adjustment', 'SUBMIT')
  submit(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.adjustments.submit(user, id);
  }

  @Post(':id/approve')
  @Idempotent()
  @HttpCode(200)
  @Returns(AdjustmentDetailDto)
  @RequirePermission('approvals.inbox', 'APPROVE')
  approve(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: DecisionDto, @ClientMeta() meta: Meta) {
    return this.adjustments.decide(user, id, 'APPROVED', body.comment, meta);
  }

  @Post(':id/reject')
  @Idempotent()
  @HttpCode(200)
  @Returns(AdjustmentDetailDto)
  @RequirePermission('approvals.inbox', 'REJECT')
  reject(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: RejectionDto, @ClientMeta() meta: Meta) {
    return this.adjustments.decide(user, id, 'REJECTED', body.comment, meta);
  }

  @Post(':id/post')
  @Idempotent()
  @HttpCode(200)
  @Returns(AdjustmentDetailDto)
  @RequirePermission('inventory.adjustment', 'POST')
  post(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.adjustments.post(user, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Returns(AdjustmentDetailDto)
  @RequirePermission('inventory.adjustment', 'CANCEL')
  cancel(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.adjustments.cancel(user, id, body.reason);
  }

  @Get(':id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('inventory.adjustment', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.adjustments.activityFor(user, id);
  }
}

@ApiTags('stock-counts')
@Controller('stock-counts')
export class CountsController {
  constructor(private readonly counts: CountsService) {}

  @Get()
  @Returns(CountPageDto)
  @RequirePermission('inventory.count', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: StockDocListQueryDto) {
    return this.counts.list(user, query);
  }

  @Post()
  @Returns(CountDetailDto, { created: true })
  @RequirePermission('inventory.count', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateCountDto) {
    return this.counts.create(user, body);
  }

  @Get(':id')
  @Returns(CountDetailDto)
  @RequirePermission('inventory.count', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.counts.get(user, id);
  }

  @Put(':id/lines')
  @Returns(CountDetailDto)
  @RequirePermission('inventory.count', 'EDIT')
  record(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: RecordCountDto) {
    return this.counts.record(user, id, body);
  }

  @Post(':id/submit')
  @Idempotent()
  @HttpCode(200)
  @Returns(CountDetailDto)
  @RequirePermission('inventory.count', 'SUBMIT')
  submit(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.counts.submit(user, id);
  }

  @Post(':id/approve')
  @Idempotent()
  @HttpCode(200)
  @Returns(CountDetailDto)
  @RequirePermission('approvals.inbox', 'APPROVE')
  approve(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: DecisionDto, @ClientMeta() meta: Meta) {
    return this.counts.decide(user, id, 'APPROVED', body.comment, meta);
  }

  @Post(':id/reject')
  @Idempotent()
  @HttpCode(200)
  @Returns(CountDetailDto)
  @RequirePermission('approvals.inbox', 'REJECT')
  reject(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: RejectionDto, @ClientMeta() meta: Meta) {
    return this.counts.decide(user, id, 'REJECTED', body.comment, meta);
  }

  @Post(':id/post')
  @Idempotent()
  @HttpCode(200)
  @Returns(CountDetailDto)
  @RequirePermission('inventory.count', 'POST')
  post(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.counts.post(user, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Returns(CountDetailDto)
  @RequirePermission('inventory.count', 'CANCEL')
  cancel(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.counts.cancel(user, id, body.reason);
  }

  @Get(':id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('inventory.count', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.counts.activityFor(user, id);
  }
}
