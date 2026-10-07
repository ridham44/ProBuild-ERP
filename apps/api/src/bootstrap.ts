import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/config.service';

/**
 * Cookie sessions are immune to cross-site writes only if cross-origin browsers are refused.
 * SameSite=Lax covers most cases; this adds an explicit Origin allowlist on state-changing calls.
 */
function originGuard(allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const safe = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const origin = req.headers.origin;
    if (!safe && origin && !allowed.includes(origin)) {
      res.status(403).type('application/problem+json').json({
        type: 'about:blank#403',
        title: 'Forbidden',
        status: 403,
        detail: 'Origin not allowed',
      });
      return;
    }
    next();
  };
}

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfig);
  app.useLogger(app.get(Logger));

  const sentryDsn = config.get('SENTRY_DSN');
  if (sentryDsn) Sentry.init({ dsn: sentryDsn, environment: config.get('NODE_ENV') });

  const origins = config.get('WEB_ORIGINS');
  app.use(helmet());
  app.use(cookieParser());
  app.use(originGuard(origins));
  app.enableCors({ origin: origins, credentials: true });
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.setGlobalPrefix('v1', { exclude: ['health', 'ready'] });

  return app;
}

export function mountSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('ProBuild ERP API')
      .setVersion('1')
      .addCookieAuth('pb_session')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json' });
}
