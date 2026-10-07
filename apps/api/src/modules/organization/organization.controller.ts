import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createBankAccountSchema,
  createBranchSchema,
  createCostCenterSchema,
  createDepartmentSchema,
  createLocationSchema,
  createWarehouseSchema,
  paginationQuerySchema,
  warehouseStockQuerySchema,
  updateBankAccountSchema,
  updateBranchSchema,
  updateCompanySchema,
  updateCostCenterSchema,
  updateDepartmentSchema,
  updateWarehouseSchema,
  type SessionUser,
} from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AccessService } from '../../common/access.service';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { OrganizationService } from './organization.service';

class PageQueryDto extends createZodDto(paginationQuerySchema) {}
class UpdateCompanyDto extends createZodDto(updateCompanySchema) {}
class CreateBranchDto extends createZodDto(createBranchSchema) {}
class UpdateBranchDto extends createZodDto(updateBranchSchema) {}
class CreateDepartmentDto extends createZodDto(createDepartmentSchema) {}
class UpdateDepartmentDto extends createZodDto(updateDepartmentSchema) {}
class CreateCostCenterDto extends createZodDto(createCostCenterSchema) {}
class UpdateCostCenterDto extends createZodDto(updateCostCenterSchema) {}
class CreateWarehouseDto extends createZodDto(createWarehouseSchema) {}
class UpdateWarehouseDto extends createZodDto(updateWarehouseSchema) {}
class CreateLocationDto extends createZodDto(createLocationSchema) {}
class CreateBankAccountDto extends createZodDto(createBankAccountSchema) {}
class UpdateBankAccountDto extends createZodDto(updateBankAccountSchema) {}
class WarehouseStockQueryDto extends createZodDto(warehouseStockQuerySchema) {}
class LocationQueryDto extends createZodDto(z.object({ warehouseId: z.string().uuid() })) {}

@ApiTags('organization')
@Controller()
export class OrganizationController {
  constructor(
    private readonly org: OrganizationService,
    private readonly access: AccessService,
  ) {}

  @Get('company')
  @RequirePermission('organization.company', 'VIEW')
  getCompany(@CurrentUser() user: SessionUser) {
    return this.org.getCompany(user);
  }

  @Patch('company')
  @RequirePermission('organization.company', 'EDIT')
  updateCompany(@CurrentUser() user: SessionUser, @Body() body: UpdateCompanyDto) {
    return this.org.updateCompany(user, body);
  }

  @Get('branches')
  @RequirePermission('organization.branch', 'VIEW')
  listBranches(@CurrentUser() user: SessionUser, @Query() query: PageQueryDto) {
    return this.org.listBranches(user, query);
  }

  @Post('branches')
  @RequirePermission('organization.branch', 'CREATE')
  createBranch(@CurrentUser() user: SessionUser, @Body() body: CreateBranchDto) {
    return this.org.createBranch(user, body);
  }

  @Patch('branches/:id')
  @RequirePermission('organization.branch', 'EDIT')
  updateBranch(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateBranchDto) {
    return this.org.updateBranch(user, id, body);
  }

  @Delete('branches/:id')
  @HttpCode(204)
  @RequirePermission('organization.branch', 'DELETE')
  deleteBranch(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.org.deleteBranch(user, id);
  }

  @Get('departments')
  @RequirePermission('organization.department', 'VIEW')
  listDepartments(@CurrentUser() user: SessionUser, @Query() query: PageQueryDto) {
    return this.org.listDepartments(user, query);
  }

  @Post('departments')
  @RequirePermission('organization.department', 'CREATE')
  createDepartment(@CurrentUser() user: SessionUser, @Body() body: CreateDepartmentDto) {
    return this.org.createDepartment(user, body);
  }

  @Patch('departments/:id')
  @RequirePermission('organization.department', 'EDIT')
  updateDepartment(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateDepartmentDto) {
    return this.org.updateDepartment(user, id, body);
  }

  @Delete('departments/:id')
  @HttpCode(204)
  @RequirePermission('organization.department', 'DELETE')
  deleteDepartment(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.org.deleteDepartment(user, id);
  }

