import type {
  BillingCycle,
  BookingStatus,
  CampaignDiscountType,
  EntryStatus,
  EquipmentStatus,
  PaymentMethod,
  PaymentStatus,
  SessionType,
  TicketStatus,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
} from '@vintage/shared';

export interface BranchItem {
  id: string;
  name: string;
  code: string;
  address: string;
  maxOccupancy: number;
  currentOccupancy: number;
  edgeNodeOnline: boolean;
  lastEdgeHeartbeat?: string;
}

export interface UserSummaryItem {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRole;
  status: UserStatus;
  homeBranchId: string;
  primaryPayerId: string | null;
  loyaltyPoints: number;
  churnRiskScore: number;
  healthScore: number;
  activeCardUid?: string | null;
}

export interface MembershipPlanItem {
  id: string;
  name: string;
  billingCycle: BillingCycle;
  priceBdt: number;
  durationDays: number;
  sessionCredits?: number | null;
  roamingEnabled: boolean;
  offPeakOnly: boolean;
  offPeakStartHour?: number | null;
  offPeakEndHour?: number | null;
}

export interface SubscriptionItem {
  id: string;
  userId: string;
  planId: string;
  planName?: string;
  plan?: MembershipPlanItem;
  startDate: string;
  endDate: string;
  paymentStatus: PaymentStatus;
  totalAmountBdt: number;
  paidAmountBdt: number;
  dueAmountBdt: number;
  remainingCredits: number;
  frozenFrom?: string | null;
  frozenUntil?: string | null;
}

export interface TransactionItem {
  id: string;
  userId: string;
  userName?: string;
  invoiceNumber: string;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  amountBdt: number;
  discountBdt?: number;
  status: TransactionStatus;
  gatewayRef?: string | null;
  createdAt: string;
}

export interface CampaignItem {
  id: string;
  name: string;
  promoCode: string;
  discountType: CampaignDiscountType;
  discountValue: number;
  branchId: string | null;
  branchName?: string | null;
  startDate: string;
  endDate: string;
  maxRedemptions: number | null;
  redemptionsCount?: number;
  isActive: boolean;
}

export interface AttendanceLogItem {
  id: string;
  branchId: string;
  branchName?: string;
  userId?: string | null;
  memberName?: string | null;
  cardUid?: string | null;
  entryStatus: EntryStatus;
  reason?: string | null;
  overrideReason?: string | null;
  overrideNotes?: string | null;
  planName?: string | null;
  dueAmountBdt?: number | null;
  scannedAt: string;
}

export interface SmartLockerItem {
  id: string;
  branchId: string;
  lockerNumber: string;
  hardwareRelayId?: string;
  assignedUserId: string | null;
  assignedUserName?: string | null;
  claimedAt: string | null;
}

export interface EquipmentAssetItem {
  id: string;
  branchId: string;
  branchName?: string;
  qrCodeToken: string;
  name: string;
  zoneName: string;
  status: EquipmentStatus;
}

export interface MaintenanceTicketItem {
  id: string;
  equipmentId: string;
  equipmentName?: string;
  zoneName?: string;
  qrCodeToken?: string;
  branchId: string;
  reportedByUserId?: string;
  reportedByName?: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface FeatureFlagItem {
  key: string;
  description: string;
  isEnabled: boolean;
  rolloutPct: number;
}

export interface AuditLogItem {
  id: string;
  actorUserId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  branchId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface SessionAttendeeItem {
  bookingId: string;
  userId: string;
  fullName: string;
  phone: string;
  status: BookingStatus;
  waitlistOrder?: number | null;
}

export interface TrainerSessionItem {
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
  myBookingId?: string | null;
  myBookingStatus?: BookingStatus | null;
  myWaitlistOrder?: number | null;
  attendees?: SessionAttendeeItem[];
}
