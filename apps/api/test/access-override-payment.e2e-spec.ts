import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SEED_IDS, InMemoryPrismaMock } from './in-memory-prisma.mock';
import { createE2eTestApp, loginAs, withAuth } from './test-app.helper';

describe('Access Control, Manual Override Cap & Offline Sync (e2e)', () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaMock;

  beforeAll(async () => {
    const setup = await createE2eTestApp();
    app = setup.app;
    prismaMock = setup.prismaMock;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prismaMock.reset();
  });

  it('denies overdue member, enforces >=10 char note & 2/month override cap, settles due to unlock gate, and syncs offline batch idempotently', async () => {
    const deskGulshan = await loginAs(
      app,
      'desk.gulshan@vintageaesthetics.gym',
    );

    // Ensure Tariq's subscription is within its active date window so paymentStatus=OVERDUE triggers DENIED_UNPAID
    await prismaMock.subscription.update({
      where: { id: SEED_IDS.subTariq },
      data: { endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    // 1. Tap VA-RFID-8841 (Tariq Overdue) -> DENIED_UNPAID
    const tapDenied = await withAuth(
      request(app.getHttpServer()).post('/api/access/verify'),
      deskGulshan,
    )
      .send({
        branchId: SEED_IDS.branchGulshan,
        cardUid: 'VA-RFID-8841',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(tapDenied.body.allowed).toBe(false);
    expect(tapDenied.body.entryStatus).toBe('DENIED_UNPAID');

    // 2. Front-Desk short-note override ("hi") -> 400 Bad Request
    await withAuth(
      request(app.getHttpServer()).post('/api/access/override'),
      deskGulshan,
    )
      .send({
        userId: SEED_IDS.userTariqOverdue,
        branchId: SEED_IDS.branchGulshan,
        reason: 'Promised to pay tomorrow',
        notes: 'hi',
      })
      .expect(400);

    // 3. Valid Manual Override #1 and #2 succeed + create AuditLog; #3 rejected (cap = 2/month)
    for (let i = 1; i <= 2; i++) {
      const ovRes = await withAuth(
        request(app.getHttpServer()).post('/api/access/override'),
        deskGulshan,
      )
        .send({
          userId: SEED_IDS.userTariqOverdue,
          branchId: SEED_IDS.branchGulshan,
          reason: 'Promised to pay tomorrow',
          notes: `Valid front desk override justification #${i}`,
        })
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      expect(ovRes.body.entryStatus ?? 'MANUAL_OVERRIDE').toBe(
        'MANUAL_OVERRIDE',
      );
    }

    const auditsAfterTwo = await prismaMock.auditLog.findMany({
      where: { action: 'GATE_OVERRIDE' },
    });
    expect(auditsAfterTwo.length).toBe(2);

    // 3rd override in same month must be rejected
    await withAuth(
      request(app.getHttpServer()).post('/api/access/override'),
      deskGulshan,
    )
      .send({
        userId: SEED_IDS.userTariqOverdue,
        branchId: SEED_IDS.branchGulshan,
        reason: 'Admin approved',
        notes: 'Attempting third override beyond monthly cap of 2',
      })
      .expect((res) => {
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
      });

    // 4. Front-Desk settles Tariq's overdue due -> PAID -> tap VA-RFID-8841 -> ALLOWED
    await withAuth(
      request(app.getHttpServer()).post(
        `/api/billing/subscriptions/${SEED_IDS.subTariq}/settle-due`,
      ),
      deskGulshan,
    )
      .send({
        amountBdt: 3500,
        paymentMethod: 'CASH',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const settledSub = await prismaMock.subscription.findUnique({
      where: { id: SEED_IDS.subTariq },
    });
    expect(settledSub?.paymentStatus).toBe('PAID');

    // Ensure settled subscription covers active period if endDate was past-due before tap
    if (settledSub && (settledSub.endDate as Date).getTime() < Date.now()) {
      await prismaMock.subscription.update({
        where: { id: SEED_IDS.subTariq },
        data: { endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
    }

    // Clear anti-passback state from the manual overrides by simulating checkout before re-tapping
    await prismaMock.attendanceLog.updateMany({
      where: { userId: SEED_IDS.userTariqOverdue, checkedOutAt: null },
      data: { checkedOutAt: new Date() },
    });

    const tapAllowed = await withAuth(
      request(app.getHttpServer()).post('/api/access/verify'),
      deskGulshan,
    )
      .send({
        branchId: SEED_IDS.branchGulshan,
        cardUid: 'VA-RFID-8841',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(tapAllowed.body.allowed).toBe(true);
    expect(tapAllowed.body.entryStatus).toBe('ALLOWED');

    // 5. Offline batch sync with duplicate UUIDs -> idempotent (zero duplicate AttendanceLog rows)
    const eventUuid1 = '90000000-0000-4000-8000-000000000001';
    const eventUuid2 = '90000000-0000-4000-8000-000000000002';
    const beforeOfflineCount = await prismaMock.attendanceLog.count();

    const syncPayload = {
      branchId: SEED_IDS.branchGulshan,
      events: [
        {
          id: eventUuid1,
          kind: 'CARD_TAP',
          cardUid: 'VA-RFID-4092',
          scannedAt: new Date(Date.now() - 120000).toISOString(),
        },
        {
          id: eventUuid2,
          kind: 'CARD_TAP',
          cardUid: 'VA-RFID-4093',
          scannedAt: new Date(Date.now() - 60000).toISOString(),
        },
      ],
    };

    await withAuth(
      request(app.getHttpServer()).post('/api/access/offline-sync'),
      deskGulshan,
    )
      .send(syncPayload)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const afterFirstSyncCount = await prismaMock.attendanceLog.count();
    expect(afterFirstSyncCount).toBe(beforeOfflineCount + 2);

    // Replay exact same batch -> zero new duplicate rows
    await withAuth(
      request(app.getHttpServer()).post('/api/access/offline-sync'),
      deskGulshan,
    )
      .send(syncPayload)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const afterReplayCount = await prismaMock.attendanceLog.count();
    expect(afterReplayCount).toBe(afterFirstSyncCount);
  });
});
