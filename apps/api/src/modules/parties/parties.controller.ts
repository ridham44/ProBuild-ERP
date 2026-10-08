import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createContactSchema,
  createCustomerSchema,
  createSupplierEvaluationSchema,
  createSupplierSchema,
  customerListQuerySchema,
  paginationQuerySchema,
  setAccreditationSchema,
  supplierHistoryQuerySchema,
  supplierListQuerySchema,
  updateContactSchema,
  updateCustomerSchema,
  updateSupplierSchema,
  type SessionUser,
} from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { CustomersService } from './customers.service';
import { SuppliersService } from './suppliers.service';
import { Returns, ReturnsNothing } from '../../common/decorators/api-docs';
import { ActivityItemDto, ContactDto, CustomerDetailDto, CustomerDto, CustomerPageDto, SupplierDetailDto, SupplierDto, SupplierEvaluationDto, SupplierEvaluationPageDto, SupplierPageDto, SupplierPerformanceDto, SupplierPurchaseHistoryPageDto } from '../../common/dto/responses.dto';

class SupplierListQueryDto extends createZodDto(supplierListQuerySchema) {}
class CreateSupplierDto extends createZodDto(createSupplierSchema) {}
class UpdateSupplierDto extends createZodDto(updateSupplierSchema) {}
class CreateContactDto extends createZodDto(createContactSchema) {}
class UpdateContactDto extends createZodDto(updateContactSchema) {}
class SetAccreditationDto extends createZodDto(setAccreditationSchema) {}
class CreateEvaluationDto extends createZodDto(createSupplierEvaluationSchema) {}
class SupplierHistoryQueryDto extends createZodDto(supplierHistoryQuerySchema) {}
class PageQueryDto extends createZodDto(paginationQuerySchema) {}
class CustomerListQueryDto extends createZodDto(customerListQuerySchema) {}
class CreateCustomerDto extends createZodDto(createCustomerSchema) {}
class UpdateCustomerDto extends createZodDto(updateCustomerSchema) {}

@ApiTags('suppliers')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @Returns(SupplierPageDto)
  @RequirePermission('parties.supplier', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: SupplierListQueryDto) {
    return this.suppliers.list(user, query);
  }

  @Post()
  @Returns(SupplierDto, { created: true })
  @RequirePermission('parties.supplier', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateSupplierDto) {
    return this.suppliers.create(user, body);
  }

  @Get(':id')
  @Returns(SupplierDetailDto)
  @RequirePermission('parties.supplier', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.get(user, id);
  }

  @Patch(':id')
  @Returns(SupplierDto)
  @RequirePermission('parties.supplier', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateSupplierDto) {
    return this.suppliers.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('parties.supplier', 'DELETE')
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.remove(user, id);
  }

  @Put(':id/accreditation')
  @Returns(SupplierDto)
  @RequirePermission('parties.supplier', 'EDIT')
  setAccreditation(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: SetAccreditationDto) {
    return this.suppliers.setAccreditation(user, id, body);
  }

  @Get(':id/contacts')
  @Returns(ContactDto, { array: true })
  @RequirePermission('parties.supplier', 'VIEW')
  listContacts(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.listContacts(user, id);
  }

  @Post(':id/contacts')
  @Returns(ContactDto, { created: true })
  @RequirePermission('parties.supplier', 'EDIT')
  addContact(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: CreateContactDto) {
    return this.suppliers.addContact(user, id, body);
  }

  @Patch(':id/contacts/:contactId')
  @Returns(ContactDto)
  @RequirePermission('parties.supplier', 'EDIT')
  updateContact(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() body: UpdateContactDto,
  ) {
    return this.suppliers.updateContact(user, id, contactId, body);
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('parties.supplier', 'EDIT')
  removeContact(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.suppliers.removeContact(user, id, contactId);
  }

  @Get(':id/evaluations')
  @Returns(SupplierEvaluationPageDto)
  @RequirePermission('parties.supplier', 'VIEW')
  listEvaluations(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: PageQueryDto) {
    return this.suppliers.listEvaluations(user, id, query);
  }

  @Post(':id/evaluations')
  @Returns(SupplierEvaluationDto, { created: true })
  @RequirePermission('parties.supplier', 'EDIT')
  addEvaluation(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: CreateEvaluationDto) {
    return this.suppliers.addEvaluation(user, id, body);
  }

  @Get(':id/performance')
  @Returns(SupplierPerformanceDto)
  @RequirePermission('parties.supplier', 'VIEW')
  performance(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.performance(user, id);
  }

  @Get(':id/purchase-history')
  @Returns(SupplierPurchaseHistoryPageDto)
  @RequirePermission('parties.supplier', 'VIEW')
  purchaseHistory(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: SupplierHistoryQueryDto) {
    return this.suppliers.purchaseHistory(user, id, query);
  }

  @Get(':id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('parties.supplier', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.activityFor(user, id);
  }
}

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Returns(CustomerPageDto)
  @RequirePermission('parties.customer', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: CustomerListQueryDto) {
    return this.customers.list(user, query);
  }

  @Post()
  @Returns(CustomerDto, { created: true })
  @RequirePermission('parties.customer', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateCustomerDto) {
    return this.customers.create(user, body);
  }

  @Get(':id')
  @Returns(CustomerDetailDto)
  @RequirePermission('parties.customer', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.get(user, id);
  }

  @Patch(':id')
  @Returns(CustomerDto)
  @RequirePermission('parties.customer', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCustomerDto) {
    return this.customers.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('parties.customer', 'DELETE')
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.remove(user, id);
  }

  @Get(':id/contacts')
  @Returns(ContactDto, { array: true })
  @RequirePermission('parties.customer', 'VIEW')
  listContacts(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.listContacts(user, id);
  }

  @Post(':id/contacts')
  @Returns(ContactDto, { created: true })
  @RequirePermission('parties.customer', 'EDIT')
  addContact(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: CreateContactDto) {
    return this.customers.addContact(user, id, body);
  }

  @Patch(':id/contacts/:contactId')
  @Returns(ContactDto)
  @RequirePermission('parties.customer', 'EDIT')
  updateContact(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() body: UpdateContactDto,
  ) {
    return this.customers.updateContact(user, id, contactId, body);
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('parties.customer', 'EDIT')
  removeContact(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.customers.removeContact(user, id, contactId);
  }

  @Get(':id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('parties.customer', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.activityFor(user, id);
  }
}
