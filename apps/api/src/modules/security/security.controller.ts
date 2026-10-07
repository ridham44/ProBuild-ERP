import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSION_ACTIONS, assignRoleSchema, createUserSchema, type SessionUser } from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { SecurityService } from './security.service';

class CreateUserDto extends createZodDto(createUserSchema) {}
class AssignRoleDto extends createZodDto(assignRoleSchema) {}
class UserSearchDto extends createZodDto(z.object({ search: z.string().max(100).optional() })) {}
class SetActiveDto extends createZodDto(z.object({ active: z.boolean() })) {}
class CreateRoleDto extends createZodDto(z.object({ name: z.string().trim().min(2).max(60), description: z.string().max(200).optional() })) {}
class SetPermissionsDto extends createZodDto(
  z.object({ permissions: z.array(z.object({ module: z.string(), action: z.enum(PERMISSION_ACTIONS) })).max(2000) }),
) {}

@ApiTags('security')
@Controller()
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get('users')
  @RequirePermission('security.user', 'VIEW')
  listUsers(@CurrentUser() user: SessionUser, @Query() query: UserSearchDto) {
    return this.security.listUsers(user, query.search);
  }

  @Post('users')
  @RequirePermission('security.user', 'CREATE')
  createUser(@CurrentUser() user: SessionUser, @Body() body: CreateUserDto) {
    return this.security.createUser(user, body);
  }

  @Put('users/:id/active')
  @RequirePermission('security.user', 'EDIT')
  setActive(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: SetActiveDto) {
    return this.security.setActive(user, id, body.active);
  }

  @Post('users/:id/roles')
  @RequirePermission('security.user', 'EDIT')
  assignRole(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: AssignRoleDto) {
    return this.security.assignRole(user, id, body);
  }

  @Delete('users/:id/roles/:assignmentId')
  @HttpCode(204)
  @RequirePermission('security.user', 'EDIT')
  removeAssignment(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.security.removeAssignment(user, id, assignmentId);
  }

  @Get('roles')
  @RequirePermission('security.role', 'VIEW')
  listRoles(@CurrentUser() user: SessionUser) {
    return this.security.listRoles(user);
  }

  @Post('roles')
  @RequirePermission('security.role', 'CREATE')
  createRole(@CurrentUser() user: SessionUser, @Body() body: CreateRoleDto) {
    return this.security.createRole(user, body.name, body.description);
  }

  @Put('roles/:id/permissions')
  @RequirePermission('security.role', 'EDIT')
  setPermissions(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: SetPermissionsDto) {
    return this.security.setRolePermissions(user, id, body.permissions);
  }
}
