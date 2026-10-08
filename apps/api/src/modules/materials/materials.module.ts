import { Module } from '@nestjs/common';
import { MaterialDimensionsValidator } from './material-dimensions';
import { MaterialIssuesService } from './material-issues.service';
import { MaterialRequestsService } from './material-requests.service';
import { MaterialReturnsService } from './material-returns.service';
import { MaterialIssuesController, MaterialRequestsController, MaterialReturnsController, ProjectCostController } from './materials.controller';
import { ProjectCostService } from './project-cost.service';

/** Material request, issue, return and project cost reporting (Stages H-I). */
@Module({
  controllers: [MaterialRequestsController, MaterialIssuesController, MaterialReturnsController, ProjectCostController],
  providers: [MaterialDimensionsValidator, MaterialRequestsService, MaterialIssuesService, MaterialReturnsService, ProjectCostService],
  exports: [MaterialRequestsService, MaterialIssuesService, MaterialReturnsService],
})
export class MaterialsModule {}
