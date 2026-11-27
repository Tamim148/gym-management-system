import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  BUSINESS_RULES,
  EntryStatus,
  NotificationTriggerType,
  PaymentStatus,
  UserRole,
} from '@vintage/shared';
import { withSystemRls } from '../../common/rls-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationCronService {
  private readonly logger = new Logger(NotificationCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Daily 08:00 AM job: dispatches 7/3/1-day subscription expiry reminders.
   */
  @Cron('0 8 * * *')
  async sendExpiryAlerts(): Promise<void> {
    const now = new Date();
    const thresholds = [
      { days: 7, trigger: NotificationTriggerType.EXPIRY_7D },
      { days: 3, trigger: NotificationTriggerType.EXPIRY_3D },
      { days: 1, trigger: NotificationTriggerType.EXPIRY_1D },
    ];

    for (const { days, trigger } of thresholds) {
      const windowStart = new Date(now.getTime() + (days - 0.5) * 86_400_000);
      const windowEnd = new Date(now.getTime() + (days + 0.5) * 86_400_000);

      const subs = await withSystemRls(this.prisma, (tx) =>
        tx.subscription.findMany({
          where: {
            paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] },
            endDate: { gte: windowStart, lte: windowEnd },
          },
          include: { plan: true },
        }),
      );

      for (const sub of subs) {
        await this.notificationsService.sendNotification({
          userId: sub.userId,
          triggerType: trigger,
          subject: `Membership expiring in ${days} day${days > 1 ? 's' : ''}`,
          payload: `Your ${sub.plan.name} membership expires on ${sub.endDate.toDateString()}. Renew early to avoid turnstile interruption.`,
        });
      }
    }
  }

  /**
   * Daily 01:00 AM job: transitions partial-payment subscriptions past 7-day grace period to OVERDUE.
   */
  @Cron('0 1 * * *')
  async enforcePartialPaymentGraceLockout(): Promise<void> {
    const cutoff = new Date(
      Date.now() - BUSINESS_RULES.PARTIAL_PAYMENT_GRACE_DAYS * 86_400_000,
    );

    const result = await withSystemRls(this.prisma, (tx) =>
      tx.subscription.updateMany({
        where: {
          paymentStatus: PaymentStatus.PARTIAL,
          dueAmountBdt: { gt: 0 },
          startDate: { lt: cutoff },
        },
        data: {
          paymentStatus: PaymentStatus.OVERDUE,
          syncVersion: { increment: 1 },
        },
      }),
    );

    if (result.count > 0) {
      this.logger.log(
        `Locked ${result.count} partial-payment subscription(s) past ${BUSINESS_RULES.PARTIAL_PAYMENT_GRACE_DAYS}-day grace period.`,
      );
    }
  }

  /**
   * Daily 02:00 AM job: scores member churn risk based on 14-day attendance inactivity and overdue status.
   */
  @Cron('0 2 * * *')
  async scoreChurnRisk(): Promise<void> {
    const now = Date.now();
    const members = await withSystemRls(this.prisma, (tx) =>
      tx.user.findMany({
        where: { role: UserRole.MEMBER },
        include: {
          attendanceLogs: {
            where: {
              entryStatus: {
                in: [EntryStatus.ALLOWED, EntryStatus.MANUAL_OVERRIDE],
              },
            },
            orderBy: { scannedAt: 'desc' },
            take: 1,
          },
          subscriptions: {
            orderBy: { endDate: 'desc' },
            take: 1,
          },
        },
      }),
    );

    for (const member of members) {
      const lastVisit = member.attendanceLogs[0]?.scannedAt;
      const daysSinceVisit = lastVisit
        ? (now - lastVisit.getTime()) / 86_400_000
        : 30;
      const latestSub = member.subscriptions[0];

      let score = 0.1;
      if (daysSinceVisit >= 14) {
        score = Math.min(0.95, 0.45 + (daysSinceVisit - 14) * 0.025);
      } else if (daysSinceVisit >= 7) {
        score = 0.3;
      }

      if (latestSub?.paymentStatus === PaymentStatus.OVERDUE) {
        score = Math.min(0.98, score + 0.2);
      }

      await withSystemRls(this.prisma, (tx) =>
        tx.user.update({
          where: { id: member.id },
          data: { churnRiskScore: Number(score.toFixed(2)) },
        }),
      );
    }
  }

  /**
   * Monthly 1st at 03:00 AM job: anonymizes AI prompts older than 90 days.
   */
  @Cron('0 3 1 * *')
  async anonymizeOldAiPrompts(): Promise<void> {
    const cutoff = new Date(Date.now() - 90 * 86_400_000);
    const result = await withSystemRls(this.prisma, (tx) =>
      tx.aIInteractionLog.updateMany({
        where: {
          createdAt: { lt: cutoff },
          userPrompt: { not: '[ANONYMIZED]' },
        },
        data: {
          userId: null,
          userPrompt: '[ANONYMIZED]',
        },
      }),
    );

    if (result.count > 0) {
      this.logger.log(`Anonymized ${result.count} AI interaction prompt(s) >90 days.`);
    }
  }
}
