import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
} from '@nestjs/common';
import { RequestAuthContext, UserRole } from '@vintage/shared';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getMyNotifications(@CurrentUser() user: RequestAuthContext) {
    return this.notificationsService.getMyNotifications(user.userId);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markRead(user.userId, id);
  }

  @Public()
  @Get('dev-inbox')
  getDevInbox(@CurrentUser() user?: RequestAuthContext) {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      const simEnabled = process.env.ENABLE_DEV_SIMULATOR === 'true';
      if (!simEnabled || user?.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Dev inbox is disabled in production');
      }
    }
    return this.notificationsService.getDevInbox();
  }
}
