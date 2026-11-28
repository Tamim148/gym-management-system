import { z } from 'zod';
import {
  CampaignDiscountType,
  EntryStatus,
  EquipmentStatus,
  NotificationChannel,
  PaymentMethod,
  PaymentStatus,
  SessionType,
  TicketStatus,
  UserRole,
  UserStatus,
} from './enums';

export const SOCKET_EVENTS = {
  ACCESS_EVENT: 'access:event',
  OCCUPANCY_UPDATE: 'branch:occupancy',
  NOTIFICATION_NEW: 'notification:new',
  TICKET_NEW: 'equipment:ticket',
} as const;

export const ALLOWED_AI_NAV_ROUTES = [
  '/member',
  '/member/schedule',
  '/member/pass',
  '/member/profile',
  '/desk',
  '/admin',
  '/trainer',
  '/simulator',
] as const;

export type AllowedAiNavRoute = (typeof ALLOWED_AI_NAV_ROUTES)[number];

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  service: z.string(),
  database: z.enum(['connected', 'disconnected']),
  latencyMs: z.number().nonnegative().optional(),
  environment: z.string(),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export interface RequestAuthContext {
  userId: string;
  role: UserRole;
  branchId: string;
}

// ==================== AUTH ====================
export const LoginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(6).max(128),
  isSharedTablet: z.boolean().optional().default(false),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(10).max(20),
  password: z.string().min(10).max(128),
  homeBranchId: z.string().uuid(),
  emergencyContact: z.string().trim().min(5).max(100).optional(),
  parqData: z
    .object({
      hasHeartCondition: z.boolean().default(false),
      hasChestPain: z.boolean().default(false),
      hasJointInjury: z.boolean().default(false),
      fitnessGoal: z.string().max(200).optional(),
      waiverSignatureDataUrl: z.string().max(150000).optional(),
    })
    .optional(),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const VerifyOtpSchema = z.object({
  identifier: z.string().trim().min(3),
  code: z.string().trim().length(6),
});
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;

export interface AuthUserProfile {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRole;
  status: UserStatus;
  homeBranchId: string;
  branchName?: string;
  branchCode?: string;
  loyaltyPoints: number;
  churnRiskScore: number;
  healthScore: number;
  primaryPayerId: string | null;
}

export interface AuthSessionResponse {
  user: AuthUserProfile;
  accessToken?: string;
  devOtpPreview?: string;
}

// ==================== USERS & ONBOARDING ====================
export const OnboardMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(10).max(20),
  password: z.string().min(10).max(128).optional(),
  homeBranchId: z.string().uuid().optional(),
  emergencyContact: z.string().trim().max(120).optional(),
  primaryPayerId: z.string().uuid().optional(),
  cardUid: z.string().trim().min(4).max(40).optional(),
  parqData: z.record(z.unknown()).optional(),
});
export type OnboardMemberDto = z.infer<typeof OnboardMemberSchema>;

export const UpdateOwnProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  emergencyContact: z.string().trim().max(120).optional(),
  telegramChatId: z.string().trim().max(64).optional(),
});
export type UpdateOwnProfileDto = z.infer<typeof UpdateOwnProfileSchema>;

export interface MemberQuickProfile {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRole;
  status: UserStatus;
  homeBranchId: string;
  profilePhotoUrl: string | null;
  loyaltyPoints: number;
  activeCardUid: string | null;
  subscription: {
    id: string;
    planName: string;
    paymentStatus: PaymentStatus;
    endDate: string;
    totalAmountBdt: number;
    paidAmountBdt: number;
    dueAmountBdt: number;
    remainingCredits: number;
    roamingEnabled: boolean;
  } | null;
  recentAttendance: Array<{
    id: string;
    branchId: string;
    entryStatus: EntryStatus;
    scannedAt: string;
    overrideReason: string | null;
  }>;
}

// ==================== ACCESS & HARDWARE ====================
export const AccessVerifySchema = z.object({
  branchId: z.string().uuid(),
  cardUid: z.string().trim().min(1).optional(),
  qrToken: z.string().trim().min(1).optional(),
  syncedFromEdge: z.boolean().optional().default(false),
  clientEventId: z.string().uuid().optional(),
  scannedAt: z.string().datetime().optional(),
});
export type AccessVerifyDto = z.infer<typeof AccessVerifySchema>;

export interface AccessVerifyResult {
  allowed: boolean;
  entryStatus: EntryStatus;
  attendanceLogId: string;
  branchId: string;
  userId?: string;
  memberName?: string;
  planName?: string;
  dueAmountBdt?: number;
  reason: string;
  latencyMs: number;
  scannedAt: string;
}

