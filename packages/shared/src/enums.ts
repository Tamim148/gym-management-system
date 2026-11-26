export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  FRONT_DESK: 'FRONT_DESK',
  TRAINER: 'TRAINER',
  MEMBER: 'MEMBER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const CardStatus = {
  ACTIVE: 'ACTIVE',
  LOST: 'LOST',
  DAMAGED: 'DAMAGED',
  REPLACED: 'REPLACED',
  REVOKED: 'REVOKED',
} as const;
export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus];

export const EntryStatus = {
  ALLOWED: 'ALLOWED',
  DENIED_UNPAID: 'DENIED_UNPAID',
  DENIED_EXPIRED: 'DENIED_EXPIRED',
  DENIED_FROZEN: 'DENIED_FROZEN',
  DENIED_WRONG_BRANCH: 'DENIED_WRONG_BRANCH',
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
} as const;
export type EntryStatus = (typeof EntryStatus)[keyof typeof EntryStatus];

export const BillingCycle = {
  DAY_PASS: 'DAY_PASS',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  ANNUAL: 'ANNUAL',
  SESSION_PACK: 'SESSION_PACK',
} as const;
export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

export const PaymentStatus = {
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
  FROZEN: 'FROZEN',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const CampaignDiscountType = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED_BDT: 'FIXED_BDT',
} as const;
export type CampaignDiscountType =
  (typeof CampaignDiscountType)[keyof typeof CampaignDiscountType];

export const TransactionType = {
  MEMBERSHIP: 'MEMBERSHIP',
  PARTIAL_DUE_SETTLEMENT: 'PARTIAL_DUE_SETTLEMENT',
  PT_PACKAGE: 'PT_PACKAGE',
  CARD_REPLACEMENT: 'CARD_REPLACEMENT',
  POS_RETAIL: 'POS_RETAIL',
  REFUND: 'REFUND',
} as const;
export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const PaymentMethod = {
  MOCK_BKASH: 'MOCK_BKASH',
  MOCK_NAGAD: 'MOCK_NAGAD',
  MOCK_CARD: 'MOCK_CARD',
  CASH: 'CASH',
  POS_TERMINAL: 'POS_TERMINAL',
} as const;
export type PaymentMethod =
  (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const TransactionStatus = {
  PENDING: 'PENDING',
  CLEARED: 'CLEARED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const SessionType = {
  PERSONAL_TRAINING: 'PERSONAL_TRAINING',
  GROUP_CLASS: 'GROUP_CLASS',
  OPEN_AVAILABILITY: 'OPEN_AVAILABILITY',
} as const;
export type SessionType = (typeof SessionType)[keyof typeof SessionType];

export const BookingStatus = {
  CONFIRMED: 'CONFIRMED',
  WAITLISTED: 'WAITLISTED',
  ATTENDED: 'ATTENDED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
} as const;
export type BookingStatus =
  (typeof BookingStatus)[keyof typeof BookingStatus];

export const EquipmentStatus = {
  OPERATIONAL: 'OPERATIONAL',
  OUT_OF_ORDER: 'OUT_OF_ORDER',
  UNDER_MAINTENANCE: 'UNDER_MAINTENANCE',
} as const;
export type EquipmentStatus =
  (typeof EquipmentStatus)[keyof typeof EquipmentStatus];

export const TicketStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const NotificationChannel = {
  IN_APP: 'IN_APP',
  WEB_PUSH: 'WEB_PUSH',
  TELEGRAM: 'TELEGRAM',
  EMAIL_RESEND: 'EMAIL_RESEND',
  DEV_INBOX: 'DEV_INBOX',
} as const;
export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationTriggerType = {
  OTP: 'OTP',
  EXPIRY_7D: 'EXPIRY_7D',
  EXPIRY_3D: 'EXPIRY_3D',
  EXPIRY_1D: 'EXPIRY_1D',
  PAYMENT_RECEIPT: 'PAYMENT_RECEIPT',
  TRAINER_CANCEL: 'TRAINER_CANCEL',
  WAITLIST_PROMOTED: 'WAITLIST_PROMOTED',
  CHURN_NUDGE: 'CHURN_NUDGE',
  GATE_OVERRIDE_ALERT: 'GATE_OVERRIDE_ALERT',
} as const;
export type NotificationTriggerType =
  (typeof NotificationTriggerType)[keyof typeof NotificationTriggerType];

export const AuditAction = {
  GATE_OVERRIDE: 'GATE_OVERRIDE',
  CARD_REPLACED: 'CARD_REPLACED',
  BOOKED_SLOT_DELETED: 'BOOKED_SLOT_DELETED',
  PARTIAL_DUE_PAID: 'PARTIAL_DUE_PAID',
  KYC_DOCUMENT_VIEWED: 'KYC_DOCUMENT_VIEWED',
  FEATURE_FLAG_UPDATED: 'FEATURE_FLAG_UPDATED',
  LOGIN_BRUTE_FORCE_SUSPECTED: 'LOGIN_BRUTE_FORCE_SUSPECTED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
