import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AiChatRequestSchema,
  AiChatResponse,
  RequestAuthContext,
  UserRole,
} from '@vintage/shared';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { AiService } from './ai.service';

const Public = () => SetMetadata('isPublic', true);

interface RawJwtOrGuardUser {
  userId?: string;
  sub?: string;
  id?: string;
  role?: UserRole;
  branchId?: string;
  homeBranchId?: string;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  private extractAuthContext(req: Request): RequestAuthContext | null {
    const reqUser = (req as Request & { user?: RawJwtOrGuardUser }).user;
    if (reqUser) {
      const userId = reqUser.userId ?? reqUser.sub ?? reqUser.id;
      const branchId = reqUser.branchId ?? reqUser.homeBranchId;
      if (userId && reqUser.role && branchId) {
        return { userId, role: reqUser.role, branchId };
      }
    }

    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    const cookieToken =
      cookies?.va_access_token ??
      cookies?.va_access ??
      cookies?.accessToken ??
      cookies?.access_token;
    const token = bearerToken || cookieToken;
    const secret = process.env.JWT_ACCESS_SECRET;

    if (!token || !secret) {
      return null;
    }

    try {
      const decoded = jwt.verify(token, secret) as RawJwtOrGuardUser;
      const userId = decoded.userId ?? decoded.sub ?? decoded.id;
      const branchId = decoded.branchId ?? decoded.homeBranchId;
      if (userId && decoded.role && branchId) {
        return { userId, role: decoded.role, branchId };
      }
      return null;
    } catch {
      return null;
    }
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<AiChatResponse> {
    const parsed = AiChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid AI chat request payload',
        errors: parsed.error.flatten(),
      });
    }

    const authCtx = this.extractAuthContext(req);
    if (parsed.data.confirmAction && !authCtx) {
      throw new UnauthorizedException(
        'Authentication required to confirm AI write actions',
      );
    }

    return this.aiService.chat(parsed.data, authCtx);
  }
}
