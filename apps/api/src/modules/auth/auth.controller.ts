import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { loginSchema, type SessionUser } from '@probuild/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { AuthedRequest, Authenticated, CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { AppConfig } from '../../config/config.service';
import { AuthService, SESSION_COOKIE } from './auth.service';

class LoginDto extends createZodDto(loginSchema) {}

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
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (token) await this.auth.logout(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Authenticated()
  @Get('me')
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }
}
