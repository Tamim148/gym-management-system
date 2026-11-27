import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { InMemoryPrismaMock, SEED_IDS } from './in-memory-prisma.mock';
import { createE2eTestApp, loginAs, withAuth } from './test-app.helper';

describe('Concurrency Booking & Waitlist Promotion (e2e)', () => {
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

  it('handles 10 parallel bookings on maxCapacity=1 session with exactly 1 CONFIRMED & 9 WAITLISTED (1..9), and promotes #1 on cancel', async () => {
    // Clear pre-seeded booking on sessionHiitFull so 10 concurrent users compete for the 1 spot
    await prismaMock.booking.deleteMany({
      where: { sessionId: SEED_IDS.sessionHiitFull },
    });

    // Create 10 active member accounts so all 10 concurrent callers are valid distinct members
    const existingMember = await prismaMock.user.findUnique({
      where: { id: SEED_IDS.userFarhanaVip },
    });
    const passwordHash = String(existingMember?.passwordHash);

    const memberIdentifiers: string[] = ['farhana@demo.com', 'rayhan@demo.com'];
    for (let i = 1; i <= 8; i++) {
      const email = `concurrent.member${i}@demo.com`;
      const created = await prismaMock.user.create({
        data: {
          homeBranchId: SEED_IDS.branchGulshan,
          role: 'MEMBER',
          status: 'ACTIVE',
          fullName: `Concurrent Member ${i}`,
          email,
          phone: `+880179900000${i}`,
          passwordHash,
        },
      });
      await prismaMock.subscription.create({
        data: {
          userId: created.id,
          planId: SEED_IDS.planVipAllAccess,
          startDate: new Date(Date.now() - 86400000),
          endDate: new Date(Date.now() + 30 * 86400000),
          paymentStatus: 'PAID',
          totalAmountBdt: 5500,
          paidAmountBdt: 5500,
          dueAmountBdt: 0,
          remainingCredits: 5,
        },
      });
      memberIdentifiers.push(email);
    }

    const sessions = await Promise.all(
      memberIdentifiers.map((email) => loginAs(app, email)),
    );

    // Fire 10 parallel booking requests simultaneously
    const responses = await Promise.all(
      sessions.map((auth) =>
        withAuth(
          request(app.getHttpServer()).post(
            `/api/scheduling/sessions/${SEED_IDS.sessionHiitFull}/book`,
          ),
          auth,
        ).send({}),
      ),
    );

    for (const res of responses) {
      expect([200, 201]).toContain(res.status);
    }

    const confirmed = responses.filter((r) => r.body.status === 'CONFIRMED');
    const waitlisted = responses.filter((r) => r.body.status === 'WAITLISTED');

    expect(confirmed).toHaveLength(1);
    expect(waitlisted).toHaveLength(9);

    const orders = waitlisted
      .map((r) => Number(r.body.waitlistOrder))
      .sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    // Find which auth session won the confirmed slot and which one is Waitlist #1
    const confirmedIdx = responses.findIndex(
      (r) => r.body.status === 'CONFIRMED',
    );
    const waitlist1Idx = responses.findIndex(
      (r) => r.body.status === 'WAITLISTED' && r.body.waitlistOrder === 1,
    );

    const confirmedBookingId = responses[confirmedIdx].body.bookingId as string;
    const waitlist1BookingId = responses[waitlist1Idx].body.bookingId as string;

    // Cancel the confirmed booking -> Waitlist #1 automatically promoted to CONFIRMED
    await withAuth(
      request(app.getHttpServer()).delete(
        `/api/scheduling/bookings/${confirmedBookingId}`,
      ),
      sessions[confirmedIdx],
    ).expect((res) => {
      expect([200, 204]).toContain(res.status);
    });

    const promoted = await prismaMock.booking.findUnique({
      where: { id: waitlist1BookingId },
    });
    expect(promoted?.status).toBe('CONFIRMED');
  });
});
