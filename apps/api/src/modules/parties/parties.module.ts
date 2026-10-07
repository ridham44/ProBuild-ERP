import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController, SuppliersController } from './parties.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  controllers: [SuppliersController, CustomersController],
  providers: [SuppliersService, CustomersService],
  exports: [SuppliersService, CustomersService],
})
export class PartiesModule {}
