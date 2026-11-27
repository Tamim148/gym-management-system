import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestAuthContext, UserRole, UserStatus } from '@vintage/shared';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { withSystemRls } from '../../common/rls-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './auth.decorators';

interface JwtPayload {
  sub: string;
  role: UserRole;
  branchId: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      Request & { user?: RequestAuthContext }
    >();

    const isHealthRoute =
      context.getClass().name === 'HealthController' ||
      request.path === '/health' ||
      request.url === '/health';

    const isPublic =
      isHealthRoute ||
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    const token = this.extractToken(request);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required');
    }

    const secret =
      process.env.JWT_ACCESS_SECRET?.trim() ||
      'vintage-aesthetics-dev-access-secret-256bit';

    try {
      const payload = jwt.verify(token, secret) as JwtPayload;
      const user = await withSystemRls(this.prisma, (tx) =>
        tx.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, role: true, homeBranchId: true, status: true },
        }),
      );

      if (
        !user ||
        user.status === UserStatus.SUSPENDED ||
        user.status === UserStatus.INACTIVE
      ) {
        if (isPublic) return true;
        throw new UnauthorizedException('Account is inactive or suspended');
      }

      request.user = {
        userId: user.id,
        role: user.role as UserRole,
        branchId: user.homeBranchId,
      };
      return true;
    } catch (err) {
      if (isPublic) return true;
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractToken(request: Request): string | null {
    const cookieToken = request.cookies?.va_access_token;
    if (typeof cookieToken === 'string' && cookieToken.trim()) {
      return cookieToken.trim();
    }
    const authHeader = request.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    return null;
  }
}
