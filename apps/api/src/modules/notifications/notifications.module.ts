import { Global, Module } from '@nestjs/common';
import { NotificationCronService } from './notification-cron.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationCronService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
