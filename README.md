# Vintage Aesthetics Gym — Management Ecosystem

Multi-branch gym management, automated turnstile gatekeeping, billing, trainer scheduling, and AI concierge platform built for **3 Dhaka branches** (`DHK-01` Gulshan-1, `DHK-02` Dhanmondi, `DHK-03` Uttara) at **500+ member scale** on a **$0 free-tier stack**.

---

## Architecture & $0 Free Stack

| Layer | Technology |
| :--- | :--- |
| **Monorepo** | `npm workspaces` (`packages/shared`, `apps/api`, `apps/web`) |
| **Backend API** | NestJS (TypeScript) + Prisma ORM + Helmet + Socket.IO (Step 3) |
| **Frontend PWA** | Next.js App Router + Tailwind CSS v4 (Modern Golden Era Iron palette) |
| **Database** | Neon Free PostgreSQL (`DATABASE_URL` pooled + `DIRECT_URL` unpooled) + `pgvector` + PostgreSQL RLS |
| **AI & Hardware** | Google Gemini Free Tier (with local mock fallback) + built-in `/simulator` & `html5-qrcode` |
| **CI/CD & Hosting** | GitHub Actions (`ci.yml`), Render Free Web Service (`render.yaml`), Vercel Hobby (PWA) |

---

## Monorepo Structure

```text
├── .github/workflows/ci.yml   # Secret scan, pgvector Postgres migration/seed check, lint, tests & builds
├── prisma/
│   ├── schema.prisma          # 18 Neon PostgreSQL + pgvector models
│   ├── seed.ts                # Idempotent seed for 3 branches, plans, 11 users, cards, campaigns, RAG & flags
│   └── migrations/            # Core schema, pgvector HNSW index & PostgreSQL RLS SQL migrations
├── packages/shared/           # @vintage/shared — TypeScript enums, business rules & Zod DTOs
├── apps/api/                  # @vintage/api — NestJS REST API & GET /health
├── apps/web/                  # @vintage/web — Next.js PWA (Vintage Aesthetics theme)
├── docs/                      # Product, UI/UX, Database & Security specifications
├── GEMINI.md                  # Workspace architecture, branding & security guardrails
├── render.yaml                # Render Blueprint IaC for apps/api
└── .env.example               # Environment variable template (never commit .env)
```

---

## Local Quickstart (Neon PostgreSQL)

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment:**
   Copy `.env.example` to `.env` and populate your **Neon `dev` branch** `DATABASE_URL` (pooled) and `DIRECT_URL` (unpooled), plus fresh 64-char hex secrets.
3. **Validate, generate, migrate, and seed:**
   ```bash
   npx prisma validate
   npx prisma generate
   npx prisma migrate deploy
   npx prisma db seed
   ```
4. **Verify lint, tests, and production builds:**
   ```bash
   npm run lint
   npm run test
   npm run build
   ```
5. **Run locally:**
   ```bash
   npm run dev:api   # http://localhost:4000/health
   npm run dev:web   # http://localhost:3000
   ```

---

## Seeded Demo Accounts (`Vintage@2026`)

| Role | Email | Branch | Notes |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@vintageaesthetics.gym` | All 3 (`DHK-01` home) | Full analytics, campaigns, feature flags |
| **Front-Desk** | `desk.gulshan@vintageaesthetics.gym` | Gulshan-1 (`DHK-01`) | Live access, overrides, card replacement |
| **Front-Desk** | `desk.dhanmondi@vintageaesthetics.gym` | Dhanmondi (`DHK-02`) | Cross-branch RBAC isolation fixture |
| **Trainer** | `arif.trainer@vintageaesthetics.gym` | Gulshan-1 (`DHK-01`) | Full HIIT class (`maxCapacity: 1`) |
| **Trainer** | `imran.trainer@vintageaesthetics.gym` | Dhanmondi (`DHK-02`) | Off-peak strength circuit deal |
| **Member (Active VIP)** | `farhana@demo.com` | Gulshan-1 (`DHK-01`) | 3-branch roaming (`VA-RFID-4092`) |
| **Member (Family Sub)** | `rayhan@demo.com` | Gulshan-1 (`DHK-01`) | Linked dependent (`VA-RFID-4093`) |
| **Member (Overdue)** | `tariq@demo.com` | Gulshan-1 (`DHK-01`) | 3,500 BDT unpaid (`VA-RFID-8841`) |
| **Member (Partial)** | `kamrul@demo.com` | Gulshan-1 (`DHK-01`) | 1,750 BDT due (`VA-RFID-5510`) |
| **Member (Frozen)** | `nusrat@demo.com` | Uttara (`DHK-03`) | Active travel freeze (`VA-RFID-7721`) |
| **Member (Churn Risk)** | `rafiq@demo.com` | Dhanmondi (`DHK-02`) | Churn score `0.84` (`VA-RFID-2104`) |

---

## Specifications

- [Product & Architecture Docs](docs/)
- [Database Model, Schema, Migrations, RLS & Seed](docs/database/)
- [Security Standards, Auth, Privacy, Threat Model & Checklist](docs/security/)
