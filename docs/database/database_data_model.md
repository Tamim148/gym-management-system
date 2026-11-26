# 01. Database Data Model — Vintage Aesthetics Gym
**Project:** Multi-Branch Gym Management & Member Engagement Ecosystem  
**Brand:** Vintage Aesthetics Gym (3 Dhaka Branches | 500+ Members)  
**Storage Engines:** Local SQLite (Zero-Setup Dev) / Neon Free PostgreSQL (Cloud Dev, Staging, Prod)  
**Version:** 2.1 (Zero-Cost Enterprise SDLC Edition)

---

## 1. Architectural Modeling Principles

1. **Multi-Branch Isolation by Design:** Every operational record (`User`, `AttendanceLog`, `Session`, `SmartLocker`, `EquipmentAsset`, `AuditLog`) is anchored to a `Branch` (`branchId` or `homeBranchId`). Super Admins aggregate across all 3 branches, while Branch Managers and Front-Desk staff are strictly scoped to their assigned branch.
2. **Offline-First Distributed Identity:** Every primary key across all 18 tables uses a **UUID v4** (`id: String`) rather than auto-incrementing integers. Combined with `syncVersion` and `updatedAt` timestamps, simulated or real offline branch check-ins and manual gate overrides reconcile cleanly with zero ID collisions.
3. **Immutable Financial & Security Ledgers:** `Transaction`, `AttendanceLog`, and `AuditLog` are append-only operational records. Refunds, card replacements, and gate overrides create new linked entries rather than overwriting historical evidence.
4. **Zero-Cost Vector & Flag Storage:** Instead of paid external SaaS tools (Pinecone or LaunchDarkly), AI knowledge embeddings live in `KnowledgeChunk` and production rollouts are controlled via `FeatureFlag`.

---

## 2. Logical Entity-Relationship Diagram (ERD)

