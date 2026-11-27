import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationItem,
  NotificationTriggerType,
} from '@vintage/shared';
import { withSystemRls } from '../../common/rls-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface SendNotificationParams {
  userId: string;
  triggerType: NotificationTriggerType | string;
  subject?: string;
  payload: string;
  channels?: NotificationChannel[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async sendNotification(params: SendNotificationParams): Promise<void> {
    const channels = params.channels ?? [
      NotificationChannel.IN_APP,
      NotificationChannel.DEV_INBOX,
    ];

    const createdLogs = await withSystemRls(this.prisma, async (tx) => {
      const records = [];
      for (const channel of channels) {
        const log = await tx.notificationLog.create({
          data: {
            userId: params.userId,
            channel,
            triggerType: params.triggerType,
            subject: params.subject ?? null,
            payload: params.payload,
            status: 'SENT',
          },
        });
        records.push(log);
      }
      return records;
    });

    const inAppLog =
      createdLogs.find((l) => l.channel === NotificationChannel.IN_APP) ??
      createdLogs[0];

    if (inAppLog) {
      this.realtime.emitNotificationNew(params.userId, {
        id: inAppLog.id,
        userId: inAppLog.userId,
        channel: inAppLog.channel,
        triggerType: inAppLog.triggerType,
        subject: inAppLog.subject,
        payload: inAppLog.payload,
        status: inAppLog.status,
        isRead: inAppLog.isRead,
        sentAt: inAppLog.sentAt.toISOString(),
      });
    }

    // Free optional external dispatch hooks (strictly no-op when keys are absent)
    await Promise.allSettled([
      this.sendTelegramIfConfigured(params),
      this.sendWebPushIfConfigured(params),
      this.sendResendEmailIfConfigured(params),
    ]);
  }

  async getMyNotifications(userId: string): Promise<NotificationItem[]> {
    const rows = await withSystemRls(this.prisma, (tx) =>
      tx.notificationLog.findMany({
        where: { userId, channel: NotificationChannel.IN_APP },
        orderBy: { sentAt: 'desc' },
        take: 50,
      }),
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      channel: row.channel as NotificationChannel,
      triggerType: row.triggerType,
      subject: row.subject,
      payload: row.payload,
      status: row.status,
      isRead: row.isRead,
      sentAt: row.sentAt.toISOString(),
    }));
  }

  async markRead(userId: string, notificationId: string): Promise<{ success: boolean }> {
    await withSystemRls(this.prisma, (tx) =>
      tx.notificationLog.updateMany({
        where: { id: notificationId, userId },
        data: { isRead: true },
      }),
    );
    return { success: true };
  }

  async getDevInbox(): Promise<NotificationItem[]> {
    const rows = await withSystemRls(this.prisma, (tx) =>
      tx.notificationLog.findMany({
        where: { channel: NotificationChannel.DEV_INBOX },
        include: { user: { select: { fullName: true } } },
        orderBy: { sentAt: 'desc' },
        take: 100,
      }),
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      userName: row.user.fullName,
      channel: row.channel as NotificationChannel,
      triggerType: row.triggerType,
      subject: row.subject,
      payload: row.payload,
      status: row.status,
      isRead: row.isRead,
      sentAt: row.sentAt.toISOString(),
    }));
  }

  private async sendTelegramIfConfigured(
    params: SendNotificationParams,
  ): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) return;

    const user = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id: params.userId },
        select: { telegramChatId: true },
      }),
    );
    if (!user?.telegramChatId) return;

    try {
      const text = params.subject
        ? `*${params.subject}*\n${params.payload}`
        : params.payload;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.telegramChatId,
          text,
          parse_mode: 'Markdown',
        }),
      });
    } catch (err) {
      this.logger.warn(`Telegram dispatch failed: ${(err as Error).message}`);
    }
  }

  private async sendWebPushIfConfigured(
    params: SendNotificationParams,
  ): Promise<void> {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    if (!vapidPublicKey || !vapidPrivateKey) return;
    this.logger.debug(
      `Web Push hook ready for user ${params.userId} (${params.triggerType})`,
    );
  }

  private async sendResendEmailIfConfigured(
    params: SendNotificationParams,
  ): Promise<void> {
    const resendKey = process.env.RESEND_API_KEY?.trim();
    if (!resendKey) return;

    const user = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id: params.userId },
        select: { email: true },
      }),
    );
    if (!user?.email) return;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Vintage Aesthetics Gym <noreply@vintageaesthetics.gym>',
          to: [user.email],
          subject: params.subject || 'Vintage Aesthetics Gym Notification',
          text: params.payload,
        }),
      });
    } catch (err) {
      this.logger.warn(`Resend email failed: ${(err as Error).message}`);
    }
  }
}
