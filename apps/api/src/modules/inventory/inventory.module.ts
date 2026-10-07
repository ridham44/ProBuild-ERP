import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { ItemsService } from './items.service';

/** Item master data now; stock documents (GRN, issue, transfer, count) are added by the inventory stages. */
@Module({ controllers: [InventoryController], providers: [ItemsService], exports: [ItemsService] })
export class InventoryModule {}