  @Get('cost-centers')
  @RequirePermission('organization.department', 'VIEW')
  listCostCenters(@CurrentUser() user: SessionUser, @Query() query: PageQueryDto) {
    return this.org.listCostCenters(user, query);
  }

  @Post('cost-centers')
  @RequirePermission('organization.department', 'CREATE')
  createCostCenter(@CurrentUser() user: SessionUser, @Body() body: CreateCostCenterDto) {
    return this.org.createCostCenter(user, body);
  }

  @Patch('cost-centers/:id')
  @RequirePermission('organization.department', 'EDIT')
  updateCostCenter(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCostCenterDto) {
    return this.org.updateCostCenter(user, id, body);
  }

  @Delete('cost-centers/:id')
  @HttpCode(204)
  @RequirePermission('organization.department', 'DELETE')
  deleteCostCenter(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.org.deleteCostCenter(user, id);
  }

  @Get('warehouses')
  @RequirePermission('organization.warehouse', 'VIEW')
  listWarehouses(@CurrentUser() user: SessionUser, @Query() query: PageQueryDto) {
    return this.org.listWarehouses(user, query, this.access.warehouseScope(user, 'organization.warehouse', 'VIEW'));
  }

  @Get('warehouses/:id')
  @RequirePermission('organization.warehouse', 'VIEW')
  getWarehouse(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    this.access.assertCan(user, 'organization.warehouse', 'VIEW', { warehouseId: id });
    return this.org.getWarehouse(user, id);
  }

  @Get('warehouses/:id/summary')
  @RequirePermission('organization.warehouse', 'VIEW')
  warehouseSummary(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    this.access.assertCan(user, 'organization.warehouse', 'VIEW', { warehouseId: id });
    return this.org.warehouseSummary(user, id);
  }

  @Get('warehouses/:id/stock')
  @RequirePermission('inventory.stock', 'VIEW')
  warehouseStock(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: WarehouseStockQueryDto) {
    this.access.assertCan(user, 'inventory.stock', 'VIEW', { warehouseId: id });
    return this.org.warehouseStock(user, id, query);
  }

  @Get('warehouses/:id/activity')
  @RequirePermission('organization.warehouse', 'VIEW')
  warehouseActivity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    this.access.assertCan(user, 'organization.warehouse', 'VIEW', { warehouseId: id });
    return this.org.warehouseActivity(user, id);
  }

  @Post('warehouses')
  @RequirePermission('organization.warehouse', 'CREATE')
  createWarehouse(@CurrentUser() user: SessionUser, @Body() body: CreateWarehouseDto) {
    return this.org.createWarehouse(user, body);
  }

  @Patch('warehouses/:id')
  @RequirePermission('organization.warehouse', 'EDIT')
  updateWarehouse(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateWarehouseDto) {
    this.access.assertCan(user, 'organization.warehouse', 'EDIT', { warehouseId: id });
    return this.org.updateWarehouse(user, id, body);
  }

  @Get('warehouse-locations')
  @RequirePermission('organization.warehouse', 'VIEW')
  listLocations(@CurrentUser() user: SessionUser, @Query() query: LocationQueryDto) {
    this.access.assertCan(user, 'organization.warehouse', 'VIEW', { warehouseId: query.warehouseId });
    return this.org.listLocations(user, query.warehouseId);
  }

  @Post('warehouse-locations')
  @RequirePermission('organization.warehouse', 'CREATE')
  createLocation(@CurrentUser() user: SessionUser, @Body() body: CreateLocationDto) {
    return this.org.createLocation(user, body);
  }

  @Get('bank-accounts')
  @RequirePermission('finance.bank', 'VIEW')
  listBankAccounts(@CurrentUser() user: SessionUser) {
    return this.org.listBankAccounts(user);
  }

  @Post('bank-accounts')
  @RequirePermission('finance.bank', 'CREATE')
  createBankAccount(@CurrentUser() user: SessionUser, @Body() body: CreateBankAccountDto) {
    return this.org.createBankAccount(user, body);
  }

  @Put('bank-accounts/:id')
  @RequirePermission('finance.bank', 'EDIT')
  updateBankAccount(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateBankAccountDto) {
    return this.org.updateBankAccount(user, id, body);
  }
}
