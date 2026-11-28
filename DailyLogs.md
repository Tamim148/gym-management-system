# Vintage Aesthetics Gym — Daily Push Logs

A simple, plain-language record of every Git push across any branch (newest updates at the top).

---

## 2026-11-28 — Brand Redesign, Role Split & Editor Fixes

- **Branches Pushed:** `pikachu` merged into `dev`
- **What Changed:**
  - **Team Structure:** Split Backend and Security into separate specialist roles in `GEMINI.md` so Frontend, Backend, and Security each have strict file ownership.
  - **Full Visual Redesign:** Upgraded the storefront and all app portals (Login, Onboarding, Member, Trainer, Front-Desk, Admin, Simulator, Dev Inbox) with real Vintage Aesthetics Gym photos, the circular crest logo, live 3-branch crowd status, transparent BDT pricing, a Free Pass request form, and cleaner responsive styling.
  - **Backend & Security:** Added staffed hours and public coach cards to branch listings, a rate-limited Free Pass lead endpoint, strict Content-Security-Policy headers, and automated security tests.
  - **Editor & App-Folder Fixes:** Added `.vscode/settings.json` so VS Code recognizes Tailwind CSS v4 `@theme` rules and the workspace TypeScript SDK, standardized Tailwind v4 gradient/height classes across 12 frontend files, and added app favicon metadata to eliminate `/favicon.ico` 404 console errors.
- **Status:** Lint checks, full production builds (`shared`, `api`, and all 16 web routes), and all 31 automated unit, E2E, and AI tests passed.

---

## 2026-11-27 — Full Gym Ecosystem Build (Step 3)

- **Branches Pushed:** `feature/step-3-backend-api` (`660a978`), `feature/step-3-frontend-pwa` (`155c232`), `feature/step-3-simulator-ai-qa` (`e83c6f4`), and merged into `dev` (`59816e6`; merged to `main` via PRs #2–#5, `4029604`)
- **What Changed:**
  - **Backend & Security:** Built the NestJS server for secure login, branch-locked staff permissions, encrypted health waivers, instant card/QR gate checks (blocking unpaid or frozen members), front-desk manual overrides with audit logs, mock bKash/Nagad/Card payments, promo codes, trainer class scheduling with automatic waitlists, smart lockers, equipment repair tickets, and automated expiry reminders.
  - **Web & Mobile App (PWA):** Designed the branded Vintage Aesthetics Gym portals for **Front-Desk** (live entry alerts & quick payments), **Super Admin** (branch KPIs, festival campaigns, churn alerts, maintenance board), **Members** (rotating QR pass, crowd meter, class booking), and **Trainers** (schedule & class rosters).
  - **Simulator, AI & QA:** Added the `/simulator` testing console (virtual RFID taps, offline outage mode, smart lockers, webcam QR scanner), `/dev-inbox` for free email/alert previews, a floating AI Gym Assistant, and automated tests.
- **Status:** All production builds and 24 automated unit, security, booking, and AI tests passed.

---

## 2026-11-26 — Project Foundation & Database Setup (Phase 0)

- **Branch Pushed:** `feature/phase-0-foundation` (`0f213c1`; merged to `main` via PR #1, `5df3ffc`)
- **What Changed:**
  - **Project Structure:** Set up the workspace holding the backend API, web/mobile app, and shared rules on a $0 free-tier tech stack.
  - **Database Blueprint:** Created the PostgreSQL (Neon) database schema with all 18 core tables, row-level security rules, and starter sample data for the 3 Dhaka branches (Gulshan-1, Dhanmondi, Uttara), staff, trainers, and demo members.
  - **Automation & Docs:** Added GitHub Actions automated checks, Render hosting configuration, `/health` status endpoint, project specifications, and an updated `README.md`.
- **Status:** Schema validation, lint checks, unit tests, and initial builds passed.
