import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateEquipmentTicketDto,
  EquipmentStatus,
  LockerTapDto,
  RequestAuthContext,
  TicketStatus,
  UpdateTicketStatusDto,
  UserRole,
} from '@vintage/shared';
import { withSystemRls } from '../../common/rls-utils';
import { UploadSanitizerService } from '../../common/upload-sanitizer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HARDWARE_ADAPTER, HardwareAdapter } from '../access/hardware.adapter';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class FacilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadSanitizer: UploadSanitizerService,
    private readonly realtime: RealtimeGateway,
    @Inject(HARDWARE_ADAPTER)
    private readonly hardwareAdapter: HardwareAdapter,
  ) {}

  listLockers(actor: RequestAuthContext, branchId?: string) {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      branchId &&
      branchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch locker access forbidden');
    }
    const effectiveBranch =
      actor.role === UserRole.SUPER_ADMIN
        ? branchId
        : actor.branchId;

    return withSystemRls(this.prisma, (tx) =>
      tx.smartLocker.findMany({
        where: effectiveBranch ? { branchId: effectiveBranch } : {},
        include: {
          assignedUser: { select: { id: true, fullName: true, phone: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { lockerNumber: 'asc' },
      }),
    );
  }

  async tapLocker(
    actor: RequestAuthContext,
    lockerId: string,
    dto: LockerTapDto,
  ) {
    const locker = await this.prisma.smartLocker.findUnique({
      where: { id: lockerId },
    });
    if (!locker) {
      throw new NotFoundException('Smart locker not found');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      locker.branchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch locker tap forbidden');
    }

    let targetUserId = actor.userId;

    if (dto.cardUid) {
      const card = await withSystemRls(this.prisma, (tx) =>
        tx.accessCard.findUnique({
          where: { cardUid: dto.cardUid!.trim() },
        }),
      );
      if (!card || card.status !== 'ACTIVE') {
        throw new BadRequestException('Invalid or inactive RFID card');
      }
      targetUserId = card.userId;
    } else if (dto.userId) {
      if (actor.role === UserRole.MEMBER && dto.userId !== actor.userId) {
        throw new ForbiddenException('Cannot tap locker on behalf of another member');
      }
      targetUserId = dto.userId;
    }

    if (locker.assignedUserId === targetUserId) {
      const released = await this.prisma.smartLocker.update({
        where: { id: locker.id },
        data: { assignedUserId: null, claimedAt: null },
      });
      await this.hardwareAdapter.unlockLocker(locker.hardwareRelayId);
      return { action: 'RELEASED', locker: released };
    }

    if (locker.assignedUserId !== null) {
      throw new ConflictException(
        `Locker ${locker.lockerNumber} is currently occupied`,
      );
    }

    const existingHeld = await this.prisma.smartLocker.findUnique({
      where: { assignedUserId: targetUserId },
    });
    if (existingHeld) {
      throw new ConflictException(
        `Member already holds locker ${existingHeld.lockerNumber}. Release it first.`,
      );
    }

    const claimed = await this.prisma.smartLocker.update({
      where: { id: locker.id },
      data: { assignedUserId: targetUserId, claimedAt: new Date() },
      include: {
        assignedUser: { select: { id: true, fullName: true } },
      },
    });
    await this.hardwareAdapter.unlockLocker(locker.hardwareRelayId);
    return { action: 'CLAIMED', locker: claimed };
  }

  listEquipment(branchId?: string) {
    return this.prisma.equipmentAsset.findMany({
      where: branchId ? { branchId } : {},
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getEquipmentByQr(token: string) {
    const equipment = await this.prisma.equipmentAsset.findUnique({
      where: { qrCodeToken: token.trim() },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        tickets: {
          where: { status: { not: TicketStatus.RESOLVED } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!equipment) {
      throw new NotFoundException('Equipment asset not found for QR token');
    }
    return equipment;
  }

  listTickets(actor: RequestAuthContext, branchId?: string) {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      branchId &&
      branchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch ticket access forbidden');
    }

    return withSystemRls(this.prisma, (tx) =>
      tx.equipmentTicket.findMany({
        where:
          actor.role === UserRole.MEMBER
            ? { reportedById: actor.userId }
            : actor.role === UserRole.SUPER_ADMIN
              ? branchId
                ? { equipment: { branchId } }
                : {}
              : { equipment: { branchId: actor.branchId } },
        include: {
          equipment: {
            include: {
              branch: { select: { id: true, name: true, code: true } },
            },
          },
          reportedBy: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  async createTicket(
    actor: RequestAuthContext,
    dto: CreateEquipmentTicketDto,
    photoBuffer?: Buffer,
  ) {
    if (!dto.equipmentId && !dto.qrCodeToken) {
      throw new BadRequestException(
        'Either equipmentId or qrCodeToken is required',
      );
    }

    const equipment = await this.prisma.equipmentAsset.findFirst({
      where: dto.equipmentId
        ? { id: dto.equipmentId }
        : { qrCodeToken: dto.qrCodeToken!.trim() },
    });

    if (!equipment) {
      throw new NotFoundException('Equipment asset not found');
    }

    let photoUrl: string | null = null;
    if (photoBuffer && photoBuffer.length > 0) {
      const sanitized = await this.uploadSanitizer.sanitizeAndSave(photoBuffer, {
        category: 'equipment',
      });
      photoUrl = sanitized.relativePath;
    }

    const ticket = await withSystemRls(this.prisma, async (tx) => {
      const created = await tx.equipmentTicket.create({
        data: {
          equipmentId: equipment.id,
          reportedById: actor.userId,
          description: dto.description.trim(),
          photoUrl,
          status: TicketStatus.OPEN,
        },
        include: {
          equipment: true,
          reportedBy: { select: { id: true, fullName: true } },
        },
      });

      await tx.equipmentAsset.update({
        where: { id: equipment.id },
        data: { status: EquipmentStatus.OUT_OF_ORDER },
      });

      return created;
    });

    this.realtime.emitTicketNew(equipment.branchId, ticket);
    return ticket;
  }

  async updateTicketStatus(
    actor: RequestAuthContext,
    ticketId: string,
    dto: UpdateTicketStatusDto,
  ) {
    const existing = await withSystemRls(this.prisma, (tx) =>
      tx.equipmentTicket.findUnique({
        where: { id: ticketId },
        include: { equipment: true },
      }),
    );

    if (!existing) {
      throw new NotFoundException('Equipment ticket not found');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      existing.equipment.branchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch ticket update forbidden');
    }

    return withSystemRls(this.prisma, async (tx) => {
      const updated = await tx.equipmentTicket.update({
        where: { id: ticketId },
        data: {
          status: dto.status,
          resolvedAt:
            dto.status === TicketStatus.RESOLVED ? new Date() : null,
        },
      });

      let nextEquipmentStatus = dto.equipmentStatus;
      if (!nextEquipmentStatus && dto.status === TicketStatus.RESOLVED) {
        const remainingOpen = await tx.equipmentTicket.count({
          where: {
            equipmentId: existing.equipmentId,
            id: { not: ticketId },
            status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
          },
        });
        if (remainingOpen === 0) {
          nextEquipmentStatus = EquipmentStatus.OPERATIONAL;
        }
      }

      if (nextEquipmentStatus) {
        await tx.equipmentAsset.update({
          where: { id: existing.equipmentId },
          data: { status: nextEquipmentStatus },
        });
      }

      return updated;
    });
  }
}
