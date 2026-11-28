import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BranchCoachSummary,
  RequestAuthContext,
  UserRole,
  UserStatus,
} from '@vintage/shared';
import { withSystemRls } from '../../common/rls-utils';
import { PrismaService } from '../../prisma/prisma.service';

const STAFFED_HOURS = '06:00 AM – 11:00 PM (24/7 Member RFID)';

interface ActiveTrainerRow {
  id: string;
  fullName: string;
  homeBranchId: string;
  specializationsCsv: string | null;
  certifications: string | null;
}

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  private async fetchActiveTrainers(): Promise<ActiveTrainerRow[]> {
    if (typeof this.prisma.user?.findMany !== 'function') {
      return [];
    }

    const query = (client: PrismaService) =>
      client.user.findMany({
        where: {
          role: UserRole.TRAINER,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          fullName: true,
          homeBranchId: true,
          specializationsCsv: true,
          certifications: true,
        },
        orderBy: { fullName: 'asc' },
      });

    const rows =
      typeof this.prisma.$transaction === 'function'
        ? await withSystemRls(this.prisma, (tx) => query(tx as PrismaService))
        : await query(this.prisma);

    return Array.isArray(rows) ? rows : [];
  }

  async listBranches() {
    const [branches, trainers] = await Promise.all([
      this.prisma.branch.findMany({
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
      }),
      this.fetchActiveTrainers(),
    ]);

    const trainersByBranch = new Map<string, ActiveTrainerRow[]>();
    for (const trainer of trainers) {
      const list = trainersByBranch.get(trainer.homeBranchId) ?? [];
      list.push(trainer);
      trainersByBranch.set(trainer.homeBranchId, list);
    }

    return branches.map((branch) => {
      const branchTrainers = trainersByBranch.get(branch.id) ?? [];
      const coaches: BranchCoachSummary[] = branchTrainers.map((trainer) => ({
        id: trainer.id,
        fullName: trainer.fullName,
        specialty:
          trainer.specializationsCsv?.trim() ||
          trainer.certifications?.trim() ||
          'Strength & Conditioning',
        branchCode: branch.code,
      }));

      return {
        ...branch,
        staffedHours: STAFFED_HOURS,
        coaches,
      };
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
