import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { ZodValidationPipe } from 'nestjs-zod';
import { LoggerModule } from 'nestjs-pino';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { SessionAuthGuard } from './common/guards/session-auth.guard';
import { ConfigModule } from './config/config.module';
import { AppConfig } from './config/config.service';
import { EnginesModule } from './engines/engines.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { FieldModule } from './modules/field/field.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthController } from './modules/health/health.controller';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PartiesModule } from './modules/parties/parties.module';
import { PortalModule } from './modules/portal/portal.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SecurityModule } from './modules/security/security.module';
import { SubcontractModule } from './modules/subcontract/subcontract.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const id = typeof incoming === 'string' && incoming.length <= 100 ? incoming : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
          autoLogging: { ignore: (req) => req.url === '/health' },
        },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    EnginesModule,
    AuthModule,
    SecurityModule,
    OrganizationModule,
    PartiesModule,
    ComplianceModule,
    DocumentsModule,
    ProjectsModule,
    InventoryModule,
    ProcurementModule,
    WorkforceModule,
    EquipmentModule,
    FinanceModule,
    SubcontractModule,
    FieldModule,
    ReportsModule,
    AiModule,
    PortalModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
