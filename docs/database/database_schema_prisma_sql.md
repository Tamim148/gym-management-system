# 02. Database Schema — Prisma ORM & PostgreSQL Extensions
**Project:** Vintage Aesthetics Gym Management System  
**ORM:** Prisma ORM (`prisma@7` recommended for stable `schema.prisma` workflows)  
**Default Local DB:** SQLite (`file:./dev.db`) — Zero installation required  
**Free Cloud DB:** Neon Free PostgreSQL (`provider = "postgresql"`) — 1-line switch  
**Version:** 2.1

---

## 1. Dual-Engine Portability Strategy (SQLite & Neon Postgres)

To guarantee that a beginner on Windows can run the full system immediately without installing PostgreSQL—while deploying cleanly to **Neon Free PostgreSQL** for `dev`, `staging`, and `prod`—this schema follows three portability rules:
1. Uses universal scalar types (`String`, `Int`, `Float`, `Boolean`, `DateTime`) supported identically by SQLite and PostgreSQL.
2. Stores structured payloads (`parqDataJson`, `embeddingJson`, `metadataJson`) as JSON strings, parsed and validated via **Zod** in NestJS.
3. Enforces domain enums via shared TypeScript constants (`packages/shared/src/enums.ts`) in code, plus optional PostgreSQL `CHECK` constraints in cloud migrations.

---

## 2. Complete `prisma/schema.prisma` (18 Models)

~~~prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  // ZERO-SETUP LOCAL DEFAULT: "sqlite" with DATABASE_URL="file:./dev.db"
  // FREE CLOUD DEPLOYMENT: Change provider to "postgresql" and set Neon DATABASE_URL
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ==================== 1. MULTI-BRANCH & IDENTITY ====================

model Branch {
  id                String           @id @default(uuid())
  name              String
  code              String           @unique // e.g., "DHK-01", "DHK-02", "DHK-03"
  address           String
  timezone          String           @default("Asia/Dhaka")
  maxOccupancy      Int              @default(80)
  currentOccupancy  Int              @default(0)
  edgeNodeOnline    Boolean          @default(true)
  lastEdgeHeartbeat DateTime?
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  users             User[]
  attendanceLogs    AttendanceLog[]
  sessions          Session[]
  campaigns         Campaign[]
  lockers           SmartLocker[]
  equipment         EquipmentAsset[]
  featureFlags      FeatureFlag[]
}

model User {
  id                 String             @id @default(uuid())
  homeBranchId       String
  homeBranch         Branch             @relation(fields: [homeBranchId], references: [id], onDelete: Restrict)
  // Valid values: SUPER_ADMIN | BRANCH_MANAGER | FRONT_DESK | TRAINER | MEMBER
  role               String             @default("MEMBER")
  // Valid values: ACTIVE | FROZEN | SUSPENDED | INACTIVE
  status             String             @default("ACTIVE")
  fullName           String
  email              String?            @unique
  phone              String             @unique
  passwordHash       String
  telegramChatId     String?
  webPushSubJson     String?
  profilePhotoUrl    String?
  emergencyContact   String?
  kycDocumentUrl     String?
  parqWaiverSignedAt DateTime?
  parqDataJson       String?

  // Family Sub-Accounts (1 primary payer -> up to 4 dependents)
  primaryPayerId     String?
  primaryPayer       User?              @relation("FamilyHierarchy", fields: [primaryPayerId], references: [id], onDelete: SetNull)
  familySubAccounts  User[]             @relation("FamilyHierarchy")

  // Trainer Fields
  certifications     String?
  specializationsCsv String?            // e.g., "HIIT,Hypertrophy,Mobility"
  commissionRatePct  Float?             // Default 40.0 for PT split

  // Retention & Gamification
  loyaltyPoints      Int                @default(0)
  churnRiskScore     Float              @default(0.0)
  healthScore        Float              @default(100.0)
  syncVersion        Int                @default(1)
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  accessCards        AccessCard[]
  subscriptions      Subscription[]
  transactions       Transaction[]
  attendanceLogs     AttendanceLog[]    @relation("MemberAttendance")
  overridesPerformed AttendanceLog[]    @relation("StaffOverride")
  trainerSessions    Session[]          @relation("TrainerSessions")
  bookings           Booking[]
  assignedLocker     SmartLocker?
  reportedTickets    EquipmentTicket[]
  aiInteractions     AIInteractionLog[]
  notifications      NotificationLog[]

  @@index([homeBranchId, role])
  @@index([status])
  @@index([primaryPayerId])
}

// ==================== 2. ACCESS CONTROL & ATTENDANCE ====================

model AccessCard {
  id                   String    @id @default(uuid())
  cardUid              String    @unique // e.g., "VA-RFID-4092"
  userId               String
  user                 User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  // Valid values: ACTIVE | LOST | DAMAGED | REPLACED | REVOKED
  status               String    @default("ACTIVE")
  issuedAt             DateTime  @default(now())
  revokedAt            DateTime?
  replacementFeePaid   Boolean   @default(false)
  replacementInvoiceId String?
  syncVersion          Int       @default(1)
  updatedAt            DateTime  @updatedAt

  @@index([userId, status])
}

