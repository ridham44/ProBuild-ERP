import { Module } from '@nestjs/common';
import { CostCodesService } from './cost-codes.service';
import { EstimatesService } from './estimates.service';
import { CostCodesController, EstimatesController, WbsController } from './planning.controller';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { WbsService } from './wbs.service';

@Module({
  controllers: [ProjectsController, WbsController, CostCodesController, EstimatesController],
  providers: [ProjectsService, WbsService, CostCodesService, EstimatesService],
  exports: [ProjectsService, WbsService, CostCodesService, EstimatesService],
})
export class ProjectsModule {}
