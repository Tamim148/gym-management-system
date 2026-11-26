# UI/UX Design Specification — Vintage Aesthetics Gym Edition
**Project:** Multi-Branch Gym Management & Member Engagement Ecosystem  
**Client Brand:** Vintage Aesthetics Gym (Modern Golden Era Iron Aesthetic)  
**Platforms:** Single Unified Next.js Responsive PWA (Desktop Web Portal + Installable Mobile App)  
**Budget Stack:** 100% Free Open-Source & Permanent Free-Tier Stack  
**Version:** 2.1 (Official Brand Identity & Zero-Cost PWA)  

---

## 1. Brand Identity & Visual Design System

* **Brand Aesthetic ("Modern Golden Era Iron"):** Derived directly from the official **Vintage Aesthetics Gym** emblem—combining deep oxblood maroon, high-energy crimson, obsidian black, iron charcoal, brushed chrome-silver steel, and crisp chalk white.
* **Logo Placement:** Store the official emblem at `public/images/logo.png` and display it in the Admin/Front-Desk sidebar header, login screen, digital Member QR Pass, Virtual Turnstile header, and generated PDF invoices.
* **Unified PWA Strategy (Zero App Store Fees):** The Next.js frontend ships with `manifest.json` and a Service Worker so Members and Trainers can install the app onto Android and iOS home screens directly from the browser for $0.
* **Theme Modes:**
  * **Member & Trainer PWA (Dark Mode Default):** Deep obsidian canvas (`#0A0A0C`) and iron charcoal cards (`#141418`) with metallic steel borders (`#27272A`) and oxblood hero glows.
  * **Front-Desk & Super Admin Portal (Light Mode Default + Dark Toggle):** Bright `#F4F4F6` workspace for daytime reception readability, anchored by a deep Obsidian (`#0F0F12`) & Oxblood (`#7F1118`) left navigation sidebar.

### 1.1 Official Brand Color Tokens

| Role | Token Name | Hex Code | Logo Source & UI Usage |
| :--- | :--- | :--- | :--- |
| **Primary Brand Deep** | Brand Oxblood | `#7F1118` | Circular emblem backdrop — hero gradients, VIP QR pass, sidebar accent |
| **Oxblood Shadow** | Oxblood Deep | `#560A0F` | Gradient depths, dark borders on maroon banners |
| **Primary Action CTA** | Brand Crimson | `#DC1E26` | "AESTHETICS" wordmark — primary buttons (`Book Class`, `Renew Now`), active tab pills |
| **CTA Hover** | Crimson Hover | `#B9161D` | Pressed/hover states for primary buttons |
| **Dark Canvas** | Obsidian Black | `#0A0A0C` | Barbell shadow outlines — default Dark Mode background |
| **Dark Card Surface** | Iron Charcoal | `#141418` | Dark steel plates — elevated cards, drawers, modals, bottom nav |
| **Metallic Border** | Brushed Steel | `#27272A` | Crisp $1\text{px}$ card borders and dividers in Dark Mode |
| **Metallic Accent** | Brushed Chrome | `#A1A1AA` | Silver laurel wreath & barbell — icons, muted text, streak badges |
| **Primary Light Text** | Chalk White | `#FAFAFA` | White emblem figure — primary text on dark surfaces |
| **Light Portal Canvas** | Reception Mist | `#F4F4F6` | Front-Desk Light Mode workspace canvas |
| **Success / Granted** | Emerald | `#10B981` | Turnstile open, paid status, active edge heartbeat |
| **Warning / Queue** | Amber | `#F59E0B` | Partial dues, waitlist queue badges, off-peak promo tags |
| **Access Denied Alert** | Alert Crimson | `#FF2A3B` | Pulsing danger border + dark tint + Lock/X icon for unpaid turnstile blocks |

> **Critical UX Guardrail (Red Brand vs. Red Alerts):** Keep $\ge 70\%$ of the interface neutral (Obsidian/Iron/Chrome in Dark Mode; Chalk/Charcoal in Light Mode). Never rely on red color alone for access denials—always pair `ACCESS DENIED` cards with a pulsing danger outline, prominent lock/warning icon, high-contrast badge, and an audio chime at reception.

