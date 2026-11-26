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
    AND role = 'MEMBER'
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
