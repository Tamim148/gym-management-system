import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessVerifyDto,
  AccessVerifyResult,
  AuditAction,
  BUSINESS_RULES,
  CardStatus,
  EntryStatus,
  ManualOverrideDto,
  NotificationTriggerType,
  OfflineSyncBatchDto,
  PaymentStatus,
  QrPassPayload,
  ReplaceCardDto,
  RequestAuthContext,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
} from '@vintage/shared';
import { CryptoService } from '../../common/crypto.service';
import { SYSTEM_RLS_CONTEXT, withSystemRls, withTxRls } from '../../common/rls-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { withRlsContext } from '../../prisma/rls.helper';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { HARDWARE_ADAPTER, HardwareAdapter } from './hardware.adapter';

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    @Inject(HARDWARE_ADAPTER)
    private readonly hardwareAdapter: HardwareAdapter,
  ) {}

  getQrPass(userId: string): QrPassPayload {
    const { token, expiresAt } = this.cryptoService.signQrPassToken(userId);
    return {
      token,
      userId,
      expiresAt,
      bucketSeconds: BUSINESS_RULES.QR_BUCKET_SECONDS,
    };
  }

  async verifyAccess(dto: AccessVerifyDto): Promise<AccessVerifyResult> {
    const startedAt = Date.now();
    const scanTime = dto.scannedAt ? new Date(dto.scannedAt) : new Date();

    try {
      if (!dto.cardUid && !dto.qrToken) {
        return {
          allowed: false,
          entryStatus: EntryStatus.DENIED_EXPIRED,
          attendanceLogId: '',
          branchId: dto.branchId,
          reason: 'Either cardUid or qrToken is required',
          latencyMs: Date.now() - startedAt,
          scannedAt: scanTime.toISOString(),
        };
      }

      if (dto.clientEventId) {
        const existingLog = await withSystemRls(this.prisma, (tx) =>
          tx.attendanceLog.findUnique({
            where: { id: dto.clientEventId },
            include: { user: { select: { fullName: true } } },
          }),
        );
        if (existingLog) {
          return {
            allowed:
              existingLog.entryStatus === EntryStatus.ALLOWED ||
              existingLog.entryStatus === EntryStatus.MANUAL_OVERRIDE,
            entryStatus: existingLog.entryStatus as EntryStatus,
            attendanceLogId: existingLog.id,
            branchId: existingLog.branchId,
            userId: existingLog.userId,
            memberName: existingLog.user.fullName,
            reason: 'Idempotent replay',
            latencyMs: Date.now() - startedAt,
            scannedAt: existingLog.scannedAt.toISOString(),
          };
        }
      }

      const branch = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
        select: { id: true, maxOccupancy: true },
      });
      if (!branch) {
        return {
          allowed: false,
          entryStatus: EntryStatus.DENIED_WRONG_BRANCH,
          attendanceLogId: '',
          branchId: dto.branchId,
          reason: 'Branch not found',
          latencyMs: Date.now() - startedAt,
          scannedAt: scanTime.toISOString(),
        };
      }

      let resolvedUserId: string | undefined;
      let cardInvalidReason: string | undefined;

      if (dto.cardUid) {
        const card = await withSystemRls(this.prisma, (tx) =>
          tx.accessCard.findUnique({
            where: { cardUid: dto.cardUid!.trim() },
          }),
        );
        if (!card) {
          await this.hardwareAdapter.triggerDeniedAlarm(
            dto.branchId,
            'Unknown RFID card',
          );
          return {
            allowed: false,
            entryStatus: EntryStatus.DENIED_EXPIRED,
            attendanceLogId: '',
            branchId: dto.branchId,
            reason: 'Unknown RFID card',
            latencyMs: Date.now() - startedAt,
            scannedAt: scanTime.toISOString(),
          };
        }
        resolvedUserId = card.userId;
        if (card.status !== CardStatus.ACTIVE) {
          cardInvalidReason = `RFID card is ${card.status}`;
        }
      } else if (dto.qrToken) {
        const verified = this.cryptoService.verifyQrPassToken(
          dto.qrToken,
          scanTime,
        );
        if (!verified.valid || !verified.userId) {
          await this.hardwareAdapter.triggerDeniedAlarm(
            dto.branchId,
            'Invalid or expired QR pass',
          );
          return {
            allowed: false,
            entryStatus: EntryStatus.DENIED_EXPIRED,
            attendanceLogId: '',
            branchId: dto.branchId,
            reason: 'Invalid or expired rotating QR pass',
            latencyMs: Date.now() - startedAt,
            scannedAt: scanTime.toISOString(),
          };
        }
        resolvedUserId = verified.userId;
      }

      const user = await withSystemRls(this.prisma, (tx) =>
        tx.user.findUnique({
          where: { id: resolvedUserId! },
          include: {
            subscriptions: {
              orderBy: { endDate: 'desc' },
              take: 1,
              include: { plan: true },
            },
          },
        }),
      );

      if (!user) {
        return {
          allowed: false,
          entryStatus: EntryStatus.DENIED_EXPIRED,
          attendanceLogId: '',
          branchId: dto.branchId,
          reason: 'Member account not found',
          latencyMs: Date.now() - startedAt,
          scannedAt: scanTime.toISOString(),
        };
      }

      const latestSub = user.subscriptions[0] ?? null;
      let entryStatus: EntryStatus = EntryStatus.ALLOWED;
      let reason = 'Access granted';

      if (cardInvalidReason) {
        entryStatus = EntryStatus.DENIED_EXPIRED;
        reason = cardInvalidReason;
      } else if (
        user.status === UserStatus.FROZEN ||
        user.status === UserStatus.SUSPENDED ||
        user.status === UserStatus.INACTIVE ||
        latestSub?.paymentStatus === PaymentStatus.FROZEN
      ) {
        entryStatus = EntryStatus.DENIED_FROZEN;
        reason = 'Membership or account is currently frozen/suspended';
      } else if (
        !latestSub ||
        latestSub.paymentStatus === PaymentStatus.CANCELLED ||
        latestSub.endDate.getTime() < scanTime.getTime()
      ) {
        entryStatus = EntryStatus.DENIED_EXPIRED;
        reason = latestSub
          ? 'Membership subscription has expired'
          : 'No active membership subscription found';
      } else if (latestSub.paymentStatus === PaymentStatus.OVERDUE) {
        entryStatus = EntryStatus.DENIED_UNPAID;
        reason = `Outstanding dues of ${latestSub.dueAmountBdt} BDT`;
      } else if (
        latestSub.paymentStatus === PaymentStatus.PARTIAL &&
        scanTime.getTime() - latestSub.startDate.getTime() >
          BUSINESS_RULES.PARTIAL_PAYMENT_GRACE_DAYS * 86_400_000
      ) {
        entryStatus = EntryStatus.DENIED_UNPAID;
        reason = `Partial payment 7-day grace expired (${latestSub.dueAmountBdt} BDT due)`;
      } else if (
        !latestSub.plan.roamingEnabled &&
        user.homeBranchId !== dto.branchId
      ) {
        entryStatus = EntryStatus.DENIED_WRONG_BRANCH;
        reason = 'Plan does not include multi-branch roaming';
      } else if (latestSub.plan.offPeakOnly) {
        const dhakaHour = (scanTime.getUTCHours() + 6) % 24;
        const startHour =
          latestSub.plan.offPeakStartHour ?? BUSINESS_RULES.OFF_PEAK_START_HOUR;
        const endHour =
          latestSub.plan.offPeakEndHour ?? BUSINESS_RULES.OFF_PEAK_END_HOUR;
        if (dhakaHour < startHour || dhakaHour >= endHour) {
          entryStatus = EntryStatus.DENIED_EXPIRED;
          reason = `Off-peak plan valid ${startHour}:00–${endHour}:00 Dhaka time`;
        }
      }

      if (entryStatus === EntryStatus.ALLOWED && !dto.syncedFromEdge) {
        const antiPassbackSince = new Date(
          scanTime.getTime() - BUSINESS_RULES.ANTI_PASSBACK_MINUTES * 60_000,
        );
        const recentEntry = await withSystemRls(this.prisma, (tx) =>
          tx.attendanceLog.findFirst({
            where: {
              userId: user.id,
              branchId: dto.branchId,
              entryStatus: EntryStatus.ALLOWED,
              scannedAt: { gte: antiPassbackSince },
              checkedOutAt: null,
            },
            orderBy: { scannedAt: 'desc' },
          }),
        );
        if (recentEntry) {
          entryStatus = EntryStatus.DENIED_EXPIRED;
          reason = `Anti-passback active (${BUSINESS_RULES.ANTI_PASSBACK_MINUTES} min cooldown)`;
        }
      }

      const allowed = entryStatus === EntryStatus.ALLOWED;

      const { log, updatedBranch } = await withTxRls(
        this.prisma,
        async (tx) => {
          const createdLog = await tx.attendanceLog.create({
            data: {
              ...(dto.clientEventId ? { id: dto.clientEventId } : {}),
              userId: user.id,
              branchId: dto.branchId,
              cardUidScanned: dto.cardUid?.trim() ?? 'QR_PASS',
              scannedAt: scanTime,
              entryStatus,
              syncedFromEdge: dto.syncedFromEdge ?? false,
            },
          });

          let nextBranch = null;
          if (allowed) {
            nextBranch = await tx.branch.update({
              where: { id: dto.branchId },
              data: { currentOccupancy: { increment: 1 } },
              select: {
                id: true,
                currentOccupancy: true,
                maxOccupancy: true,
              },
            });
          }

          return { log: createdLog, updatedBranch: nextBranch };
        },
        { ...SYSTEM_RLS_CONTEXT, branchId: dto.branchId },
      );

      if (allowed) {
        await this.hardwareAdapter.openGate(dto.branchId, reason);
      } else {
        await this.hardwareAdapter.triggerDeniedAlarm(dto.branchId, reason);
      }

      const result: AccessVerifyResult = {
        allowed,
        entryStatus,
        attendanceLogId: log.id,
        branchId: dto.branchId,
        userId: user.id,
        memberName: user.fullName,
        planName: latestSub?.plan.name,
        dueAmountBdt: latestSub?.dueAmountBdt ?? 0,
        reason,
        latencyMs: Date.now() - startedAt,
        scannedAt: log.scannedAt.toISOString(),
      };

      this.realtime.emitAccessEvent(dto.branchId, result);
      if (updatedBranch) {
        this.realtime.emitOccupancyUpdate(dto.branchId, {
          branchId: updatedBranch.id,
          currentOccupancy: updatedBranch.currentOccupancy,
          maxOccupancy: updatedBranch.maxOccupancy,
        });
      }

      return result;
    } catch (error) {
      // Fail-closed guarantee on any unexpected database or runtime failure
      this.logger.error(
        `Access verification failed closed: ${(error as Error).message}`,
      );
      return {
        allowed: false,
        entryStatus: EntryStatus.DENIED_EXPIRED,
        attendanceLogId: '',
        branchId: dto.branchId,
        reason: 'Turnstile verification failed closed',
        latencyMs: Date.now() - startedAt,
        scannedAt: scanTime.toISOString(),
      };
    }
  }

  async manualOverride(actor: RequestAuthContext, dto: ManualOverrideDto) {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      actor.branchId !== dto.branchId
    ) {
      throw new ForbiddenException('Cross-branch manual override forbidden');
    }

    const member = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id: dto.userId },
        select: { id: true, fullName: true, homeBranchId: true },
      }),
    );
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const { log, updatedBranch } = await withTxRls(
      this.prisma,
      async (tx) => {
        const monthlyOverrides = await tx.attendanceLog.count({
          where: {
            userId: dto.userId,
            entryStatus: EntryStatus.MANUAL_OVERRIDE,
            scannedAt: { gte: startOfMonth },
          },
        });

        if (monthlyOverrides >= BUSINESS_RULES.MAX_OVERRIDES_PER_MEMBER_MONTH) {
          throw new ConflictException(
            `Monthly manual override cap (${BUSINESS_RULES.MAX_OVERRIDES_PER_MEMBER_MONTH}) reached for this member`,
          );
        }

        const createdLog = await tx.attendanceLog.create({
          data: {
            userId: dto.userId,
            branchId: dto.branchId,
            entryStatus: EntryStatus.MANUAL_OVERRIDE,
            overrideById: actor.userId,
            overrideReason: dto.reason,
            overrideNotes: dto.notes.trim(),
          },
        });

        const nextBranch = await tx.branch.update({
          where: { id: dto.branchId },
          data: { currentOccupancy: { increment: 1 } },
          select: { id: true, currentOccupancy: true, maxOccupancy: true },
        });

        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            branchId: dto.branchId,
            action: AuditAction.GATE_OVERRIDE,
            entityType: 'AttendanceLog',
            entityId: createdLog.id,
            metadataJson: JSON.stringify({
              memberId: dto.userId,
              reason: dto.reason,
              notes: dto.notes,
            }),
          },
        });

        return { log: createdLog, updatedBranch: nextBranch };
      },
      actor,
    );

    await this.hardwareAdapter.openGate(dto.branchId, `Override: ${dto.reason}`);

    const superAdmins = await withSystemRls(this.prisma, (tx) =>
      tx.user.findMany({
        where: { role: UserRole.SUPER_ADMIN },
        select: { id: true },
      }),
    );

    for (const admin of superAdmins) {
      await this.notifications.sendNotification({
        userId: admin.id,
        triggerType: NotificationTriggerType.GATE_OVERRIDE_ALERT,
        subject: `Gate Override Alert — ${member.fullName}`,
        payload: `Staff ${actor.userId} overrode gate at branch ${dto.branchId} for ${member.fullName}. Reason: ${dto.reason}. Notes: ${dto.notes}`,
      });
    }

    const eventPayload: AccessVerifyResult = {
      allowed: true,
      entryStatus: EntryStatus.MANUAL_OVERRIDE,
      attendanceLogId: log.id,
      branchId: dto.branchId,
      userId: member.id,
      memberName: member.fullName,
      reason: `Manual override: ${dto.reason}`,
      latencyMs: 0,
      scannedAt: log.scannedAt.toISOString(),
    };

    this.realtime.emitAccessEvent(dto.branchId, eventPayload);
    this.realtime.emitOccupancyUpdate(dto.branchId, {
      branchId: updatedBranch.id,
      currentOccupancy: updatedBranch.currentOccupancy,
      maxOccupancy: updatedBranch.maxOccupancy,
    });

    return eventPayload;
  }

  async replaceCard(actor: RequestAuthContext, dto: ReplaceCardDto) {
    const member = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id: dto.userId },
        select: { id: true, fullName: true, homeBranchId: true },
      }),
    );
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      actor.branchId !== member.homeBranchId
    ) {
      throw new ForbiddenException('Cross-branch card replacement forbidden');
    }

    const newUid = dto.newCardUid.trim();

    return withTxRls(this.prisma, async (tx) => {
      const uidConflict = await tx.accessCard.findUnique({
        where: { cardUid: newUid },
      });
      if (uidConflict) {
        throw new ConflictException('New RFID card UID is already assigned');
      }

      await tx.accessCard.updateMany({
        where: { userId: member.id, status: CardStatus.ACTIVE },
        data: {
          status: dto.lostOrDamagedReason,
          revokedAt: new Date(),
          syncVersion: { increment: 1 },
        },
      });

      const invoiceNumber = `INV-CARD-${Date.now()}-${crypto.randomInt(100, 999)}`;
      const transaction = await tx.transaction.create({
        data: {
          invoiceNumber,
          userId: member.id,
          type: TransactionType.CARD_REPLACEMENT,
          paymentMethod: dto.paymentMethod,
          amountBdt: BUSINESS_RULES.CARD_REPLACEMENT_FEE_BDT,
          discountAppliedBdt: 0,
          gatewayRef: `CARD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          status: TransactionStatus.CLEARED,
          collectedByStaffId: actor.userId,
        },
      });

      const newCard = await tx.accessCard.create({
        data: {
          cardUid: newUid,
          userId: member.id,
          status: CardStatus.ACTIVE,
          replacementFeePaid: true,
          replacementInvoiceId: transaction.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          branchId: member.homeBranchId,
          action: AuditAction.CARD_REPLACED,
          entityType: 'AccessCard',
          entityId: newCard.id,
          metadataJson: JSON.stringify({
            memberId: member.id,
            newCardUid: newUid,
            reason: dto.lostOrDamagedReason,
            feeBdt: BUSINESS_RULES.CARD_REPLACEMENT_FEE_BDT,
            transactionId: transaction.id,
          }),
        },
      });

      return {
        card: newCard,
        transaction,
      };
    });
  }

  async offlineSync(actor: RequestAuthContext, dto: OfflineSyncBatchDto) {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      actor.branchId !== dto.branchId
    ) {
      throw new ForbiddenException('Cross-branch offline sync forbidden');
    }

    let processed = 0;
    let skipped = 0;

    for (const event of dto.events) {
      const exists = await withSystemRls(this.prisma, (tx) =>
        tx.attendanceLog.findUnique({ where: { id: event.id } }),
      );
      if (exists) {
        skipped += 1;
        continue;
      }

      if (event.kind === 'CARD_TAP') {
        if (!event.cardUid) {
          throw new BadRequestException(
            `CARD_TAP event ${event.id} missing cardUid`,
          );
        }
        await this.verifyAccess({
          branchId: dto.branchId,
          cardUid: event.cardUid,
          syncedFromEdge: true,
          clientEventId: event.id,
          scannedAt: event.scannedAt,
        });
        processed += 1;
      } else if (event.kind === 'MANUAL_OVERRIDE') {
        if (!event.userId) {
          throw new BadRequestException(
            `MANUAL_OVERRIDE event ${event.id} missing userId`,
          );
        }
        const notes =
          event.overrideNotes && event.overrideNotes.trim().length >= 10
            ? event.overrideNotes.trim()
            : 'Offline edge override synced';

        await withSystemRls(
          this.prisma,
          async (tx) => {
            await tx.attendanceLog.create({
              data: {
                id: event.id,
                userId: event.userId!,
                branchId: dto.branchId,
                scannedAt: new Date(event.scannedAt),
                entryStatus: EntryStatus.MANUAL_OVERRIDE,
                overrideById: actor.userId,
                overrideReason: event.overrideReason || 'Admin approved',
                overrideNotes: notes,
                syncedFromEdge: true,
              },
            });

            await tx.auditLog.create({
              data: {
                actorId: actor.userId,
                branchId: dto.branchId,
                action: AuditAction.GATE_OVERRIDE,
                entityType: 'AttendanceLog',
                entityId: event.id,
                metadataJson: JSON.stringify({
                  syncedFromEdge: true,
                  memberId: event.userId,
                  reason: event.overrideReason || 'Admin approved',
                  notes,
                }),
              },
            });
          },
          dto.branchId,
        );
        processed += 1;
      }
    }

    return {
      branchId: dto.branchId,
      processed,
      skipped,
      total: dto.events.length,
    };
  }

  async getRecentLogs(actor: RequestAuthContext, branchId?: string) {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      branchId &&
      branchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch attendance logs forbidden');
    }

    const effectiveBranchId =
      actor.role === UserRole.SUPER_ADMIN ? branchId : actor.branchId;

    return withRlsContext(this.prisma, actor, (tx) =>
      tx.attendanceLog.findMany({
        where: effectiveBranchId ? { branchId: effectiveBranchId } : {},
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              role: true,
            },
          },
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { scannedAt: 'desc' },
        take: 50,
      }),
    );
  }
}
