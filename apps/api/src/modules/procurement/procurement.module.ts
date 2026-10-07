import { Module } from '@nestjs/common';
import { ProcurementValidator } from './procurement-validation';
import { PurchaseOrdersController, QuotationsController, RequisitionsController, RfqsController } from './procurement.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { RequisitionsService } from './requisitions.service';
import { RfqsService } from './rfqs.service';

@Module({
  controllers: [RequisitionsController, RfqsController, QuotationsController, PurchaseOrdersController],
  providers: [ProcurementValidator, RequisitionsService, RfqsService, PurchaseOrdersService],
  exports: [RequisitionsService, RfqsService, PurchaseOrdersService],
})
export class ProcurementModule {}