### 1.2 Typography (100% Free Google Fonts)
* **Display & Headings:** `Barlow Condensed` (Bold/ExtraBold, uppercase/italic optional) — echoes the bold athletic lettering of the emblem for KPI numbers, branch headers, and festival banners.
* **UI Body & Tables:** `Plus Jakarta Sans` (or `Inter`) with `font-variant-numeric: tabular-nums` for aligned invoices, BDT totals, and class timers.
* **Bangla Localization:** `Noto Sans Bengali` loaded as fallback for Bangla offers and receipts.

### 1.3 Ready-to-Use Tailwind CSS v4 Tokens (`src/app/globals.css`)

```css
@import "tailwindcss";

@theme {
  --color-oxblood: #7f1118;
  --color-oxblood-deep: #560a0f;
  --color-crimson: #dc1e26;
  --color-crimson-hover: #b9161d;

  --color-obsidian: #0a0a0c;
  --color-iron: #141418;
  --color-steel: #27272a;
  --color-chrome: #a1a1aa;
  --color-silver: #d4d4d8;
  --color-chalk: #fafafa;

  --color-access-ok: #10b981;
  --color-access-warn: #f59e0b;
  --color-access-denied: #ff2a3b;

  --font-display: "Barlow Condensed", "Oswald", sans-serif;
  --font-sans: "Plus Jakarta Sans", "Inter", "Noto Sans Bengali", sans-serif;
}

.va-card {
  background-color: #141418;
  border: 1px solid #27272a;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.va-hero-gradient {
  background: radial-gradient(circle at top right, #7f1118 0%, #141418 55%, #0a0a0c 100%);
}
```

### 1.4 Touch & Resilience Standards
* Minimum $48 \times 48\text{dp}$ touch targets on mobile and reception tablets.
* Skeleton loading states instead of full-page spinners; target PWA Time-to-Interactive $\le 2.0\text{ s}$.
* Persistent top banner (**"Offline Mode — Local Queue Active"**) in Amber whenever the branch simulator or real network goes offline.

---

## 2. Key Screen Wireframes & Component Inventory

### A. Web Portal — Front-Desk Live Access Dashboard (Tablet/Desktop)
* **Left Sidebar (`240px`, Obsidian `#0F0F12` + Oxblood `#7F1118` crest header):** Displays the circular Vintage Aesthetics Gym logo, Branch Switcher (locked to assigned branch for Front-Desk staff), and navigation links (`Live Access`, `Members`, `Payments`, `Simulator`, `Dev Inbox`).
* **Top Bar:** Live Occupancy Counter (`42 / 80 Inside`), Edge Node Heartbeat Indicator (Emerald pulse), Quick-Search Member Bar, and Light/Dark Mode toggle.
* **Left Column ($65\%$ Width) — Live Entry Stream:** Real-time Socket.IO feed of RFID card and QR scans.
  * *Allowed Entry:* Clean card with Emerald left bar, member avatar, active plan badge, and check-in timestamp.
  * *Denied Entry:* Pinned to the top with pulsing `#FF2A3B` border, Lock icon, `DENIED: UNPAID DUES` pill, and sound chime.
* **Right Column ($35\%$ Width) — Quick-Profile Action Drawer:** Member photo, Phone, Plan & Expiry, Balance Due (BDT), Recent 5 Check-ins, and three high-clarity CTAs:
  1. **`Collect Payment`** (Emerald primary action for settling dues)
  2. **`Manual Override`** (Amber outlined button opening the mandatory audit modal)
  3. **`Replace Card`** (Steel button opening the $300\text{ BDT}$ replacement ticket workflow)
* **Manual Override Modal:** Read-only auto-filled `Branch` & `Timestamp`, mandatory `Reason` dropdown (`Promised to pay tomorrow`, `Card reader glitch`, `Admin approved`), mandatory justification note (min $10$ characters), and **`Confirm Override & Unlock Gate`** CTA.

