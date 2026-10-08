import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  addProjectMemberSchema,
  createContractSchema,
  createProjectSchema,
  projectListQuerySchema,
  projectStatusChangeSchema,
  reasonSchema,
  updateContractSchema,
  updateProjectMemberSchema,
  updateProjectSchema,
  type SessionUser,
} from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { ProjectsService } from './projects.service';
import { Returns, ReturnsNothing } from '../../common/decorators/api-docs';
import { ActivityItemDto, ContractDto, ProjectDashboardDto, ProjectDetailDto, ProjectDto, ProjectMemberDto, ProjectMemberViewDto, ProjectPageDto } from '../../common/dto/responses.dto';

class ProjectListQueryDto extends createZodDto(projectListQuerySchema) {}
class CreateProjectDto extends createZodDto(createProjectSchema) {}
class UpdateProjectDto extends createZodDto(updateProjectSchema) {}
class StatusChangeDto extends createZodDto(projectStatusChangeSchema) {}
class AddMemberDto extends createZodDto(addProjectMemberSchema) {}
class UpdateMemberDto extends createZodDto(updateProjectMemberSchema) {}
class CreateContractDto extends createZodDto(createContractSchema) {}
class UpdateContractDto extends createZodDto(updateContractSchema) {}
class ReasonDto extends createZodDto(reasonSchema) {}

@ApiTags('projects')
@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('projects')
  @Returns(ProjectPageDto)
  @RequirePermission('projects.project', 'VIEW')
  list(@CurrentUser() user: SessionUser, @Query() query: ProjectListQueryDto) {
    return this.projects.list(user, query);
  }

  @Post('projects')
  @Returns(ProjectDto, { created: true })
  @RequirePermission('projects.project', 'CREATE')
  create(@CurrentUser() user: SessionUser, @Body() body: CreateProjectDto) {
    return this.projects.create(user, body);
  }

  @Get('projects/:id')
  @Returns(ProjectDetailDto)
  @RequirePermission('projects.project', 'VIEW')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.get(user, id);
  }

  @Patch('projects/:id')
  @Returns(ProjectDto)
  @RequirePermission('projects.project', 'EDIT')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateProjectDto) {
    return this.projects.update(user, id, body);
  }

  @Delete('projects/:id')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('projects.project', 'DELETE')
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.remove(user, id);
  }

  @Post('projects/:id/status')
  @HttpCode(200)
  @Returns(ProjectDto)
  @RequirePermission('projects.project', 'EDIT')
  changeStatus(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: StatusChangeDto) {
    return this.projects.changeStatus(user, id, body);
  }

  @Get('projects/:id/dashboard')
  @Returns(ProjectDashboardDto)
  @RequirePermission('projects.project', 'VIEW')
  dashboard(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.dashboard(user, id);
  }

  @Get('projects/:id/activity')
  @Returns(ActivityItemDto, { array: true })
  @RequirePermission('projects.project', 'VIEW')
  activity(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.activityFor(user, id);
  }

  @Get('projects/:id/members')
  @Returns(ProjectMemberViewDto, { array: true })
  @RequirePermission('projects.project', 'VIEW')
  listMembers(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.listMembers(user, id);
  }

  @Post('projects/:id/members')
  @Returns(ProjectMemberDto, { created: true })
  @RequirePermission('projects.project', 'EDIT')
  addMember(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: AddMemberDto) {
    return this.projects.addMember(user, id, body);
  }

  @Patch('projects/:id/members/:memberId')
  @Returns(ProjectMemberDto)
  @RequirePermission('projects.project', 'EDIT')
  updateMember(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: UpdateMemberDto,
  ) {
    return this.projects.updateMember(user, id, memberId, body.role);
  }

  @Delete('projects/:id/members/:memberId')
  @HttpCode(204)
  @ReturnsNothing()
  @RequirePermission('projects.project', 'EDIT')
  removeMember(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.projects.removeMember(user, id, memberId);
  }

  @Get('projects/:id/contracts')
  @Returns(ContractDto, { array: true })
  @RequirePermission('projects.contract', 'VIEW')
  listContracts(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.listContracts(user, id);
  }

  @Post('projects/:id/contracts')
  @Returns(ContractDto, { created: true })
  @RequirePermission('projects.contract', 'CREATE')
  createContract(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: CreateContractDto) {
    return this.projects.createContract(user, id, body);
  }

  @Patch('contracts/:id')
  @Returns(ContractDto)
  @RequirePermission('projects.contract', 'EDIT')
  updateContract(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateContractDto) {
    return this.projects.updateContract(user, id, body);
  }

  @Post('contracts/:id/activate')
  @HttpCode(200)
  @Returns(ContractDto)
  @RequirePermission('projects.contract', 'APPROVE')
  activateContract(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.activateContract(user, id);
  }

  @Post('contracts/:id/close')
  @HttpCode(200)
  @Returns(ContractDto)
  @RequirePermission('projects.contract', 'CLOSE')
  closeContract(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.projects.closeContract(user, id, body.reason);
  }

  @Post('contracts/:id/cancel')
  @HttpCode(200)
  @Returns(ContractDto)
  @RequirePermission('projects.contract', 'CANCEL')
  cancelContract(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.projects.cancelContract(user, id, body.reason);
  }
}
