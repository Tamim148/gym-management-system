import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaMock: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns 200 ok payload when database ping succeeds', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    const result = await controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('vintage-aesthetics-api');
    expect(result.database).toBe('connected');
    expect(typeof result.latencyMs).toBe('number');
    expect(typeof result.timestamp).toBe('string');
  });

  it('fails closed with ServiceUnavailableException when database ping fails', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('Neon connection refused'));

    await expect(controller.getHealth()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
