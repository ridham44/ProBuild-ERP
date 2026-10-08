import { Module } from '@nestjs/common';
import { AdjustmentsService } from './adjustments.service';
import { CountsService } from './counts.service';
import { InventoryController } from './inventory.controller';
import { ItemsService } from './items.service';
import { StockQueriesService } from './stock-queries.service';
import { AdjustmentsController, CountsController, StockController, TransfersController } from './stock.controller';
import { TransfersService } from './transfers.service';

/** Item master data, stock queries, and the stock documents: transfer, adjustment and count. */
@Module({
  controllers: [InventoryController, StockController, TransfersController, AdjustmentsController, CountsController],
  providers: [ItemsService, StockQueriesService, TransfersService, AdjustmentsService, CountsService],
  exports: [ItemsService, StockQueriesService],
})
export class InventoryModule {}