### B. Web Portal — Super Admin Command Center
* **Executive KPI Strip:** Total Revenue (MTD across 3 branches + branch breakdown), Active vs. Overdue Members, Today's Footfall, High-Risk Churn Count (styled in bold `Barlow Condensed` numerals).
* **Festival Campaign Builder:** Visual form to configure Campaign Name (e.g., *Eid Iron Blast*), Discount (`%` or Fixed BDT), Promo Code, Validity Dates, and Branch Targets, paired with a live oxblood-and-crimson mobile banner preview.
* **Proactive Churn Radar:** Daily ranked list of members with elevated `churnRiskScore` with a 1-Click **"Send AI-Drafted Check-in Message"** action (routed via Free Push / Telegram / `/dev-inbox`).
* **Equipment & Maintenance Board:** Kanban board (`OPEN` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `RESOLVED`) fed by member QR scans, including a **"Print QR Sticker"** button per machine.

### C. Mobile PWA — Member Experience (Installable on iOS & Android)
* **Bottom Navigation (5 Tabs):** `Home` | `Schedule` | `QR Pass` (elevated Crimson center crest button) | `Workouts` | `Profile`.
* **Home Screen (Dark Mode):**
  * Header with Vintage Aesthetics Gym mini crest, Branch selector, and Membership Pill (`18 Days Left` or Crimson `Renew Now`).
  * **Live Gym Crowd Meter** (e.g., *"Gulshan Branch • Moderate — 38% Full"*).
  * **Festival Promo Banner** (Oxblood-to-Obsidian radial gradient card).
  * **Next Booked Session Card** & **Chrome Laurel Streak Badge** (echoing the emblem's silver wreath).
* **Digital QR Pass Screen:** Styled as a luxury **Black & Oxblood Metallic Membership Card** with a brushed chrome border, circular emblem, scannable QR code, member ID, and offline-cached verification badge.
* **Schedule & Booking Screen:** Branch selector, date strip, filters (`PT`, `Group`, `Off-Peak Deals`), Amber off-peak discount badges, Crimson `Book Slot` or Amber `Join Waitlist` buttons, and slide-up Confirmation Bottom Sheet.
* **Mock Payment Checkout Modal:** Realistic Bangladesh checkout interface supporting **bKash**, **Nagad**, or **Card** with one-click `Simulate Success`, `Simulate Failed Payment`, and `Simulate Browser Drop (IPN Test)` controls.
* **Floating AI Concierge Orb:** Bottom-right oxblood/crimson floating button expanding into a dark glassmorphic chat drawer capable of navigating pages and rendering inline booking cards.

### D. Mobile PWA — Trainer Experience
* **Calendar View:** Day/Week/Month toggle (`Crimson = 1-on-1 PT`, `Chrome/Indigo = Group Class`, `Steel = Open Availability`) with tap-to-create and conflict validation.
* **Live Class Roster:** Member check-in checkboxes, high-visibility `OUT_OF_ORDER` equipment alert banner for the assigned zone, and client meal/workout plan uploader.
* **Earnings & Retention Tab:** Completed sessions, estimated monthly commission payout (`40%` default split), and client renewal rate.

### E. Virtual Hardware Simulator (`/simulator`) & Free Dev Inbox (`/dev-inbox`)
* **Virtual Turnstile Console:** Branch selector, **"Simulate Offline Outage"** toggle, one-click card taps for seeded test members (Active, Unpaid, Expired, Lost), live **Webcam QR Scanner** (`html5-qrcode`), and animated turnstile gate graphic.
* **Virtual Smart Locker Grid:** Interactive locker grid per branch showing Free (Iron Charcoal) vs. Occupied (Oxblood/Crimson) compartments; tap to simulate RFID card assignment.
* **Free Notification & Email Preview Inbox (`/dev-inbox`):** Displays every simulated OTP, PDF receipt link, Telegram payload, Web Push alert, and expiry reminder at zero cost.