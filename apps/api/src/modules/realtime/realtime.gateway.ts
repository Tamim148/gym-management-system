import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { SOCKET_EVENTS, UserRole, UserStatus } from '@vintage/shared';
import * as jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { withSystemRls } from '../../common/rls-utils';
import { PrismaService } from '../../prisma/prisma.service';

interface AccessJwtPayload {
  sub: string;
  role: UserRole;
  branchId: string;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const secret =
        process.env.JWT_ACCESS_SECRET?.trim() ||
        'vintage-aesthetics-dev-access-secret-256bit';
      const decoded = jwt.verify(token, secret) as AccessJwtPayload;

      const user = await withSystemRls(this.prisma, (tx) =>
        tx.user.findUnique({
          where: { id: decoded.sub },
          select: { id: true, role: true, homeBranchId: true, status: true },
        }),
      );

      if (
        !user ||
        user.status === UserStatus.SUSPENDED ||
        user.status === UserStatus.INACTIVE
      ) {
        client.disconnect(true);
        return;
      }

      client.data.user = {
        userId: user.id,
        role: user.role as UserRole,
        branchId: user.homeBranchId,
      };

      // Server-derived room assignment (never trust client-supplied room names)
      await client.join(`user:${user.id}:notifications`);

      if (user.role === UserRole.SUPER_ADMIN) {
        await client.join('branch:all:desk');
      } else if (
        user.role === UserRole.BRANCH_MANAGER ||
        user.role === UserRole.FRONT_DESK
      ) {
        await client.join(`branch:${user.homeBranchId}:desk`);
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  emitAccessEvent(branchId: string, payload: unknown): void {
    if (!this.server) return;
    this.server
      .to(`branch:${branchId}:desk`)
      .to('branch:all:desk')
      .emit(SOCKET_EVENTS.ACCESS_EVENT, payload);
  }

  emitOccupancyUpdate(
    branchId: string,
    payload: { branchId: string; currentOccupancy: number; maxOccupancy: number },
  ): void {
    if (!this.server) return;
    this.server
      .to(`branch:${branchId}:desk`)
      .to('branch:all:desk')
      .emit(SOCKET_EVENTS.OCCUPANCY_UPDATE, payload);
  }

  emitNotificationNew(userId: string, payload: unknown): void {
    if (!this.server) return;
    this.server
      .to(`user:${userId}:notifications`)
      .emit(SOCKET_EVENTS.NOTIFICATION_NEW, payload);
  }

  emitTicketNew(branchId: string, payload: unknown): void {
    if (!this.server) return;
    this.server
      .to(`branch:${branchId}:desk`)
      .to('branch:all:desk')
      .emit(SOCKET_EVENTS.TICKET_NEW, payload);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, '').trim();
    }

    const cookieHeader = client.handshake.headers?.cookie;
    if (typeof cookieHeader === 'string' && cookieHeader.length > 0) {
      const pairs = cookieHeader.split(';');
      for (const pair of pairs) {
        const idx = pair.indexOf('=');
        if (idx === -1) continue;
        const key = pair.slice(0, idx).trim();
        if (key === 'va_access_token') {
          return decodeURIComponent(pair.slice(idx + 1).trim());
        }
      }
    }

    return null;
  }
}
