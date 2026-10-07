import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, SESSION_COOKIE } from '../../modules/auth/auth.service';
import { ALLOW_PASSWORD_CHANGE, AuthedRequest, IS_PUBLIC } from '../decorators/auth.decorators';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('Not signed in');

    const resolved = await this.auth.resolveSession(token);
    if (!resolved) throw new UnauthorizedException('Session expired');
    req.user = resolved.user;
    req.sessionId = resolved.sessionId;

    if (resolved.user.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE, [context.getHandler(), context.getClass()]);
      if (!allowed) throw new ForbiddenException('You must change your password before continuing');
    }
    return true;
  }
}
