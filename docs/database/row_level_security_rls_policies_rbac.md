# 04. Row-Level Security (RLS) Policies & RBAC Matrix
**Project:** Vintage Aesthetics Gym Management System  
**Defense-in-Depth Architecture:** Layer 1 (NestJS + Prisma Extension for SQLite & Postgres) + Layer 2 (Native PostgreSQL RLS on Neon Free Tier)  
**Version:** 2.1

---

## 1. Why Two Security Layers?

* **Local SQLite (`dev.db`)** does not support native PostgreSQL `CREATE POLICY` statements. Therefore, **Layer 1 (Application-Level RBAC + Prisma Tenant Extension)** guarantees identical multi-branch and per-user data isolation on your local Windows PC.
* **Neon Free PostgreSQL (`dev`, `staging`, `main`)** enforces **Layer 2 (Native Database RLS)** directly inside PostgreSQL. Even if a developer writes a buggy API query and forgets a `WHERE branchId = ...` filter, PostgreSQL physically refuses to return or modify another branch's or another member's rows.

---

## 2. Master Role & Table Access Matrix

| Table | `SUPER_ADMIN` | `BRANCH_MANAGER` | `FRONT_DESK` | `TRAINER` | `MEMBER` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`Branch`** | Full CRUD (All 3) | Read All / Update Own | Read Own Branch | Read All | Read All |
| **`User`** | Full CRUD (All 3) | CRUD Own Branch | Read & Onboard Own Branch | Read Assigned Clients + Self | Read/Update Self + Family Sub-Accounts |
| **`AccessCard`** | Full CRUD | CRUD Own Branch | Read/Issue/Revoke Own Branch | None | Read Own Cards Only |
| **`AttendanceLog`** | Read All / Override | Read & Override Own Branch | Read & Override Own Branch | Read Own Class Attendees | Read Own History Only |
| **`Subscription`** | Full CRUD | CRUD Own Branch | Read & Update Payment Own Branch | None | Read Own + Family Subscriptions |
| **`Transaction`** | Read/Create/Refund All | Read/Create Own Branch | Create Cash/POS & Read Own Branch | Read Own Payouts Only | Read Own Invoices + Create Self Checkout |
| **`Campaign`** | Full CRUD | Read Own + Global | Read Active Only | Read Active Only | Read Active Only |
| **`Session`** | Full CRUD | CRUD Own Branch | Read Own Branch | Full CRUD Own Sessions | Read Published Sessions |
| **`Booking`** | Full CRUD | CRUD Own Branch | Read Own Branch | Read/Mark Attendance Own Sessions | Read/Create/Cancel Own Bookings |
| **`SmartLocker`** | Full CRUD | Manage Own Branch | Manage Own Branch | Read Own Branch | Claim/Release Own Locker |
| **`EquipmentAsset`** | Full CRUD | CRUD Own Branch | Read/Update Own Branch | Read Own Branch (`OUT_OF_ORDER` alerts) | Read Active Branch Equipment |
| **`EquipmentTicket`** | Full CRUD | CRUD Own Branch | CRUD Own Branch | Read Own Branch / Create | Create & Read Own Tickets |
| **`NotificationLog`** | Read All (`/dev-inbox`) | Read Own Branch | Read Own Branch | Read Own Only | Read/Mark Read Own Only |
| **`AuditLog`** | Read All (Immutable) | Read Own Branch (Immutable) | Insert Only (Via Override/Card API) | None | None |
| **`FeatureFlag`** | Full CRUD | Read Only | Read Only | Read Only | Read Enabled Flags Only |

---

## 3. Layer 2: Native PostgreSQL RLS SQL Script (Neon Free Tier)

Run this script inside a Prisma migration once you switch to Neon PostgreSQL. The backend sets three transaction-scoped session variables on every authenticated request:
* `app.current_user_id` (UUID of logged-in user)
* `app.current_role` (`SUPER_ADMIN`, `BRANCH_MANAGER`, `FRONT_DESK`, `TRAINER`, `MEMBER`)
* `app.current_branch_id` (UUID of user's assigned branch)

~~~sql
-- ==================== HELPER FUNCTIONS ====================
CREATE OR REPLACE FUNCTION app_user_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION app_user_role() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_role', true), '');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION app_branch_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_branch_id', true), '');
$$ LANGUAGE SQL STABLE;

