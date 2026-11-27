import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuditAction,
  AuthSessionResponse,
  AuthUserProfile,
  LoginDto,
  NotificationChannel,
  NotificationTriggerType,
  RegisterDto,
  UserRole,
  UserStatus,
  VerifyOtpDto,
} from '@vintage/shared';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { CryptoService } from '../../common/crypto.service';
import { withSystemRls } from '../../common/rls-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface RefreshTokenRecord {
  tokenHash: string;
  userId: string;
  tokenFamilyId: string;
  used: boolean;
  revokedAt: Date | null;
  expiresAt: Date;
  isSharedTablet: boolean;
}

interface OtpRecord {
  codeHash: string;
  userId: string;
  expiresAt: Date;
  attempts: number;
}

interface BruteForceRecord {
  count: number;
  windowStart: number;
  lockedUntil?: number;
}

export interface IssuedAuthCookies {
  accessToken: string;
  refreshToken: string;
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
}

const DUMMY_BCRYPT_HASH =
  '$2a$10$CwTycUXWue0Thq9StjUM0uJ8uW7qV.dK6sM7Y9fZ7iQ2x5rM5y3eK';

@Injectable()
export class AuthService {
  private readonly refreshTokenStore = new Map<string, RefreshTokenRecord>();
  private readonly otpStore = new Map<string, OtpRecord>();
  private readonly failedAttempts = new Map<string, BruteForceRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private getAccessSecret(): string {
    const secret = process.env.JWT_ACCESS_SECRET?.trim();
    if (process.env.NODE_ENV === 'production' && !secret) {
      throw new Error('JWT_ACCESS_SECRET must be set in production');
    }
    return secret || 'vintage-aesthetics-dev-access-secret-256bit';
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private normalizeIdentifier(identifier: string): string {
    return identifier.includes('@')
      ? this.cryptoService.normalizeEmail(identifier)
      : this.cryptoService.normalizePhone(identifier);
  }

  async login(
    dto: LoginDto,
    clientIp: string,
  ): Promise<{ session: AuthSessionResponse; cookies: IssuedAuthCookies }> {
    const normalizedId = this.normalizeIdentifier(dto.identifier);
    const attemptKey = `${clientIp}:${normalizedId}`;
    this.assertNotRateLocked(attemptKey);

    const user = await withSystemRls(this.prisma, (tx) =>
      tx.user.findFirst({
        where: {
          OR: [{ email: normalizedId }, { phone: normalizedId }],
        },
        include: {
          homeBranch: { select: { name: true, code: true } },
        },
      }),
    );

    // Always run bcrypt.compare even if user is missing (uniform timing defense)
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user ? user.passwordHash : DUMMY_BCRYPT_HASH,
    );

    if (!user || !passwordMatches) {
      await this.recordFailedLogin(attemptKey, normalizedId, user?.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.INACTIVE
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.failedAttempts.delete(attemptKey);
    const cookies = this.issueTokensForUser(
      user.id,
      user.role as UserRole,
      user.homeBranchId,
      dto.isSharedTablet ?? false,
    );

    return {
      session: {
        user: this.toAuthUserProfile(user),
        accessToken: cookies.accessToken,
      },
      cookies,
    };
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ session: AuthSessionResponse; cookies: IssuedAuthCookies }> {
    const normalizedPhone = this.cryptoService.normalizePhone(dto.phone);
    const normalizedEmail = dto.email
      ? this.cryptoService.normalizeEmail(dto.email)
      : null;

    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.homeBranchId },
      select: { id: true, name: true, code: true },
    });
    if (!branch) {
      throw new BadRequestException('Selected home branch does not exist');
    }

