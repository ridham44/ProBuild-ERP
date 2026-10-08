import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createGoodsReceiptSchema,
  goodsReceiptListQuerySchema,
  inspectionSchema,
  postGoodsReceiptSchema,
  reasonSchema,
  updateGoodsReceiptSchema,
  type SessionUser,
} from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { Returns } from '../../common/decorators/api-docs';
import { ActivityItemDto, GoodsReceiptDetailDto, GoodsReceiptPageDto, ReceivableLinesDto } from '../../common/dto/responses.dto';
import { Idempotent } from '../../common/idempotency/idempotency.interceptor';
import { GoodsReceiptsService } from './goods-receipts.service';

class GoodsReceiptListQueryDto extends createZodDto(goodsReceiptListQuerySchema) {}
class CreateGoodsReceiptDto extends createZodDto(createGoodsReceiptSchema) {}
class UpdateGoodsReceiptDto extends createZodDto(updateGoodsReceiptSchema) {}
class PostGoodsReceiptDto extends createZodDto(postGoodsReceiptSchema) {}
class InspectionDto extends createZodDto(inspectionSchema) {}
class ReasonDto extends createZodDto(reasonSchema) {}

@ApiTags('goods-receipts')
@Controller()
export class ReceivingController {
  constructor(private readonly receipts: GoodsReceiptsService) {}

  @Get('goods-receipts')
  @Returns(GoodsReceiptPageDto)
  @RequirePermission('procurement.receipt', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: GoodsReceiptListQueryDto) {
    return this.receipts.list(user, query);
  }

  @Get('purchase-orders/:orderId/receivable-lines')
  @Returns(ReceivableLinesDto)
  @RequirePermission('procurement.receipt', 'VIEW')
  receivable(@CurrentUser() user: SessionUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.receipts.receivableLines(user, orderId);
  }

  @Post('goods-receipts')
  @Returns(GoodsReceiptDetailDto, { created: true })
  @RequirePermission('procurement.receipt', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateGoodsReceiptDto) {
    return this.receipts.create(user, body);
  }

  @Get('goods-receipts/:id')
  @Returns(GoodsReceiptDetailDto)
  @RequirePermission('procurement.receipt', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.receipts.get(user, id);
  }

  @Patch('goods-receipts/:id')
  @Returns(GoodsReceiptDetailDto)
  @RequirePermission('procurement.receipt', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateGoodsReceiptDto) {
    return this.receipts.update(user, id, body);
  }

  @Put('goods-receipts/:id/lines/:lineId/inspection')
  @Returns(GoodsReceiptDetailDto)
  @RequirePermission('procurement.receipt', 'APPROVE')
  inspect(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() body: InspectionDto,
  ) {
    return this.receipts.inspectDraftLine(user, id, lineId, body);
  }

  @Post('goods-receipts/:id/post')
  @Idempotent()
  @HttpCode(200)
  @Returns(GoodsReceiptDetailDto)
  @RequirePermission('procurement.receipt', 'POST')
  post(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: PostGoodsReceiptDto) {
    return this.receipts.post(user, id, body);
  }

  @Post('goods-receipts/:id/lines/:lineId/quarantine-decision')
  @Idempotent()
  @HttpCode(200)
  @Returns(GoodsReceiptDetailDto)
  @RequirePermission('procurement.receipt', 'APPROVE')
  decide(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() body: InspectionDto,
  ) {
    return this.receipts.decideQuarantine(user, id, lineId, body);
  }

  @Post('goods-receipts/:id/cancel')
  @Idempotent()
  @HttpCode(200)
  @Returns(GoodsReceiptDetailDto)
  @RequirePermission('procurement.receipt', 'CANCEL')
  cancel(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.receipts.cancel(user, id, body.reason);
  }

  @Get('goods-receipts/:id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('procurement.receipt', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.receipts.activityFor(user, id);
  }
}