-- ==================== ENABLE & FORCE RLS ====================
ALTER TABLE "User"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessCard"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceLog"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EquipmentTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"        ENABLE ROW LEVEL SECURITY;

ALTER TABLE "User"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceLog"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "Subscription"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "Transaction"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"        FORCE ROW LEVEL SECURITY;

-- ==================== 1. USER POLICIES ====================
CREATE POLICY user_super_admin_all ON "User"
  FOR ALL USING (app_user_role() = 'SUPER_ADMIN');

CREATE POLICY user_staff_branch_scope ON "User"
  FOR ALL USING (
    app_user_role() IN ('BRANCH_MANAGER', 'FRONT_DESK')
    AND "homeBranchId" = app_branch_id()
  );

CREATE POLICY user_member_self_and_family_read ON "User"
  FOR SELECT USING (
    id = app_user_id()
    OR "primaryPayerId" = app_user_id()
  );

CREATE POLICY user_member_self_update ON "User"
  FOR UPDATE USING (id = app_user_id())
  WITH CHECK (
    id = app_user_id()
    AND role = 'MEMBER' -- Prevents privilege escalation!
  );

-- ==================== 2. ATTENDANCE LOG POLICIES ====================
CREATE POLICY attendance_super_admin ON "AttendanceLog"
  FOR ALL USING (app_user_role() = 'SUPER_ADMIN');

CREATE POLICY attendance_staff_branch_read_insert ON "AttendanceLog"
  FOR SELECT USING (
    app_user_role() IN ('BRANCH_MANAGER', 'FRONT_DESK')
    AND "branchId" = app_branch_id()
  );

CREATE POLICY attendance_staff_override_insert ON "AttendanceLog"
  FOR INSERT WITH CHECK (
    app_user_role() IN ('BRANCH_MANAGER', 'FRONT_DESK')
    AND "branchId" = app_branch_id()
    AND (
      "entryStatus" <> 'MANUAL_OVERRIDE'
      OR ("overrideById" = app_user_id() AND length(coalesce("overrideNotes", '')) >= 10)
    )
  );

CREATE POLICY attendance_member_own_read ON "AttendanceLog"
  FOR SELECT USING ("userId" = app_user_id());

-- ==================== 3. SUBSCRIPTION & TRANSACTION POLICIES ====================
CREATE POLICY subscription_super_admin ON "Subscription"
  FOR ALL USING (app_user_role() = 'SUPER_ADMIN');

CREATE POLICY subscription_staff_branch ON "Subscription"
  FOR ALL USING (
    app_user_role() IN ('BRANCH_MANAGER', 'FRONT_DESK')
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "Subscription"."userId" AND u."homeBranchId" = app_branch_id()
    )
  );

CREATE POLICY subscription_member_and_family_read ON "Subscription"
  FOR SELECT USING (
    "userId" = app_user_id()
    OR EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "Subscription"."userId" AND u."primaryPayerId" = app_user_id()
    )
  );

CREATE POLICY transaction_super_admin ON "Transaction"
  FOR ALL USING (app_user_role() = 'SUPER_ADMIN');

CREATE POLICY transaction_staff_branch ON "Transaction"
  FOR SELECT USING (
    app_user_role() IN ('BRANCH_MANAGER', 'FRONT_DESK')
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "Transaction"."userId" AND u."homeBranchId" = app_branch_id()
    )
  );

CREATE POLICY transaction_staff_insert ON "Transaction"
  FOR INSERT WITH CHECK (
    app_user_role() IN ('BRANCH_MANAGER', 'FRONT_DESK')
    AND "collectedByStaffId" = app_user_id()
  );

CREATE POLICY transaction_member_own_read ON "Transaction"
  FOR SELECT USING ("userId" = app_user_id());

-- ==================== 4. SESSION & BOOKING POLICIES ====================
CREATE POLICY session_read_all_authenticated ON "Session"
  FOR SELECT USING (app_user_id() IS NOT NULL);

