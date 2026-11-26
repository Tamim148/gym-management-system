# Backend Database Schema Specification — Zero-Cost Edition
**Project:** Multi-Branch Gym Management & Member Engagement Ecosystem  
**Database Engine:** Local **SQLite** (Zero-Setup Default) $\rightarrow$ **Neon Free PostgreSQL** (1-Line Cloud Upgrade)  
**ORM:** Prisma ORM  
**Version:** 2.0 (SQLite-Safe & Postgres-Ready)  

---

## 1. Zero-Cost & SQLite-Compatible Design Rules

1. **Runs Out-of-the-Box on SQLite (Zero Install):** To ensure beginners can run `npx prisma migrate dev` immediately without installing PostgreSQL, this schema avoids Postgres-only column modifiers (`@db.Decimal`, native `String[]` arrays, and strict native enums) in favor of universal `String`, `Float`, and serialized JSON text fields with TypeScript enum validation in NestJS/Zod.
2. **One-Line Upgrade to Neon Free Postgres:** Changing `provider = "sqlite"` to `provider = "postgresql"` and pointing `DATABASE_URL` to a free Neon connection string works cleanly with zero schema rewrites.
3. **UUID Primary Keys Everywhere:** All tables use `@default(uuid())` so records created during offline branch simulation never collide on sync.
4. **Zero-Cost Vector Storage (`KnowledgeChunk`):** Replaces paid Pinecone by storing facility policy embeddings directly in the database (`embeddingJson` on SQLite, upgradable to `pgvector` on Neon Postgres).

---

## 2. Complete Zero-Setup Prisma Schema (`prisma/schema.prisma`)

~~~prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  // Default: 100% Free Local SQLite (Zero setup).
  // Cloud Upgrade: Change to "postgresql" and set DATABASE_URL to Neon Free Tier.
  provider = "sqlite"
  url      = env("DATABASE_URL") // e.g., "file:./dev.db"
}

// ==================== CORE MULTI-BRANCH & USERS ====================

model Branch {
  id                String           @id @default(uuid())
  name              String
  code              String           @unique // e.g., "DHK-01"
  address           String
  timezone          String           @default("Asia/Dhaka")
  maxOccupancy      Int              @default(100)
  currentOccupancy  Int              @default(0)
  edgeNodeOnline    Boolean          @default(true) // Toggled in /simulator to test offline mode
  lastEdgeHeartbeat DateTime?
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  users             User[]
  attendanceLogs    AttendanceLog[]
  sessions          Session[]
  campaigns         Campaign[]
  lockers           SmartLocker[]
  equipment         EquipmentAsset[]
}

model User {
  id                 String             @id @default(uuid())
  homeBranchId       String
  homeBranch         Branch             @relation(fields: [homeBranchId], references: [id])
  // Role: "SUPER_ADMIN" | "BRANCH_MANAGER" | "FRONT_DESK" | "TRAINER" | "MEMBER"
  role               String             @default("MEMBER")
  // Status: "ACTIVE" | "FROZEN" | "SUSPENDED" | "INACTIVE"
  status             String             @default("ACTIVE")
  fullName           String
  email              String?            @unique
  phone              String             @unique
  passwordHash       String
  telegramChatId     String?            // Optional free Telegram Bot notifications
  webPushSubJson     String?            // Free Web Push (VAPID) subscription JSON
  profilePhotoUrl    String?
  emergencyContact   String?
  kycDocumentUrl     String?
  parqWaiverSignedAt DateTime?
  parqDataJson       String?            // Serialized JSON: health metrics, goals, waiver signature

  // Family Sub-Account Support (1 primary payer -> N dependents)
  primaryPayerId     String?
  primaryPayer       User?              @relation("FamilyHierarchy", fields: [primaryPayerId], references: [id])
  familySubAccounts  User[]             @relation("FamilyHierarchy")

  // Trainer-Specific Fields
  certifications     String?
  specializationsCsv String?            // Comma-separated tags e.g., "HIIT,Strength,Yoga"
  commissionRatePct  Float?

  // Retention & Gamification Metrics
  loyaltyPoints      Int                @default(0)
  churnRiskScore     Float              @default(0.0) // 0.0 to 1.0 AI/heuristic score
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
}

