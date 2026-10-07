import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  awardRfqSchema,
  createPurchaseOrderSchema,
  createQuotationSchema,
  createRequisitionSchema,
  createRfqSchema,
  documentDecisionSchema,
  documentRejectionSchema,
  purchaseOrderListQuerySchema,
  quotationListQuerySchema,
  reasonSchema,
  requisitionListQuerySchema,
  rfqListQuerySchema,
  updatePurchaseOrderSchema,
  updateQuotationSchema,
  updateRequisitionSchema,
  updateRfqSchema,
  type SessionUser,
} from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { ClientMeta, CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { Idempotent } from '../../common/idempotency/idempotency.interceptor';
import { PurchaseOrdersService } from './purchase-orders.service';
import { RequisitionsService } from './requisitions.service';
import { RfqsService } from './rfqs.service';

class RequisitionListQueryDto extends createZodDto(requisitionListQuerySchema) {}
class CreateRequisitionDto extends createZodDto(createRequisitionSchema) {}
class UpdateRequisitionDto extends createZodDto(updateRequisitionSchema) {}
class DecisionDto extends createZodDto(documentDecisionSchema) {}
class RejectionDto extends createZodDto(documentRejectionSchema) {}
class ReasonDto extends createZodDto(reasonSchema) {}
class RfqListQueryDto extends createZodDto(rfqListQuerySchema) {}
class CreateRfqDto extends createZodDto(createRfqSchema) {}
class UpdateRfqDto extends createZodDto(updateRfqSchema) {}
class AwardRfqDto extends createZodDto(awardRfqSchema) {}
class CreateQuotationDto extends createZodDto(createQuotationSchema) {}
class UpdateQuotationDto extends createZodDto(updateQuotationSchema) {}
class QuotationListQueryDto extends createZodDto(quotationListQuerySchema) {}
class PurchaseOrderListQueryDto extends createZodDto(purchaseOrderListQuerySchema) {}
class CreatePurchaseOrderDto extends createZodDto(createPurchaseOrderSchema) {}
class UpdatePurchaseOrderDto extends createZodDto(updatePurchaseOrderSchema) {}

type Meta = { ip?: string; userAgent?: string };

@ApiTags('requisitions')
@Controller('requisitions')
export class RequisitionsController {
  constructor(private readonly requisitions: RequisitionsService) {}

  @Get()
  @RequirePermission('procurement.requisition', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: RequisitionListQueryDto) {
    return this.requisitions.list(user, query);
  }

  @Post()
  @RequirePermission('procurement.requisition', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateRequisitionDto) {
    return this.requisitions.create(user, body);
  }

  @Get(':id')
  @RequirePermission('procurement.requisition', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requisitions.get(user, id);
  }

  @Patch(':id')
  @RequirePermission('procurement.requisition', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateRequisitionDto) {
    return this.requisitions.update(user, id, body);
  }

  @Post(':id/submit')
  @Idempotent()
  @HttpCode(200)
  @RequirePermission('procurement.requisition', 'SUBMIT')
  submit(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requisitions.submit(user, id);
  }

  @Post(':id/approve')
  @Idempotent()
  @HttpCode(200)
  @RequirePermission('approvals.inbox', 'APPROVE')
  approve(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: DecisionDto, @ClientMeta() meta: Meta) {
    return this.requisitions.approve(user, id, body.comment, meta);
  }

  @Post(':id/reject')
  @Idempotent()
  @HttpCode(200)
  @RequirePermission('approvals.inbox', 'REJECT')
  reject(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: RejectionDto, @ClientMeta() meta: Meta) {
    return this.requisitions.reject(user, id, body.comment, meta);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('procurement.requisition', 'CANCEL')
  cancel(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.requisitions.cancel(user, id, body.reason);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermission('procurement.requisition', 'CLOSE')
  close(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.requisitions.close(user, id, body.reason);
  }

  @Get(':id/activity')
  @RequirePermission('procurement.requisition', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requisitions.activityFor(user, id);
  }
}

@ApiTags('rfqs')
@Controller('rfqs')
export class RfqsController {
  constructor(private readonly rfqs: RfqsService) {}

  @Get()
  @RequirePermission('procurement.rfq', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: RfqListQueryDto) {
    return this.rfqs.list(user, query);
  }

  @Post()
  @RequirePermission('procurement.rfq', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateRfqDto) {
    return this.rfqs.create(user, body);
  }

  @Get(':id')
  @RequirePermission('procurement.rfq', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rfqs.get(user, id);
  }

  @Patch(':id')
  @RequirePermission('procurement.rfq', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateRfqDto) {
    return this.rfqs.update(user, id, body);
  }

  @Post(':id/send')
  @HttpCode(200)
  @RequirePermission('procurement.rfq', 'POST')
  send(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rfqs.send(user, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('procurement.rfq', 'CANCEL')
  cancel(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.rfqs.cancel(user, id, body.reason);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermission('procurement.rfq', 'CLOSE')
  close(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.rfqs.close(user, id, body.reason);
  }

  @Get(':id/comparison')
  @RequirePermission('procurement.rfq', 'VIEW')
  comparison(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rfqs.comparison(user, id);
  }

  @Post(':id/award')
  @Idempotent()
  @HttpCode(200)
  @RequirePermission('procurement.rfq', 'APPROVE')
  award(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: AwardRfqDto) {
    return this.rfqs.award(user, id, body);
  }

  @Post(':id/quotations')
  @RequirePermission('procurement.rfq', 'CREATE')
  createQuotation(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: CreateQuotationDto) {
    return this.rfqs.createQuotation(user, id, body);
  }

  @Get(':id/activity')
  @RequirePermission('procurement.rfq', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rfqs.activityFor(user, id);
  }
}

@ApiTags('quotations')
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly rfqs: RfqsService) {}

  @Get()
  @RequirePermission('procurement.rfq', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: QuotationListQueryDto) {
    return this.rfqs.listQuotations(user, query);
  }

  @Get(':id')
  @RequirePermission('procurement.rfq', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rfqs.getQuotation(user, id);
  }

  @Put(':id')
  @RequirePermission('procurement.rfq', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateQuotationDto) {
    return this.rfqs.updateQuotation(user, id, body);
  }
}

@ApiTags('purchase-orders')
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly orders: PurchaseOrdersService) {}

  @Get()
  @RequirePermission('procurement.order', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: PurchaseOrderListQueryDto) {
    return this.orders.list(user, query);
  }

  @Post()
  @Idempotent()
  @RequirePermission('procurement.order', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreatePurchaseOrderDto) {
    return this.orders.create(user, body);
  }

  @Get(':id')
  @RequirePermission('procurement.order', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(user, id);
  }

  @Patch(':id')
  @RequirePermission('procurement.order', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePurchaseOrderDto) {
    return this.orders.update(user, id, body);
  }

  @Post(':id/submit')
  @Idempotent()
  @HttpCode(200)
  @RequirePermission('procurement.order', 'SUBMIT')
  submit(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.submit(user, id);
  }

  @Post(':id/approve')
  @Idempotent()
  @HttpCode(200)
  @RequirePermission('approvals.inbox', 'APPROVE')
  approve(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: DecisionDto, @ClientMeta() meta: Meta) {
    return this.orders.approve(user, id, body.comment, meta);
  }

  @Post(':id/reject')
  @Idempotent()
  @HttpCode(200)
  @RequirePermission('approvals.inbox', 'REJECT')
  reject(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: RejectionDto, @ClientMeta() meta: Meta) {
    return this.orders.reject(user, id, body.comment, meta);
  }

  @Post(':id/send')
  @HttpCode(200)
  @RequirePermission('procurement.order', 'POST')
  send(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.send(user, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('procurement.order', 'CANCEL')
  cancel(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.orders.cancel(user, id, body.reason);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermission('procurement.order', 'CLOSE')
  close(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.orders.close(user, id, body.reason);
  }

  @Get(':id/activity')
  @RequirePermission('procurement.order', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.activityFor(user, id);
  }
}
