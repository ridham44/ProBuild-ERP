import {
  applyDecorators,
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiHeader } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { Observable, defer, from, lastValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthedRequest } from '../decorators/auth.decorators';

export const IDEMPOTENT = 'idempotent';
const TTL_MS = 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/;

/** Requires an Idempotency-Key header; retries with the same key replay the first response. */
export const Idempotent = () =>
  applyDecorators(
    SetMetadata(IDEMPOTENT, true),
    ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Unique key per user intent; retries replay the first response' }),
  );

/**
 * Makes non-repeatable mutations safe to retry. The (user, key, route) row is claimed with a unique
 * insert before the handler runs, so concurrent duplicates cannot both execute.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.reflector.getAllAndOverride<boolean>(IDEMPOTENT, [context.getHandler(), context.getClass()])) {
      return next.handle();
    }
    return defer(() => from(this.run(context, next)));
  }

  private async run(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const res = http.getResponse<Response>();
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('Idempotent routes require authentication');

    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
      throw new BadRequestException('A valid Idempotency-Key header (8-128 characters) is required');
    }
    const route = `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`;
    // The concrete path is part of the fingerprint: one key must never be replayed for a different resource (/:id).
    const requestHash = createHash('sha256').update(JSON.stringify([route, req.path, req.body ?? null])).digest('hex');

    const claimed = await this.claim(userId, key, route, requestHash);
    if (claimed.kind === 'replay') {
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(claimed.statusCode);
      return claimed.body;
    }

    try {
      const result: unknown = await lastValueFrom(next.handle(), { defaultValue: null });
      await this.prisma.idempotencyRecord.update({
        where: { id: claimed.id },
        data: {
          state: 'COMPLETED',
          statusCode: res.statusCode,
          responseBody: (result === undefined ? null : JSON.parse(JSON.stringify(result))) as Prisma.InputJsonValue,
        },
      });
      return result;
    } catch (error) {
      // A failed attempt did not change state, so the same key may be retried.
      await this.prisma.idempotencyRecord.delete({ where: { id: claimed.id } }).catch(() => undefined);
      throw error;
    }
  }

  private async claim(
    userId: string,
    key: string,
    route: string,
    requestHash: string,
  ): Promise<{ kind: 'new'; id: string } | { kind: 'replay'; statusCode: number; body: unknown }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const created = await this.prisma.idempotencyRecord.create({
          data: { userId, key, route, requestHash, expiresAt: new Date(Date.now() + TTL_MS) },
        });
        return { kind: 'new', id: created.id };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      }
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { userId_key_route: { userId, key, route } },
      });
      if (!existing) continue;
      if (existing.expiresAt < new Date()) {
        await this.prisma.idempotencyRecord.deleteMany({ where: { id: existing.id } });
        continue;
      }
      if (existing.requestHash !== requestHash) {
        throw new UnprocessableEntityException('This Idempotency-Key was already used with a different request');
      }
      if (existing.state === 'IN_PROGRESS') {
        throw new ConflictException('A request with this Idempotency-Key is still being processed');
      }
      return { kind: 'replay', statusCode: existing.statusCode ?? 200, body: existing.responseBody };
    }
    throw new ConflictException('Could not claim the Idempotency-Key; retry the request');
  }
}
