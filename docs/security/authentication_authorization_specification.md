# 02. Authentication & Authorization Specification (`auth.md`)
**Project:** Vintage Aesthetics Gym Management System  
**Auth Model:** Hybrid Short-Lived JWT + Rotating HTTP-Only Refresh Cookies + Defense-in-Depth RBAC & RLS  
**Zero-Cost Stack:** Self-hosted NestJS Passport/JWT + `argon2`/`bcryptjs` + WebAuthn/TOTP (Zero paid Auth0/Clerk fees)  
**Version:** 1.0

---

## 1. Identity & Credential Security

### 1.1 Password Policy (Aligned with NIST SP 800-63B)
* **Length over complexity:** Minimum **10 characters**, maximum **128 characters** (prevents hashing DoS). Allow spaces and passphrases; block top 10,000 leaked passwords (e.g., `password123`, `1234567890`).
* **Hashing Algorithm:**
  * **Recommended:** `argon2id` (`memoryCost: 65536` / 64 MiB, `timeCost: 3`, `parallelism: 1`).
  * **Portable Fallback (Windows zero-native-build):** `bcryptjs` with **cost factor 12** ($\approx 250\text{ ms}$ hash time).
* **Normalization:** Normalize email (`trim().toLowerCase()`) and Bangladesh phone (`+8801XXXXXXXXX`) before lookup; never trim spaces inside passwords.
* **Account Enumeration Prevention:** Both invalid email/phone and wrong password return the exact same `401 Unauthorized` response (`"Invalid credentials"`) and execute a dummy hash comparison when a user is not found to prevent timing side-channel leaks.

### 1.2 Multi-Factor Authentication (MFA) & Passwordless Path
* **Super Admin & Branch Managers (Mandatory for Production):** Free **TOTP Authenticator App** (Google Authenticator / Authy via open-source `otplib`) required for login and sensitive actions (creating global refunds, changing Feature Flags, exporting full financial ledgers).
* **Member Onboarding OTP:** 6-digit cryptographically random OTP (`crypto.randomInt(100000, 999999)`), stored hashed in DB/memory, valid for **5 minutes**, max **3 verification attempts** before invalidation. Delivered via zero-cost `/dev-inbox` (local), Resend Free Email, or Telegram Bot.
* **Future Upgrade Path:** Add WebAuthn **Passkeys** (`@simplewebauthn/server` — 100% open-source) for phishing-resistant phone biometric login.

---

## 2. Session & Token Architecture

> **Strict Rule:** NEVER store Access Tokens or Refresh Tokens in `localStorage` or `sessionStorage`. Any XSS vulnerability can read `localStorage`. All persistent tokens live strictly inside **`httpOnly` cookies**.

### 2.1 Dual-Token Lifecycle

| Token Type | Storage & Flags | TTL (Expiry) | Signing Algorithm | Contents / Claims |
| :--- | :--- | :--- | :--- | :--- |
| **Access Token (JWT)** | `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/` | **15 minutes** (10 min for Super Admin) | `HS256` (256-bit secret) or `EdDSA` (`Ed25519` asymmetric) | `sub` (userId), `role`, `branchId`, `jti`, `iat`, `exp` (ZERO PII like phone/email/health data) |
| **Refresh Token** | `httpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth/refresh` | **7 days** (24 hours on Front-Desk shared tablets) | Opaque 64-byte `crypto.randomBytes` stored **SHA-256 hashed** in DB | Linked to `userId`, `tokenFamilyId`, `deviceFingerprint`, `expiresAt`, `revokedAt` |

### 2.2 Refresh Token Rotation & Theft Detection
1. When the 15-minute Access Token expires, the frontend silently calls `POST /api/auth/refresh`.
2. NestJS hashes the incoming Refresh Cookie, looks up the token record, marks it `used = true`, and issues a **brand-new** Access Token + Refresh Token pair inside the same `tokenFamilyId`.
3. **Reuse Detection (Token Theft Alarm):** If an already-used Refresh Token is submitted a second time (meaning either the attacker or the legitimate user replayed a stolen cookie), NestJS immediately **revokes the entire `tokenFamilyId`**, forces logout on all devices in that family, and writes a high-severity `AuditLog` (`REFRESH_TOKEN_REUSE_DETECTED`).
4. **Immediate Revocation Triggers:** Password change, role change, user suspension (`status = SUSPENDED`), or explicit Logout immediately revokes all active Refresh Tokens for that user.

### 2.3 CSRF Defense
* Pairing `SameSite=Lax` (Access) and `SameSite=Strict` (Refresh) cookies with strict `Origin` / `Referer` header verification on all state-changing `POST`/`PATCH`/`DELETE` requests blocks cross-site request forgery without brittle custom token sync bugs.

---

## 3. Three-Layer Authorization Architecture (RBAC + Branch Scoping)

Following the **CVE-2025-29927** defense principle, authorization is never enforced in just one place:

~~~text
[Client Request]
   │
   ▼ Layer 1: Next.js Data Access Layer (DAL) & Server Actions
     (Checks session cookie & role before rendering Admin/Desk/Trainer views;
      middleware.ts is UX redirect ONLY)
   │
   ▼ Layer 2: NestJS Global Guards (Every API Controller)
     1. JwtAuthGuard       -> Verifies signature, expiry & active user status
     2. RolesGuard         -> Enforces @Roles('SUPER_ADMIN', 'FRONT_DESK', ...)
     3. BranchScopeGuard   -> Asserts target branchId === req.user.branchId (unless SUPER_ADMIN)
     4. OwnershipGuard     -> For MEMBER/TRAINER, verifies resource belongs to req.user.id
                              (or linked Family Sub-Account for primary payers)
   │
   ▼ Layer 3: Database Enforcement (Neon PostgreSQL RLS)
     withRlsContext() sets transaction-local app.current_user_id, app.current_role,
     and app.current_branch_id before every query.
~~~

### 3.1 Role Hierarchy & Guard Rules

| Role | Scope | Key Guard Constraints |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Global (All 3 Branches) | Full access; requires TOTP MFA for destructive/financial actions in Production. |
| **`BRANCH_MANAGER`** | Single Branch (`homeBranchId`) | Cannot view or alter financials, users, or overrides of other branches. |
| **`FRONT_DESK`** | Single Branch (`homeBranchId`) | Can onboard members, collect cash/partial dues, replace cards, and execute `MANUAL_OVERRIDE` (capped at **2 overrides/member/month** + mandatory 10-char note). Cannot delete `AuditLog` or edit `Campaign` rules. |
| **`TRAINER`** | Assigned Branch(es) & Own Sessions | CRUD strictly on `Session.trainerId === req.user.id`. Deleting a session with active `CONFIRMED` bookings triggers the booked-slot refund & apology workflow (or Manager approval). Cannot read member financial ledgers. |
| **`MEMBER`** | Self + Linked Family Sub-Accounts | Can read/update own profile (excluding `role`, `status`, `loyaltyPoints`), book classes, freeze plan, and view family dependents where `primaryPayerId === req.user.id`. |

---

## 4. Real-Time & Hardware Channel Authentication

### 4.1 Socket.IO WebSocket Auth (Front-Desk Live Access Stream)
* Clients authenticate during the WebSocket handshake using the `httpOnly` access cookie.
* **Server-Derived Rooms:** The client NEVER chooses which branch stream to subscribe to. On connection, the gateway inspects `socket.data.user`:
  * `SUPER_ADMIN` joins `branch:all:desk`.
  * `FRONT_DESK` / `BRANCH_MANAGER` joins *only* `branch:${user.homeBranchId}:desk`.
  * `MEMBER` joins *only* `user:${user.id}:notifications`.
* **Token Expiry Handling:** Connections automatically re-validate session validity every 15 minutes and disconnect immediately if the user is suspended.

### 4.2 Rotating Member Digital QR Pass (Anti-Screenshot Protocol)
Instead of encoding a static `userId` inside the QR code (which anyone could screenshot and share):
1. The PWA requests a short-lived signed QR payload (or derives one offline from a member-specific provisioned `qrSecret` stored in `IndexedDB`).
2. Format: `VA1.<userId>.<epoch60sBucket>.<HMAC_SHA256_TRUNC16>`
3. When scanned at the turnstile/webcam (`html5-qrcode`), the verifier accepts only the current 60-second bucket or previous bucket ($\pm 1$ window for minor clock skew) and enforces a **30-minute anti-passback lock** per branch.

### 4.3 Edge Node & Simulator Authentication
* **Production Edge Gateways:** Each of the 3 branch edge boxes authenticates with a unique per-branch API key (`EDGE_KEY_DHK01`, stored hashed) restricted strictly to `/api/edge/sync` and `/api/access/verify` for its assigned `branchId`.
* **Zero-Cost `/simulator` Route Protection:** In `NODE_ENV=production`, `/simulator` and `/dev-inbox` are either **disabled completely** via `ENABLE_DEV_SIMULATOR=false` or locked behind `SUPER_ADMIN` authentication with clear watermark banners so no member can simulate card taps or payments.

---

## 5. Brute-Force & Account Lockout Policy

* **Login Throttling:** Max 5 failed login attempts per `(IP + identifier)` within 15 minutes.
* **Progressive Backoff:** After 5 failures, require a 15-minute cooldown (or free Cloudflare Turnstile CAPTCHA challenge) and log `LOGIN_BRUTE_FORCE_SUSPECTED` in `AuditLog`.
* **No Permanent DoS Lockout:** Never permanently lock out a member account on failed passwords (which attackers could abuse to lock out the Gym Owner before opening hours); use IP+account progressive backoff and alert the Super Admin via Telegram/Email instead.