model AttendanceLog {
  id             String    @id @default(uuid())
  userId         String
  user           User      @relation("MemberAttendance", fields: [userId], references: [id], onDelete: Cascade)
  branchId       String
  branch         Branch    @relation(fields: [branchId], references: [id], onDelete: Restrict)
  cardUidScanned String?
  scannedAt      DateTime  @default(now())
  checkedOutAt   DateTime?
  // Valid values: ALLOWED | DENIED_UNPAID | DENIED_EXPIRED | DENIED_FROZEN | DENIED_WRONG_BRANCH | MANUAL_OVERRIDE
  entryStatus    String
  overrideById   String?
  overrideBy     User?     @relation("StaffOverride", fields: [overrideById], references: [id], onDelete: SetNull)
  overrideReason String?
  overrideNotes  String?
  syncedFromEdge Boolean   @default(false)

  @@index([branchId, scannedAt])
  @@index([userId, scannedAt])
  @@index([entryStatus])
}

// ==================== 3. BILLING, MOCK PAYMENTS & CAMPAIGNS ====================

model MembershipPlan {
  id               String         @id @default(uuid())
  name             String
  // Valid values: DAY_PASS | MONTHLY | QUARTERLY | ANNUAL | SESSION_PACK
  billingCycle     String
  priceBdt         Float
  durationDays     Int?
  sessionCredits   Int?
  roamingEnabled   Boolean        @default(false)
  offPeakOnly      Boolean        @default(false)
  offPeakStartHour Int?           // 24h format e.g., 13 (1:00 PM)
  offPeakEndHour   Int?           // 24h format e.g., 15 (3:00 PM)
  isActive         Boolean        @default(true)
  createdAt        DateTime       @default(now())

  subscriptions    Subscription[]
}

model Subscription {
  id               String         @id @default(uuid())
  userId           String
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  planId           String
  plan             MembershipPlan @relation(fields: [planId], references: [id], onDelete: Restrict)
  startDate        DateTime
  endDate          DateTime
  nextBillingDate  DateTime?
  // Valid values: PAID | PARTIAL | OVERDUE | CANCELLED | FROZEN
  paymentStatus    String         @default("PAID")
  totalAmountBdt   Float
  paidAmountBdt    Float
  dueAmountBdt     Float          @default(0)
  remainingCredits Int            @default(0)
  frozenFrom       DateTime?
  frozenUntil      DateTime?
  syncVersion      Int            @default(1)
  updatedAt        DateTime       @updatedAt

  @@index([userId, paymentStatus])
  @@index([endDate])
}

model Campaign {
  id              String        @id @default(uuid())
  name            String        // e.g., "Eid Iron Blast 2026"
  promoCode       String        @unique
  // Valid values: PERCENTAGE | FIXED_BDT
  discountType    String
  discountValue   Float
  branchId        String?       // NULL = Valid at all 3 branches
  branch          Branch?       @relation(fields: [branchId], references: [id], onDelete: SetNull)
  startDate       DateTime
  endDate         DateTime
  maxRedemptions  Int?
  redemptionCount Int           @default(0)
  isActive        Boolean       @default(true)
  createdAt       DateTime      @default(now())

  transactions    Transaction[]
}

model Transaction {
  id                 String    @id @default(uuid())
  invoiceNumber      String    @unique
  userId             String
  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  campaignId         String?
  campaign           Campaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  // Valid values: MEMBERSHIP | PARTIAL_DUE_SETTLEMENT | PT_PACKAGE | CARD_REPLACEMENT | POS_RETAIL | REFUND
  type               String
  // Valid values: MOCK_BKASH | MOCK_NAGAD | MOCK_CARD | CASH | POS_TERMINAL
  paymentMethod      String
  amountBdt          Float
  discountAppliedBdt Float     @default(0)
  gatewayRef         String?
  // Valid values: PENDING | CLEARED | FAILED | REFUNDED
  status             String    @default("CLEARED")
  collectedByStaffId String?
  createdAt          DateTime  @default(now())

  @@index([userId, createdAt])
  @@index([gatewayRef])
}

// ==================== 4. SCHEDULING & WAITLISTS ====================

model Session {
  id              String    @id @default(uuid())
  trainerId       String
  trainer         User      @relation("TrainerSessions", fields: [trainerId], references: [id], onDelete: Restrict)
  branchId        String
  branch          Branch    @relation(fields: [branchId], references: [id], onDelete: Restrict)
  title           String
  // Valid values: PERSONAL_TRAINING | GROUP_CLASS | OPEN_AVAILABILITY
  type            String
  zoneName        String?
  startTime       DateTime
  endTime         DateTime
  maxCapacity     Int       @default(1)
  isOffPeakDeal   Boolean   @default(false)
  offPeakPriceBdt Float?
  isCancelled     Boolean   @default(false)
  cancelReason    String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  bookings        Booking[]

  @@index([branchId, startTime])
  @@index([trainerId, startTime])
}

