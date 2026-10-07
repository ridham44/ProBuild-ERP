import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { paginationQuerySchema, type SessionUser } from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { Authenticated, CurrentUser } from '../../common/decorators/auth.decorators';
import { paginate } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';

class NotificationListQueryDto extends createZodDto(paginationQuerySchema) {}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Authenticated()
  async list(@CurrentUser() user: SessionUser, @Query() query: NotificationListQueryDto) {
    const page = await paginate(
      (args) =>
        this.prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      query,
    );
    const unread = await this.prisma.notification.count({ where: { userId: user.id, readAt: null } });
    return { ...page, unread };
  }

  @Post('read-all')
  @Authenticated()
  async readAll(@CurrentUser() user: SessionUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  @Post(':id/read')
  @Authenticated()
  async read(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
