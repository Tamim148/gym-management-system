# 05. Database Seed Data & Test Fixtures
**Project:** Vintage Aesthetics Gym Management System  
**Purpose:** Deterministic, idempotent starter dataset for Local SQLite, Neon `dev`, and Neon `staging`  
**Version:** 2.1

---

## 1. Test Login Credentials Cheat Sheet

All seeded accounts share the local demo password **`Vintage@2026`** (hashed with `bcryptjs` inside `prisma/seed.ts`) so you can instantly log into every role in your browser or mobile PWA:

| Role | Full Name | Email | Phone | Branch | Scenario Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Owner (Admin) | `admin@vintageaesthetics.gym` | `+8801700000001` | All 3 (Home: Gulshan-1) | Multi-branch analytics, Festival Offers, Feature Flags |
| **Front-Desk** | Sadia Rahman | `desk.gulshan@vintageaesthetics.gym` | `+8801700000002` | Gulshan-1 (`DHK-01`) | Live Access Dashboard, Manual Override, Card Replacement |
| **Front-Desk** | Mahmudul Hasan | `desk.dhanmondi@vintageaesthetics.gym` | `+8801700000003` | Dhanmondi (`DHK-02`) | Cross-branch RBAC isolation testing |
| **Trainer** | Coach Arif | `arif.trainer@vintageaesthetics.gym` | `+8801700000004` | Gulshan-1 (`DHK-01`) | Schedule CRUD, Full HIIT Class Roster, $40\%$ commission |
| **Trainer** | Coach Imran | `imran.trainer@vintageaesthetics.gym` | `+8801700000005` | Dhanmondi (`DHK-02`) | Off-Peak Strength Circuit yield-pricing slots |
| **Member (Active VIP)** | Farhana Islam | `farhana@demo.com` | `+8801819887766` | Gulshan-1 (`DHK-01`) | **Active 3-Branch Roaming** + Family Primary Payer (`VA-RFID-4092`) |
| **Member (Family Sub)** | Rayhan Islam | `rayhan@demo.com` | `+8801819887767` | Gulshan-1 (`DHK-01`) | Linked Family Dependent ($15\%$ discount) (`VA-RFID-4093`) |
| **Member (Overdue)** | Tariq Hasan | `tariq@demo.com` | `+8801711234567` | Gulshan-1 (`DHK-01`) | **Unpaid 3,500 BDT** — Triggers `DENIED_UNPAID` Red Alert (`VA-RFID-8841`) |
| **Member (Partial Due)** | Kamrul Islam | `kamrul@demo.com` | `+8801677332211` | Gulshan-1 (`DHK-01`) | Paid 50%, owes 1,750 BDT — Tests split payment settlement (`VA-RFID-5510`) |
| **Member (Frozen)** | Nusrat Jahan | `nusrat@demo.com` | `+8801755990011` | Uttara (`DHK-03`) | Active travel freeze — Tests `DENIED_FROZEN` (`VA-RFID-7721`) |
| **Member (Churn Risk)** | Rafiqul Hasan | `rafiq@demo.com` | `+8801912445566` | Dhanmondi (`DHK-02`) | High `churnRiskScore` ($0.84$) — Appears at top of Admin Churn Radar (`VA-RFID-2104`) |

---

## 2. Package.json Seed Configuration

Add this block to your root or `apps/api/package.json` so `npx prisma db seed` executes automatically:

~~~json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
~~~

---

## 3. Complete Idempotent Seed Script (`prisma/seed.ts`)

Running `npx prisma db seed` multiple times safely updates records via `upsert` with fixed UUIDs and never creates duplicate rows.

