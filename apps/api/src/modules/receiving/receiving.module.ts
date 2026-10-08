import { Module } from '@nestjs/common';
import { GoodsReceiptsService } from './goods-receipts.service';
import { ReceivingController } from './receiving.controller';

/** Goods receipt + QC against purchase orders (Stage F). */
@Module({ controllers: [ReceivingController], providers: [GoodsReceiptsService], exports: [GoodsReceiptsService] })
export class ReceivingModule {}
