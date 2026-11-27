import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestAuthContext, UserRole } from '@vintage/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async listBranches() {
    return this.prisma.branch.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        timezone: true,
        maxOccupancy: true,
        currentOccupancy: true,
        edgeNodeOnline: true,
        lastEdgeHeartbeat: true,
      },
    });
  }

  async setEdgeStatus(
    branchId: string,
    edgeNodeOnline: boolean,
    actor: RequestAuthContext,
  ) {
    if (actor.role !== UserRole.SUPER_ADMIN && actor.branchId !== branchId) {
      throw new ForbiddenException('Cross-branch edge control forbidden');
    }

    const existing = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!existing) {
      throw new NotFoundException('Branch not found');
    }

    return this.prisma.branch.update({
      where: { id: branchId },
      data: {
        edgeNodeOnline,
        lastEdgeHeartbeat: new Date(),
      },
      select: {
        id: true,
        name: true,
        code: true,
        edgeNodeOnline: true,
        lastEdgeHeartbeat: true,
      },
    });
  }
}
