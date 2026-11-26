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
- Logo path: `apps/web/public/images/logo.png`
- Palette: Oxblood `#7F1118`, Crimson `#DC1E26` (hover `#B9161D`), Obsidian `#0A0A0C`, Iron Charcoal `#141418`, Steel `#27272A`, Chrome `#A1A1AA`, Chalk `#FAFAFA`.
- Status separation: Emerald `#10B981` (Granted), Amber `#F59E0B` (Waitlist/Partial), Pulsing Danger `#FF2A3B` + Lock Icon (Access Denied).
- Fonts: `Barlow Condensed` (headings/KPIs) + `Plus Jakarta Sans` (body/tables with tabular numerals).

## 4. Security & Git Rules
- Enforce Data Access Layer (DAL) + NestJS RBAC Guards + Neon PostgreSQL RLS on all mutations (never rely on Next.js middleware alone).
- Encrypt PAR-Q health data with AES-256-GCM; strip EXIF metadata from uploads; never commit `.env` or secrets.
- Always work on feature branches off `dev`. Never push directly to `main`.
- After every major change, run local verification (`npm run lint`, `npm run build`, and tests) before reporting done.