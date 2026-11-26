# 03. Data Security & Privacy Specification (`data_security.md`)
**Project:** Vintage Aesthetics Gym Management System  
**Sensitive Assets:** Member PII, National ID (KYC) Scans, PAR-Q Health/Fitness Waivers, Financial Ledgers, Access Logs  
**Storage Stack:** Local SQLite -> Neon Free PostgreSQL + Local Disk / Supabase Storage Free (1 GB)  
**Version:** 1.0

---

## 1. Data Classification Matrix

Every column and uploaded file in the gym ecosystem belongs to one of four security tiers:

| Tier | Classification | Examples in Vintage Aesthetics Gym | Protection Mandate |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **Restricted (Critical)** | `passwordHash`, JWT/HMAC signing keys, `parqDataJson` (medical/injury disclosures), `kycDocumentUrl` (NID/Passport scans), Refresh Token hashes. | Never returned in list endpoints; never logged; app-layer `AES-256-GCM` encryption for PAR-Q/secrets; private bucket with 5-minute signed URLs for KYC files. |
| **Tier 2** | **Confidential (PII / Financial)** | `fullName`, `phone`, `email`, `emergencyContact`, `Transaction` amounts, `Subscription` dues, `AttendanceLog` timestamps, `AuditLog`, `AccessCard.cardUid`. | Strict RBAC + Branch Scoping + Neon RLS; TLS 1.3 in transit; redacted in console/error logs; CSV formula-sanitized on export. |
| **Tier 3** | **Internal Operational** | `Session` schedules, `Booking` counts, `SmartLocker` status, `EquipmentTicket` descriptions, `FeatureFlag` states. | Authenticated access required; branch-scoped writes. |
| **Tier 4** | **Public** | Branch names/addresses, public Membership Plan catalog, active Festival Promo banners, public `KnowledgeChunk` gym policies. | Read-only public endpoints; safe for CDN and PWA caching. |

---

## 2. Encryption in Transit & At Rest (Zero-Cost Implementation)

### 2.1 In Transit
* **Client $\leftrightarrow$ Vercel / Render:** Strict **TLS 1.3 / HTTPS** (free automatic Let's Encrypt certificates on Vercel Hobby and Render Free). All HTTP traffic redirects `301` to HTTPS with HSTS enabled.
* **NestJS $\leftrightarrow$ Neon PostgreSQL:** Enforced encrypted connections using `?sslmode=require` (or `verify-full`) in `DATABASE_URL`.
* **WebSockets:** `wss://` (TLS-encrypted Socket.IO) exclusively in Staging and Production.

### 2.2 At Rest & Application-Layer Field Encryption
* **Cloud Storage Encryption:** Neon PostgreSQL and Supabase Storage encrypt underlying disks at rest with AES-256 automatically on free tiers.
* **Application-Layer Encryption for Health/PAR-Q Data:** Because `parqDataJson` holds sensitive physical health/medical readiness answers—and local SQLite (`dev.db`) is a plain file on disk—encrypt `parqDataJson` using Node.js native **`crypto` (`aes-256-gcm`)** before saving:
  * Key source: 32-byte hex `DATA_ENCRYPTION_KEY` stored *only* in environment variables (never in DB or Git).
  * Per-record random **12-byte IV** + **16-byte Auth Tag** (`iv:authTag:ciphertext`) so ciphertext cannot be tampered with silently (authenticated encryption).
  * Support key rotation via version prefix (`v1:iv:tag:cipher`) so keys can rotate cleanly without breaking older waivers.

---

## 3. Secure File Uploads (KYC NIDs, Member Photos & Broken Equipment)

File uploads are one of the highest-risk vectors in web applications. Every uploaded file passes through this mandatory NestJS pipeline:

1. **Size & Count Cap:** Hard limit of **3 MB** for KYC/profile photos and **5 MB** for equipment fault photos via `Multer` memory buffer.
2. **Magic-Byte Inspection:** Verify actual file signature bytes (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `52 49 46 46` for WebP). **Strictly reject `.svg`, `.html`, `.pdf` (unless scanned), and executables.**
3. **Image Sanitization & EXIF Stripping (`sharp` — Free Open-Source):** Re-encode every uploaded image to WebP/JPEG via `sharp(buffer).rotate().resize(1600, 1600, { fit: 'inside' }).webp({ quality: 82 })`. This neutralizes polyglot script payloads and strips smartphone GPS coordinates and camera EXIF metadata.
4. **Random Storage Keys:** Store files under non-guessable UUID paths (`kyc/<branchId>/<uuid>.webp`)—never use the user's original filename (prevents path traversal `../../etc/passwd`).
5. **Private Access for KYC:**
   * Profile avatars and broken-equipment photos may live in an authenticated asset route.
   * **KYC / NID documents** must be stored in a **private** Supabase Storage bucket (or outside `public/` on local disk) and served *only* to `SUPER_ADMIN` or same-branch `FRONT_DESK` via a **short-lived (5-minute) signed URL**, recording an `AuditLog` (`KYC_DOCUMENT_VIEWED`) on every view.

---

## 4. Logging Redaction & Safe Error Responses

* **Zero Sensitive Data in Logs:** Configure NestJS logger (e.g., `nestjs-pino`) with automatic redaction paths:
  ~~~typescript
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.parqDataJson',
      '*.kycDocumentUrl',
      '*.webPushSubJson',
      '*.gatewayRef',
    ],
    censor: '[REDACTED]',
  }
  ~~~
