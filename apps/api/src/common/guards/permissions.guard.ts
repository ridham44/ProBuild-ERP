import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessService } from '../access.service';
import {
  AuthedRequest,
  IS_AUTHENTICATED_ONLY,
  IS_PUBLIC,
  REQUIRED_PERMISSION,
  RequiredPermission,
} from '../decorators/auth.decorators';

/** Deny by default: a route needs @Public(), @Authenticated() or @RequirePermission(). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) throw new ForbiddenException('No authenticated user');

    if (this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_ONLY, targets)) return true;

    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(REQUIRED_PERMISSION, targets);
    if (!required) throw new ForbiddenException('Route has no permission declared');
    if (!this.access.can(req.user, required.module, required.action)) {
      throw new ForbiddenException(`Requires ${required.action} on ${required.module}`);
    }
    return true;
  }
}
