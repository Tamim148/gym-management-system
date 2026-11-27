import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export const SEED_IDS = {
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

  subFarhana: '70000000-0000-4000-8000-000000000001',
  subTariq: '70000000-0000-4000-8000-000000000002',
  subKamrul: '70000000-0000-4000-8000-000000000003',
  subNusrat: '70000000-0000-4000-8000-000000000004',
} as const;

type Row = Record<string, unknown>;

type TableName =
  | 'branch'
  | 'user'
  | 'accessCard'
  | 'attendanceLog'
  | 'membershipPlan'
  | 'subscription'
  | 'campaign'
  | 'transaction'
  | 'session'
  | 'booking'
  | 'smartLocker'
  | 'equipmentAsset'
  | 'equipmentTicket'
  | 'notificationLog'
  | 'knowledgeChunk'
  | 'aIInteractionLog'
  | 'auditLog'
  | 'featureFlag';

const PASSWORD_HASH_CACHE = bcrypt.hashSync('Vintage@2026', 8);

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

function cloneValue<T>(val: T): T {
  if (val instanceof Date) return new Date(val.getTime()) as unknown as T;
  if (Array.isArray(val)) return val.map(cloneValue) as unknown as T;
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = cloneValue(v);
    }
    return out as T;
  }
  return val;
}

export class InMemoryPrismaMock {
  private tables: Record<TableName, Row[]> = this.createInitialData();
  private txChain: Promise<unknown> = Promise.resolve();

