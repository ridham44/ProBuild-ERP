import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PermissionActionKey, SessionUser } from '@probuild/shared';
import type { Request } from 'express';

export const IS_PUBLIC = 'isPublic';
export const IS_AUTHENTICATED_ONLY = 'isAuthenticatedOnly';
export const REQUIRED_PERMISSION = 'requiredPermission';

export type RequiredPermission = { module: string; action: PermissionActionKey };

/** Skips authentication entirely. Use sparingly (login, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Any signed-in user may call this; record-level checks must still happen in the service. */
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_ONLY, true);

/** Requires the user to hold (module, action) in at least one scope. */
export const RequirePermission = (module: string, action: PermissionActionKey) =>
  SetMetadata(REQUIRED_PERMISSION, { module, action } satisfies RequiredPermission);

export type AuthedRequest = Request & { user?: SessionUser; id?: string };

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user) throw new Error('CurrentUser used on a route without authentication');
  return req.user;
});

export const ClientMeta = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { ip?: string; userAgent?: string; requestId?: string } => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
  },
);