~~~typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Deterministic UUIDs for repeatable local & CI testing
const IDS = {
  branchGulshan: '10000000-0000-4000-8000-000000000001',
  branchDhanmondi: '10000000-0000-4000-8000-000000000002',
  branchUttara: '10000000-0000-4000-8000-000000000003',

  planMonthlyStd: '20000000-0000-4000-8000-000000000001',
  planVipAllAccess: '20000000-0000-4000-8000-000000000002',
  planOffPeak: '20000000-0000-4000-8000-000000000003',
  planPtPack10: '20000000-0000-4000-8000-000000000004',

  userAdmin: '30000000-0000-4000-8000-000000000001',
  userDeskGulshan: '30000000-0000-4000-8000-000000000002',
  userDeskDhanmondi: '30000000-0000-4000-8000-000000000003',
  userTrainerArif: '30000000-0000-4000-8000-000000000004',
  userTrainerImran: '30000000-0000-4000-8000-000000000005',
  userFarhanaVip: '30000000-0000-4000-8000-000000000006',
  userRayhanFamily: '30000000-0000-4000-8000-000000000007',
  userTariqOverdue: '30000000-0000-4000-8000-000000000008',
  userKamrulPartial: '30000000-0000-4000-8000-000000000009',
  userNusratFrozen: '30000000-0000-4000-8000-000000000010',
  userRafiqChurn: '30000000-0000-4000-8000-000000000011',

  campaignEid: '40000000-0000-4000-8000-000000000001',
  campaignWinter: '40000000-0000-4000-8000-000000000002',

  sessionHiitFull: '50000000-0000-4000-8000-000000000001',
  sessionOffPeak: '50000000-0000-4000-8000-000000000002',

  equipTreadmill04: '60000000-0000-4000-8000-000000000001',
  equipSquatRack02: '60000000-0000-4000-8000-000000000002',
};

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  console.log('Seeding Vintage Aesthetics Gym database...');
  const passwordHash = await bcrypt.hash('Vintage@2026', 10);

  // 1. Seed 3 Physical Dhaka Branches
  const branches = [
    {
      id: IDS.branchGulshan,
      name: 'Gulshan-1 Flagship',
      code: 'DHK-01',
      address: 'Road 12, Gulshan-1, Dhaka 1212',
      maxOccupancy: 80,
      currentOccupancy: 42,
      edgeNodeOnline: true,
      lastEdgeHeartbeat: new Date(),
    },
    {
      id: IDS.branchDhanmondi,
      name: 'Dhanmondi Iron Club',
      code: 'DHK-02',
      address: 'Satmasjid Road, Dhanmondi 27, Dhaka 1209',
      maxOccupancy: 70,
      currentOccupancy: 28,
      edgeNodeOnline: true,
      lastEdgeHeartbeat: new Date(),
    },
    {
      id: IDS.branchUttara,
      name: 'Uttara Sector-7 Studio',
      code: 'DHK-03',
      address: 'Road 18, Sector 7, Uttara, Dhaka 1230',
      maxOccupancy: 60,
      currentOccupancy: 19,
      edgeNodeOnline: true,
      lastEdgeHeartbeat: new Date(),
    },
  ];

  for (const b of branches) {
    await prisma.branch.upsert({ where: { id: b.id }, update: b, create: b });
  }

  // 2. Seed Membership Plans
  const plans = [
    {
      id: IDS.planMonthlyStd,
      name: 'Monthly Standard (Single Branch)',
      billingCycle: 'MONTHLY',
      priceBdt: 3500,
      durationDays: 30,
      roamingEnabled: false,
      offPeakOnly: false,
    },
    {
      id: IDS.planVipAllAccess,
      name: 'All-Access VIP (All 3 Branches)',
      billingCycle: 'MONTHLY',
      priceBdt: 5500,
      durationDays: 30,
      roamingEnabled: true,
      offPeakOnly: false,
    },
    {
      id: IDS.planOffPeak,
      name: 'Off-Peak Iron Saver (1 PM - 3 PM)',
      billingCycle: 'MONTHLY',
      priceBdt: 2400,
      durationDays: 30,
      roamingEnabled: false,
      offPeakOnly: true,
      offPeakStartHour: 13,
      offPeakEndHour: 15,
    },
    {
      id: IDS.planPtPack10,
      name: '10-Session Personal Training Pack',
      billingCycle: 'SESSION_PACK',
      priceBdt: 12000,
      durationDays: 90,
      sessionCredits: 10,
      roamingEnabled: true,
      offPeakOnly: false,
    },
  ];

  for (const p of plans) {
    await prisma.membershipPlan.upsert({ where: { id: p.id }, update: p, create: p });
  }

  // 3. Seed Staff, Trainers & Edge-Case Members
  const users = [
    {
      id: IDS.userAdmin,
      homeBranchId: IDS.branchGulshan,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      fullName: 'Vintage Aesthetics Owner',
      email: 'admin@vintageaesthetics.gym',
      phone: '+8801700000001',
      passwordHash,
    },
    {
      id: IDS.userDeskGulshan,
      homeBranchId: IDS.branchGulshan,
      role: 'FRONT_DESK',
      status: 'ACTIVE',
      fullName: 'Sadia Rahman',
      email: 'desk.gulshan@vintageaesthetics.gym',
      phone: '+8801700000002',
      passwordHash,
    },
    {
      id: IDS.userDeskDhanmondi,
      homeBranchId: IDS.branchDhanmondi,
      role: 'FRONT_DESK',
      status: 'ACTIVE',
      fullName: 'Mahmudul Hasan',
      email: 'desk.dhanmondi@vintageaesthetics.gym',
      phone: '+8801700000003',
      passwordHash,
    },
    {
      id: IDS.userTrainerArif,
      homeBranchId: IDS.branchGulshan,
      role: 'TRAINER',
      status: 'ACTIVE',
      fullName: 'Coach Arif Hossain',
      email: 'arif.trainer@vintageaesthetics.gym',
      phone: '+8801700000004',
      passwordHash,
      certifications: 'ACE CPT, CrossFit Level 1',
      specializationsCsv: 'HIIT,Hypertrophy,Fat Loss',
      commissionRatePct: 40.0,
    },
    {
      id: IDS.userTrainerImran,
      homeBranchId: IDS.branchDhanmondi,
      role: 'TRAINER',
      status: 'ACTIVE',
      fullName: 'Coach Imran Kabir',
      email: 'imran.trainer@vintageaesthetics.gym',
      phone: '+8801700000005',
      passwordHash,
      certifications: 'NSCA CSCS',
      specializationsCsv: 'Powerlifting,Strength,Mobility',
      commissionRatePct: 40.0,
    },
    {
      id: IDS.userFarhanaVip,
      homeBranchId: IDS.branchGulshan,
      role: 'MEMBER',
      status: 'ACTIVE',
      fullName: 'Farhana Islam',
      email: 'farhana@demo.com',
      phone: '+8801819887766',
      passwordHash,
      parqWaiverSignedAt: daysFromNow(-60),
      loyaltyPoints: 420,
      churnRiskScore: 0.08,
      healthScore: 95.0,
    },
    {
      id: IDS.userRayhanFamily,
      homeBranchId: IDS.branchGulshan,
      role: 'MEMBER',
      status: 'ACTIVE',
      fullName: 'Rayhan Islam',
      email: 'rayhan@demo.com',
      phone: '+8801819887767',
      passwordHash,
      primaryPayerId: IDS.userFarhanaVip,
      parqWaiverSignedAt: daysFromNow(-45),
      loyaltyPoints: 180,
      churnRiskScore: 0.15,
    },
    {
      id: IDS.userTariqOverdue,
      homeBranchId: IDS.branchGulshan,
      role: 'MEMBER',
      status: 'ACTIVE',
      fullName: 'Tariq Hasan',
      email: 'tariq@demo.com',
      phone: '+8801711234567',
      passwordHash,
      parqWaiverSignedAt: daysFromNow(-90),
      churnRiskScore: 0.72,
    },
    {
      id: IDS.userKamrulPartial,
      homeBranchId: IDS.branchGulshan,
      role: 'MEMBER',
      status: 'ACTIVE',
      fullName: 'Kamrul Islam',
      email: 'kamrul@demo.com',
      phone: '+8801677332211',
      passwordHash,
      parqWaiverSignedAt: daysFromNow(-10),
      churnRiskScore: 0.35,
    },
    {
      id: IDS.userNusratFrozen,
      homeBranchId: IDS.branchUttara,
      role: 'MEMBER',
      status: 'FROZEN',
      fullName: 'Nusrat Jahan',
      email: 'nusrat@demo.com',
      phone: '+8801755990011',
      passwordHash,
      parqWaiverSignedAt: daysFromNow(-120),
      churnRiskScore: 0.25,
    },
    {
      id: IDS.userRafiqChurn,
      homeBranchId: IDS.branchDhanmondi,
      role: 'MEMBER',
      status: 'ACTIVE',
      fullName: 'Rafiqul Hasan',
      email: 'rafiq@demo.com',
      phone: '+8801912445566',
      passwordHash,
      parqWaiverSignedAt: daysFromNow(-150),
      churnRiskScore: 0.84, // High churn radar test
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({ where: { id: u.id }, update: u, create: u });
  }

  // 4. Seed RFID Access Cards
  const cards = [
    { cardUid: 'VA-RFID-4092', userId: IDS.userFarhanaVip, status: 'ACTIVE' },
    { cardUid: 'VA-RFID-4093', userId: IDS.userRayhanFamily, status: 'ACTIVE' },
    { cardUid: 'VA-RFID-8841', userId: IDS.userTariqOverdue, status: 'ACTIVE' },
    { cardUid: 'VA-RFID-5510', userId: IDS.userKamrulPartial, status: 'ACTIVE' },
    { cardUid: 'VA-RFID-7721', userId: IDS.userNusratFrozen, status: 'ACTIVE' },
    { cardUid: 'VA-RFID-2104', userId: IDS.userRafiqChurn, status: 'ACTIVE' },
  ];

  for (const c of cards) {
    await prisma.accessCard.upsert({ where: { cardUid: c.cardUid }, update: c, create: c });
  }

  // 5. Seed Member Subscriptions (Active, Overdue, Partial, Frozen)
  const subs = [
    {
      id: '70000000-0000-4000-8000-000000000001',
      userId: IDS.userFarhanaVip,
      planId: IDS.planVipAllAccess,
      startDate: daysFromNow(-12),
      endDate: daysFromNow(18),
      paymentStatus: 'PAID',
      totalAmountBdt: 5500,
      paidAmountBdt: 5500,
      dueAmountBdt: 0,
      remainingCredits: 4,
    },
    {
      id: '70000000-0000-4000-8000-000000000002',
      userId: IDS.userTariqOverdue,
      planId: IDS.planMonthlyStd,
      startDate: daysFromNow(-34),
      endDate: daysFromNow(-4),
      paymentStatus: 'OVERDUE',
      totalAmountBdt: 3500,
      paidAmountBdt: 0,
      dueAmountBdt: 3500,
    },
    {
      id: '70000000-0000-4000-8000-000000000003',
      userId: IDS.userKamrulPartial,
      planId: IDS.planMonthlyStd,
      startDate: daysFromNow(-5),
      endDate: daysFromNow(25),
      paymentStatus: 'PARTIAL',
      totalAmountBdt: 3500,
      paidAmountBdt: 1750,
      dueAmountBdt: 1750,
    },
    {
      id: '70000000-0000-4000-8000-000000000004',
      userId: IDS.userNusratFrozen,
      planId: IDS.planVipAllAccess,
      startDate: daysFromNow(-20),
      endDate: daysFromNow(24),
      paymentStatus: 'FROZEN',
      totalAmountBdt: 5500,
      paidAmountBdt: 5500,
      dueAmountBdt: 0,
      frozenFrom: daysFromNow(-2),
      frozenUntil: daysFromNow(12),
    },
  ];

  for (const s of subs) {
    await prisma.subscription.upsert({ where: { id: s.id }, update: s, create: s });
  }

  // 6. Seed Festival Marketing Campaigns
  await prisma.campaign.upsert({
    where: { promoCode: 'EID20' },
    update: {},
    create: {
      id: IDS.campaignEid,
      name: 'Eid Iron Blast — 20% Off All Plans',
      promoCode: 'EID20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      branchId: null, // Valid across all 3 branches
      startDate: daysFromNow(-5),
      endDate: daysFromNow(30),
      maxRedemptions: 200,
      isActive: true,
    },
  });

  await prisma.campaign.upsert({
    where: { promoCode: 'WINTER500' },
    update: {},
    create: {
      id: IDS.campaignWinter,
      name: 'Gulshan Winter Transformation 500 BDT Off',
      promoCode: 'WINTER500',
      discountType: 'FIXED_BDT',
      discountValue: 500,
      branchId: IDS.branchGulshan,
      startDate: daysFromNow(-2),
      endDate: daysFromNow(45),
      maxRedemptions: 50,
      isActive: true,
    },
  });

  // 7. Seed Trainer Sessions (1 Full Class for Waitlist + 1 Off-Peak Deal)
  const tomorrowEvening = new Date(daysFromNow(1).setHours(18, 0, 0, 0));
  const tomorrowEveningEnd = new Date(daysFromNow(1).setHours(19, 0, 0, 0));
  const tomorrowOffPeak = new Date(daysFromNow(1).setHours(14, 0, 0, 0));
  const tomorrowOffPeakEnd = new Date(daysFromNow(1).setHours(15, 0, 0, 0));

  await prisma.session.upsert({
    where: { id: IDS.sessionHiitFull },
    update: {},
    create: {
      id: IDS.sessionHiitFull,
      trainerId: IDS.userTrainerArif,
      branchId: IDS.branchGulshan,
      title: 'Evening HIIT & Conditioning',
      type: 'GROUP_CLASS',
      zoneName: 'Studio A',
      startTime: tomorrowEvening,
      endTime: tomorrowEveningEnd,
      maxCapacity: 1, // Set to 1 in dev seed so booking tests Waitlist immediately
      isOffPeakDeal: false,
    },
  });

  await prisma.session.upsert({
    where: { id: IDS.sessionOffPeak },
    update: {},
    create: {
      id: IDS.sessionOffPeak,
      trainerId: IDS.userTrainerImran,
      branchId: IDS.branchDhanmondi,
      title: 'Off-Peak Strength Circuit',
      type: 'GROUP_CLASS',
      zoneName: 'Free Weights Zone',
      startTime: tomorrowOffPeak,
      endTime: tomorrowOffPeakEnd,
      maxCapacity: 10,
      isOffPeakDeal: true,
      offPeakPriceBdt: 375,
    },
  });

  // Fill the HIIT session with Farhana so any other member enters Waitlist #1
  await prisma.booking.upsert({
    where: { sessionId_userId: { sessionId: IDS.sessionHiitFull, userId: IDS.userFarhanaVip } },
    update: {},
    create: {
      sessionId: IDS.sessionHiitFull,
      userId: IDS.userFarhanaVip,
      status: 'CONFIRMED',
    },
  });

  // 8. Seed Smart Lockers & QR Equipment Assets
  for (let i = 1; i <= 6; i++) {
    const lockerNum = `G-0${i}`;
    await prisma.smartLocker.upsert({
      where: { branchId_lockerNumber: { branchId: IDS.branchGulshan, lockerNumber: lockerNum } },
      update: {},
      create: {
        branchId: IDS.branchGulshan,
        lockerNumber: lockerNum,
        hardwareRelayId: `RELAY-DHK01-L${i}`,
        assignedUserId: i === 1 ? IDS.userFarhanaVip : null,
        claimedAt: i === 1 ? new Date() : null,
      },
    });
  }

  await prisma.equipmentAsset.upsert({
    where: { qrCodeToken: 'VA-EQ-DHK01-TM04' },
    update: {},
    create: {
      id: IDS.equipTreadmill04,
      branchId: IDS.branchGulshan,
      qrCodeToken: 'VA-EQ-DHK01-TM04',
      name: 'Commercial Treadmill #04',
      zoneName: 'Cardio Deck',
      status: 'OPERATIONAL',
    },
  });

  await prisma.equipmentAsset.upsert({
    where: { qrCodeToken: 'VA-EQ-DHK01-SR02' },
    update: {},
    create: {
      id: IDS.equipSquatRack02,
      branchId: IDS.branchGulshan,
      qrCodeToken: 'VA-EQ-DHK01-SR02',
      name: 'Olympic Power Rack #02',
      zoneName: 'Studio A',
      status: 'OPERATIONAL',
    },
  });

  // 9. Seed Free RAG Knowledge Chunks (Replaces Pinecone)
  const knowledge = [
    {
      id: '80000000-0000-4000-8000-000000000001',
      sourceTitle: 'Vintage Aesthetics Gym — Membership & Freeze Policy',
      content:
        'Monthly Standard costs 3,500 BDT for a single branch. All-Access VIP costs 5,500 BDT and grants roaming access across Gulshan-1, Dhanmondi, and Uttara. Members may freeze their plan for up to 30 days with a 300 BDT fee (free for VIP). Lost RFID card replacement costs 300 BDT at the Front Desk.',
    },
    {
      id: '80000000-0000-4000-8000-000000000002',
      sourceTitle: 'Off-Peak Pricing & Waitlist Rules',
      content:
        'Off-Peak hours run daily from 1:00 PM to 3:00 PM with up to 25% discount on group classes and day passes. If a class is full, members can join the automated waitlist and will be promoted automatically with a free push notification if a seat opens.',
    },
  ];

  for (const k of knowledge) {
    await prisma.knowledgeChunk.upsert({ where: { id: k.id }, update: k, create: k });
  }

  // 10. Seed Enterprise Feature Flags ($0 Replacement for LaunchDarkly)
  const flags = [
    { key: 'ai_concierge', description: 'Floating client-side AI gym assistant', isEnabled: true, rolloutPct: 100 },
    { key: 'festival_campaigns', description: 'Seasonal promo code checkout engine', isEnabled: true, rolloutPct: 100 },
    { key: 'smart_lockers', description: 'Virtual/RFID smart locker claiming', isEnabled: true, rolloutPct: 100 },
    { key: 'off_peak_yield', description: 'Dynamic off-peak discounted class badges', isEnabled: true, rolloutPct: 100 },
    { key: 'churn_radar', description: 'Admin proactive churn prediction panel', isEnabled: true, rolloutPct: 100 },
  ];

  for (const f of flags) {
    await prisma.featureFlag.upsert({ where: { key: f.key }, update: f, create: f });
  }

  console.log('Seed complete: 3 branches, 4 plans, 11 users, RFID cards, campaigns, sessions, lockers, equipment, RAG docs, and feature flags ready.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
~~~