// ==================== ACCESS CONTROL & ATTENDANCE ====================

model AccessCard {
  id                   String    @id @default(uuid())
  cardUid              String    @unique // Virtual or physical RFID/NFC UID
  userId               String
  user                 User      @relation(fields: [userId], references: [id])
  // Status: "ACTIVE" | "LOST" | "DAMAGED" | "REPLACED" | "REVOKED"
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
  user           User      @relation("MemberAttendance", fields: [userId], references: [id])
  branchId       String
  branch         Branch    @relation(fields: [branchId], references: [id])
  cardUidScanned String?
  scannedAt      DateTime  @default(now())
  checkedOutAt   DateTime?
  // EntryStatus: "ALLOWED" | "DENIED_UNPAID" | "DENIED_EXPIRED" | "DENIED_FROZEN" | "DENIED_WRONG_BRANCH" | "MANUAL_OVERRIDE"
  entryStatus    String
  overrideById   String?
  overrideBy     User?     @relation("StaffOverride", fields: [overrideById], references: [id])
  overrideReason String?
  overrideNotes  String?
  syncedFromEdge Boolean   @default(false)

  @@index([branchId, scannedAt])
  @@index([userId, scannedAt])
}

// ==================== BILLING, MOCK PAYMENTS & CAMPAIGNS ====================

model MembershipPlan {
  id               String         @id @default(uuid())
  name             String         // e.g., "All-Access Pro", "Off-Peak Saver"
  // BillingCycle: "DAY_PASS" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "SESSION_PACK"
  billingCycle     String
  priceBdt         Float
  durationDays     Int?
  sessionCredits   Int?
  roamingEnabled   Boolean        @default(false)
  offPeakOnly      Boolean        @default(false)
  offPeakStartHour Int?           // e.g., 13 (1 PM)
  offPeakEndHour   Int?           // e.g., 15 (3 PM)
  isActive         Boolean        @default(true)
  createdAt        DateTime       @default(now())

  subscriptions    Subscription[]
}

model Subscription {
  id               String         @id @default(uuid())
  userId           String
  user             User           @relation(fields: [userId], references: [id])
  planId           String
  plan             MembershipPlan @relation(fields: [planId], references: [id])
  startDate        DateTime
  endDate          DateTime
  nextBillingDate  DateTime?
  // PaymentStatus: "PAID" | "PARTIAL" | "OVERDUE" | "CANCELLED" | "FROZEN"
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
  name            String        // e.g., "Eid Festival Offer 2026"
  promoCode       String        @unique
  discountType    String        // "PERCENTAGE" | "FIXED_BDT"
  discountValue   Float
  branchId        String?       // NULL = Applies to all 3 branches
  branch          Branch?       @relation(fields: [branchId], references: [id])
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
  user               User      @relation(fields: [userId], references: [id])
  campaignId         String?
  campaign           Campaign? @relation(fields: [campaignId], references: [id])
  // Type: "MEMBERSHIP" | "PARTIAL_DUE_SETTLEMENT" | "PT_PACKAGE" | "CARD_REPLACEMENT" | "POS_RETAIL" | "REFUND"
  type               String
  // PaymentMethod: "MOCK_BKASH" | "MOCK_NAGAD" | "MOCK_CARD" | "CASH" | "POS_TERMINAL"
  paymentMethod      String
  amountBdt          Float
  discountAppliedBdt Float     @default(0)
  gatewayRef         String?   // Mock IPN / Sandbox reference ID
  status             String    // "PENDING" | "CLEARED" | "FAILED" | "REFUNDED"
  collectedByStaffId String?
  createdAt          DateTime  @default(now())

  @@index([userId, createdAt])
  @@index([gatewayRef])
}

