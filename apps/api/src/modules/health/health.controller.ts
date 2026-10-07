import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies (database) are reachable. */
  @Public()
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database is not reachable');
    }
    return { status: 'ready' };
  }
}
