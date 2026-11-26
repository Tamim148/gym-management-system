# Product Requirements Document (PRD) — Zero-Cost Edition
**Project:** Multi-Branch Gym Management & Member Engagement Ecosystem  
**Target Scale:** 3 Physical Locations | 500+ Active Members  
**Platforms:** Installable Mobile PWA (iOS & Android via Browser) + Responsive Desktop Web Portal  
**Budget Constraint:** 100% Free Open-Source & Permanent Free-Tier Stack (Zero Purchases Required)  
**Version:** 2.0  

---

## 1. Product Vision & Business Goals

Deliver an all-in-one, portfolio- and production-ready fitness operating system built entirely on **100% free technologies**—demonstrating full multi-branch operations across **3 gym locations**, automated **payment-enforced gatekeeping**, **seasonal festival marketing**, **trainer scheduling & waitlists**, and **AI-assisted navigation** without requiring paid hardware, paid SMS/WhatsApp gateways, paid merchant accounts, or App Store fees.

---

## 2. Success Metrics (KPIs)

| Metric | Target |
| :--- | :--- |
| Monthly Infrastructure & Tooling Cost | **0 USD / 0 BDT** (Local SQLite or Neon + Vercel + Render Free Tiers) |
| Unpaid-dues revenue leakage (simulated/live) | Reduced by $\ge 90\%$ via automated access gatekeeping |
| Front-desk check-in & onboarding time | Reduced from ~10 min to $< 2\text{ min}$ per walk-in |
| Off-peak class utilization (1–3 PM) | Increased by $\ge 20\%$ via dynamic yield pricing |
| Member monthly churn rate | Reduced by $15\%\text{–}25\%$ via automated free expiry alerts & churn radar |

---

## 3. Role & Permission Matrix

| Capability | Super Admin | Front-Desk Staff | Trainer | Member |
| :--- | :---: | :---: | :---: | :---: |
| Multi-Branch Financial & Churn Analytics | Full | None | Own Payouts Only | None |
| Create Festival Offers & Dynamic Pricing | Full | View Only | None | Redeem Only |
| Onboard Members & Issue/Replace Virtual Cards | Full | Branch-Scoped | None | Self-Signup Only |
| Manual Gate Override (With Audit Reason) | Full | Branch-Scoped | None | None |
| Manage Schedule Slots (CRUD) | Full | View Only | Own Schedule | Book / Waitlist |
| Collect Cash / Log Partial Payments | Full | Branch-Scoped | None | Mock Pay Online |
| Access Virtual Hardware Simulator & Dev Inbox | Full | Branch-Scoped | None | QR Scan Only |

---

## 4. Functional Requirements & Acceptance Criteria

### FR-1: Member & Trainer Onboarding
* **Requirement:** Support digital self-registration (PWA) and rapid Front-Desk walk-in registration with photo/KYC upload (local disk / Supabase Free), emergency contact, digital PAR-Q waiver signature, and Family Sub-Accounts.
* **Acceptance Criteria:** *Given* a new member completes signup and clicks `Simulate Success` on the Mock bKash Checkout, *When* the mock IPN callback clears, *Then* the member status becomes `ACTIVE`, a scannable QR Pass is generated, and a digital receipt appears in `/dev-inbox` (and Resend/Mailpit).

### FR-2: Automated Card Attendance, Virtual Gatekeeping & Overrides
* **Requirement:** Virtual/physical RFID cards and Backup QR Passes log every entry. Cards tied to unpaid or expired plans are automatically blocked.
* **Acceptance Criteria:**
  * *Given* a member has overdue dues, *When* their card is tapped in `/simulator` (or QR scanned), *Then* the virtual turnstile flashes red (`DENIED_UNPAID`) and pushes a real-time Socket.IO alert to the Front-Desk portal.
  * *Given* an approved exception, *When* Front-Desk submits a Manual Override with branch, timestamp, and reason, *Then* the virtual gate unlocks and writes an immutable `AuditLog`.
  * *Given* a lost card, *When* Front-Desk issues a Replacement Card Ticket and collects the fee, *Then* the old `cardUid` is revoked and the new `cardUid` activates immediately.

### FR-3: Trainer Scheduling & Member Waitlists
* **Requirement:** Trainers Create, Read, Update, and Delete 1-on-1 PT and Group Class slots without double-booking trainers or studio zones. Members book or join automated waitlists.
* **Acceptance Criteria:** *Given* a full class, *When* a confirmed member cancels, *Then* Waitlist #1 is automatically promoted by the `node-cron`/`pg-boss` worker and notified via free Web Push / Telegram / In-App notification.

### FR-4: Mock Billing, Split Payments, Freezes & Festival Marketing
* **Requirement:** Support recurring tiers, PT packs, day passes, split/partial payments with due tracking, membership freezes, off-peak discounted slots, and Admin Festival Promo Codes.
* **Acceptance Criteria:** *Given* the Super Admin creates a $20\%$ "Eid Festival Offer" for Branches 1 & 2, *When* a member applies the code at Mock Checkout for Branch 1, *Then* the discount deducts automatically and increments the campaign's redemption count.

### FR-5: Free Omnichannel Notification Engine
* **Requirement:** Dispatch transactional, operational, and retention alerts using **zero-cost channels** (Socket.IO In-App, Web Push VAPID, optional Telegram Bot API, Resend Free/Mailpit Email, and `/dev-inbox` previewer).
* **Acceptance Criteria:** Automated reminders fire at 7, 3, and 1 day before membership expiry, and a "We miss you" alert fires after 14 days without check-in.

### FR-6: Free AI Concierge, Virtual Smart Lockers & QR Equipment Maintenance
* **Requirement:** Embed a client-side AI assistant powered by **Google Gemini Free Tier** (or **Ollama** offline + local vector store, with rule-based fallback); support Virtual Smart Locker claims; enable real camera QR scanning (`html5-qrcode`) for broken machine reporting.
* **Acceptance Criteria:** *Given* a member scans a generated treadmill QR code and submits a "Belt slipping" ticket, *Then* a maintenance ticket appears on the Front-Desk Kanban board and the treadmill is flagged `OUT_OF_ORDER` in Trainer class views.

---

## 5. Open Business Rules (Customizable Defaults for Your Build)

Since this is a self-directed zero-cost build, the system ships with sensible defaults that you can customize anytime:
1. **Trainer Deleting a Booked Slot:** Default = Immediate cancellation with automatic credit refund + free push apology (toggleable to require Admin approval).
2. **Cross-Branch Roaming:** Default = Restricted to `roamingEnabled` plans (All-Access tier).
3. **Front-Desk Override Limits:** Default = Max 2 overrides/member/month + instant Super Admin in-app alert.
4. **Partial Payment Grace Period:** Default = 7 days before automatic turnstile lockout.
5. **Card Replacement Fee:** Default = 300 BDT (configurable in Admin settings; simulated via Virtual Hardware).
6. **Free Notification Routing:** Default = All alerts logged to `/dev-inbox` + Socket.IO In-App; critical alerts routed to Web Push & optional Free Telegram Bot.
7. **Trainer Commission Calculation:** Default = $40\%$ split on completed PT sessions (configurable per trainer).
8. **Family Sub-Account Rules:** Default = Up to 4 dependents per primary payer with $15\%$ discount per dependent.