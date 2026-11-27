import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminKpisResponse,
  AuditAction,
  ChurnRadarItem,
  EntryStatus,
  NotificationTriggerType,
  PaymentStatus,
  RequestAuthContext,
  TransactionStatus,
  UpdateFeatureFlagDto,
  UserRole,
  UserStatus,
} from '@vintage/shared';
import { formatCsvRow } from '../../common/csv-sanitizer';
import { withSystemRls } from '../../common/rls-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { withRlsContext } from '../../prisma/rls.helper';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getKpis(actor: RequestAuthContext): Promise<AdminKpisResponse> {
    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const branchScope =
      actor.role === UserRole.SUPER_ADMIN ? undefined : actor.branchId;

    return withRlsContext(this.prisma, actor, async (tx) => {
      const branches = await tx.branch.findMany({
        where: branchScope ? { id: branchScope } : {},
        orderBy: { code: 'asc' },
      });

      const transactions = await tx.transaction.findMany({
        where: {
          status: TransactionStatus.CLEARED,
          createdAt: { gte: startOfMonth },
          ...(branchScope ? { user: { homeBranchId: branchScope } } : {}),
        },
        include: {
          user: { select: { homeBranchId: true } },
        },
      });

      const revenueByBranch = new Map<string, number>();
      let totalRevenueMtdBdt = 0;
      for (const t of transactions) {
        totalRevenueMtdBdt += t.amountBdt;
        const bId = t.user.homeBranchId;
        revenueByBranch.set(bId, (revenueByBranch.get(bId) ?? 0) + t.amountBdt);
      }

      const [activeMembers, overdueSubs, todayFootfall, highChurnCount] =
        await Promise.all([
          tx.user.count({
            where: {
              role: UserRole.MEMBER,
              status: UserStatus.ACTIVE,
              ...(branchScope ? { homeBranchId: branchScope } : {}),
            },
          }),
          tx.subscription.findMany({
            where: {
              OR: [
                { paymentStatus: PaymentStatus.OVERDUE },
                { dueAmountBdt: { gt: 0 } },
              ],
              ...(branchScope ? { user: { homeBranchId: branchScope } } : {}),
            },
            select: { userId: true },
            distinct: ['userId'],
          }),
          tx.attendanceLog.count({
            where: {
              scannedAt: { gte: startOfToday },
              entryStatus: {
                in: [EntryStatus.ALLOWED, EntryStatus.MANUAL_OVERRIDE],
              },
              ...(branchScope ? { branchId: branchScope } : {}),
            },
          }),
          tx.user.count({
            where: {
              role: UserRole.MEMBER,
              churnRiskScore: { gte: 0.6 },
              ...(branchScope ? { homeBranchId: branchScope } : {}),
            },
          }),
        ]);

      return {
        totalRevenueMtdBdt,
        activeMembers,
        overdueMembers: overdueSubs.length,
        todayFootfall,
        highChurnCount,
        branchBreakdown: branches.map((b) => ({
          branchId: b.id,
          branchName: b.name,
          branchCode: b.code,
          currentOccupancy: b.currentOccupancy,
          maxOccupancy: b.maxOccupancy,
          revenueMtdBdt: revenueByBranch.get(b.id) ?? 0,
          edgeNodeOnline: b.edgeNodeOnline,
        })),
      };
    });
  }

  async getChurnRadar(actor: RequestAuthContext): Promise<ChurnRadarItem[]> {
    const branchScope =
      actor.role === UserRole.SUPER_ADMIN ? undefined : actor.branchId;

    const members = await withRlsContext(this.prisma, actor, (tx) =>
      tx.user.findMany({
        where: {
          role: UserRole.MEMBER,
          status: { not: UserStatus.INACTIVE },
          ...(branchScope ? { homeBranchId: branchScope } : {}),
        },
        include: {
          homeBranch: { select: { name: true } },
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
            select: { paymentStatus: true },
          },
        },
        orderBy: { churnRiskScore: 'desc' },
        take: 25,
      }),
    );

    return members.map((m) => ({
      userId: m.id,
      fullName: m.fullName,
      phone: m.phone,
      branchName: m.homeBranch.name,
      churnRiskScore: m.churnRiskScore,
      lastVisitAt: m.attendanceLogs[0]?.scannedAt.toISOString() ?? null,
      paymentStatus: m.subscriptions[0]?.paymentStatus ?? 'NONE',
    }));
  }

  async sendChurnNudge(actor: RequestAuthContext, userId: string) {
    const member = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true, homeBranchId: true },
      }),
    );

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      member.homeBranchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch churn nudge forbidden');
    }

    await this.notifications.sendNotification({
      userId: member.id,
      triggerType: NotificationTriggerType.CHURN_NUDGE,
      subject: 'We miss you at Vintage Aesthetics Gym!',
      payload: `Hi ${member.fullName}, your iron sanctuary awaits! Book an off-peak class or complimentary coach check-in this week.`,
    });

    return { sent: true, userId: member.id };
  }

  listFeatureFlags() {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async updateFeatureFlag(
    actor: RequestAuthContext,
    key: string,
    dto: UpdateFeatureFlagDto,
  ) {
    const existing = await this.prisma.featureFlag.findUnique({
      where: { key },
    });
    if (!existing) {
      throw new NotFoundException(`Feature flag "${key}" not found`);
    }

    return withRlsContext(this.prisma, actor, async (tx) => {
      const updated = await tx.featureFlag.update({
        where: { key },
        data: {
          ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
          ...(dto.rolloutPct !== undefined
            ? { rolloutPct: dto.rolloutPct }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          branchId: existing.branchId,
          action: AuditAction.FEATURE_FLAG_UPDATED,
          entityType: 'FeatureFlag',
          entityId: updated.id,
          metadataJson: JSON.stringify({
            key,
            isEnabled: updated.isEnabled,
            rolloutPct: updated.rolloutPct,
          }),
        },
      });

      return updated;
    });
  }

  listAuditLogs(actor: RequestAuthContext) {
    return withRlsContext(this.prisma, actor, (tx) =>
      tx.auditLog.findMany({
        where:
          actor.role === UserRole.SUPER_ADMIN
            ? {}
            : { branchId: actor.branchId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  async exportTransactionsCsv(actor: RequestAuthContext): Promise<string> {
    const branchScope =
      actor.role === UserRole.SUPER_ADMIN ? undefined : actor.branchId;

    const transactions = await withRlsContext(this.prisma, actor, (tx) =>
      tx.transaction.findMany({
        where: branchScope ? { user: { homeBranchId: branchScope } } : {},
        include: {
          user: {
            select: {
              fullName: true,
              phone: true,
              homeBranch: { select: { code: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
    );

    const header = formatCsvRow([
      'InvoiceNumber',
      'Date',
      'BranchCode',
      'MemberName',
      'MemberPhone',
      'Type',
      'PaymentMethod',
      'AmountBdt',
      'DiscountBdt',
      'Status',
      'GatewayRef',
    ]);

    const rows = transactions.map((t) =>
      formatCsvRow([
        t.invoiceNumber,
        t.createdAt.toISOString(),
        t.user.homeBranch.code,
        t.user.fullName,
        t.user.phone,
        t.type,
        t.paymentMethod,
        t.amountBdt,
        t.discountAppliedBdt,
        t.status,
        t.gatewayRef ?? '',
      ]),
    );

    return [header, ...rows].join('\n');
  }
}