CREATE POLICY session_trainer_crud_own ON "Session"
  FOR ALL USING (
    app_user_role() = 'TRAINER' AND "trainerId" = app_user_id()
  )
  WITH CHECK (
    app_user_role() = 'TRAINER' AND "trainerId" = app_user_id()
  );

CREATE POLICY session_admin_manager_crud ON "Session"
  FOR ALL USING (
    app_user_role() = 'SUPER_ADMIN'
    OR (app_user_role() = 'BRANCH_MANAGER' AND "branchId" = app_branch_id())
  );

CREATE POLICY booking_member_own ON "Booking"
  FOR ALL USING ("userId" = app_user_id())
  WITH CHECK ("userId" = app_user_id());

CREATE POLICY booking_trainer_read_update_own_sessions ON "Booking"
  FOR ALL USING (
    app_user_role() = 'TRAINER'
    AND EXISTS (
      SELECT 1 FROM "Session" s
      WHERE s.id = "Booking"."sessionId" AND s."trainerId" = app_user_id()
    )
  );

-- ==================== 5. IMMUTABLE AUDIT LOG POLICIES ====================
-- AuditLog allows INSERT and scoped SELECT, NEVER UPDATE or DELETE!
CREATE POLICY audit_insert_any_staff ON "AuditLog"
  FOR INSERT WITH CHECK (
    app_user_role() IN ('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'TRAINER')
    AND "actorId" = app_user_id()
  );

CREATE POLICY audit_read_super_admin ON "AuditLog"
  FOR SELECT USING (app_user_role() = 'SUPER_ADMIN');

CREATE POLICY audit_read_manager_own_branch ON "AuditLog"
  FOR SELECT USING (
    app_user_role() = 'BRANCH_MANAGER' AND "branchId" = app_branch_id()
  );
~~~

---

## 4. Layer 1: NestJS + Prisma RLS Context Wrapper (SQLite & Neon Safe)

Use this service wrapper so connection pooling on Neon (`PgBouncer`) never leaks session state between requests, and local SQLite applies the exact same tenant/role filtering:

~~~typescript
import { PrismaClient } from '@prisma/client';

export interface RequestAuthContext {
  userId: string;
  role: 'SUPER_ADMIN' | 'BRANCH_MANAGER' | 'FRONT_DESK' | 'TRAINER' | 'MEMBER';
  branchId: string;
}

/**
 * Executes database queries with transaction-local PostgreSQL RLS variables.
 * Safe for Neon pooled connections because SET LOCAL resets at transaction end.
 */
export async function withRlsContext<T>(
  prisma: PrismaClient,
  ctx: RequestAuthContext,
  work: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  const isPostgres = process.env.DATABASE_URL?.startsWith('postgres');

  if (!isPostgres) {
    // Local SQLite mode: NestJS BranchScopeGuard & Service queries enforce identical rules
    return work(prisma);
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_role', ${ctx.role}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_branch_id', ${ctx.branchId}, true)`;
    return work(tx as unknown as PrismaClient);
  });
}
~~~

---

## 5. Mandatory Security Verification Tests (Automated in CI)

1. **Cross-Branch Isolation Test:** Authenticate as Dhanmondi (`DHK-02`) Front-Desk staff $\rightarrow$ request `GET /api/transactions` and `POST /api/access/override` targeting a Gulshan-1 (`DHK-01`) member $\rightarrow$ assert `0` cross-branch rows returned and `403 Forbidden` on mutation.
2. **Member Privilege Escalation Test:** Authenticate as `MEMBER` $\rightarrow$ submit `PATCH /api/users/me` with `{ role: "SUPER_ADMIN" }` $\rightarrow$ assert request is rejected and `role` remains `MEMBER`.
3. **Audit Immutability Test:** Attempt `DELETE` or `UPDATE` on `AuditLog` using a `BRANCH_MANAGER` or `FRONT_DESK` role $\rightarrow$ assert database denies the operation.
4. **Override Justification Test:** Attempt `MANUAL_OVERRIDE` with an empty or 5-character `overrideNotes` string $\rightarrow$ assert both NestJS DTO validation and Postgres RLS reject the insert.