~~~mermaid
erDiagram
    Branch ||--o{ User : "home_branch"
    Branch ||--o{ AttendanceLog : "logs_entry"
    Branch ||--o{ Session : "hosts"
    Branch ||--o{ Campaign : "targets_optional"
    Branch ||--o{ SmartLocker : "contains"
    Branch ||--o{ EquipmentAsset : "owns"

    User ||--o{ User : "family_primary_payer"
    User ||--o{ AccessCard : "holds"
    User ||--o{ Subscription : "subscribes"
    User ||--o{ Transaction : "pays"
    User ||--o{ AttendanceLog : "checks_in"
    User ||--o{ AttendanceLog : "staff_override"
    User ||--o{ Session : "trains"
    User ||--o{ Booking : "reserves"
    User ||--o| SmartLocker : "claims"
    User ||--o{ EquipmentTicket : "reports"
    User ||--o{ NotificationLog : "receives"
    User ||--o{ AIInteractionLog : "asks"

    MembershipPlan ||--o{ Subscription : "defines_tier"
    Campaign ||--o{ Transaction : "discounts"
    Session ||--o{ Booking : "fills_or_waitlists"
    EquipmentAsset ||--o{ EquipmentTicket : "tracks_faults"
~~~

---

## 3. Domain-by-Domain Entity Dictionary

### Domain A: Multi-Branch Organization & Identity

| Entity | Purpose | Key Relationships & Invariants |
| :--- | :--- | :--- |
| **`Branch`** | Represents each physical gym location (`DHK-01` Gulshan-1, `DHK-02` Dhanmondi, `DHK-03` Uttara). | Unique `code`. Tracks `maxOccupancy`, live `currentOccupancy`, and `edgeNodeOnline` (toggled in `/simulator` for offline outage drills). |
| **`User`** | Unified identity table for `SUPER_ADMIN`, `BRANCH_MANAGER`, `FRONT_DESK`, `TRAINER`, and `MEMBER`. | Unique `phone` and nullable unique `email`. Self-referential `primaryPayerId` enables **Family Sub-Accounts** (1 primary payer covering up to 4 dependents at $15\%$ discount). Stores trainer commission (`commissionRatePct`), `loyaltyPoints`, and daily `churnRiskScore` ($0.0 \le \text{score} \le 1.0$). |

### Domain B: Access Control & Automated Attendance

| Entity | Purpose | Key Relationships & Invariants |
| :--- | :--- | :--- |
| **`AccessCard`** | Maps a physical or virtual RFID/NFC tap card (`cardUid`) to a member. | Unique `cardUid`. Only one `ACTIVE` card should exist per member; issuing a replacement immediately marks the previous card `REPLACED`/`REVOKED` and links `replacementInvoiceId`. |
| **`AttendanceLog`** | Immutable log of every turnstile tap, QR pass scan, denial, and Front-Desk override. | Links `userId` (member) and `branchId`. If `entryStatus = MANUAL_OVERRIDE`, `overrideById`, `overrideReason`, and `overrideNotes` (minimum $10$ characters) are mandatory at the application layer. |

### Domain C: Billing, Subscriptions & Festival Marketing

| Entity | Purpose | Key Relationships & Invariants |
| :--- | :--- | :--- |
| **`MembershipPlan`** | Catalog of gym tiers (`All-Access VIP`, `Monthly Standard`, `Off-Peak Saver`, `10-Session PT Pack`). | Controls cross-branch access via `roamingEnabled` and yield management via `offPeakOnly`, `offPeakStartHour`, and `offPeakEndHour`. |
| **`Subscription`** | Active or historical membership contract for a member. | Tracks `totalAmountBdt`, `paidAmountBdt`, and `dueAmountBdt` ($\text{due} = \text{total} - \text{paid}$) to support split/partial payments, 7-day grace periods, PT `remainingCredits`, and `frozenFrom`/`frozenUntil` pauses. |
| **`Campaign`** | Admin-created seasonal promotions (e.g., *Eid Iron Blast* `EID20`). | Unique `promoCode`. Nullable `branchId`: `NULL` applies globally across all 3 branches; non-null restricts promo to one branch. Enforces `redemptionCount <= maxRedemptions`. |
| **`Transaction`** | Financial ledger for Mock bKash, Mock Nagad, Mock Card, Cash, POS, Card Replacement fees, and Refunds. | Unique `invoiceNumber`. Links optional `campaignId` and `collectedByStaffId` for reception cash reconciliation. |

### Domain D: Trainer Scheduling & Waitlist Queue

| Entity | Purpose | Key Relationships & Invariants |
| :--- | :--- | :--- |
| **`Session`** | Trainer-managed 1-on-1 PT slots, Group Classes, or Open Availability blocks. | Scoped to `trainerId` and `branchId`. Application conflict guard prevents overlapping `startTime`--`endTime` for the same trainer or `zoneName` (plus configurable buffer minutes). Supports `isOffPeakDeal` and `offPeakPriceBdt`. |
| **`Booking`** | Member seat reservation or automated waitlist position for a `Session`. | Composite unique constraint `(sessionId, userId)` prevents duplicate bookings. When confirmed seats equal `Session.maxCapacity`, new bookings enter as `WAITLISTED` with ascending `waitlistOrder` ($1, 2, 3, \dots$). |

### Domain E: Facility IoT Simulation, Notifications & Free AI RAG

| Entity | Purpose | Key Relationships & Invariants |
| :--- | :--- | :--- |
| **`SmartLocker`** | Digital/virtual RFID locker compartment inside a branch. | Composite unique `(branchId, lockerNumber)`. Unique `assignedUserId` enforces at most 1 active locker per checked-in member. |
| **`EquipmentAsset`** | Physical gym machines (`Treadmill #04`, `Squat Rack #02`) with scannable QR stickers. | Unique `qrCodeToken`. Status transitions to `OUT_OF_ORDER` automatically when a critical ticket is logged, alerting trainers on their class rosters. |
| **`EquipmentTicket`** | Maintenance ticket created when a member or staff member scans a broken machine's QR code. | Tracks `OPEN` -> `IN_PROGRESS` -> `RESOLVED`, reporter ID, description, and optional local/Supabase photo URL. |
| **`NotificationLog`** | Zero-cost omnichannel alert log (`IN_APP`, `WEB_PUSH`, `TELEGRAM`, `EMAIL_RESEND`, `DEV_INBOX`). | Powers both the member notification bell and the `/dev-inbox` zero-cost previewer. |
| **`KnowledgeChunk`** | Zero-cost RAG store replacing Pinecone for gym rules, pricing, and FAQs. | Stores text chunks and `embeddingJson` (cosine similarity on SQLite; native `vector(768)` via `pgvector` on Neon Postgres). |
| **`AIInteractionLog`** | Logs client-side AI Concierge prompts, detected intents, and DOM navigation actions. | Used for debugging assistant accuracy and tracking after-hours lead engagement. |

### Domain F: Governance, Audit & Release Control

| Entity | Purpose | Key Relationships & Invariants |
| :--- | :--- | :--- |
| **`AuditLog`** | Immutable security trail for high-risk actions (`GATE_OVERRIDE`, `CARD_REPLACED`, `BOOKED_SLOT_DELETED`, `PARTIAL_PAYMENT_COLLECTED`). | Indexed by `(branchId, createdAt)` for rapid Super Admin review. |
| **`FeatureFlag`** | Zero-cost production feature toggle system (replaces LaunchDarkly). | Unique `key` (e.g., `ai_concierge`, `festival_campaigns`, `smart_lockers`) with optional `branchId` override and `rolloutPct`. |

---

## 4. Critical Query Paths & Indexing Strategy

| Operational Hot Path | Target SLA | Supporting Index |
| :--- | :--- | :--- |
| Turnstile Card Tap Verification | $\le 200\text{ ms}$ | `AccessCard(cardUid)` UNIQUE + `Subscription(userId, paymentStatus)` |
| Front-Desk Live Entry Stream | $\le 150\text{ ms}$ | `AttendanceLog(branchId, scannedAt DESC)` |
| Daily Expiry & Overdue Cron Job | $\le 1\text{ s}$ | `Subscription(endDate)` + `User(status)` |
| Waitlist Auto-Promotion on Cancel | $\le 200\text{ ms}$ | `Booking(sessionId, status, waitlistOrder)` |
| Trainer Double-Booking Conflict Check | $\le 150\text{ ms}$ | `Session(trainerId, startTime)` + `Session(branchId, startTime)` |
| Super Admin Branch Audit Review | $\le 250\text{ ms}$ | `AuditLog(branchId, createdAt DESC)` |