    const existing = await withSystemRls(this.prisma, (tx) =>
      tx.user.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone },
            ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
          ],
        },
      }),
    );

    if (existing) {
      throw new ConflictException(
        'An account with this phone or email already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const encryptedParq = dto.parqData
      ? this.cryptoService.encryptAes256Gcm(JSON.stringify(dto.parqData))
      : null;

    const user = await withSystemRls(this.prisma, (tx) =>
      tx.user.create({
        data: {
          homeBranchId: dto.homeBranchId,
          role: UserRole.MEMBER,
          status: UserStatus.ACTIVE,
          fullName: dto.fullName.trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          emergencyContact: dto.emergencyContact?.trim() || null,
          parqDataJson: encryptedParq,
          parqWaiverSignedAt: dto.parqData ? new Date() : null,
        },
        include: {
          homeBranch: { select: { name: true, code: true } },
        },
      }),
    );

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpRecord: OtpRecord = {
      codeHash: this.hashToken(otpCode),
      userId: user.id,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
    };
    this.otpStore.set(normalizedPhone, otpRecord);
    if (normalizedEmail) {
      this.otpStore.set(normalizedEmail, otpRecord);
    }

    await this.notificationsService.sendNotification({
      userId: user.id,
      channels: [NotificationChannel.DEV_INBOX, NotificationChannel.IN_APP],
      triggerType: NotificationTriggerType.OTP,
      subject: 'Your Vintage Aesthetics Verification OTP',
      payload: `Welcome ${user.fullName}! Your 6-digit verification code is ${otpCode} (valid for 5 minutes).`,
    });

    const cookies = this.issueTokensForUser(
      user.id,
      user.role as UserRole,
      user.homeBranchId,
      false,
    );

    return {
      session: {
        user: this.toAuthUserProfile(user),
        accessToken: cookies.accessToken,
        ...(process.env.NODE_ENV !== 'production'
          ? { devOtpPreview: otpCode }
          : {}),
      },
      cookies,
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ verified: boolean }> {
    const key = this.normalizeIdentifier(dto.identifier);
    const record = this.otpStore.get(key);
    if (!record) {
      throw new BadRequestException('OTP not found or expired');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      this.otpStore.delete(key);
      throw new BadRequestException('OTP has expired');
    }
    if (record.attempts >= 3) {
      this.otpStore.delete(key);
      throw new BadRequestException('Maximum OTP attempts exceeded');
    }

    record.attempts += 1;
    const providedHash = this.hashToken(dto.code.trim());
    const match = crypto.timingSafeEqual(
      Buffer.from(providedHash, 'hex'),
      Buffer.from(record.codeHash, 'hex'),
    );

    if (!match) {
      if (record.attempts >= 3) {
        this.otpStore.delete(key);
      }
      throw new BadRequestException('Invalid OTP code');
    }

    this.otpStore.delete(key);
    return { verified: true };
  }

  async refresh(
    rawRefreshToken: string | undefined,
  ): Promise<{ session: AuthSessionResponse; cookies: IssuedAuthCookies }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const record = this.refreshTokenStore.get(tokenHash);

    if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Reuse detection: revoke entire token family and record AuditLog
    if (record.used) {
      await this.revokeTokenFamily(record.tokenFamilyId, record.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    record.used = true;

    const user = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id: record.userId },
        include: { homeBranch: { select: { name: true, code: true } } },
      }),
    );

    if (
      !user ||
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.INACTIVE
    ) {
      await this.revokeTokenFamily(record.tokenFamilyId, record.userId);
      throw new UnauthorizedException('User account is inactive');
    }

    const cookies = this.issueTokensForUser(
      user.id,
      user.role as UserRole,
      user.homeBranchId,
      record.isSharedTablet,
      record.tokenFamilyId,
    );

    return {
      session: {
        user: this.toAuthUserProfile(user),
        accessToken: cookies.accessToken,
      },
      cookies,
    };
  }

  logout(rawRefreshToken?: string, userId?: string): void {
    if (rawRefreshToken) {
      const record = this.refreshTokenStore.get(this.hashToken(rawRefreshToken));
      if (record) {
        this.revokeTokenFamilySync(record.tokenFamilyId);
      }
    }
    if (userId) {
      this.revokeAllUserTokens(userId);
    }
  }

  revokeAllUserTokens(userId: string): void {
    const now = new Date();
    for (const rec of this.refreshTokenStore.values()) {
      if (rec.userId === userId && !rec.revokedAt) {
        rec.revokedAt = now;
      }
    }
  }

  async getMe(userId: string): Promise<AuthUserProfile> {
    const user = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id: userId },
        include: { homeBranch: { select: { name: true, code: true } } },
      }),
    );
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.toAuthUserProfile(user);
  }

  private issueTokensForUser(
    userId: string,
    role: UserRole,
    branchId: string,
    isSharedTablet: boolean,
    existingFamilyId?: string,
  ): IssuedAuthCookies {
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    const accessTtlSeconds = isSuperAdmin ? 10 * 60 : 15 * 60;
    const accessMaxAgeMs = accessTtlSeconds * 1000;

    const refreshMaxAgeMs = isSharedTablet
      ? 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;

    const accessToken = jwt.sign(
      {
        sub: userId,
        role,
        branchId,
        jti: crypto.randomUUID(),
      },
      this.getAccessSecret(),
      { expiresIn: accessTtlSeconds },
    );

    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawRefresh);
    const tokenFamilyId = existingFamilyId || crypto.randomUUID();

    this.refreshTokenStore.set(tokenHash, {
      tokenHash,
      userId,
      tokenFamilyId,
      used: false,
      revokedAt: null,
      expiresAt: new Date(Date.now() + refreshMaxAgeMs),
      isSharedTablet,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      accessMaxAgeMs,
      refreshMaxAgeMs,
    };
  }

  private revokeTokenFamilySync(tokenFamilyId: string): void {
    const now = new Date();
    for (const rec of this.refreshTokenStore.values()) {
      if (rec.tokenFamilyId === tokenFamilyId) {
        rec.revokedAt = now;
      }
    }
  }

  private async revokeTokenFamily(
    tokenFamilyId: string,
    userId: string,
  ): Promise<void> {
    this.revokeTokenFamilySync(tokenFamilyId);
    await withSystemRls(this.prisma, (tx) =>
      tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          entityType: 'AuthTokenFamily',
          entityId: tokenFamilyId,
          metadataJson: JSON.stringify({ reason: 'Refresh token replay detected' }),
        },
      }),
    );
  }

  private assertNotRateLocked(attemptKey: string): void {
    const rec = this.failedAttempts.get(attemptKey);
    if (!rec) return;

    const now = Date.now();
    if (rec.lockedUntil && rec.lockedUntil > now) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          errorCode: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many failed login attempts. Try again in 15 minutes.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (now - rec.windowStart > 15 * 60 * 1000) {
      this.failedAttempts.delete(attemptKey);
    }
  }

  private async recordFailedLogin(
    attemptKey: string,
    identifier: string,
    userId?: string,
  ): Promise<void> {
    const now = Date.now();
    const existing = this.failedAttempts.get(attemptKey);
    const rec: BruteForceRecord =
      existing && now - existing.windowStart <= 15 * 60 * 1000
        ? existing
        : { count: 0, windowStart: now };

    rec.count += 1;
    if (rec.count >= 5) {
      rec.lockedUntil = now + 15 * 60 * 1000;
      await withSystemRls(this.prisma, (tx) =>
        tx.auditLog.create({
          data: {
            actorId: userId ?? 'anonymous',
            action: AuditAction.LOGIN_BRUTE_FORCE_SUSPECTED,
            entityType: 'User',
            entityId: userId ?? identifier,
            metadataJson: JSON.stringify({
              identifier,
              failedAttempts: rec.count,
            }),
          },
        }),
      );
    }
    this.failedAttempts.set(attemptKey, rec);
  }

  private toAuthUserProfile(user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string;
    role: string;
    status: string;
    homeBranchId: string;
    loyaltyPoints: number;
    churnRiskScore: number;
    healthScore: number;
    primaryPayerId: string | null;
    homeBranch?: { name: string; code: string } | null;
  }): AuthUserProfile {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      homeBranchId: user.homeBranchId,
      branchName: user.homeBranch?.name,
      branchCode: user.homeBranch?.code,
      loyaltyPoints: user.loyaltyPoints,
      churnRiskScore: user.churnRiskScore,
      healthScore: user.healthScore,
      primaryPayerId: user.primaryPayerId,
    };
  }
}
