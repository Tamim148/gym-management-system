# Implementation Plan & Rollout Roadmap — Zero-Cost Edition
**Project:** Multi-Branch Gym Management & Member Engagement Ecosystem  
**Budget:** 100% Free (Open-Source + Permanent Free Tiers, Zero Hardware Purchase)  
**Target Timeline:** 10–12 Weeks (Acceleratable to Days/Weeks via Antigravity Multi-Agents)  
**Version:** 2.0  

---

## 1. Phased Delivery Roadmap (Zero-Cost Stack)

| Phase | Timeline | Focus & Deliverables | Exit Criteria |
| :--- | :--- | :--- | :--- |
| **Phase 0: Zero-Setup Local Foundation** | Week 1 | Monorepo (`apps/api`, `apps/web`), SQLite + Prisma schema, Seed Data (3 branches, sample trainers, active/overdue/frozen members, equipment, festival offers), JWT Auth & RBAC guards. | `npm run dev` boots full stack locally with zero external paid accounts. |
| **Phase 1: Core Ops & Virtual Hardware Simulator** | Weeks 2–3 | Member/Trainer onboarding (KYC + Canvas Waiver), Virtual Turnstile & Offline Outage Simulator (`/simulator`), Webcam QR Scanner (`html5-qrcode`), Front-Desk Live Access Dashboard (Socket.IO), Denied-Entry Override Modal, Replacement Card Ticket flow. | Simulated tap denies unpaid user in $\le 200\text{ ms}$; offline toggle buffers logs and syncs cleanly; override logs audit trail. |
| **Phase 2: Mock Billing, Promo Engine & Free Alerts** | Weeks 4–5 | Subscription tiers, Split/Partial payment tracking, Membership freezes, **Mock Payment Gateway** (simulates bKash, Nagad, Cards + IPN callback), Admin Festival Campaign & Promo Code Engine, PDF invoices, Free Notification Hub (`node-cron`, Socket.IO, Web Push, Telegram Bot, `/dev-inbox` previewer). | End-to-end mock bKash checkout activates membership and opens virtual turnstile automatically; receipt appears in `/dev-inbox`. |
| **Phase 3: Trainer Scheduling & Member Mobile PWA** | Weeks 6–7 | Trainer Schedule CRUD (conflict prevention + buffer times), Member Class/PT Booking, Automated Waitlist Queue, Dynamic Off-Peak Pricing badges, Live Occupancy Gauge, Installable Next.js PWA (`manifest.json` + Service Worker), Trainer Meal Plans & Commission tracker. | PWA installs on Android/iOS Home Screen for free and runs full booking, waitlist, and cancellation loops. |
| **Phase 4: Free AI Concierge, Churn & Virtual IoT** | Weeks 8–9 | Free RAG Client-Side AI Chatbot (**Gemini Free Tier** or **Ollama** + local `KnowledgeChunk` vector search, plus rule-based fallback if no key is set), Daily Churn Risk job (`node-cron`), Virtual Smart Locker grid, QR Broken Equipment reporting. | AI assistant navigates and books a class; scanning a generated equipment QR code marks machine `OUT_OF_ORDER` for trainers. |
| **Phase 5: Free Live Cloud Deployment & QA** | Weeks 10–12 | Switch Prisma `DATABASE_URL` to **Neon Free PostgreSQL** (`pgvector` + `pg-boss`), deploy Next.js PWA to **Vercel Hobby**, deploy NestJS API to **Render Free Web Service**, configure **Resend Free Tier** & **Supabase Storage Free**, run full automated QA suite. | Live public URL works across desktop and mobile phones at zero monthly cost. |

---

## 2. Antigravity Multi-Agent Execution Mapping

* **Orchestrator Agent:** Owns `prisma/schema.prisma`, `prisma/seed.ts`, shared TypeScript DTOs (`packages/shared`), API contracts, and code review gating.
* **Agent 1 (Backend & Free Jobs Agent):** Owns `apps/api` (NestJS modules, Socket.IO gateway, `node-cron` / `pg-boss` workers, Mock Payment IPN controller, Free Notification dispatcher).
* **Agent 2 (Frontend Web & Mobile PWA Agent):** Owns `apps/web` (Next.js App Router, Tailwind CSS, PWA manifest, Front-Desk Live Dashboard, Admin Command Center, Member & Trainer Mobile UIs).
* **Agent 3 (AI, Simulator & QA Agent):** Owns `/simulator` (Virtual Turnstile, Offline Mode Toggle, Smart Lockers, `html5-qrcode` Scanner), `/dev-inbox`, Gemini Free Tier / Ollama RAG service, and automated Playwright/Jest tests.

---

## 3. Zero-Cost Verification & Testing Protocol

1. **Simulated Offline Chaos Test:** Toggle **"Simulate Branch Offline"** in `/simulator` $\rightarrow$ tap 10 active/unpaid virtual cards $\rightarrow$ perform 2 manual overrides $\rightarrow$ toggle Branch back Online $\rightarrow$ verify $100\%$ of queued records reconcile with zero duplicates.
2. **Mock IPN Payment Reconciliation Test:** Trigger `"Simulate Browser Drop (IPN Delayed)"` in Mock bKash checkout $\rightarrow$ verify webhook transitions `Transaction` to `CLEARED` and immediately unlocks virtual gate access.
3. **Webcam QR Equipment Test:** Display a seeded treadmill QR sticker on screen $\rightarrow$ scan it using phone/webcam $\rightarrow$ verify ticket pops onto Front-Desk Kanban and flags `OUT_OF_ORDER` on Trainer class view.
4. **RBAC Security Test:** Attempt cross-branch financial mutation using a Branch A Front-Desk JWT and confirm `403 Forbidden`.