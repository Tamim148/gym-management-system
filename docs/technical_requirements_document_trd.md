# Technical Requirements Document (TRD) — Zero-Cost Edition
**Project:** Multi-Branch Gym Management & Member Engagement Ecosystem  
**Scale:** 3 Physical Branches | 500+ Active Members | Zero-Budget Open-Source & Free-Tier Build  
**Version:** 2.0 (100% Free Stack)  

---

## 1. System Architecture Overview

The platform uses a **Zero-Cost Modular Architecture** that runs completely free on a local PC (for development and demos) and deploys for free on permanent zero-cost cloud tiers (no credit card required). It preserves the **Offline-First Edge Architecture** design using local SQLite and a built-in **Virtual Hardware Simulator** instead of requiring paid physical turnstiles or Raspberry Pi hardware.

* **Cloud / Local API Core:** NestJS backend with Socket.IO WebSockets, `node-cron` / `pg-boss` background jobs, Mock Payment Gateway webhook handler, and AI/RAG Concierge service.
* **Database Layer:** Starts on a single local **SQLite** file (zero setup) and switches cleanly to **Neon Free PostgreSQL** (1 GB permanent free tier, no credit card) with `pgvector` for live cloud demos.
* **Client Tier (Zero App Store Fees):** Responsive **Next.js Progressive Web App (PWA)** serving Desktop/Tablet portals (Super Admin & Front-Desk) and an installable Mobile App experience (iOS & Android Home Screen install for Members & Trainers), with optional **Expo Go** support for React Native testing.
* **Simulated Edge & Hardware Layer:** Dedicated `/simulator` control panel with an **Offline Mode Toggle** to test RFID card taps, turnstile lockouts, smart lockers, and real webcam/phone QR scanning (`html5-qrcode`).

~~~text
[Mobile PWA (iOS/Android Browser)]   [Web Portal (Admin / Front Desk)]   [/simulator (Virtual Hardware)]
                \                                   |                                   /
                 +-------------------------- HTTPS / Socket.IO ------------------------+
                                                    |
                                         [NestJS Core API Server]
                                       /       |         |        \
                   [SQLite (Local) OR]   [node-cron /]  [Gemini Free]  [Free Alerts:]
                   [Neon Free Postgres]  [pg-boss Jobs] [Tier / Ollama] [Web Push, Telegram,]
                   [+ pgvector RAG]                     [(Local LLM)]   [Resend / Mailpit]
                                                    |
                                     [Mock Payment Gateway + IPN Engine]
                                     (Simulates bKash, Nagad, Card, Cash)
~~~

---

## 2. Mandatory Zero-Cost Tech Stack (100% Free — No Credit Card)

| Layer | Free Technology | Cost & Limit Notes |
| :--- | :--- | :--- |
| **Backend Framework** | **NestJS** (TypeScript on Node.js 22+ LTS) + **Socket.IO** | 100% open-source. Handles REST APIs, RBAC, and live Front-Desk alerts. |
| **Database (Local Dev)** | **SQLite** (via Prisma ORM) | Zero installation; single local file on your PC. |
| **Database (Free Cloud)** | **Neon Free PostgreSQL** | Permanent free tier (1 GB storage, 100 compute hrs/mo, no credit card, never expires). |
| **Vector DB (AI RAG)** | **`pgvector`** (Postgres) or **Local SQLite/JSON Cosine Search** | 100% free open-source replacement for Pinecone. |
| **ORM & Migrations** | **Prisma ORM** | Open-source, type-safe TypeScript queries and declarative migrations. |
| **Web & Mobile Client** | **Next.js (App Router) + Tailwind CSS + PWA** *(Optional: Expo Go)* | Installs on Android/iOS home screens for free—avoids Apple and Google developer fees. |
| **Background Jobs** | **`node-cron`** (Local) or **`pg-boss`** (Postgres) | Replaces paid Redis/BullMQ for expiry reminders and waitlist promotion. |
| **Payments** | **Built-in Mock Payment Simulator** *(Optional: SSLCommerz Sandbox)* | Simulates bKash, Nagad, Cards, Cash, Split/Partial dues, and IPN webhooks with zero merchant fees. |
| **AI Concierge LLM** | **Google Gemini API Free Tier** (`gemini-3.8-flash`) or **Ollama** | Free Google AI Studio key (no card) or 100% offline local LLM via Ollama + mock fallback mode. |
| **Notifications** | **Socket.IO In-App + Web Push (VAPID) + Telegram Bot API** | 100% free unlimited phone & browser push alerts replacing paid SMS/WhatsApp APIs. |
| **Email Service** | **Mailpit** (Local Preview) / **Resend Free Tier** (Cloud) | Mailpit runs locally with zero internet; Resend gives 3,000 free emails/mo (100/day). |
| **QR & Hardware Sim** | **`html5-qrcode`** + Custom `/simulator` Web Console | Uses laptop/phone camera for real QR scanning and simulates RFID turnstiles & smart lockers. |
| **File Storage** | **Local Disk (`uploads/`)** or **Supabase Storage Free Tier** | 1 GB permanent free tier for KYC images, profile photos, and broken-equipment photos. |
| **Cloud Hosting** | **Vercel Hobby** (Frontend) + **Render Free Web Service** (Backend) | Both require no credit card (Render free tier sleeps after 15 min idle). |

---

## 3. Offline-First Simulation & Virtual Hardware Integration

* **Zero-Latency Local Decisioning:** Whether running against local SQLite or cached branch state, access verification evaluates `AccessCard.status` and `Subscription.paymentStatus` in $\le 200\text{ ms}$.
* **Virtual Turnstile & Offline Chaos Toggle:** The `/simulator` module lets admins/testers toggle **"Simulate Branch Internet Outage"** for any of the 3 branches. While offline, simulated card taps and manual overrides buffer locally in browser `IndexedDB`/local SQLite and automatically reconcile to the master database using **UUID primary keys** and `syncVersion` timestamps once online is restored.
* **Future Hardware Readiness:** Because the simulator communicates with the backend through a clean `HardwareAdapter` interface (`verifyCardTap`, `fireGateRelay`, `bindLocker`), physical TCP/IP, RS-485, or Wiegand RFID turnstiles can be plugged in later without rewriting business logic.

---

## 4. Security, Compliance & Non-Functional Requirements

* **Authentication & RBAC:** Short-lived JWT Access Tokens (15 min) + HTTP-only Refresh Tokens (7 days) with `bcrypt`/`argon2` password hashing. Strict Role-Based Access Control (`SUPER_ADMIN`, `BRANCH_MANAGER`, `FRONT_DESK`, `TRAINER`, `MEMBER`) with branch-scoped guards so Branch A staff cannot mutate Branch B ledgers.
* **Auditability:** Every Front-Desk manual gate override, partial payment collection, card replacement, and booked slot deletion writes an immutable `AuditLog` entry.
* **Performance Targets:**
  * Local Access Decision: $\le 200\text{ ms}$
  * API P95 Response: $\le 350\text{ ms}$
  * PWA Screen Time-to-Interactive (TTI): $\le 2.0\text{ seconds}$