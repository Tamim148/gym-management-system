import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  BUSINESS_RULES,
  CardStatus,
  EntryStatus,
  MemberQuickProfile,
  OnboardMemberDto,
  PaymentStatus,
  RequestAuthContext,
  UpdateOwnProfileDto,
  UserRole,
  UserStatus,
} from '@vintage/shared';
import * as bcrypt from 'bcryptjs';
import { CryptoService } from '../../common/crypto.service';
import { withSystemRls } from '../../common/rls-utils';
import { UploadSanitizerService } from '../../common/upload-sanitizer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { withRlsContext } from '../../prisma/rls.helper';
import { AuthService } from '../auth/auth.service';

const SAFE_USER_SELECT = {
  id: true,
  homeBranchId: true,
  role: true,
  status: true,
  fullName: true,
  email: true,
  phone: true,
  profilePhotoUrl: true,
  emergencyContact: true,
  kycDocumentUrl: true,
  parqWaiverSignedAt: true,
  primaryPayerId: true,
  certifications: true,
  specializationsCsv: true,
  commissionRatePct: true,
  loyaltyPoints: true,
  churnRiskScore: true,
  healthScore: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly uploadSanitizer: UploadSanitizerService,
    private readonly authService: AuthService,
  ) {}

  async listUsers(
    actor: RequestAuthContext,
    filters: { role?: string; search?: string; branchId?: string },
  ) {
    const targetBranchId =
      actor.role === UserRole.SUPER_ADMIN
        ? filters.branchId || undefined
        : actor.branchId;

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      filters.branchId &&
      filters.branchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch user listing forbidden');
    }

    const search = filters.search?.trim();

    return withRlsContext(this.prisma, actor, (tx) =>
      tx.user.findMany({
        where: {
          ...(targetBranchId ? { homeBranchId: targetBranchId } : {}),
          ...(filters.role ? { role: filters.role } : {}),
          ...(search
            ? {
                OR: [
                  { fullName: { contains: search, mode: 'insensitive' } },
                  { phone: { contains: search } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: {
          ...SAFE_USER_SELECT,
          homeBranch: { select: { name: true, code: true } },
          accessCards: {
            where: { status: CardStatus.ACTIVE },
            select: { cardUid: true },
            take: 1,
          },
          subscriptions: {
            orderBy: { endDate: 'desc' },
            take: 1,
            select: {
              id: true,
              paymentStatus: true,
              endDate: true,
              dueAmountBdt: true,
              plan: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  async getUserById(actor: RequestAuthContext, id: string) {
    const user = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id },
        select: {
          ...SAFE_USER_SELECT,
          homeBranch: { select: { name: true, code: true } },
          familySubAccounts: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              status: true,
            },
          },
        },
      }),
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.assertCanViewUser(actor, user);
    return user;
  }

  async getQuickProfile(
    actor: RequestAuthContext,
    id: string,
  ): Promise<MemberQuickProfile> {
    const user = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          homeBranchId: true,
          primaryPayerId: true,
          profilePhotoUrl: true,
          loyaltyPoints: true,
          accessCards: {
            where: { status: CardStatus.ACTIVE },
            select: { cardUid: true },
            orderBy: { issuedAt: 'desc' },
            take: 1,
          },
          subscriptions: {
            orderBy: { endDate: 'desc' },
            take: 1,
            include: { plan: true },
          },
          attendanceLogs: {
            orderBy: { scannedAt: 'desc' },
            take: 10,
            select: {
              id: true,
              branchId: true,
              entryStatus: true,
              scannedAt: true,
              overrideReason: true,
            },
          },
        },
      }),
    );

    if (!user) {
      throw new NotFoundException('Member not found');
    }

    this.assertCanViewUser(actor, user);

    const latestSub = user.subscriptions[0] ?? null;

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      homeBranchId: user.homeBranchId,
      profilePhotoUrl: user.profilePhotoUrl,
      loyaltyPoints: user.loyaltyPoints,
      activeCardUid: user.accessCards[0]?.cardUid ?? null,
      subscription: latestSub
        ? {
            id: latestSub.id,
            planName: latestSub.plan.name,
            paymentStatus: latestSub.paymentStatus as PaymentStatus,
            endDate: latestSub.endDate.toISOString(),
            totalAmountBdt: latestSub.totalAmountBdt,
            paidAmountBdt: latestSub.paidAmountBdt,
            dueAmountBdt: latestSub.dueAmountBdt,
            remainingCredits: latestSub.remainingCredits,
            roamingEnabled: latestSub.plan.roamingEnabled,
          }
        : null,
      recentAttendance: user.attendanceLogs.map((log) => ({
        id: log.id,
        branchId: log.branchId,
        entryStatus: log.entryStatus as EntryStatus,
        scannedAt: log.scannedAt.toISOString(),
        overrideReason: log.overrideReason,
      })),
    };
  }

  async updateOwnProfile(actor: RequestAuthContext, dto: UpdateOwnProfileDto) {
    return withRlsContext(this.prisma, actor, (tx) =>
      tx.user.update({
        where: { id: actor.userId },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
          ...(dto.emergencyContact !== undefined
            ? { emergencyContact: dto.emergencyContact.trim() }
            : {}),
          ...(dto.telegramChatId !== undefined
            ? { telegramChatId: dto.telegramChatId.trim() }
            : {}),
        },
        select: SAFE_USER_SELECT,
      }),
    );
  }

  async onboardMember(actor: RequestAuthContext, dto: OnboardMemberDto) {
    const targetBranchId = dto.homeBranchId ?? actor.branchId;
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      targetBranchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cannot onboard member into another branch');
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: targetBranchId },
    });
    if (!branch) {
      throw new BadRequestException('Invalid homeBranchId');
    }

    const normalizedPhone = this.cryptoService.normalizePhone(dto.phone);
    const normalizedEmail = dto.email
      ? this.cryptoService.normalizeEmail(dto.email)
      : null;

    if (dto.primaryPayerId) {
      const payer = await withSystemRls(this.prisma, (tx) =>
        tx.user.findUnique({
          where: { id: dto.primaryPayerId },
          include: { familySubAccounts: { select: { id: true } } },
        }),
      );
      if (!payer) {
        throw new BadRequestException('Primary payer user not found');
      }
      if (
        payer.familySubAccounts.length >= BUSINESS_RULES.MAX_FAMILY_DEPENDENTS
      ) {
        throw new ConflictException(
          `Maximum ${BUSINESS_RULES.MAX_FAMILY_DEPENDENTS} family dependents allowed per primary payer`,
        );
      }
    }

    const rawPassword =
      dto.password || crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const encryptedParq = dto.parqData
      ? this.cryptoService.encryptAes256Gcm(JSON.stringify(dto.parqData))
      : null;

    return withSystemRls(this.prisma, async (tx) => {
      const existing = await tx.user.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone },
            ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
          ],
        },
      });
      if (existing) {
        throw new ConflictException(
          'A member with this phone or email already exists',
        );
      }

      if (dto.cardUid) {
        const cardConflict = await tx.accessCard.findUnique({
          where: { cardUid: dto.cardUid.trim() },
        });
        if (cardConflict) {
          throw new ConflictException('RFID card UID is already registered');
        }
      }

      const created = await tx.user.create({
        data: {
          homeBranchId: targetBranchId,
          role: UserRole.MEMBER,
          status: UserStatus.ACTIVE,
          fullName: dto.fullName.trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          emergencyContact: dto.emergencyContact?.trim() || null,
          primaryPayerId: dto.primaryPayerId ?? null,
          parqDataJson: encryptedParq,
          parqWaiverSignedAt: dto.parqData ? new Date() : null,
        },
        select: SAFE_USER_SELECT,
      });

      let cardUid: string | null = null;
      if (dto.cardUid) {
        const card = await tx.accessCard.create({
          data: {
            cardUid: dto.cardUid.trim(),
            userId: created.id,
            status: CardStatus.ACTIVE,
          },
        });
        cardUid = card.cardUid;
      }

      return {
        ...created,
        activeCardUid: cardUid,
      };
    });
  }

  async uploadKyc(
    actor: RequestAuthContext,
    userId: string,
    fileBuffer: Buffer,
  ) {
    const target = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: { id: true, homeBranchId: true, kycDocumentUrl: true },
      }),
    );

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (
      actor.role === UserRole.MEMBER &&
      actor.userId !== target.id
    ) {
      throw new ForbiddenException('Cannot upload KYC for another member');
    }

    if (
      (actor.role === UserRole.BRANCH_MANAGER ||
        actor.role === UserRole.FRONT_DESK) &&
      actor.branchId !== target.homeBranchId
    ) {
      throw new ForbiddenException('Cross-branch KYC upload forbidden');
    }

    const sanitized = await this.uploadSanitizer.sanitizeAndSave(fileBuffer, {
      category: 'kyc',
      branchId: target.homeBranchId,
    });

    if (target.kycDocumentUrl) {
      await this.uploadSanitizer.deleteIfExists(target.kycDocumentUrl);
    }

    await withSystemRls(this.prisma, (tx) =>
      tx.user.update({
        where: { id: target.id },
        data: { kycDocumentUrl: sanitized.relativePath },
      }),
    );

    return {
      userId: target.id,
      kycDocumentUrl: sanitized.relativePath,
      sizeBytes: sanitized.sizeBytes,
      mimeType: sanitized.mimeType,
    };
  }

  async viewKyc(actor: RequestAuthContext, userId: string): Promise<Buffer> {
    const target = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: { id: true, homeBranchId: true, kycDocumentUrl: true },
      }),
    );

    if (!target || !target.kycDocumentUrl) {
      throw new NotFoundException('KYC document not found');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      actor.branchId !== target.homeBranchId
    ) {
      throw new ForbiddenException('Cross-branch KYC access forbidden');
    }

    const absPath = this.uploadSanitizer.resolveSafePath(target.kycDocumentUrl);
    const fileBuf = await fs.readFile(absPath).catch(() => null);
    if (!fileBuf) {
      throw new NotFoundException('KYC file missing from storage');
    }

    await withSystemRls(this.prisma, (tx) =>
      tx.auditLog.create({
        data: {
          actorId: actor.userId,
          branchId: target.homeBranchId,
          action: AuditAction.KYC_DOCUMENT_VIEWED,
          entityType: 'User',
          entityId: target.id,
          metadataJson: JSON.stringify({
            viewedByRole: actor.role,
          }),
        },
      }),
    );

    return fileBuf;
  }

  async anonymizeUser(actor: RequestAuthContext, userId: string) {
    const target = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: { id: true, homeBranchId: true, kycDocumentUrl: true },
      }),
    );

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (actor.role === UserRole.MEMBER && actor.userId !== target.id) {
      throw new ForbiddenException('Cannot anonymize another member');
    }
    if (
      actor.role === UserRole.BRANCH_MANAGER &&
      actor.branchId !== target.homeBranchId
    ) {
      throw new ForbiddenException('Cross-branch anonymization forbidden');
    }

    this.authService.revokeAllUserTokens(target.id);
    await this.uploadSanitizer.deleteIfExists(target.kycDocumentUrl);

    await withSystemRls(this.prisma, async (tx) => {
      await tx.accessCard.updateMany({
        where: { userId: target.id, status: CardStatus.ACTIVE },
        data: { status: CardStatus.REVOKED, revokedAt: new Date() },
      });

      await tx.user.update({
        where: { id: target.id },
        data: {
          fullName: 'Deleted Member',
          email: null,
          phone: `deleted_${target.id}`,
          status: UserStatus.INACTIVE,
          parqDataJson: null,
          profilePhotoUrl: null,
          telegramChatId: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          webPushSubJson: null,
        },
      });
    });

    return { anonymized: true, userId: target.id };
  }

  private assertCanViewUser(
    actor: RequestAuthContext,
    target: { id: string; homeBranchId: string; primaryPayerId: string | null },
  ): void {
    if (actor.role === UserRole.SUPER_ADMIN) {
      return;
    }
    if (
      actor.role === UserRole.BRANCH_MANAGER ||
      actor.role === UserRole.FRONT_DESK ||
      actor.role === UserRole.TRAINER
    ) {
      if (target.homeBranchId !== actor.branchId) {
        throw new ForbiddenException('Cross-branch profile access forbidden');
      }
      return;
    }
    if (
      target.id === actor.userId ||
      target.primaryPayerId === actor.userId
    ) {
      return;
    }
    throw new ForbiddenException('Cannot access another member profile');
  }
}
