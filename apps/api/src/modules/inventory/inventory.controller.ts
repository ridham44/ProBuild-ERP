import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createItemCategorySchema,
  createItemSchema,
  createUomSchema,
  itemListQuerySchema,
  paginationQuerySchema,
  priceHistoryQuerySchema,
  setItemUnitConversionSchema,
  stockSummaryQuerySchema,
  updateItemCategorySchema,
  updateItemSchema,
  updateUomSchema,
  type SessionUser,
} from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { ItemsService } from './items.service';
import { Returns, ReturnsNothing } from '../../common/decorators/api-docs';
import { ActivityItemDto, ItemCategoryDto, ItemCategoryPageDto, ItemDetailDto, ItemDto, ItemPageDto, ItemStockSummaryDto, ItemUnitConversionDto, PriceHistoryPageDto, UomDto, UomPageDto } from '../../common/dto/responses.dto';

class PageQueryDto extends createZodDto(paginationQuerySchema) {}
class CreateUomDto extends createZodDto(createUomSchema) {}
class UpdateUomDto extends createZodDto(updateUomSchema) {}
class CreateCategoryDto extends createZodDto(createItemCategorySchema) {}
class UpdateCategoryDto extends createZodDto(updateItemCategorySchema) {}
class ItemListQueryDto extends createZodDto(itemListQuerySchema) {}
class CreateItemDto extends createZodDto(createItemSchema) {}
class UpdateItemDto extends createZodDto(updateItemSchema) {}
class UnitConversionDto extends createZodDto(setItemUnitConversionSchema) {}
class StockSummaryQueryDto extends createZodDto(stockSummaryQuerySchema) {}
class PriceHistoryQueryDto extends createZodDto(priceHistoryQuerySchema) {}

@ApiTags('inventory')
@Controller()
export class InventoryController {
  constructor(private readonly items: ItemsService) {}

  @Get('units-of-measure')
  @Returns(UomPageDto)
  @RequirePermission('inventory.item', 'VIEW')
  listUoms(@CurrentUser() user: SessionUser, @Query() query: PageQueryDto) {
    return this.items.listUoms(user, query);
  }

  @Post('units-of-measure')
  @Returns(UomDto, { created: true })
  @RequirePermission('inventory.item', 'CREATE')
  createUom(@CurrentUser() user: SessionUser, @Body() body: CreateUomDto) {
    return this.items.createUom(user, body);
  }

  @Patch('units-of-measure/:id')
  @Returns(UomDto)
  @RequirePermission('inventory.item', 'EDIT')
  updateUom(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateUomDto) {
    return this.items.updateUom(user, id, body);
  }

  @Get('item-categories')
  @Returns(ItemCategoryPageDto)
  @RequirePermission('inventory.item', 'VIEW')
  listCategories(@CurrentUser() user: SessionUser, @Query() query: PageQueryDto) {
    return this.items.listCategories(user, query);
  }

  @Post('item-categories')
  @Returns(ItemCategoryDto, { created: true })
  @RequirePermission('inventory.item', 'CREATE')
  createCategory(@CurrentUser() user: SessionUser, @Body() body: CreateCategoryDto) {
    return this.items.createCategory(user, body);
  }

  @Patch('item-categories/:id')
  @Returns(ItemCategoryDto)
  @RequirePermission('inventory.item', 'EDIT')
  updateCategory(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCategoryDto) {
    return this.items.updateCategory(user, id, body);
  }

  @Delete('item-categories/:id')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('inventory.item', 'DELETE')
  removeCategory(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.removeCategory(user, id);
  }

  @Get('items')
  @Returns(ItemPageDto)
  @RequirePermission('inventory.item', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: ItemListQueryDto) {
    return this.items.list(user, query);
  }

  @Post('items')
  @Returns(ItemDto, { created: true })
  @RequirePermission('inventory.item', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateItemDto) {
    return this.items.create(user, body);
  }

  @Get('items/:id')
  @Returns(ItemDetailDto)
  @RequirePermission('inventory.item', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.get(user, id);
  }

  @Patch('items/:id')
  @Returns(ItemDto)
  @RequirePermission('inventory.item', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateItemDto) {
    return this.items.update(user, id, body);
  }

  @Delete('items/:id')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('inventory.item', 'DELETE')
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.remove(user, id);
  }

  @Put('items/:id/unit-conversions')
  @Returns(ItemUnitConversionDto)
  @RequirePermission('inventory.item', 'EDIT')
  setUnitConversion(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UnitConversionDto) {
    return this.items.setUnitConversion(user, id, body);
  }

  @Delete('items/:id/unit-conversions/:unit')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('inventory.item', 'EDIT')
  removeUnitConversion(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('unit') unit: string) {
    return this.items.removeUnitConversion(user, id, unit);
  }

  @Get('items/:id/stock')
  @Returns(ItemStockSummaryDto)
  @RequirePermission('inventory.stock', 'VIEW')
  stockSummary(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: StockSummaryQueryDto) {
    return this.items.stockSummary(user, id, query.warehouseId);
  }

  @Get('items/:id/price-history')
  @Returns(PriceHistoryPageDto)
  @RequirePermission('inventory.item', 'VIEW')
  priceHistory(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: PriceHistoryQueryDto) {
    return this.items.priceHistory(user, id, query);
  }

  @Get('items/:id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('inventory.item', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.activityFor(user, id);
  }
}
