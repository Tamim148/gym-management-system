# 03. Database Migrations Strategy & Playbook
**Project:** Vintage Aesthetics Gym Management System  
**Environments:** Local SQLite -> Neon `dev` -> Neon `staging` -> Neon `main` (Production)  
**Tooling:** Prisma Migrate + GitHub Actions CI + Neon Free Branch Snapshots ($0)  
**Version:** 2.1

---

## 1. Environment-to-Migration Flow (Enterprise SDLC for $0)

| Environment | Git Branch | Database Target | Command Executed | Who Runs It |
| :--- | :--- | :--- | :--- | :--- |
| **Local PC** | `feature/*` | Local SQLite (`file:./dev.db`) | `npx prisma migrate dev --name <desc>` | Developer / Antigravity Agent |
| **Cloud Dev** | `dev` | Neon Free Branch: `dev` | `npx prisma migrate deploy` | GitHub Actions CI |
| **Cloud Staging** | `staging` | Neon Free Branch: `staging` | `npx prisma migrate deploy` | GitHub Actions CI (plus k6 load test) |
| **Production** | `main` | Neon Free Branch: `main` | `npx prisma migrate deploy` | GitHub Actions CI (after PR approval) |

> **Golden Rule:** NEVER run `prisma migrate dev` or `prisma db push --force-reset` against `staging` or `main`. Production and Staging only ever run `npx prisma migrate deploy`, which applies version-controlled SQL files strictly in order.

---

## 2. Standard Migration File Structure

Prisma generates timestamped folders under `prisma/migrations/`. Commit every folder to Git:

~~~text
prisma/
├── schema.prisma
├── seed.ts
└── migrations/
    ├── migration_lock.toml
    ├── 20261126090000_init_vintage_aesthetics_core/
    │   └── migration.sql
    ├── 20261128143000_add_feature_flags_and_audit/
    │   └── migration.sql
    └── 20261202100000_pgvector_and_rls_postgres_only/
        └── migration.sql
~~~

---

## 3. Day-to-Day PowerShell Commands (Beginner Cheat Sheet)

### First-Time Local Setup (Zero-Setup SQLite)
~~~powershell
# 1. Verify .env has DATABASE_URL="file:./dev.db"
# 2. Create the initial migration and build dev.db
npx prisma migrate dev --name init_vintage_aesthetics_core

# 3. Generate TypeScript Prisma Client
npx prisma generate

# 4. Seed the 3 Dhaka branches, trainers, test members, and festival offers
npx prisma db seed

# 5. Visually inspect your tables in the browser (Free built-in GUI)
npx prisma studio
~~~

### Making a Safe Schema Change on a Feature Branch
~~~powershell
git checkout dev
git pull origin dev
git checkout -b feature/add-member-blood-group

# Edit prisma/schema.prisma, then generate & test migration:
npx prisma migrate dev --name add_member_blood_group

# Verify migration status is clean
npx prisma migrate status
~~~

### Switching from Local SQLite to Neon Free PostgreSQL (Phase 5 Cloud Launch)
Because SQLite migration SQL syntax differs slightly from PostgreSQL DDL (e.g., `DATETIME` vs `TIMESTAMP(3)`), follow this clean cutover once when moving to Neon Free Postgres:
1. Update `datasource db` in `prisma/schema.prisma` to `provider = "postgresql"`.
2. Archive local SQLite migrations to `prisma/migrations_sqlite_archive/` and update `migration_lock.toml` (or delete the old lock file so Prisma creates a fresh PostgreSQL baseline).
3. Point `.env` `DATABASE_URL` to your **Neon `dev` branch** connection string (with `?sslmode=require`).
4. Run `npx prisma migrate dev --name init_postgres_baseline`.
5. Apply the `pgvector` and RLS SQL migrations (`04_rls_policies.md`) as a custom `--create-only` Prisma migration:
   ~~~powershell
   npx prisma migrate dev --create-only --name enable_pgvector_and_rls
   # Paste SQL from docs/database/04_rls_policies.md into the generated migration.sql
   npx prisma migrate dev
   ~~~

---

## 4. Zero-Downtime "Expand & Contract" Rules

Never run destructive changes directly on a live database with 500+ active gym members:

1. **Renaming a Column (e.g., `phone` to `mobilePhone`):**
   * *Migration 1 (Expand):* Add nullable `mobilePhone`, write to both columns in NestJS, and backfill existing rows.
   * *Migration 2 (Contract):* After verifying all apps read `mobilePhone`, drop the old `phone` column in a later release.
2. **Adding a Required Column:** Always provide a `@default(...)` value or add it nullable first, backfill via script, and then mark `NOT NULL`.
3. **Never Delete Audit History:** Instead of hard-deleting members who leave the gym, set `User.status = 'INACTIVE'` so `Transaction` and `AttendanceLog` foreign keys stay intact for tax and revenue reports.

---

## 5. Free Instant Rollback Strategy (Neon Point-in-Time Branching)

Instead of writing risky `DROP COLUMN` rollback scripts, use **Neon Free Branching**:
1. Before deploying a major migration to `main`, create a zero-cost backup branch in Neon (`backup-pre-release-v1`)—takes under 2 seconds and uses copy-on-write storage.
2. If a production migration fails or introduces a critical bug:
   * Restore `main` from `backup-pre-release-v1` in the Neon dashboard, **or**
   * Mark a failed migration rolled back via `npx prisma migrate resolve --rolled-back <migration_name>` and deploy a fixed hotfix migration from a `hotfix/*` branch.

---

## 6. Automated GitHub Actions Migration Verification (`.github/workflows/db-ci.yml`)

~~~yaml
name: Database Migration & Seed Verification

on:
  pull_request:
    branches: [dev, staging, main]
    paths:
      - "prisma/**"
      - "docs/database/**"

jobs:
  verify-migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - name: Validate Prisma Schema
        run: npx prisma validate
      - name: Run Clean Migration & Seed on Ephemeral SQLite
        env:
          DATABASE_URL: "file:./ci_test.db"
        run: |
          npx prisma migrate deploy
          npx prisma db seed
          npx prisma migrate status
~~~