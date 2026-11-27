import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  BillingCycle,
  BookingStatus,
  BookSessionResponse,
  BUSINESS_RULES,
  CancelSessionSchema,
  CreateSessionDto,
  EquipmentStatus,
  NotificationTriggerType,
  PaymentStatus,
  RequestAuthContext,
  SessionType,
  SessionWithAvailability,
  UpdateSessionDto,
  UserRole,
} from '@vintage/shared';
import { SYSTEM_RLS_CONTEXT, withSystemRls, withTxRls } from '../../common/rls-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listSessions(filters: {
    branchId?: string;
    trainerId?: string;
    includeCancelled?: boolean;
  }): Promise<SessionWithAvailability[]> {
    const sessions = await withSystemRls(this.prisma, (tx) =>
      tx.session.findMany({
        where: {
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
          ...(filters.trainerId ? { trainerId: filters.trainerId } : {}),
          ...(!filters.includeCancelled ? { isCancelled: false } : {}),
        },
        include: {
          trainer: { select: { fullName: true } },
          branch: { select: { name: true } },
          bookings: {
            where: {
              status: {
                in: [
                  BookingStatus.CONFIRMED,
                  BookingStatus.ATTENDED,
                  BookingStatus.WAITLISTED,
                ],
              },
            },
            select: { status: true },
          },
        },
        orderBy: { startTime: 'asc' },
      }),
    );

    const outOfOrderEquipment = await this.prisma.equipmentAsset.findMany({
      where: { status: EquipmentStatus.OUT_OF_ORDER },
      select: { branchId: true, zoneName: true },
    });

    const oooZoneKeys = new Set(
      outOfOrderEquipment.map((eq) => `${eq.branchId}:${eq.zoneName}`),
    );

    return sessions.map((s) => {
      const confirmedCount = s.bookings.filter(
        (b) =>
          b.status === BookingStatus.CONFIRMED ||
          b.status === BookingStatus.ATTENDED,
      ).length;
      const waitlistCount = s.bookings.filter(
        (b) => b.status === BookingStatus.WAITLISTED,
      ).length;

      return {
        id: s.id,
        trainerId: s.trainerId,
        trainerName: s.trainer.fullName,
        branchId: s.branchId,
        branchName: s.branch.name,
        title: s.title,
        type: s.type as SessionType,
        zoneName: s.zoneName,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        maxCapacity: s.maxCapacity,
        confirmedCount,
        waitlistCount,
        isOffPeakDeal: s.isOffPeakDeal,
        offPeakPriceBdt: s.offPeakPriceBdt,
        isCancelled: s.isCancelled,
        hasOutOfOrderEquipment: s.zoneName
          ? oooZoneKeys.has(`${s.branchId}:${s.zoneName}`)
          : false,
      };
    });
  }

  async listMyBookings(userId: string) {
    return withSystemRls(this.prisma, (tx) =>
      tx.booking.findMany({
        where: { userId },
        include: {
          session: {
            include: {
              trainer: { select: { fullName: true } },
              branch: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async createSession(actor: RequestAuthContext, dto: CreateSessionDto) {
    const targetTrainerId =
      actor.role === UserRole.TRAINER
        ? actor.userId
        : dto.trainerId ?? actor.userId;

    if (
      actor.role === UserRole.TRAINER &&
      dto.trainerId &&
      dto.trainerId !== actor.userId
    ) {
      throw new ForbiddenException(
        'Trainers can only create sessions for themselves',
      );
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      dto.branchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch session creation forbidden');
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    await this.assertNoScheduleConflict({
      trainerId: targetTrainerId,
      branchId: dto.branchId,
      zoneName: dto.zoneName,
      startTime,
      endTime,
    });

    const dhakaHour = (startTime.getUTCHours() + 6) % 24;
    const isOffPeakWindow =
      dhakaHour >= BUSINESS_RULES.OFF_PEAK_START_HOUR &&
      dhakaHour < BUSINESS_RULES.OFF_PEAK_END_HOUR;

    return withSystemRls(
      this.prisma,
      (tx) =>
        tx.session.create({
          data: {
            trainerId: targetTrainerId,
            branchId: dto.branchId,
            title: dto.title.trim(),
            type: dto.type,
            zoneName: dto.zoneName?.trim() || null,
            startTime,
            endTime,
            maxCapacity: dto.maxCapacity,
            isOffPeakDeal: isOffPeakWindow,
            offPeakPriceBdt: isOffPeakWindow ? 375 : null,
          },
        }),
      dto.branchId,
    );
  }

  async updateSession(
    actor: RequestAuthContext,
    sessionId: string,
    dto: UpdateSessionDto,
  ) {
    const existing = await withSystemRls(this.prisma, (tx) =>
      tx.session.findUnique({ where: { id: sessionId } }),
    );
    if (!existing) {
      throw new NotFoundException('Session not found');
    }

    this.assertCanManageSession(actor, existing);

    const nextStart = dto.startTime
      ? new Date(dto.startTime)
      : existing.startTime;
    const nextEnd = dto.endTime ? new Date(dto.endTime) : existing.endTime;
    if (nextEnd <= nextStart) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const nextBranchId = dto.branchId ?? existing.branchId;
    const nextTrainerId = dto.trainerId ?? existing.trainerId;
    const nextZone =
      dto.zoneName !== undefined ? dto.zoneName : existing.zoneName;

    await this.assertNoScheduleConflict({
      excludeSessionId: existing.id,
      trainerId: nextTrainerId,
      branchId: nextBranchId,
      zoneName: nextZone ?? undefined,
      startTime: nextStart,
      endTime: nextEnd,
    });

    return withSystemRls(
      this.prisma,
      (tx) =>
        tx.session.update({
          where: { id: existing.id },
          data: {
            ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
            ...(dto.type !== undefined ? { type: dto.type } : {}),
            ...(dto.zoneName !== undefined
              ? { zoneName: dto.zoneName.trim() }
              : {}),
            ...(dto.maxCapacity !== undefined
              ? { maxCapacity: dto.maxCapacity }
              : {}),
            startTime: nextStart,
            endTime: nextEnd,
            branchId: nextBranchId,
            trainerId: nextTrainerId,
          },
        }),
      nextBranchId,
    );
  }

  async deleteOrCancelSession(
    actor: RequestAuthContext,
    sessionId: string,
    rawBody: unknown,
  ) {
    const existing = await withSystemRls(this.prisma, (tx) =>
      tx.session.findUnique({
        where: { id: sessionId },
        include: {
          bookings: {
            where: {
              status: { in: [BookingStatus.CONFIRMED, BookingStatus.WAITLISTED] },
            },
          },
        },
      }),
    );

    if (!existing) {
      throw new NotFoundException('Session not found');
    }

    this.assertCanManageSession(actor, existing);

    const confirmedBookings = existing.bookings.filter(
      (b) => b.status === BookingStatus.CONFIRMED,
    );

    let cancelReason = 'Cancelled by staff';
    if (confirmedBookings.length > 0) {
      const parsed = CancelSessionSchema.strict().safeParse(rawBody);
      if (!parsed.success) {
        throw new BadRequestException(
          'Cancelling a session with confirmed bookings requires a reason (min 5 characters)',
        );
      }
      cancelReason = parsed.data.reason;
    }

    await withSystemRls(
      this.prisma,
      async (tx) => {
        await tx.session.update({
          where: { id: existing.id },
          data: {
            isCancelled: true,
            cancelReason,
          },
        });

        await tx.booking.updateMany({
          where: {
            sessionId: existing.id,
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.WAITLISTED] },
          },
          data: {
            status: BookingStatus.CANCELLED,
            waitlistOrder: null,
          },
        });

        for (const booking of confirmedBookings) {
          const packSub = await tx.subscription.findFirst({
            where: {
              userId: booking.userId,
              paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] },
              plan: { billingCycle: BillingCycle.SESSION_PACK },
            },
            orderBy: { endDate: 'desc' },
          });
          if (packSub) {
            await tx.subscription.update({
              where: { id: packSub.id },
              data: {
                remainingCredits: { increment: 1 },
                syncVersion: { increment: 1 },
              },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            branchId: existing.branchId,
            action: AuditAction.BOOKED_SLOT_DELETED,
            entityType: 'Session',
            entityId: existing.id,
            metadataJson: JSON.stringify({
              title: existing.title,
              reason: cancelReason,
              affectedMemberIds: confirmedBookings.map((b) => b.userId),
            }),
          },
        });
      },
      existing.branchId,
    );

    for (const booking of confirmedBookings) {
      await this.notifications.sendNotification({
        userId: booking.userId,
        triggerType: NotificationTriggerType.TRAINER_CANCEL,
        subject: `Session Cancelled: ${existing.title}`,
        payload: `Your booked session "${existing.title}" has been cancelled. Reason: ${cancelReason}. Any PT session credit used has been refunded.`,
      });
    }

    return {
      cancelled: true,
      sessionId: existing.id,
      notifiedMembers: confirmedBookings.length,
    };
  }

  async bookSession(
    actor: RequestAuthContext,
    sessionId: string,
  ): Promise<BookSessionResponse> {
    const isPostgres = process.env.DATABASE_URL?.startsWith('postgres');

    return withTxRls(
      this.prisma,
      async (tx) => {
      if (isPostgres) {
        // Row-level lock on Session prevents concurrent bookings from exceeding maxCapacity
        await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId} FOR UPDATE`;
      }

      const session = await tx.session.findUnique({
        where: { id: sessionId },
      });
      if (!session || session.isCancelled) {
        throw new NotFoundException('Session not found or cancelled');
      }

      const existingBooking = await tx.booking.findUnique({
        where: {
          sessionId_userId: { sessionId, userId: actor.userId },
        },
      });
      if (
        existingBooking &&
        existingBooking.status !== BookingStatus.CANCELLED
      ) {
        throw new ConflictException(
          'Already booked or waitlisted for this session',
        );
      }

      const confirmedCount = await tx.booking.count({
        where: {
          sessionId,
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.ATTENDED] },
        },
      });

      if (confirmedCount < session.maxCapacity) {
        if (session.type === SessionType.GROUP_CLASS) {
          const upcomingGroupCount = await tx.booking.count({
            where: {
              userId: actor.userId,
              status: BookingStatus.CONFIRMED,
              session: {
                type: SessionType.GROUP_CLASS,
                startTime: { gte: new Date() },
                isCancelled: false,
              },
            },
          });
          if (upcomingGroupCount >= 3) {
            throw new ConflictException(
              'Maximum 3 upcoming confirmed group class bookings allowed',
            );
          }
        }

        if (session.type === SessionType.PERSONAL_TRAINING) {
          const packSub = await tx.subscription.findFirst({
            where: {
              userId: actor.userId,
              paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] },
              plan: { billingCycle: BillingCycle.SESSION_PACK },
              remainingCredits: { gte: 1 },
            },
            orderBy: { endDate: 'desc' },
          });
          if (packSub) {
            const deducted = await tx.subscription.updateMany({
              where: { id: packSub.id, remainingCredits: { gte: 1 } },
              data: {
                remainingCredits: { decrement: 1 },
                syncVersion: { increment: 1 },
              },
            });
            if (deducted.count === 0) {
              throw new ConflictException('Insufficient session credits');
            }
          }
        }

        const booking = await tx.booking.upsert({
          where: {
            sessionId_userId: { sessionId, userId: actor.userId },
          },
          update: {
            status: BookingStatus.CONFIRMED,
            waitlistOrder: null,
          },
          create: {
            sessionId,
            userId: actor.userId,
            status: BookingStatus.CONFIRMED,
            waitlistOrder: null,
          },
        });

        return {
          bookingId: booking.id,
          sessionId,
          status: 'CONFIRMED',
          waitlistOrder: null,
        };
      }

      const lastWaitlist = await tx.booking.findFirst({
        where: { sessionId, status: BookingStatus.WAITLISTED },
        orderBy: { waitlistOrder: 'desc' },
        select: { waitlistOrder: true },
      });
      const nextOrder = (lastWaitlist?.waitlistOrder ?? 0) + 1;

      const waitlisted = await tx.booking.upsert({
        where: {
          sessionId_userId: { sessionId, userId: actor.userId },
        },
        update: {
          status: BookingStatus.WAITLISTED,
          waitlistOrder: nextOrder,
        },
        create: {
          sessionId,
          userId: actor.userId,
          status: BookingStatus.WAITLISTED,
          waitlistOrder: nextOrder,
        },
      });

      return {
        bookingId: waitlisted.id,
        sessionId,
        status: 'WAITLISTED',
        waitlistOrder: nextOrder,
      };
    }, SYSTEM_RLS_CONTEXT);
  }

  async cancelBooking(actor: RequestAuthContext, bookingId: string) {
    const isPostgres = process.env.DATABASE_URL?.startsWith('postgres');

    const outcome = await withTxRls(
      this.prisma,
      async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { session: true },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (
        actor.role === UserRole.MEMBER &&
        booking.userId !== actor.userId
      ) {
        throw new ForbiddenException('Cannot cancel another member booking');
      }
      if (
        actor.role === UserRole.TRAINER &&
        booking.session.trainerId !== actor.userId
      ) {
        throw new ForbiddenException('Trainers can only manage own sessions');
      }
      if (
        (actor.role === UserRole.BRANCH_MANAGER ||
          actor.role === UserRole.FRONT_DESK) &&
        booking.session.branchId !== actor.branchId
      ) {
        throw new ForbiddenException('Cross-branch booking cancel forbidden');
      }

      if (isPostgres) {
        await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${booking.sessionId} FOR UPDATE`;
      }

      const wasConfirmed = booking.status === BookingStatus.CONFIRMED;

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED, waitlistOrder: null },
      });

      let promotedUserId: string | null = null;
      if (wasConfirmed) {
        const nextWaitlisted = await tx.booking.findFirst({
          where: {
            sessionId: booking.sessionId,
            status: BookingStatus.WAITLISTED,
          },
          orderBy: { waitlistOrder: 'asc' },
        });

        if (nextWaitlisted) {
          await tx.booking.update({
            where: { id: nextWaitlisted.id },
            data: { status: BookingStatus.CONFIRMED, waitlistOrder: null },
          });
          promotedUserId = nextWaitlisted.userId;
        }
      }

      return {
        bookingId: booking.id,
        promotedUserId,
        sessionTitle: booking.session.title,
      };
    });

    if (outcome.promotedUserId) {
      await this.notifications.sendNotification({
        userId: outcome.promotedUserId,
        triggerType: NotificationTriggerType.WAITLIST_PROMOTED,
        subject: `Waitlist Promoted: ${outcome.sessionTitle}`,
        payload: `A spot opened up! Your booking for "${outcome.sessionTitle}" is now CONFIRMED.`,
      });
    }

    return {
      cancelled: true,
      bookingId: outcome.bookingId,
      promotedUserId: outcome.promotedUserId,
    };
  }

  async markAttendance(
    actor: RequestAuthContext,
    bookingId: string,
    status: typeof BookingStatus.ATTENDED | typeof BookingStatus.NO_SHOW,
  ) {
    const booking = await withSystemRls(this.prisma, (tx) =>
      tx.booking.findUnique({
        where: { id: bookingId },
        include: { session: true },
      }),
    );

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertCanManageSession(actor, booking.session);

    return withSystemRls(this.prisma, (tx) =>
      tx.booking.update({
        where: { id: booking.id },
        data: { status },
      }),
    );
  }

  private assertCanManageSession(
    actor: RequestAuthContext,
    session: { trainerId: string; branchId: string },
  ): void {
    if (actor.role === UserRole.SUPER_ADMIN) {
      return;
    }
    if (actor.role === UserRole.TRAINER) {
      if (session.trainerId !== actor.userId) {
        throw new ForbiddenException('Trainers can only manage their own sessions');
      }
      return;
    }
    if (actor.role === UserRole.BRANCH_MANAGER) {
      if (session.branchId !== actor.branchId) {
        throw new ForbiddenException('Cross-branch session management forbidden');
      }
      return;
    }
    throw new ForbiddenException('Insufficient permissions for session management');
  }

  private async assertNoScheduleConflict(params: {
    excludeSessionId?: string;
    trainerId: string;
    branchId: string;
    zoneName?: string;
    startTime: Date;
    endTime: Date;
  }): Promise<void> {
    const bufferMs = 15 * 60_000;
    const windowStart = new Date(params.startTime.getTime() - bufferMs);
    const windowEnd = new Date(params.endTime.getTime() + bufferMs);

    const conflict = await withSystemRls(this.prisma, (tx) =>
      tx.session.findFirst({
        where: {
          ...(params.excludeSessionId
            ? { id: { not: params.excludeSessionId } }
            : {}),
          isCancelled: false,
          startTime: { lt: windowEnd },
          endTime: { gt: windowStart },
          OR: [
            { trainerId: params.trainerId },
            ...(params.zoneName
              ? [
                  {
                    branchId: params.branchId,
                    zoneName: params.zoneName.trim(),
                  },
                ]
              : []),
          ],
        },
        select: { id: true, title: true, startTime: true, endTime: true },
      }),
    );

    if (conflict) {
      throw new ConflictException(
        `Schedule conflict (including 15-min buffer) with "${conflict.title}"`,
      );
    }
  }
}
