import { NotFoundException } from '@nestjs/common';
import {
  FreePassLeadSchema,
  NotificationChannel,
} from '@vintage/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LeadsService } from './leads.service';

describe('LeadsService & FreePassLeadSchema', () => {
  const validBranchId = '10000000-0000-4000-8000-000000000001';

  it('throws NotFoundException when branchId does not exist', async () => {
    const prismaMock = {
      branch: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    const service = new LeadsService(prismaMock);
    await expect(
      service.reserveFreePass({
        fullName: 'Tanvir Ahmed',
        phone: '+8801712345678',
        branchId: validBranchId,
        preferredVisitWindow: 'OFF_PEAK_1_3PM',
        goal: 'Hypertrophy',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('reserves a free pass and dispatches best-effort staff notification', async () => {
    const prismaMock = {
      branch: {
        findUnique: jest.fn().mockResolvedValue({
          id: validBranchId,
          name: 'Gulshan-1 Flagship',
          code: 'DHK-01',
        }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'staff-1',
        }),
      },
    } as unknown as PrismaService;

    const notificationsMock = {
      sendNotification: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationsService;

    const service = new LeadsService(prismaMock, notificationsMock);
    const response = await service.reserveFreePass({
      fullName: 'Tanvir Ahmed',
      phone: '+8801712345678',
      branchId: validBranchId,
      preferredVisitWindow: 'MORNING',
    });

    expect(response.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(response.referenceCode).toMatch(/^VA-PASS-\d{4}$/);
    expect(response.branchName).toBe('Gulshan-1 Flagship');
    expect(response.message).toBe(
      'Free Day Pass & Branch Tour reserved. Present your reference code at reception.',
    );

    expect(notificationsMock.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'staff-1',
        triggerType: 'FREE_PASS_LEAD',
        channels: [NotificationChannel.IN_APP, NotificationChannel.DEV_INBOX],
      }),
    );
  });

  it('still succeeds if best-effort notification fails', async () => {
    const prismaMock = {
      branch: {
        findUnique: jest.fn().mockResolvedValue({
          id: validBranchId,
          name: 'Gulshan-1 Flagship',
          code: 'DHK-01',
        }),
      },
      user: {
        findFirst: jest.fn().mockRejectedValue(new Error('DB transient error')),
      },
    } as unknown as PrismaService;

    const notificationsMock = {
      sendNotification: jest.fn(),
    } as unknown as NotificationsService;

    const service = new LeadsService(prismaMock, notificationsMock);
    const response = await service.reserveFreePass({
      fullName: 'Nusrat Jahan',
      phone: '+8801812345678',
      branchId: validBranchId,
      preferredVisitWindow: 'EVENING',
    });

    expect(response.referenceCode).toMatch(/^VA-PASS-\d{4}$/);
    expect(notificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it('validates FreePassLeadSchema strictly for Bangladesh mobile numbers', () => {
    const pipe = new ZodValidationPipe(FreePassLeadSchema.strict());

    const parsed = pipe.transform({
      fullName: '  Farhan Sadiq  ',
      phone: '+8801912345678',
      branchId: validBranchId,
      preferredVisitWindow: 'OFF_PEAK_1_3PM',
      goal: 'Strength & conditioning',
    });

    expect(parsed).toEqual({
      fullName: 'Farhan Sadiq',
      phone: '+8801912345678',
      branchId: validBranchId,
      preferredVisitWindow: 'OFF_PEAK_1_3PM',
      goal: 'Strength & conditioning',
    });

    expect(() =>
      pipe.transform({
        fullName: 'Farhan',
        phone: '+8801212345678',
        branchId: validBranchId,
        preferredVisitWindow: 'MORNING',
      }),
    ).toThrow();

    expect(() =>
      pipe.transform({
        fullName: 'Farhan',
        phone: '+8801712345678',
        branchId: validBranchId,
        preferredVisitWindow: 'MORNING',
        extraField: 'not-allowed',
      }),
    ).toThrow();
  });
});
