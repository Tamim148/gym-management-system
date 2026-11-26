import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HealthResponse } from '@vintage/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    const start = Date.now();
    const environment = process.env.NODE_ENV || 'development';
    const timestamp = new Date().toISOString();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'vintage-aesthetics-api',
        database: 'connected',
        latencyMs: Date.now() - start,
        environment,
        timestamp,
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'vintage-aesthetics-api',
        database: 'disconnected',
        environment,
        timestamp,
      });
    }
  }
}
