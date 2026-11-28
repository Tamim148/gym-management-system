import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import {
  FreePassLeadDto,
  FreePassLeadResponse,
  NotificationChannel,
  UserRole,
  UserStatus,
} from '@vintage/shared';
import { randomInt, randomUUID } from 'crypto';
import { withSystemRls } from '../../common/rls-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async reserveFreePass(dto: FreePassLeadDto): Promise<FreePassLeadResponse> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
      select: { id: true, name: true, code: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const id = randomUUID();
    const referenceCode = `VA-PASS-${randomInt(1000, 10000)}`;

    await this.dispatchStaffLeadNotification({
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.code,
      referenceCode,
      dto,
    });

    return {
      id,
      referenceCode,
      branchName: branch.name,
      message:
        'Free Day Pass & Branch Tour reserved. Present your reference code at reception.',
    };
  }

  private async dispatchStaffLeadNotification(params: {
    branchId: string;
    branchName: string;
    branchCode: string;
    referenceCode: string;
    dto: FreePassLeadDto;
  }): Promise<void> {
    if (!this.notifications || typeof this.prisma.user?.findFirst !== 'function') {
      return;
    }

    try {
      const queryStaff = (client: PrismaService) =>
        client.user.findFirst({
          where: {
            homeBranchId: params.branchId,
            status: UserStatus.ACTIVE,
            role: {
              in: [
                UserRole.FRONT_DESK,
                UserRole.BRANCH_MANAGER,
                UserRole.SUPER_ADMIN,
              ],
            },
          },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });

      const staffUser =
        typeof this.prisma.$transaction === 'function'
          ? await withSystemRls(this.prisma, (tx) =>
              queryStaff(tx as PrismaService),
            )
          : await queryStaff(this.prisma);

      if (!staffUser?.id) {
        return;
      }

      const goalSegment = params.dto.goal ? ` | Goal: ${params.dto.goal}` : '';
      await this.notifications.sendNotification({
        userId: staffUser.id,
        triggerType: 'FREE_PASS_LEAD',
        subject: `Free Pass Lead ${params.referenceCode} (${params.branchCode})`,
        payload: `${params.dto.fullName} (${params.dto.phone}) reserved a Free Day Pass & Tour at ${params.branchName} [${params.dto.preferredVisitWindow}]${goalSegment}. Ref: ${params.referenceCode}`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.DEV_INBOX],
      });
    } catch (error) {
      this.logger.warn(
        `Best-effort free-pass lead notification failed: ${(error as Error).message}`,
      );
    }
  }
}
