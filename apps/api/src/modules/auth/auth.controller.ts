import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { changePasswordSchema, confirmPasswordResetSchema, loginSchema, type SessionUser } from '@probuild/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import {
  AllowPasswordChange,
  AuthedRequest,
  Authenticated,
  ClientMeta,
  CurrentSessionId,
  CurrentUser,
  Public,
} from '../../common/decorators/auth.decorators';
import { AppConfig } from '../../config/config.service';
import { AuthService, ClientMetaInfo, SESSION_COOKIE } from './auth.service';

class LoginDto extends createZodDto(loginSchema) {}
class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
class ConfirmPasswordResetDto extends createZodDto(confirmPasswordResetSchema) {}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const { token, expiresAt, user } = await this.auth.login(body.email, body.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });
    return user;
  }

  @Authenticated()
  @AllowPasswordChange()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser() user: SessionUser,
    @ClientMeta() meta: ClientMetaInfo,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (token) await this.auth.logout(token, user, meta);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Authenticated()
  @AllowPasswordChange()
  @Get('me')
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }

  @Authenticated()
  @AllowPasswordChange()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password')
  @HttpCode(204)
  changePassword(
    @CurrentUser() user: SessionUser,
    @CurrentSessionId() sessionId: string,
    @Body() body: ChangePasswordDto,
    @ClientMeta() meta: ClientMetaInfo,
  ): Promise<void> {
    return this.auth.changePassword(user, sessionId, body, meta);
  }

  /** Completes an admin-issued reset. Public because the user cannot sign in; the token is the credential. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-reset/confirm')
  @HttpCode(204)
  confirmReset(@Body() body: ConfirmPasswordResetDto, @ClientMeta() meta: ClientMetaInfo): Promise<void> {
    return this.auth.confirmPasswordReset(body.token, body.newPassword, meta);
  }

  @Authenticated()
  @Get('sessions')
  sessions(@CurrentUser() user: SessionUser, @CurrentSessionId() sessionId: string) {
    return this.auth.listSessions(user, sessionId);
  }

  @Authenticated()
  @Delete('sessions/:id')
  @HttpCode(204)
  revoke(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.auth.revokeSession(user, id);
  }

  @Authenticated()
  @Post('sessions/revoke-others')
  @HttpCode(200)
  async revokeOthers(@CurrentUser() user: SessionUser, @CurrentSessionId() sessionId: string) {
    return { revoked: await this.auth.revokeOtherSessions(user, sessionId) };
  }
}