export const ManualOverrideSchema = z.object({
  userId: z.string().uuid(),
  branchId: z.string().uuid(),
  reason: z.enum([
    'Promised to pay tomorrow',
    'Card reader glitch',
    'Admin approved',
  ]),
  notes: z
    .string()
    .trim()
    .min(10, 'Override justification note must be at least 10 characters'),
});
export type ManualOverrideDto = z.infer<typeof ManualOverrideSchema>;

export const ReplaceCardSchema = z.object({
  userId: z.string().uuid(),
  newCardUid: z.string().trim().min(4).max(40),
  paymentMethod: z.enum([
    PaymentMethod.CASH,
    PaymentMethod.POS_TERMINAL,
    PaymentMethod.MOCK_BKASH,
    PaymentMethod.MOCK_NAGAD,
    PaymentMethod.MOCK_CARD,
  ]),
  lostOrDamagedReason: z.enum(['LOST', 'DAMAGED']).default('LOST'),
});
export type ReplaceCardDto = z.infer<typeof ReplaceCardSchema>;

export const OfflineSyncBatchSchema = z.object({
  branchId: z.string().uuid(),
  events: z
    .array(
      z.object({
        id: z.string().uuid(),
        kind: z.enum(['CARD_TAP', 'MANUAL_OVERRIDE']),
        cardUid: z.string().optional(),
        userId: z.string().uuid().optional(),
        scannedAt: z.string().datetime(),
        overrideReason: z.string().optional(),
        overrideNotes: z.string().optional(),
      }),
    )
    .max(200),
});
export type OfflineSyncBatchDto = z.infer<typeof OfflineSyncBatchSchema>;

export interface QrPassPayload {
  token: string;
  userId: string;
  expiresAt: string;
  bucketSeconds: number;
}

// ==================== BILLING & CAMPAIGNS ====================
export const CheckoutRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  planId: z.string().uuid(),
  paymentMethod: z.enum([
    PaymentMethod.MOCK_BKASH,
    PaymentMethod.MOCK_NAGAD,
    PaymentMethod.MOCK_CARD,
    PaymentMethod.CASH,
    PaymentMethod.POS_TERMINAL,
  ]),
  promoCode: z.string().trim().max(40).optional(),
  isPartialPayment: z.boolean().optional().default(false),
  partialPaidBdt: z.number().positive().optional(),
  simulateMode: z
    .enum(['SUCCESS', 'FAIL', 'BROWSER_DROP'])
    .optional()
    .default('SUCCESS'),
});
export type CheckoutRequestDto = z.infer<typeof CheckoutRequestSchema>;

export interface CheckoutResponse {
  transactionId: string;
  invoiceNumber: string;
  gatewayRef: string;
  amountBdt: number;
  discountAppliedBdt: number;
  status: string;
  ipnSignature: string;
  subscriptionId?: string;
}

export const MockIpnWebhookSchema = z.object({
  gatewayRef: z.string().trim().min(3),
  amountBdt: z.number().nonnegative(),
  status: z.enum(['CLEARED', 'FAILED']),
  signature: z.string().trim().min(8),
});
export type MockIpnWebhookDto = z.infer<typeof MockIpnWebhookSchema>;

export const SettleDueSchema = z.object({
  amountBdt: z.number().positive().optional(),
  paymentMethod: z.enum([
    PaymentMethod.CASH,
    PaymentMethod.POS_TERMINAL,
    PaymentMethod.MOCK_BKASH,
    PaymentMethod.MOCK_NAGAD,
    PaymentMethod.MOCK_CARD,
  ]),
});
export type SettleDueDto = z.infer<typeof SettleDueSchema>;

export const FreezeSubscriptionSchema = z.object({
  days: z.number().int().min(3).max(30),
  reason: z.string().trim().min(3).max(200).optional(),
});
export type FreezeSubscriptionDto = z.infer<typeof FreezeSubscriptionSchema>;

export const CreateCampaignSchema = z.object({
  name: z.string().trim().min(3).max(120),
  promoCode: z.string().trim().min(3).max(30),
  discountType: z.enum([
    CampaignDiscountType.PERCENTAGE,
    CampaignDiscountType.FIXED_BDT,
  ]),
  discountValue: z.number().positive(),
  branchId: z.string().uuid().nullable().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
});
export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;

// ==================== SCHEDULING & WAITLIST ====================
export const CreateSessionSchema = z.object({
  branchId: z.string().uuid(),
  trainerId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(120),
  type: z.enum([
    SessionType.PERSONAL_TRAINING,
    SessionType.GROUP_CLASS,
    SessionType.OPEN_AVAILABILITY,
  ]),
  zoneName: z.string().trim().max(80).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  maxCapacity: z.number().int().min(1).max(100),
});
export type CreateSessionDto = z.infer<typeof CreateSessionSchema>;

export const UpdateSessionSchema = CreateSessionSchema.partial();
export type UpdateSessionDto = z.infer<typeof UpdateSessionSchema>;

