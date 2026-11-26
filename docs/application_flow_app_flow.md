# Application Flow Specification (App Flow) — Zero-Cost Edition
**Project:** Multi-Branch Gym Management & Member Engagement Ecosystem  
**Version:** 2.0 (100% Free Stack & Virtual Hardware Flows)  

---

## 1. Member Onboarding (Self-Service PWA & Front-Desk Walk-In)

~~~text
[Entry Point]
 ├── Mobile/Web Self-Signup (Next.js PWA):
 │     Phone/Email Verification (OTP shown in Free Local Inbox / Mailpit / Resend)
 │     -> Profile & Fitness Goals -> Digital PAR-Q Health Form & Canvas E-Signature Waiver
 │     -> Select Home Branch & Plan -> Apply Festival Promo Code (optional)
 │     -> Mock Payment Gateway Screen (Choose bKash / Nagad / Card -> Click "Simulate Success")
 │     -> Instant Mock IPN Webhook Confirmed -> Account Active + Backup QR Pass Generated
 │     -> Front Desk Binds Virtual/Physical RFID Card_UID on Visit 1
 │
 └── Front-Desk Walk-In:
       Staff Opens "Quick Onboard" -> Upload Photo, NID/KYC & Emergency Contact
       -> Tablet Hand-Off for Digital Waiver Signature -> Select Plan (Full or Split/Partial Payment)
       -> Log Cash/POS or Launch Mock Payment -> Assign RFID Card_UID (Auto-generate or Manual Input)
       -> Instant Availability in Access Check Engine -> Member Cleared for Entry
~~~

---

## 2. Automated Card Attendance, Denial & Front-Desk Override Flow

~~~text
[Member Taps Card via /simulator Virtual Turnstile OR Scans QR Pass via Webcam (html5-qrcode)]
      |
      v
[Access Verification Engine Checks Card + Subscription Status (<= 200ms)]
      |
      ├── Status == ACTIVE & Dues == PAID & Branch Allowed?
      |     └── YES -> Virtual Gate Turns Green (Opens) -> Log Entry (ALLOWED) -> Increment Live Occupancy
      |
      └── NO (Overdue / Expired / Card Damaged / Lost)
            |
            v
     [Virtual Gate Flashes Red (Locked) + Real-Time Alert via Socket.IO to Front-Desk Live Dashboard]
            |
            v
     [Member Approaches Front Desk -> Staff Clicks Alert to Open Quick-Profile Drawer]
            |
            ├── Path A (Pay Overdue Balance):
            │     Collect Cash/POS or Run Mock bKash Checkout -> Ledger Updated -> Tap Again -> Gate Opens
            │
            ├── Path B (Manual Override):
            │     Staff Clicks "Manual Override" -> Auto-fills Branch & Timestamp
            │     -> Selects Reason ("Promised to pay tomorrow", "Card reader glitch", "Admin approved")
            │     -> Enters Mandatory Note -> Clicks "Open Gate & Log Attendance"
            │     -> Virtual Gate Fires Open -> AttendanceLog (MANUAL_OVERRIDE) + AuditLog Saved
            │
            └── Path C (Lost/Damaged Card Replacement):
                  Staff Clicks "Issue Replacement Ticket" -> Old Card_UID Immediately Revoked
                  -> System Generates Replacement Fee Invoice -> Collect Fee (Cash / Mock Payment)
                  -> Bind New Card_UID -> New Card Active Immediately
~~~

---

## 3. Trainer Schedule CRUD & Booked-Slot Conflict Flow

~~~text
[Trainer Opens Schedule Tab in Mobile/Web PWA]
  ├── Add Slot: Select Branch -> Type (1-on-1 PT / Group Class) -> Time & Capacity
  │     -> System Validates No Trainer/Zone Overlap & Buffer Time -> Slot Published to Member Schedule
  │
  ├── Edit / Delete UNBOOKED Slot:
  │     -> Instant Update/Removal -> Zero Member Impact
  │
  └── Edit / Delete BOOKED Slot:
        -> System Flags Active Bookings (e.g., "4 members booked")
        -> Policy Gate: Requires Reason + (Admin Approval OR Auto-Notify Rule)
        -> Upon Confirmation: Refund Session Credit -> Free Push / Telegram / Local Inbox Apology Sent
        -> Prompt Affected Members to Rebook Alternative Trainer/Slot
~~~

---

## 4. Member Booking, Dynamic Pricing & Waitlist Auto-Promotion

~~~text
[Member Browses Branch Schedule]
  ├── Off-Peak Slot (e.g., 1 PM – 3 PM)? -> Displays Discounted Yield-Management Price Badge
  ├── Spots Available (>0) -> Tap "Book" -> Deduct Session Credit / Confirm -> Schedule Free Reminder (T-2h)
  └── Class Full (0 Spots) -> Tap "Join Waitlist" -> Assigned Queue Position (#1, #2...)
        |
        └── When Another Member Cancels:
              node-cron / pg-boss Worker Promotes Waitlist #1 -> Reserves Spot
              -> Sends Free Web Push + Telegram / In-App Alert
              (Optional: 15-min Confirm Window before cascading to #2)
~~~

---

## 5. Client-Side AI Concierge (Free Gemini / Ollama + DOM Action Flow)

~~~text
[User Opens Floating AI Chat Widget on Web/PWA (24/7)]
  -> Types: "Book me a HIIT class tomorrow evening at Dhanmondi branch" OR "Freeze my plan"
  -> Backend Queries Local Vector Store / pgvector (Gym Policies & Live Schedule)
  -> Calls Google Gemini Free Tier API (or Ollama offline / Mock Rule Fallback if no API key)
  -> If Navigation/Search Intent:
       Returns Structured Action Payload -> Frontend Navigates Route, Applies Filters & Shows Booking Card
  -> If Write Intent (e.g., Freeze Membership / Book Class):
       Validates User JWT & Policy Eligibility -> Asks 1-Tap User Confirmation
       -> Executes Scoped API Mutation -> Logs to AIInteractionLog
~~~

---

## 6. Facility IoT Simulation: Smart Lockers & QR Equipment Maintenance

* **Virtual Smart Lockers:** On `/simulator` (or Member PWA), member taps their active card/QR against an available locker $\rightarrow$ System verifies active check-in $\rightarrow$ Claims locker (`assignedUserId`) until checkout tap releases it.
* **Real QR Broken-Equipment Reporting:** Admin prints or displays QR codes generated for each gym asset (`EquipmentAsset.qrCodeToken`) $\rightarrow$ Member scans the QR code using their laptop/phone camera (`html5-qrcode`) $\rightarrow$ Selects issue & uploads photo to local disk / Supabase Free Storage $\rightarrow$ Maintenance ticket appears on Front-Desk Kanban board **and** equipment is flagged `OUT_OF_ORDER` on Trainer class views.