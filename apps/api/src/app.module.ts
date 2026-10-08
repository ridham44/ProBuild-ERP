import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { ZodValidationPipe } from 'nestjs-zod';
import { LoggerModule } from 'nestjs-pino';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { SessionAuthGuard } from './common/guards/session-auth.guard';
import { ConfigModule } from './config/config.module';
import { AppConfig } from './config/config.service';
import { EnginesModule } from './engines/engines.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PartiesModule } from './modules/parties/parties.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { ReceivingModule } from './modules/receiving/receiving.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SecurityModule } from './modules/security/security.module';
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
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      // Rate limiting is only bypassed under NODE_ENV=test so suites can sign in many users from one IP.
      useFactory: (config: AppConfig) => ({
        throttlers: [{ ttl: 60_000, limit: 300 }],
        skipIf: () => config.get('NODE_ENV') === 'test',
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EnginesModule,
    AuthModule,
    SecurityModule,
    AccountingModule,
    OrganizationModule,
    PartiesModule,
    ProjectsModule,
    InventoryModule,
    ProcurementModule,
    ReceivingModule,
    MaterialsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