export const CancelSessionSchema = z.object({
  reason: z.string().trim().min(5).max(300),
});
export type CancelSessionDto = z.infer<typeof CancelSessionSchema>;

export interface SessionWithAvailability {
  id: string;
  trainerId: string;
  trainerName: string;
  branchId: string;
  branchName: string;
  title: string;
  type: SessionType;
  zoneName: string | null;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  confirmedCount: number;
  waitlistCount: number;
  isOffPeakDeal: boolean;
  offPeakPriceBdt: number | null;
  isCancelled: boolean;
  hasOutOfOrderEquipment?: boolean;
}

export interface BookSessionResponse {
  bookingId: string;
  sessionId: string;
  status: 'CONFIRMED' | 'WAITLISTED';
  waitlistOrder: number | null;
}

// ==================== FACILITY ====================
export const LockerTapSchema = z.object({
  userId: z.string().uuid().optional(),
  cardUid: z.string().trim().optional(),
});
export type LockerTapDto = z.infer<typeof LockerTapSchema>;

export const CreateEquipmentTicketSchema = z.object({
  equipmentId: z.string().uuid().optional(),
  qrCodeToken: z.string().trim().min(3).optional(),
  description: z.string().trim().min(5).max(500),
});
export type CreateEquipmentTicketDto = z.infer<
  typeof CreateEquipmentTicketSchema
>;

export const UpdateTicketStatusSchema = z.object({
  status: z.enum([
    TicketStatus.OPEN,
    TicketStatus.IN_PROGRESS,
    TicketStatus.RESOLVED,
  ]),
  equipmentStatus: z
    .enum([
      EquipmentStatus.OPERATIONAL,
      EquipmentStatus.OUT_OF_ORDER,
      EquipmentStatus.UNDER_MAINTENANCE,
    ])
    .optional(),
});
export type UpdateTicketStatusDto = z.infer<typeof UpdateTicketStatusSchema>;

// ==================== ADMIN & NOTIFICATIONS ====================
export interface AdminKpisResponse {
  totalRevenueMtdBdt: number;
  activeMembers: number;
  overdueMembers: number;
  todayFootfall: number;
  highChurnCount: number;
  branchBreakdown: Array<{
    branchId: string;
    branchName: string;
    branchCode: string;
    currentOccupancy: number;
    maxOccupancy: number;
    revenueMtdBdt: number;
    edgeNodeOnline: boolean;
  }>;
}

export const UpdateFeatureFlagSchema = z.object({
  isEnabled: z.boolean().optional(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
});
export type UpdateFeatureFlagDto = z.infer<typeof UpdateFeatureFlagSchema>;

export interface ChurnRadarItem {
  userId: string;
  fullName: string;
  phone: string;
  branchName: string;
  churnRiskScore: number;
  lastVisitAt: string | null;
  paymentStatus: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  userName?: string;
  channel: NotificationChannel;
  triggerType: string;
  subject: string | null;
  payload: string;
  status: string;
  isRead: boolean;
  sentAt: string;
}

// ==================== AI CONCIERGE ====================
export const AiChatRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  currentRoute: z.string().max(120).optional(),
  confirmAction: z
    .object({
      actionType: z.enum(['BOOK_CLASS', 'FREEZE_PLAN']),
      targetId: z.string().uuid().optional(),
      days: z.number().int().min(3).max(30).optional(),
    })
    .optional(),
});
export type AiChatRequestDto = z.infer<typeof AiChatRequestSchema>;

export interface AiDomAction {
  type: 'NAVIGATE' | 'CONFIRM_WRITE';
  route?: AllowedAiNavRoute;
  label: string;
  actionType?: 'BOOK_CLASS' | 'FREEZE_PLAN';
  targetId?: string;
  days?: number;
}

export interface AiChatResponse {
  reply: string;
  provider: 'gemini' | 'mock';
  intentType: string;
  domActionTaken: boolean;
  action?: AiDomAction;
  citations: string[];
}

// ==================== BRANCHES & FREE PASS LEADS ====================
export interface BranchCoachSummary {
  id: string;
  fullName: string;
  specialty: string;
  branchCode: string;
}

export const FreePassLeadSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(
      /^\+8801[3-9]\d{8}$/,
      'Valid Bangladesh mobile (+8801XXXXXXXXX) required',
    ),
  branchId: z.string().uuid(),
  preferredVisitWindow: z.enum(['MORNING', 'OFF_PEAK_1_3PM', 'EVENING']),
  goal: z.string().trim().max(200).optional(),
});
export type FreePassLeadDto = z.infer<typeof FreePassLeadSchema>;

export interface FreePassLeadResponse {
  id: string;
  referenceCode: string;
  branchName: string;
  message: string;
}
