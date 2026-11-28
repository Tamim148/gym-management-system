# Vintage Aesthetics Gym — Workspace Guardrails

## 1. Source of Truth
Always consult the specification documents before designing schemas, APIs, or UI:
- Product & Architecture: `docs/01_trd.md` through `docs/06_prd.md`
- Database: `docs/database/01_data_model.md` through `05_seed_data.md`
- Security: `docs/security/01_security.md` through `05_security_checklist.md`

## 2. Strict $0 Zero-Cost Stack Rules
- NEVER introduce paid services, Pinecone, paid Redis, paid SMS/WhatsApp APIs, or paid payment gateways.
- Database: Neon Free PostgreSQL (`DATABASE_URL` pooled for runtime, `DIRECT_URL` unpooled for Prisma migrations) + `pgvector` for AI RAG.
- Backend: NestJS (TypeScript) + Prisma ORM + Socket.IO + `node-cron` / `pg-boss`.
- Frontend: Next.js (App Router) + Tailwind CSS + installable PWA (covers Desktop Reception/Admin + Mobile Member/Trainer).
- AI Concierge: Google Gemini API Free Tier (`GEMINI_API_KEY`) with automatic local Mock fallback if no key is configured.
- Hardware & Payments: Built-in `/simulator` page (RFID tap + Smart Locker + Webcam QR via `html5-qrcode`) and Mock Checkout (bKash, Nagad, Card, Cash, Split payments).

## 3. Brand Identity — Vintage Aesthetics Gym
- Logo path: `apps/web/public/images/logo.jpg` (real gym photography: `hero-floor.jpg`, `red-led-rack.jpg`, `strength-station.jpg`, `power-rack-detail.jpg` under `apps/web/public/images/`)
- Palette: Oxblood `#7F1118` (deep `#560A0F`), Crimson `#DC1E26` (hover `#B9161D`), Obsidian `#0A0A0C`, Iron Charcoal `#141418`, Steel `#27272A`, Chrome `#A1A1AA` / `#D4D4D8`, Chalk `#FAFAFA`.
- Status separation: Emerald `#10B981` (Granted), Amber `#F59E0B` (Waitlist/Partial/Off-Peak), Pulsing Danger `#FF2A3B` + Lock Icon (Access Denied).
- Fonts: `Barlow Condensed` (headings/KPIs) + `Plus Jakarta Sans` (body/tables with tabular numerals) + `Noto Sans Bengali` fallback.

## 4. Security & Git Rules
- Enforce Data Access Layer (DAL) + NestJS RBAC Guards + Neon PostgreSQL RLS on all mutations (never rely on Next.js middleware alone).
- Encrypt PAR-Q health data with AES-256-GCM; strip EXIF metadata from uploads; never commit `.env` or secrets.
- Always work on feature branches off `dev`. Never push directly to `main`.
- Before or on every push from any branch, add a brief, plain-language entry (for both technical and non-technical readers) to the top of `DailyLogs.md`.
- After every major change, run local verification (`npm run lint`, `npm run build`, and tests) before reporting done.

## 5. Multi-Agent Architecture & Strict Ownership Boundaries
Never combine Backend and Security into one role. Every change must respect strict single-function domain ownership:
1. **`Frontend PWA Engineer`** — **SOLE owner** of all UI/UX design, Tailwind CSS, design tokens, navigation, layouts, responsive breakpoints, and every screen/component in `apps/web/**` (excluding `apps/web/next.config.ts` security headers & `apps/web/src/lib/dal.ts` auth boundary rules owned/reviewed with `Security Engineer`). Must NEVER edit `apps/api/**` or `prisma/**`.
2. **`Backend Engineer`** — Dedicated owner of `apps/api/**` business logic, NestJS controllers/services, `prisma/**` schemas/queries, Socket.IO real-time events, `node-cron` jobs, Mock Payment endpoints, and `/simulator` backend APIs. Must NEVER edit CSS, layout shells, or UI components in `apps/web/**`.
3. **`Security Engineer`** — Dedicated owner of Authentication (`apps/api/src/modules/auth/**`), RBAC/BranchScope Guards, DAL enforcement (`apps/web/src/lib/dal.ts`), Neon PostgreSQL RLS policies (`prisma/migrations/*rls*`), AES-256-GCM PAR-Q encryption, EXIF stripping, CSP/security headers (`apps/web/next.config.ts`, `apps/api/src/main.ts`), AI Concierge prompt-injection guards, and security/abuse-case test suites (`apps/api/test/**`).

### Cross-Agent Handoff Rules
- Missing API fields needed by the UI (e.g., staffed hours, coach bios, live occupancy percentages, branch tour leads) -> route a typed contract ticket to **`Backend Engineer`** (via `packages/shared`) rather than letting `Frontend PWA Engineer` touch `apps/api/**`.
- New public forms (e.g., Free Pass / Branch Tour lead capture), updated auth flows, new frontend routes, or CSP updates -> route a security review ticket to **`Security Engineer`** to verify rate limiting, input validation, RBAC/DAL guards, and CSP rules.