* **No Stack Traces to Clients:** In Production, the global exception filter returns standardized safe JSON (`{ statusCode, errorCode, message, correlationId }`)—never raw Prisma errors, SQL table names, or file paths.
* **Dev Inbox Protection:** `/dev-inbox` (which displays simulated OTPs and receipts locally) is strictly disabled when `NODE_ENV=production` unless explicitly unlocked for a Demo Staging build behind Admin credentials.

---

## 5. AI Concierge & RAG Data Privacy Guardrails

Because our AI Concierge uses **Google Gemini API Free Tier** (or local **Ollama**):
1. **Strict RAG Corpus Isolation:** Only **Tier 4 Public** gym documents (plans, branch hours, freeze policies, class schedules) are embedded into `KnowledgeChunk`. **NEVER** embed member PII, health waivers, payment dues, or attendance logs into the shared vector store.
2. **PII Minimization Before External LLM Calls:** Before sending a user's prompt to Gemini Free Tier, scrub or replace raw phone numbers, NID numbers, and emails with placeholders (`[PHONE]`, `[EMAIL]`). Only pass minimal scoped context (e.g., first name + active plan tier + branch name).
3. **Zero-Leakage Local Option:** If deploying for a real gym with strict data-residency requirements, switch `AI_PROVIDER=ollama` to run the model 100% locally on-premise so zero conversation text ever leaves the gym's server.
4. **Prompt & Interaction Retention:** Purge or anonymize `AIInteractionLog.userPrompt` older than **90 days** via a monthly `node-cron` cleanup job.

---

## 6. Data Retention, Deletion, Backups & Privacy Compliance

* **Financial & Audit Retention:** Retain `Transaction` and `AuditLog` records for **7 years** (standard accounting/tax compliance in Bangladesh). Never hard-delete paid invoices.
* **Member Right-to-Deletion (Soft Delete + Anonymization):** When a member requests account deletion:
  * Revoke all `AccessCard`s and refresh tokens immediately.
  * Delete KYC files from storage and clear `parqDataJson`, `profilePhotoUrl`, `telegramChatId`, and `emergencyContact`.
  * Anonymize `fullName` $\rightarrow$ `"Deleted Member"`, `email` $\rightarrow$ `null`, `phone` $\rightarrow$ `deleted_<uuid>`, `status` $\rightarrow$ `INACTIVE`—preserving aggregated branch revenue integrity without keeping personal identifiers.
* **Zero-Cost Backup & Recovery Plan:**
  * **Local SQLite:** Automated nightly copy of `dev.db` via SQLite `.backup` command (safe under WAL mode) into a local encrypted archive.
  * **Neon Free PostgreSQL:** Leverage Neon's built-in point-in-time recovery (PITR) window plus a weekly GitHub Actions `pg_dump` encrypted with `age`/`gpg` and stored in a private backup repository or Google Drive.