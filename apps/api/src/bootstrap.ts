import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { AppConfig } from './config/config.service';
import { stripPublicPrefix } from './strip-public-prefix';

/**
 * Cookie sessions are immune to cross-site writes only if cross-origin browsers are refused.
 * SameSite=Lax covers most cases; this adds an explicit Origin allowlist on state-changing calls.
 */
function originGuard(allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const safe = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const origin = req.headers.origin;
    const fetchSite = req.headers['sec-fetch-site'];
    const crossSite = fetchSite === 'cross-site' || (fetchSite === 'same-site' && origin !== undefined && !allowed.includes(origin));
    if (!safe && ((origin && !allowed.includes(origin)) || (crossSite && !origin))) {
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

/** abortOnError: false makes a startup failure throw instead of exiting the process (serverless callers must survive it). */
export async function createApp(options: { abortOnError?: boolean } = {}): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, abortOnError: options.abortOnError ?? true });
  const config = app.get(AppConfig);
  app.useLogger(app.get(Logger));

  const sentryDsn = config.get('SENTRY_DSN');
  if (sentryDsn) Sentry.init({ dsn: sentryDsn, environment: config.get('NODE_ENV') });

  // Behind the Vercel route /api/* the original path arrives intact; the app itself serves /v1/* and /health.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.url = stripPublicPrefix(req.url) ?? req.url;
    next();
  });

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

const PROBLEM_REF = { $ref: '#/components/schemas/ProblemDetails' };
const PROBLEM_CONTENT = { 'application/problem+json': { schema: PROBLEM_REF } };
const COMMON_ERRORS: Record<string, string> = {
  '400': 'Validation failed',
  '401': 'Not signed in or session expired',
  '403': 'Permission denied',
  '404': 'Resource not found',
  '409': 'Conflict (duplicate or stale state)',
  '422': 'Business rule violated',
};
const PUBLIC_PATHS = new Set(['/health', '/ready', '/v1/auth/login']);

/** Documents the RFC 9457 error shape and cookie auth on every operation. */
function addCommonResponses(doc: OpenAPIObject): OpenAPIObject {
  doc.components ??= {};
  doc.components.schemas ??= {};
  doc.components.schemas['ProblemDetails'] = {
    type: 'object',
    required: ['type', 'title', 'status'],
    properties: {
      type: { type: 'string' },
      title: { type: 'string' },
      status: { type: 'integer' },
      detail: { type: 'string' },
      errors: {
        type: 'array',
        items: { type: 'object', required: ['path', 'message'], properties: { path: { type: 'string' }, message: { type: 'string' } } },
      },
    },
  };
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = item[method];
      if (!op) continue;
      op.responses ??= {};
      const hasBody = Boolean(op.requestBody);
      for (const [status, description] of Object.entries(COMMON_ERRORS)) {
        if (status === '400' && !hasBody && !op.parameters?.length) continue;
        if (!PUBLIC_PATHS.has(path) || status !== '401') op.responses[status] ??= { description, content: PROBLEM_CONTENT };
      }
      if (!PUBLIC_PATHS.has(path)) op.security = [{ pb_session: [] }];
    }
  }
  return doc;
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('ProBuild ERP API')
      .setDescription('Construction ERP for Philippine contractors')
      .setVersion('1')
      .addCookieAuth('pb_session')
      .build(),
  );
  return addCommonResponses(cleanupOpenApiDoc(document));
}

/** Interactive docs are development-only; production exposes nothing unauthenticated beyond health. */
export function mountSwagger(app: INestApplication): void {
  const config = app.get(AppConfig);
  if (config.isProduction && !config.get('ENABLE_API_DOCS')) return;
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), { jsonDocumentUrl: 'docs/openapi.json' });
}