// ==================== SCHEDULING & WAITLISTS ====================

model Session {
  id              String    @id @default(uuid())
  trainerId       String
  trainer         User      @relation("TrainerSessions", fields: [trainerId], references: [id])
  branchId        String
  branch          Branch    @relation(fields: [branchId], references: [id])
  title           String
  // Type: "PERSONAL_TRAINING" | "GROUP_CLASS" | "OPEN_AVAILABILITY"
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
  session       Session  @relation(fields: [sessionId], references: [id])
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  // Status: "CONFIRMED" | "WAITLISTED" | "ATTENDED" | "NO_SHOW" | "CANCELLED"
  status        String   @default("CONFIRMED")
  waitlistOrder Int?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([sessionId, userId])
  @@index([sessionId, status, waitlistOrder])
}

// ==================== FACILITY SIMULATOR, NOTIFICATIONS, FREE AI RAG & AUDIT ====================

model SmartLocker {
  id              String    @id @default(uuid())
  branchId        String
  branch          Branch    @relation(fields: [branchId], references: [id])
  lockerNumber    String
  hardwareRelayId String
  assignedUserId  String?   @unique
  assignedUser    User?     @relation(fields: [assignedUserId], references: [id])
  claimedAt       DateTime?

  @@unique([branchId, lockerNumber])
}

model EquipmentAsset {
  id          String            @id @default(uuid())
  branchId    String
  branch      Branch            @relation(fields: [branchId], references: [id])
  qrCodeToken String            @unique
  name        String            // e.g., "Treadmill #04"
  zoneName    String
  // Status: "OPERATIONAL" | "OUT_OF_ORDER" | "UNDER_MAINTENANCE"
  status      String            @default("OPERATIONAL")

  tickets     EquipmentTicket[]
}

model EquipmentTicket {
  id           String         @id @default(uuid())
  equipmentId  String
  equipment    EquipmentAsset @relation(fields: [equipmentId], references: [id])
  reportedById String
  reportedBy   User           @relation(fields: [reportedById], references: [id])
  description  String
  photoUrl     String?
  // Status: "OPEN" | "IN_PROGRESS" | "RESOLVED"
  status       String         @default("OPEN")
  createdAt    DateTime       @default(now())
  resolvedAt   DateTime?
}

model NotificationLog {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  // Channel: "IN_APP" | "WEB_PUSH" | "TELEGRAM" | "EMAIL_RESEND" | "DEV_INBOX"
  channel     String
  triggerType String   // "OTP" | "EXPIRY_7D" | "PAYMENT_RECEIPT" | "TRAINER_CANCEL" | "CHURN_NUDGE"
  subject     String?
  payload     String
  status      String   @default("SENT")
  isRead      Boolean  @default(false)
  sentAt      DateTime @default(now())
}

// Free Local RAG Knowledge Store (Replaces paid Pinecone)
model KnowledgeChunk {
  id            String   @id @default(uuid())
  sourceTitle   String   // e.g., "Gym Policies", "Pricing & Plans"
  content       String
  embeddingJson String?  // Stored float array for local cosine similarity (or pgvector on Postgres)
  updatedAt     DateTime @updatedAt
}

model AIInteractionLog {
  id                String   @id @default(uuid())
  userId            String?
  user              User?    @relation(fields: [userId], references: [id])
  userPrompt        String
  intentType        String
  domActionTaken    Boolean  @default(false)
  actionPayloadJson String?
  createdAt         DateTime @default(now())
}

model AuditLog {
  id           String   @id @default(uuid())
  actorId      String
  branchId     String?
  action       String   // e.g., "GATE_OVERRIDE", "CARD_REPLACED", "SLOT_DELETED"
  entityType   String
  entityId     String
  metadataJson String
  createdAt    DateTime @default(now())

  @@index([branchId, createdAt])
}
~~~