model Booking {
  id            String   @id @default(uuid())
  sessionId     String
  session       Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  // Valid values: CONFIRMED | WAITLISTED | ATTENDED | NO_SHOW | CANCELLED
  status        String   @default("CONFIRMED")
  waitlistOrder Int?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([sessionId, userId])
  @@index([sessionId, status, waitlistOrder])
}

// ==================== 5. FACILITY IoT, NOTIFICATIONS & FREE AI RAG ====================

model SmartLocker {
  id              String    @id @default(uuid())
  branchId        String
  branch          Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  lockerNumber    String
  hardwareRelayId String
  assignedUserId  String?   @unique
  assignedUser    User?     @relation(fields: [assignedUserId], references: [id], onDelete: SetNull)
  claimedAt       DateTime?

  @@unique([branchId, lockerNumber])
}

model EquipmentAsset {
  id          String            @id @default(uuid())
  branchId    String
  branch      Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  qrCodeToken String            @unique
  name        String
  zoneName    String
  // Valid values: OPERATIONAL | OUT_OF_ORDER | UNDER_MAINTENANCE
  status      String            @default("OPERATIONAL")

  tickets     EquipmentTicket[]
}

model EquipmentTicket {
  id           String         @id @default(uuid())
  equipmentId  String
  equipment    EquipmentAsset @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  reportedById String
  reportedBy   User           @relation(fields: [reportedById], references: [id], onDelete: Cascade)
  description  String
  photoUrl     String?
  // Valid values: OPEN | IN_PROGRESS | RESOLVED
  status       String         @default("OPEN")
  createdAt    DateTime       @default(now())
  resolvedAt   DateTime?

  @@index([equipmentId, status])
}

model NotificationLog {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  // Valid values: IN_APP | WEB_PUSH | TELEGRAM | EMAIL_RESEND | DEV_INBOX
  channel     String
  triggerType String
  subject     String?
  payload     String
  status      String   @default("SENT")
  isRead      Boolean  @default(false)
  sentAt      DateTime @default(now())

  @@index([userId, isRead])
}

model KnowledgeChunk {
  id            String   @id @default(uuid())
  sourceTitle   String
  content       String
  embeddingJson String?  // Cosine similarity locally; mirrored to pgvector on Neon Postgres
  updatedAt     DateTime @updatedAt
}

model AIInteractionLog {
  id                String   @id @default(uuid())
  userId            String?
  user              User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  userPrompt        String
  intentType        String
  domActionTaken    Boolean  @default(false)
  actionPayloadJson String?
  createdAt         DateTime @default(now())
}

// ==================== 6. GOVERNANCE, AUDIT & FEATURE FLAGS ====================

model AuditLog {
  id           String   @id @default(uuid())
  actorId      String
  branchId     String?
  action       String   // GATE_OVERRIDE | CARD_REPLACED | BOOKED_SLOT_DELETED | PARTIAL_DUE_PAID
  entityType   String
  entityId     String
  metadataJson String
  createdAt    DateTime @default(now())

  @@index([branchId, createdAt])
  @@index([actorId])
}

model FeatureFlag {
  id          String   @id @default(uuid())
  key         String   @unique // e.g., "ai_concierge", "smart_lockers", "off_peak_yield"
  description String
  isEnabled   Boolean  @default(true)
  branchId    String?  // NULL = global flag; non-null = branch pilot rollout
  branch      Branch?  @relation(fields: [branchId], references: [id], onDelete: SetNull)
  rolloutPct  Int      @default(100)
  updatedAt   DateTime @updatedAt
}
~~~

---

## 3. Shared TypeScript Enum Guard (`packages/shared/src/enums.ts`)

Because SQLite stores enum fields as text, both NestJS DTOs and Next.js forms import these strict constants:

~~~typescript
export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  FRONT_DESK: 'FRONT_DESK',
  TRAINER: 'TRAINER',
  MEMBER: 'MEMBER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const EntryStatus = {
  ALLOWED: 'ALLOWED',
  DENIED_UNPAID: 'DENIED_UNPAID',
  DENIED_EXPIRED: 'DENIED_EXPIRED',
  DENIED_FROZEN: 'DENIED_FROZEN',
  DENIED_WRONG_BRANCH: 'DENIED_WRONG_BRANCH',
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
} as const;
export type EntryStatus = (typeof EntryStatus)[keyof typeof EntryStatus];

export const PaymentStatus = {
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
  FROZEN: 'FROZEN',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
~~~

---

## 4. Optional Neon PostgreSQL `pgvector` Extension

When deploying to **Neon Free PostgreSQL**, enable native vector indexing on `KnowledgeChunk` via a raw SQL migration so AI Concierge queries execute natively inside Postgres at zero cost:

~~~sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KnowledgeChunk"
  ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_idx
  ON "KnowledgeChunk"
  USING hnsw (embedding vector_cosine_ops);
~~~