  private createInitialData(): Record<TableName, Row[]> {
    const now = new Date();
    const tomorrowEvening = new Date(daysFromNow(1).setHours(18, 0, 0, 0));
    const tomorrowEveningEnd = new Date(daysFromNow(1).setHours(19, 0, 0, 0));
    const tomorrowOffPeak = new Date(daysFromNow(1).setHours(14, 0, 0, 0));
    const tomorrowOffPeakEnd = new Date(daysFromNow(1).setHours(15, 0, 0, 0));

    return {
      branch: [
        {
          id: SEED_IDS.branchGulshan,
          name: 'Gulshan-1 Flagship',
          code: 'DHK-01',
          address: 'Road 12, Gulshan-1, Dhaka 1212',
          timezone: 'Asia/Dhaka',
          maxOccupancy: 80,
          currentOccupancy: 42,
          edgeNodeOnline: true,
          lastEdgeHeartbeat: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.branchDhanmondi,
          name: 'Dhanmondi Iron Club',
          code: 'DHK-02',
          address: 'Satmasjid Road, Dhanmondi 27, Dhaka 1209',
          timezone: 'Asia/Dhaka',
          maxOccupancy: 70,
          currentOccupancy: 28,
          edgeNodeOnline: true,
          lastEdgeHeartbeat: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.branchUttara,
          name: 'Uttara Sector-7 Studio',
          code: 'DHK-03',
          address: 'Road 18, Sector 7, Uttara, Dhaka 1230',
          timezone: 'Asia/Dhaka',
          maxOccupancy: 60,
          currentOccupancy: 19,
          edgeNodeOnline: true,
          lastEdgeHeartbeat: now,
          createdAt: now,
          updatedAt: now,
        },
      ],
      membershipPlan: [
        {
          id: SEED_IDS.planMonthlyStd,
          name: 'Monthly Standard (Single Branch)',
          billingCycle: 'MONTHLY',
          priceBdt: 3500,
          durationDays: 30,
          sessionCredits: null,
          roamingEnabled: false,
          offPeakOnly: false,
          offPeakStartHour: null,
          offPeakEndHour: null,
          isActive: true,
          createdAt: now,
        },
        {
          id: SEED_IDS.planVipAllAccess,
          name: 'All-Access VIP (All 3 Branches)',
          billingCycle: 'MONTHLY',
          priceBdt: 5500,
          durationDays: 30,
          sessionCredits: null,
          roamingEnabled: true,
          offPeakOnly: false,
          offPeakStartHour: null,
          offPeakEndHour: null,
          isActive: true,
          createdAt: now,
        },
        {
          id: SEED_IDS.planOffPeak,
          name: 'Off-Peak Iron Saver (1 PM - 3 PM)',
          billingCycle: 'MONTHLY',
          priceBdt: 2400,
          durationDays: 30,
          sessionCredits: null,
          roamingEnabled: false,
          offPeakOnly: true,
          offPeakStartHour: 13,
          offPeakEndHour: 15,
          isActive: true,
          createdAt: now,
        },
        {
          id: SEED_IDS.planPtPack10,
          name: '10-Session Personal Training Pack',
          billingCycle: 'SESSION_PACK',
          priceBdt: 12000,
          durationDays: 90,
          sessionCredits: 10,
          roamingEnabled: true,
          offPeakOnly: false,
          offPeakStartHour: null,
          offPeakEndHour: null,
          isActive: true,
          createdAt: now,
        },
      ],
      user: [
        {
          id: SEED_IDS.userAdmin,
          homeBranchId: SEED_IDS.branchGulshan,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
          fullName: 'Vintage Aesthetics Owner',
          email: 'admin@vintageaesthetics.gym',
          phone: '+8801700000001',
          passwordHash: PASSWORD_HASH_CACHE,
          telegramChatId: null,
          webPushSubJson: null,
          profilePhotoUrl: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          parqWaiverSignedAt: null,
          parqDataJson: null,
          primaryPayerId: null,
          certifications: null,
          specializationsCsv: null,
          commissionRatePct: null,
          loyaltyPoints: 0,
          churnRiskScore: 0,
          healthScore: 100,
          syncVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.userDeskGulshan,
          homeBranchId: SEED_IDS.branchGulshan,
          role: 'FRONT_DESK',
          status: 'ACTIVE',
          fullName: 'Sadia Rahman',
          email: 'desk.gulshan@vintageaesthetics.gym',
          phone: '+8801700000002',
          passwordHash: PASSWORD_HASH_CACHE,
          telegramChatId: null,
          webPushSubJson: null,
          profilePhotoUrl: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          parqWaiverSignedAt: null,
          parqDataJson: null,
          primaryPayerId: null,
          certifications: null,
          specializationsCsv: null,
          commissionRatePct: null,
          loyaltyPoints: 0,
          churnRiskScore: 0,
          healthScore: 100,
          syncVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.userDeskDhanmondi,
          homeBranchId: SEED_IDS.branchDhanmondi,
          role: 'FRONT_DESK',
          status: 'ACTIVE',
          fullName: 'Mahmudul Hasan',
          email: 'desk.dhanmondi@vintageaesthetics.gym',
          phone: '+8801700000003',
          passwordHash: PASSWORD_HASH_CACHE,
          telegramChatId: null,
          webPushSubJson: null,
          profilePhotoUrl: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          parqWaiverSignedAt: null,
          parqDataJson: null,
          primaryPayerId: null,
          certifications: null,
          specializationsCsv: null,
          commissionRatePct: null,
          loyaltyPoints: 0,
          churnRiskScore: 0,
          healthScore: 100,
          syncVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.userTrainerArif,
          homeBranchId: SEED_IDS.branchGulshan,
          role: 'TRAINER',
          status: 'ACTIVE',
          fullName: 'Coach Arif Hossain',
          email: 'arif.trainer@vintageaesthetics.gym',
          phone: '+8801700000004',
          passwordHash: PASSWORD_HASH_CACHE,
          telegramChatId: null,
          webPushSubJson: null,
          profilePhotoUrl: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          parqWaiverSignedAt: null,
          parqDataJson: null,
          primaryPayerId: null,
          certifications: 'ACE CPT, CrossFit Level 1',
          specializationsCsv: 'HIIT,Hypertrophy,Fat Loss',
          commissionRatePct: 40,
          loyaltyPoints: 0,
          churnRiskScore: 0,
          healthScore: 100,
          syncVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.userTrainerImran,
          homeBranchId: SEED_IDS.branchDhanmondi,
          role: 'TRAINER',
          status: 'ACTIVE',
          fullName: 'Coach Imran Kabir',
          email: 'imran.trainer@vintageaesthetics.gym',
          phone: '+8801700000005',
          passwordHash: PASSWORD_HASH_CACHE,
          telegramChatId: null,
          webPushSubJson: null,
          profilePhotoUrl: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          parqWaiverSignedAt: null,
          parqDataJson: null,
          primaryPayerId: null,
          certifications: 'NSCA CSCS',
          specializationsCsv: 'Powerlifting,Strength,Mobility',
          commissionRatePct: 40,
          loyaltyPoints: 0,
          churnRiskScore: 0,
          healthScore: 100,
          syncVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.userFarhanaVip,
          homeBranchId: SEED_IDS.branchGulshan,
          role: 'MEMBER',
          status: 'ACTIVE',
          fullName: 'Farhana Islam',
          email: 'farhana@demo.com',
          phone: '+8801819887766',
          passwordHash: PASSWORD_HASH_CACHE,
          telegramChatId: null,
          webPushSubJson: null,
          profilePhotoUrl: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          parqWaiverSignedAt: daysFromNow(-60),
          parqDataJson: null,
          primaryPayerId: null,
          certifications: null,
          specializationsCsv: null,
          commissionRatePct: null,
          loyaltyPoints: 420,
          churnRiskScore: 0.08,
          healthScore: 95,
          syncVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.userRayhanFamily,
          homeBranchId: SEED_IDS.branchGulshan,
          role: 'MEMBER',
          status: 'ACTIVE',
          fullName: 'Rayhan Islam',
          email: 'rayhan@demo.com',
          phone: '+8801819887767',
          passwordHash: PASSWORD_HASH_CACHE,
          telegramChatId: null,
          webPushSubJson: null,
          profilePhotoUrl: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          parqWaiverSignedAt: daysFromNow(-45),
          parqDataJson: null,
          primaryPayerId: SEED_IDS.userFarhanaVip,
          certifications: null,
          specializationsCsv: null,
          commissionRatePct: null,
          loyaltyPoints: 180,
          churnRiskScore: 0.15,
          healthScore: 100,
          syncVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.userTariqOverdue,
          homeBranchId: SEED_IDS.branchGulshan,
          role: 'MEMBER',
          status: 'ACTIVE',
          fullName: 'Tariq Hasan',
          email: 'tariq@demo.com',
          phone: '+8801711234567',
          passwordHash: PASSWORD_HASH_CACHE,
          telegramChatId: null,
          webPushSubJson: null,
          profilePhotoUrl: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          parqWaiverSignedAt: daysFromNow(-90),
          parqDataJson: null,
          primaryPayerId: null,
          certifications: null,
          specializationsCsv: null,
          commissionRatePct: null,
          loyaltyPoints: 0,
          churnRiskScore: 0.72,
          healthScore: 100,
          syncVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.userKamrulPartial,
          homeBranchId: SEED_IDS.branchGulshan,
          role: 'MEMBER',
          status: 'ACTIVE',
          fullName: 'Kamrul Islam',
          email: 'kamrul@demo.com',
          phone: '+8801677332211',
          passwordHash: PASSWORD_HASH_CACHE,
          telegramChatId: null,
          webPushSubJson: null,
          profilePhotoUrl: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          parqWaiverSignedAt: daysFromNow(-10),
          parqDataJson: null,
          primaryPayerId: null,
          certifications: null,
          specializationsCsv: null,
          commissionRatePct: null,
          loyaltyPoints: 0,
          churnRiskScore: 0.35,
          healthScore: 100,
          syncVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.userNusratFrozen,
          homeBranchId: SEED_IDS.branchUttara,
          role: 'MEMBER',
          status: 'FROZEN',
          fullName: 'Nusrat Jahan',
          email: 'nusrat@demo.com',
          phone: '+8801755990011',
          passwordHash: PASSWORD_HASH_CACHE,
          telegramChatId: null,
          webPushSubJson: null,
          profilePhotoUrl: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          parqWaiverSignedAt: daysFromNow(-120),
          parqDataJson: null,
          primaryPayerId: null,
          certifications: null,
          specializationsCsv: null,
          commissionRatePct: null,
          loyaltyPoints: 0,
          churnRiskScore: 0.25,
          healthScore: 100,
          syncVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.userRafiqChurn,
          homeBranchId: SEED_IDS.branchDhanmondi,
          role: 'MEMBER',
          status: 'ACTIVE',
          fullName: 'Rafiqul Hasan',
          email: 'rafiq@demo.com',
          phone: '+8801912445566',
          passwordHash: PASSWORD_HASH_CACHE,
          telegramChatId: null,
          webPushSubJson: null,
          profilePhotoUrl: null,
          emergencyContact: null,
          kycDocumentUrl: null,
          parqWaiverSignedAt: daysFromNow(-150),
          parqDataJson: null,
          primaryPayerId: null,
          certifications: null,
          specializationsCsv: null,
          commissionRatePct: null,
          loyaltyPoints: 0,
          churnRiskScore: 0.84,
          healthScore: 100,
          syncVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
      ],
      accessCard: [
        {
          id: 'c0000000-0000-4000-8000-000000000001',
          cardUid: 'VA-RFID-4092',
          userId: SEED_IDS.userFarhanaVip,
          status: 'ACTIVE',
          issuedAt: now,
          revokedAt: null,
          replacementFeePaid: false,
          replacementInvoiceId: null,
          syncVersion: 1,
          updatedAt: now,
        },
        {
          id: 'c0000000-0000-4000-8000-000000000002',
          cardUid: 'VA-RFID-4093',
          userId: SEED_IDS.userRayhanFamily,
          status: 'ACTIVE',
          issuedAt: now,
          revokedAt: null,
          replacementFeePaid: false,
          replacementInvoiceId: null,
          syncVersion: 1,
          updatedAt: now,
        },
        {
          id: 'c0000000-0000-4000-8000-000000000003',
          cardUid: 'VA-RFID-8841',
          userId: SEED_IDS.userTariqOverdue,
          status: 'ACTIVE',
          issuedAt: now,
          revokedAt: null,
          replacementFeePaid: false,
          replacementInvoiceId: null,
          syncVersion: 1,
          updatedAt: now,
        },
        {
          id: 'c0000000-0000-4000-8000-000000000004',
          cardUid: 'VA-RFID-5510',
          userId: SEED_IDS.userKamrulPartial,
          status: 'ACTIVE',
          issuedAt: now,
          revokedAt: null,
          replacementFeePaid: false,
          replacementInvoiceId: null,
          syncVersion: 1,
          updatedAt: now,
        },
        {
          id: 'c0000000-0000-4000-8000-000000000005',
          cardUid: 'VA-RFID-7721',
          userId: SEED_IDS.userNusratFrozen,
          status: 'ACTIVE',
          issuedAt: now,
          revokedAt: null,
          replacementFeePaid: false,
          replacementInvoiceId: null,
          syncVersion: 1,
          updatedAt: now,
        },
        {
          id: 'c0000000-0000-4000-8000-000000000006',
          cardUid: 'VA-RFID-2104',
          userId: SEED_IDS.userRafiqChurn,
          status: 'ACTIVE',
          issuedAt: now,
          revokedAt: null,
          replacementFeePaid: false,
          replacementInvoiceId: null,
          syncVersion: 1,
          updatedAt: now,
        },
      ],
      subscription: [
        {
          id: SEED_IDS.subFarhana,
          userId: SEED_IDS.userFarhanaVip,
          planId: SEED_IDS.planVipAllAccess,
          startDate: daysFromNow(-12),
          endDate: daysFromNow(18),
          nextBillingDate: null,
          paymentStatus: 'PAID',
          totalAmountBdt: 5500,
          paidAmountBdt: 5500,
          dueAmountBdt: 0,
          remainingCredits: 4,
          frozenFrom: null,
          frozenUntil: null,
          syncVersion: 1,
          updatedAt: now,
        },
        {
          id: SEED_IDS.subTariq,
          userId: SEED_IDS.userTariqOverdue,
          planId: SEED_IDS.planMonthlyStd,
          startDate: daysFromNow(-34),
          endDate: daysFromNow(-4),
          nextBillingDate: null,
          paymentStatus: 'OVERDUE',
          totalAmountBdt: 3500,
          paidAmountBdt: 0,
          dueAmountBdt: 3500,
          remainingCredits: 0,
          frozenFrom: null,
          frozenUntil: null,
          syncVersion: 1,
          updatedAt: now,
        },
        {
          id: SEED_IDS.subKamrul,
          userId: SEED_IDS.userKamrulPartial,
          planId: SEED_IDS.planMonthlyStd,
          startDate: daysFromNow(-5),
          endDate: daysFromNow(25),
          nextBillingDate: null,
          paymentStatus: 'PARTIAL',
          totalAmountBdt: 3500,
          paidAmountBdt: 1750,
          dueAmountBdt: 1750,
          remainingCredits: 0,
          frozenFrom: null,
          frozenUntil: null,
          syncVersion: 1,
          updatedAt: now,
        },
        {
          id: SEED_IDS.subNusrat,
          userId: SEED_IDS.userNusratFrozen,
          planId: SEED_IDS.planVipAllAccess,
          startDate: daysFromNow(-20),
          endDate: daysFromNow(24),
          nextBillingDate: null,
          paymentStatus: 'FROZEN',
          totalAmountBdt: 5500,
          paidAmountBdt: 5500,
          dueAmountBdt: 0,
          remainingCredits: 0,
          frozenFrom: daysFromNow(-2),
          frozenUntil: daysFromNow(12),
          syncVersion: 1,
          updatedAt: now,
        },
      ],
      campaign: [
        {
          id: SEED_IDS.campaignEid,
          name: 'Eid Iron Blast — 20% Off All Plans',
          promoCode: 'EID20',
          discountType: 'PERCENTAGE',
          discountValue: 20,
          branchId: null,
          startDate: daysFromNow(-5),
          endDate: daysFromNow(30),
          maxRedemptions: 200,
          redemptionCount: 0,
          isActive: true,
          createdAt: now,
        },
        {
          id: SEED_IDS.campaignWinter,
          name: 'Gulshan Winter Transformation 500 BDT Off',
          promoCode: 'WINTER500',
          discountType: 'FIXED_BDT',
          discountValue: 500,
          branchId: SEED_IDS.branchGulshan,
          startDate: daysFromNow(-2),
          endDate: daysFromNow(45),
          maxRedemptions: 50,
          redemptionCount: 0,
          isActive: true,
          createdAt: now,
        },
      ],
      transaction: [],
      attendanceLog: [],
      session: [
        {
          id: SEED_IDS.sessionHiitFull,
          trainerId: SEED_IDS.userTrainerArif,
          branchId: SEED_IDS.branchGulshan,
          title: 'Evening HIIT & Conditioning',
          type: 'GROUP_CLASS',
          zoneName: 'Studio A',
          startTime: tomorrowEvening,
          endTime: tomorrowEveningEnd,
          maxCapacity: 1,
          isOffPeakDeal: false,
          offPeakPriceBdt: null,
          isCancelled: false,
          cancelReason: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: SEED_IDS.sessionOffPeak,
          trainerId: SEED_IDS.userTrainerImran,
          branchId: SEED_IDS.branchDhanmondi,
          title: 'Off-Peak Strength Circuit',
          type: 'GROUP_CLASS',
          zoneName: 'Free Weights Zone',
          startTime: tomorrowOffPeak,
          endTime: tomorrowOffPeakEnd,
          maxCapacity: 10,
          isOffPeakDeal: true,
          offPeakPriceBdt: 375,
          isCancelled: false,
          cancelReason: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      booking: [
        {
          id: 'b0000000-0000-4000-8000-000000000001',
          sessionId: SEED_IDS.sessionHiitFull,
          userId: SEED_IDS.userFarhanaVip,
          status: 'CONFIRMED',
          waitlistOrder: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      smartLocker: Array.from({ length: 6 }, (_, idx) => ({
        id: `d0000000-0000-4000-8000-00000000000${idx + 1}`,
        branchId: SEED_IDS.branchGulshan,
        lockerNumber: `G-0${idx + 1}`,
        hardwareRelayId: `RELAY-DHK01-L${idx + 1}`,
        assignedUserId: idx === 0 ? SEED_IDS.userFarhanaVip : null,
        claimedAt: idx === 0 ? now : null,
      })),
      equipmentAsset: [
        {
          id: SEED_IDS.equipTreadmill04,
          branchId: SEED_IDS.branchGulshan,
          qrCodeToken: 'VA-EQ-DHK01-TM04',
          name: 'Commercial Treadmill #04',
          zoneName: 'Cardio Deck',
          status: 'OPERATIONAL',
        },
        {
          id: SEED_IDS.equipSquatRack02,
          branchId: SEED_IDS.branchGulshan,
          qrCodeToken: 'VA-EQ-DHK01-SR02',
          name: 'Olympic Power Rack #02',
          zoneName: 'Studio A',
          status: 'OPERATIONAL',
        },
      ],
      equipmentTicket: [],
      notificationLog: [],
      knowledgeChunk: [
        {
          id: '80000000-0000-4000-8000-000000000001',
          sourceTitle: 'Vintage Aesthetics Gym — Membership & Freeze Policy',
          content:
            'Monthly Standard costs 3,500 BDT for a single branch. All-Access VIP costs 5,500 BDT and grants roaming access across Gulshan-1, Dhanmondi, and Uttara. Members may freeze their plan for up to 30 days with a 300 BDT fee (free for VIP). Lost RFID card replacement costs 300 BDT at the Front Desk.',
          embeddingJson: null,
          updatedAt: now,
        },
        {
          id: '80000000-0000-4000-8000-000000000002',
          sourceTitle: 'Off-Peak Pricing & Waitlist Rules',
          content:
            'Off-Peak hours run daily from 1:00 PM to 3:00 PM with up to 25% discount on group classes and day passes. If a class is full, members can join the automated waitlist and will be promoted automatically with a free push notification if a seat opens.',
          embeddingJson: null,
          updatedAt: now,
        },
      ],
      aIInteractionLog: [],
      auditLog: [],
      featureFlag: [
        {
          id: 'f0000000-0000-4000-8000-000000000001',
          key: 'ai_concierge',
          description: 'Floating client-side AI gym assistant',
          isEnabled: true,
          branchId: null,
          rolloutPct: 100,
          updatedAt: now,
        },
        {
          id: 'f0000000-0000-4000-8000-000000000002',
          key: 'festival_campaigns',
          description: 'Seasonal promo code checkout engine',
          isEnabled: true,
          branchId: null,
          rolloutPct: 100,
          updatedAt: now,
        },
        {
          id: 'f0000000-0000-4000-8000-000000000003',
          key: 'smart_lockers',
          description: 'Virtual/RFID smart locker claiming',
          isEnabled: true,
          branchId: null,
          rolloutPct: 100,
          updatedAt: now,
        },
        {
          id: 'f0000000-0000-4000-8000-000000000004',
          key: 'off_peak_yield',
          description: 'Dynamic off-peak discounted class badges',
          isEnabled: true,
          branchId: null,
          rolloutPct: 100,
          updatedAt: now,
        },
        {
          id: 'f0000000-0000-4000-8000-000000000005',
          key: 'churn_radar',
          description: 'Admin proactive churn prediction panel',
          isEnabled: true,
          branchId: null,
          rolloutPct: 100,
          updatedAt: now,
        },
      ],
    };
  }

  reset(): void {
    this.tables = this.createInitialData();
  }

  getSnapshot(): Record<TableName, number> {
    return {
      branch: this.tables.branch.length,
      user: this.tables.user.length,
      accessCard: this.tables.accessCard.length,
      attendanceLog: this.tables.attendanceLog.length,
      membershipPlan: this.tables.membershipPlan.length,
      subscription: this.tables.subscription.length,
      campaign: this.tables.campaign.length,
      transaction: this.tables.transaction.length,
      session: this.tables.session.length,
      booking: this.tables.booking.length,
      smartLocker: this.tables.smartLocker.length,
      equipmentAsset: this.tables.equipmentAsset.length,
      equipmentTicket: this.tables.equipmentTicket.length,
      notificationLog: this.tables.notificationLog.length,
      knowledgeChunk: this.tables.knowledgeChunk.length,
      aIInteractionLog: this.tables.aIInteractionLog.length,
      auditLog: this.tables.auditLog.length,
      featureFlag: this.tables.featureFlag.length,
    };
  }

  async onModuleInit(): Promise<void> {}
  async onModuleDestroy(): Promise<void> {}
  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}

  async $queryRaw(): Promise<unknown[]> {
    return [{ '?column?': 1 }];
  }

  async $executeRaw(): Promise<number> {
    return 0;
  }

  async $transaction<T>(
    arg: ((tx: this) => Promise<T>) | Array<Promise<unknown>>,
  ): Promise<T> {
    if (Array.isArray(arg)) {
      return Promise.all(arg) as unknown as T;
    }

    const run = async (): Promise<T> => {
      const backup = cloneValue(this.tables);
      try {
        return await arg(this);
      } catch (err) {
        this.tables = backup;
        throw err;
      }
    };

    const next = this.txChain.then(run, run);
    this.txChain = next.catch(() => undefined);
    return next;
  }

  private matchesWhere(table: TableName, row: Row, where?: Row): boolean {
    if (!where) return true;

    for (const [key, condition] of Object.entries(where)) {
      if (condition === undefined) continue;

      if (key === 'AND') {
        const list = Array.isArray(condition) ? condition : [condition];
        if (!list.every((sub) => this.matchesWhere(table, row, sub as Row))) {
          return false;
        }
        continue;
      }
      if (key === 'OR') {
        const list = Array.isArray(condition) ? condition : [condition];
        if (!list.some((sub) => this.matchesWhere(table, row, sub as Row))) {
          return false;
        }
        continue;
      }
      if (key === 'NOT') {
        const list = Array.isArray(condition) ? condition : [condition];
        if (list.some((sub) => this.matchesWhere(table, row, sub as Row))) {
          return false;
        }
        continue;
      }

      // Composite unique keys
      if (key === 'sessionId_userId' && condition && typeof condition === 'object') {
        const c = condition as Row;
        if (row.sessionId !== c.sessionId || row.userId !== c.userId) return false;
        continue;
      }
      if (
        key === 'branchId_lockerNumber' &&
        condition &&
        typeof condition === 'object'
      ) {
        const c = condition as Row;
        if (row.branchId !== c.branchId || row.lockerNumber !== c.lockerNumber)
          return false;
        continue;
      }

      // Relation filtering
      if (!(key in row) && condition && typeof condition === 'object') {
        const relMatch = this.matchRelationFilter(table, row, key, condition as Row);
        if (relMatch !== null) {
          if (!relMatch) return false;
          continue;
        }
      }

      const value = row[key];
      if (!this.matchesScalarCondition(value, condition)) {
        return false;
      }
    }

    return true;
  }

  private matchRelationFilter(
    table: TableName,
    row: Row,
    relKey: string,
    cond: Row,
  ): boolean | null {
    if (relKey === 'user' && typeof row.userId === 'string') {
      const target = this.tables.user.find((u) => u.id === row.userId);
      return target ? this.matchesWhere('user', target, cond) : false;
    }
    if (relKey === 'homeBranch' && typeof row.homeBranchId === 'string') {
      const target = this.tables.branch.find((b) => b.id === row.homeBranchId);
      return target ? this.matchesWhere('branch', target, cond) : false;
    }
    if (relKey === 'branch' && typeof row.branchId === 'string') {
      const target = this.tables.branch.find((b) => b.id === row.branchId);
      return target ? this.matchesWhere('branch', target, cond) : false;
    }
    if (relKey === 'plan' && typeof row.planId === 'string') {
      const target = this.tables.membershipPlan.find((p) => p.id === row.planId);
      return target ? this.matchesWhere('membershipPlan', target, cond) : false;
    }
    if (relKey === 'session' && typeof row.sessionId === 'string') {
      const target = this.tables.session.find((s) => s.id === row.sessionId);
      return target ? this.matchesWhere('session', target, cond) : false;
    }
    if (relKey === 'trainer' && typeof row.trainerId === 'string') {
      const target = this.tables.user.find((u) => u.id === row.trainerId);
      return target ? this.matchesWhere('user', target, cond) : false;
    }
    if (relKey === 'equipment' && typeof row.equipmentId === 'string') {
      const target = this.tables.equipmentAsset.find(
        (e) => e.id === row.equipmentId,
      );
      return target ? this.matchesWhere('equipmentAsset', target, cond) : false;
    }
    if (table === 'user' && relKey === 'subscriptions') {
      const subs = this.tables.subscription.filter((s) => s.userId === row.id);
      if ('some' in cond) {
        return subs.some((s) =>
          this.matchesWhere('subscription', s, cond.some as Row),
        );
      }
      if ('every' in cond) {
        return subs.every((s) =>
          this.matchesWhere('subscription', s, cond.every as Row),
        );
      }
      if ('none' in cond) {
        return !subs.some((s) =>
          this.matchesWhere('subscription', s, cond.none as Row),
        );
      }
    }
    return null;
  }

  private matchesScalarCondition(value: unknown, condition: unknown): boolean {
    if (condition === null) {
      return value === null || value === undefined;
    }
    if (
      typeof condition !== 'object' ||
      condition instanceof Date
    ) {
      if (value instanceof Date && condition instanceof Date) {
        return value.getTime() === condition.getTime();
      }
      return value === condition;
    }

    const op = condition as Row;
    const isOpObj =
      'equals' in op ||
      'not' in op ||
      'in' in op ||
      'notIn' in op ||
      'lt' in op ||
      'lte' in op ||
      'gt' in op ||
      'gte' in op ||
      'contains' in op ||
      'startsWith' in op ||
      'endsWith' in op;

    if (!isOpObj) {
      return value === condition;
    }

    const toComparable = (v: unknown) =>
      v instanceof Date ? v.getTime() : (v as number | string);

    if ('equals' in op && !this.matchesScalarCondition(value, op.equals)) {
      return false;
    }
    if ('not' in op && this.matchesScalarCondition(value, op.not)) {
      return false;
    }
    if ('in' in op && Array.isArray(op.in)) {
      if (!op.in.includes(value)) return false;
    }
    if ('notIn' in op && Array.isArray(op.notIn)) {
      if (op.notIn.includes(value)) return false;
    }
    if ('lt' in op && op.lt !== undefined) {
      if (value == null || toComparable(value) >= toComparable(op.lt))
        return false;
    }
    if ('lte' in op && op.lte !== undefined) {
      if (value == null || toComparable(value) > toComparable(op.lte))
        return false;
    }
    if ('gt' in op && op.gt !== undefined) {
      if (value == null || toComparable(value) <= toComparable(op.gt))
        return false;
    }
    if ('gte' in op && op.gte !== undefined) {
      if (value == null || toComparable(value) < toComparable(op.gte))
        return false;
    }
    if ('contains' in op && typeof op.contains === 'string') {
      if (typeof value !== 'string') return false;
      const insensitive = op.mode === 'insensitive';
      const hay = insensitive ? value.toLowerCase() : value;
      const needle = insensitive ? op.contains.toLowerCase() : op.contains;
      if (!hay.includes(needle)) return false;
    }
    if ('startsWith' in op && typeof op.startsWith === 'string') {
      if (typeof value !== 'string') return false;
      if (!value.startsWith(op.startsWith)) return false;
    }
    if ('endsWith' in op && typeof op.endsWith === 'string') {
      if (typeof value !== 'string') return false;
      if (!value.endsWith(op.endsWith)) return false;
    }

    return true;
  }

  private applySelectAndInclude(
    table: TableName,
    row: Row,
    args?: { include?: Row; select?: Row },
  ): Row {
    const base = cloneValue(row);

    if (args?.include) {
      for (const [rel, relCfg] of Object.entries(args.include)) {
        if (!relCfg) continue;
        const subArgs =
          typeof relCfg === 'object' ? (relCfg as Row) : undefined;
        base[rel] = this.resolveRelation(table, row, rel, subArgs);
      }
    }

    if (args?.select) {
      const selected: Row = {};
      for (const [field, selCfg] of Object.entries(args.select)) {
        if (!selCfg) continue;
        if (field in base) {
          selected[field] = base[field];
        } else {
          selected[field] = this.resolveRelation(
            table,
            row,
            field,
            typeof selCfg === 'object' ? (selCfg as Row) : undefined,
          );
        }
      }
      return selected;
    }

    return base;
  }

  private resolveRelation(
    table: TableName,
    row: Row,
    rel: string,
    subArgs?: Row,
  ): unknown {
    const findOne = (targetTable: TableName, idVal: unknown) => {
      if (typeof idVal !== 'string') return null;
      const found = this.tables[targetTable].find((r) => r.id === idVal);
      return found
        ? this.applySelectAndInclude(
            targetTable,
            found,
            subArgs as { include?: Row; select?: Row },
          )
        : null;
    };

    const findMany = (
      targetTable: TableName,
      fk: string,
      parentVal: unknown,
    ) => {
      let rows = this.tables[targetTable].filter((r) => r[fk] === parentVal);
      if (subArgs?.where) {
        rows = rows.filter((r) =>
          this.matchesWhere(targetTable, r, subArgs.where as Row),
        );
      }
      if (subArgs?.orderBy) {
        rows = this.sortRows(rows, subArgs.orderBy);
      }
      if (typeof subArgs?.take === 'number') {
        rows = rows.slice(0, subArgs.take);
      }
      return rows.map((r) =>
        this.applySelectAndInclude(
          targetTable,
          r,
          subArgs as { include?: Row; select?: Row },
        ),
      );
    };

    if (rel === 'homeBranch') return findOne('branch', row.homeBranchId);
    if (rel === 'branch') return findOne('branch', row.branchId);
    if (rel === 'user') return findOne('user', row.userId);
    if (rel === 'trainer') return findOne('user', row.trainerId);
    if (rel === 'overrideBy') return findOne('user', row.overrideById);
    if (rel === 'reportedBy') return findOne('user', row.reportedById);
    if (rel === 'assignedUser') return findOne('user', row.assignedUserId);
    if (rel === 'primaryPayer') return findOne('user', row.primaryPayerId);
    if (rel === 'plan') return findOne('membershipPlan', row.planId);
    if (rel === 'campaign') return findOne('campaign', row.campaignId);
    if (rel === 'session') return findOne('session', row.sessionId);
    if (rel === 'equipment') {
      if (table === 'branch') return findMany('equipmentAsset', 'branchId', row.id);
      return findOne('equipmentAsset', row.equipmentId);
    }

    if (rel === 'subscriptions')
      return findMany('subscription', 'userId', row.id);
    if (rel === 'accessCards') return findMany('accessCard', 'userId', row.id);
    if (rel === 'transactions') return findMany('transaction', 'userId', row.id);
    if (rel === 'familySubAccounts')
      return findMany('user', 'primaryPayerId', row.id);
    if (rel === 'bookings') {
      return findMany(
        'booking',
        table === 'session' ? 'sessionId' : 'userId',
        row.id,
      );
    }
    if (rel === 'tickets') {
      return findMany('equipmentTicket', 'equipmentId', row.id);
    }
    if (rel === 'attendanceLogs') {
      return findMany(
        'attendanceLog',
        table === 'branch' ? 'branchId' : 'userId',
        row.id,
      );
    }
    if (rel === 'lockers') return findMany('smartLocker', 'branchId', row.id);
    if (rel === 'sessions') return findMany('session', 'branchId', row.id);
    if (rel === '_count') {
      return {
        bookings:
          table === 'session'
            ? this.tables.booking.filter((b) => b.sessionId === row.id).length
            : 0,
      };
    }

    return null;
  }

  private sortRows(rows: Row[], orderBy: unknown): Row[] {
    if (!orderBy) return rows;
    const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...rows].sort((a, b) => {
      for (const spec of specs) {
        if (!spec || typeof spec !== 'object') continue;
        for (const [field, dir] of Object.entries(spec as Row)) {
          const av = a[field];
          const bv = b[field];
          const cmpA = av instanceof Date ? av.getTime() : (av as string | number);
          const cmpB = bv instanceof Date ? bv.getTime() : (bv as string | number);
          if (cmpA === cmpB) continue;
          if (cmpA == null) return 1;
          if (cmpB == null) return -1;
          const res = cmpA < cmpB ? -1 : 1;
          return dir === 'desc' ? -res : res;
        }
      }
      return 0;
    });
  }

  private applyUpdateData(row: Row, data: Row): Row {
    const next = { ...row };
    for (const [key, val] of Object.entries(data)) {
      if (val === undefined) continue;
      if (val && typeof val === 'object' && !(val instanceof Date)) {
        const op = val as Row;
        if ('increment' in op && typeof op.increment === 'number') {
          next[key] = (Number(next[key]) || 0) + op.increment;
          continue;
        }
        if ('decrement' in op && typeof op.decrement === 'number') {
          next[key] = (Number(next[key]) || 0) - op.decrement;
          continue;
        }
        if ('set' in op) {
          next[key] = op.set;
          continue;
        }
        if ('connect' in op && op.connect && typeof op.connect === 'object') {
          const conn = op.connect as Row;
          if (typeof conn.id === 'string') {
            next[`${key}Id`] = conn.id;
          }
          continue;
        }
      }
      next[key] = val;
    }
    if ('updatedAt' in next) {
      next.updatedAt = new Date();
    }
    return next;
  }

  private normalizeCreateRow(table: TableName, data: Row): Row {
    const now = new Date();
    const row: Row = {
      id: typeof data.id === 'string' ? data.id : randomUUID(),
    };

    for (const [key, val] of Object.entries(data)) {
      if (val === undefined) continue;
      if (
        val &&
        typeof val === 'object' &&
        !(val instanceof Date) &&
        'connect' in (val as Row)
      ) {
        const conn = (val as Row).connect as Row;
        if (typeof conn?.id === 'string') {
          row[`${key}Id`] = conn.id;
        }
        continue;
      }
      row[key] = val;
    }

    if (table === 'attendanceLog') {
      row.scannedAt = row.scannedAt ?? now;
      row.checkedOutAt = row.checkedOutAt ?? null;
      row.cardUidScanned = row.cardUidScanned ?? null;
      row.overrideById = row.overrideById ?? null;
      row.overrideReason = row.overrideReason ?? null;
      row.overrideNotes = row.overrideNotes ?? null;
      row.syncedFromEdge = row.syncedFromEdge ?? false;
    }
    if (table === 'booking') {
      row.status = row.status ?? 'CONFIRMED';
      row.waitlistOrder = row.waitlistOrder ?? null;
      row.createdAt = row.createdAt ?? now;
      row.updatedAt = row.updatedAt ?? now;
    }
    if (table === 'auditLog') {
      row.createdAt = row.createdAt ?? now;
    }
    if (table === 'transaction') {
      row.discountAppliedBdt = row.discountAppliedBdt ?? 0;
      row.status = row.status ?? 'CLEARED';
      row.createdAt = row.createdAt ?? now;
    }
    if (table === 'aIInteractionLog') {
      row.domActionTaken = row.domActionTaken ?? false;
      row.createdAt = row.createdAt ?? now;
    }
    if (table === 'notificationLog') {
      row.status = row.status ?? 'SENT';
      row.isRead = row.isRead ?? false;
      row.sentAt = row.sentAt ?? now;
    }
    if (table === 'equipmentTicket') {
      row.status = row.status ?? 'OPEN';
      row.createdAt = row.createdAt ?? now;
    }
    if (table === 'user') {
      row.role = row.role ?? 'MEMBER';
      row.status = row.status ?? 'ACTIVE';
      row.loyaltyPoints = row.loyaltyPoints ?? 0;
      row.churnRiskScore = row.churnRiskScore ?? 0;
      row.healthScore = row.healthScore ?? 100;
      row.syncVersion = row.syncVersion ?? 1;
      row.createdAt = row.createdAt ?? now;
      row.updatedAt = row.updatedAt ?? now;
    }

    return row;
  }

  private assertUniqueConstraints(table: TableName, candidate: Row, ignoreId?: string): void {
    const others = this.tables[table].filter((r) => r.id !== ignoreId);
    if (table === 'booking') {
      const dup = others.find(
        (r) =>
          r.sessionId === candidate.sessionId && r.userId === candidate.userId,
      );
      if (dup) {
        const err = new Error('Unique constraint failed on (sessionId, userId)') as Error & {
          code?: string;
        };
        err.code = 'P2002';
        throw err;
      }
    }
    const uniqueFields: Partial<Record<TableName, string[]>> = {
      branch: ['code'],
      user: ['email', 'phone'],
      accessCard: ['cardUid'],
      campaign: ['promoCode'],
      transaction: ['invoiceNumber'],
      equipmentAsset: ['qrCodeToken'],
      featureFlag: ['key'],
    };
    for (const field of uniqueFields[table] ?? []) {
      if (candidate[field] != null) {
        const dup = others.find((r) => r[field] === candidate[field]);
        if (dup) {
          const err = new Error(`Unique constraint failed on ${field}`) as Error & {
            code?: string;
          };
          err.code = 'P2002';
          throw err;
        }
      }
    }
  }

  private delegate(table: TableName) {
    return {
      findUnique: async (args: {
        where: Row;
        include?: Row;
        select?: Row;
      }) => {
        const found = this.tables[table].find((r) =>
          this.matchesWhere(table, r, args.where),
        );
        return found ? this.applySelectAndInclude(table, found, args) : null;
      },
      findUniqueOrThrow: async (args: {
        where: Row;
        include?: Row;
        select?: Row;
      }) => {
        const found = this.tables[table].find((r) =>
          this.matchesWhere(table, r, args.where),
        );
        if (!found) throw new Error(`${table} record not found`);
        return this.applySelectAndInclude(table, found, args);
      },
      findFirst: async (args?: {
        where?: Row;
        include?: Row;
        select?: Row;
        orderBy?: unknown;
      }) => {
        let rows = this.tables[table].filter((r) =>
          this.matchesWhere(table, r, args?.where),
        );
        if (args?.orderBy) rows = this.sortRows(rows, args.orderBy);
        const found = rows[0];
        return found ? this.applySelectAndInclude(table, found, args) : null;
      },
      findMany: async (args?: {
        where?: Row;
        include?: Row;
        select?: Row;
        orderBy?: unknown;
        take?: number;
        skip?: number;
      }) => {
        let rows = this.tables[table].filter((r) =>
          this.matchesWhere(table, r, args?.where),
        );
        if (args?.orderBy) rows = this.sortRows(rows, args.orderBy);
        if (typeof args?.skip === 'number') rows = rows.slice(args.skip);
        if (typeof args?.take === 'number') rows = rows.slice(0, args.take);
        return rows.map((r) => this.applySelectAndInclude(table, r, args));
      },
      create: async (args: { data: Row; include?: Row; select?: Row }) => {
        const created = this.normalizeCreateRow(table, args.data);
        this.assertUniqueConstraints(table, created);
        this.tables[table].push(created);
        return this.applySelectAndInclude(table, created, args);
      },
      createMany: async (args: { data: Row[] }) => {
        let count = 0;
        for (const item of args.data) {
          const created = this.normalizeCreateRow(table, item);
          this.assertUniqueConstraints(table, created);
          this.tables[table].push(created);
          count += 1;
        }
        return { count };
      },
      update: async (args: {
        where: Row;
        data: Row;
        include?: Row;
        select?: Row;
      }) => {
        const idx = this.tables[table].findIndex((r) =>
          this.matchesWhere(table, r, args.where),
        );
        if (idx === -1) {
          throw new Error(`Record to update not found in ${table}`);
        }
        const updated = this.applyUpdateData(this.tables[table][idx], args.data);
        this.assertUniqueConstraints(table, updated, String(updated.id));
        this.tables[table][idx] = updated;
        return this.applySelectAndInclude(table, updated, args);
      },
      updateMany: async (args: { where?: Row; data: Row }) => {
        let count = 0;
        this.tables[table] = this.tables[table].map((row) => {
          if (this.matchesWhere(table, row, args.where)) {
            count += 1;
            return this.applyUpdateData(row, args.data);
          }
          return row;
        });
        return { count };
      },
      upsert: async (args: {
        where: Row;
        create: Row;
        update: Row;
        include?: Row;
        select?: Row;
      }) => {
        const idx = this.tables[table].findIndex((r) =>
          this.matchesWhere(table, r, args.where),
        );
        if (idx === -1) {
          const created = this.normalizeCreateRow(table, args.create);
          this.assertUniqueConstraints(table, created);
          this.tables[table].push(created);
          return this.applySelectAndInclude(table, created, args);
        }
        const updated = this.applyUpdateData(this.tables[table][idx], args.update);
        this.tables[table][idx] = updated;
        return this.applySelectAndInclude(table, updated, args);
      },
      delete: async (args: { where: Row }) => {
        const idx = this.tables[table].findIndex((r) =>
          this.matchesWhere(table, r, args.where),
        );
        if (idx === -1) throw new Error(`Record to delete not found in ${table}`);
        const [removed] = this.tables[table].splice(idx, 1);
        return cloneValue(removed);
      },
      deleteMany: async (args?: { where?: Row }) => {
        const before = this.tables[table].length;
        this.tables[table] = this.tables[table].filter(
          (r) => !this.matchesWhere(table, r, args?.where),
        );
        return { count: before - this.tables[table].length };
      },
      count: async (args?: { where?: Row }) => {
        return this.tables[table].filter((r) =>
          this.matchesWhere(table, r, args?.where),
        ).length;
      },
      aggregate: async (args?: {
        where?: Row;
        _max?: Record<string, boolean>;
        _min?: Record<string, boolean>;
        _sum?: Record<string, boolean>;
        _count?: boolean | Record<string, boolean>;
      }) => {
        const rows = this.tables[table].filter((r) =>
          this.matchesWhere(table, r, args?.where),
        );
        const result: Record<string, unknown> = {};
        if (args?._max) {
          const maxObj: Record<string, unknown> = {};
          for (const field of Object.keys(args._max)) {
            const vals = rows
              .map((r) => r[field])
              .filter((v): v is number => typeof v === 'number');
            maxObj[field] = vals.length > 0 ? Math.max(...vals) : null;
          }
          result._max = maxObj;
        }
        if (args?._min) {
          const minObj: Record<string, unknown> = {};
          for (const field of Object.keys(args._min)) {
            const vals = rows
              .map((r) => r[field])
              .filter((v): v is number => typeof v === 'number');
            minObj[field] = vals.length > 0 ? Math.min(...vals) : null;
          }
          result._min = minObj;
        }
        if (args?._sum) {
          const sumObj: Record<string, unknown> = {};
          for (const field of Object.keys(args._sum)) {
            sumObj[field] = rows.reduce(
              (acc, r) => acc + (Number(r[field]) || 0),
              0,
            );
          }
          result._sum = sumObj;
        }
        if (args?._count) {
          result._count = rows.length;
        }
        return result;
      },
    };
  }

  get branch() {
    return this.delegate('branch');
  }
  get user() {
    return this.delegate('user');
  }
  get accessCard() {
    return this.delegate('accessCard');
  }
  get attendanceLog() {
    return this.delegate('attendanceLog');
  }
  get membershipPlan() {
    return this.delegate('membershipPlan');
  }
  get subscription() {
    return this.delegate('subscription');
  }
  get campaign() {
    return this.delegate('campaign');
  }
  get transaction() {
    return this.delegate('transaction');
  }
  get session() {
    return this.delegate('session');
  }
  get booking() {
    return this.delegate('booking');
  }
  get smartLocker() {
    return this.delegate('smartLocker');
  }
  get equipmentAsset() {
    return this.delegate('equipmentAsset');
  }
  get equipmentTicket() {
    return this.delegate('equipmentTicket');
  }
  get notificationLog() {
    return this.delegate('notificationLog');
  }
  get knowledgeChunk() {
    return this.delegate('knowledgeChunk');
  }
  get aIInteractionLog() {
    return this.delegate('aIInteractionLog');
  }
  get auditLog() {
    return this.delegate('auditLog');
  }
  get featureFlag() {
    return this.delegate('featureFlag');
  }
}
