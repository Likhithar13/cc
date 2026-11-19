# HemoCore Blood Bank — AI-Enabled Blood Bank Management System (Free Firebase Spark Edition)

An end-to-end **AI-Enabled Blood Bank Management System Using Google Gemini**, built as a **100% free, zero-billing academic demonstration prototype** hosted as a static single-page application on **Firebase Hosting (Spark Plan)**.

- **Zero Cloud Billing Required**: No Cloud Run, no Cloud SQL, no Cloud Functions, no Blaze plan upgrade, and no credit card required.
- **Public Static Hosting**: Built with Vite into `dist/` and served via **Firebase Hosting**.
- **Database & Auth**: **Firebase Authentication** + **Cloud Firestore** with hardened `firestore.rules` and atomic FIFO stock transactions.
- **AI Integration**: **Firebase AI Logic (`firebase/ai` with `GoogleAIBackend`)** using the **Gemini Developer API Free Tier (`gemini-2.5-flash`)** plus **Firebase App Check** support and an honest deterministic non-AI fallback if free-tier quota is unavailable.

---

## Architecture Overview

```
Authorized User (Browser)
   │
   ▼
Static React + TypeScript SPA (Firebase Hosting — Spark Plan)
   ├── Firebase Authentication (Google Sign-In / Email & Password, instant active access)
   ├── Cloud Firestore (Atomic FIFO Stock Transactions + Hardened Security Rules)
   ├── Deterministic Metrics & Zero-PII Stripper Layer
   │
   ▼ (Protected by Optional Free Firebase App Check reCAPTCHA v3)
Firebase AI Logic (`GoogleAIBackend` — Gemini Developer API Free Tier)
   ├── `gemini-2.5-flash`: Stock Analysis, Shortage Alerts, Reports & Chat
   └── Honest Error + Deterministic Live-Firestore Fallback (when quota/API unavailable)
```

## Firestore Collections
- `users` — User profiles protected by `isOwner(userId) || isAdmin()` rules
- `donors` — Fictional demonstration donor directory across all 8 blood groups (PII never sent to Gemini)
- `blood_inventory` — Traceable blood unit batches with collection/expiry dates, components, and quarantine controls
- `blood_transactions` — Immutable stock ledger (`addition`, `usage`, `quarantine`, `expiry_writeoff`, `adjustment`)
- `blood_requests` — Hospital/requester orders (`pending`, `approved`, `rejected`, `fulfilled`) with atomic FIFO deduction
- `donations` — Donor-linked collection records atomically crediting inventory
- `ai_reports` — Archived Gemini inventory reports
- `activity_logs` — Immutable audit trail
- `system_settings` — Configurable illustrative thresholds (`lowStockMax`, `moderateStockMax`, `nearExpiryDays`)

---

## Firebase Spark Plan Setup (No Credit Card / No Billing)

1. **Ensure Project Remains on Spark Plan**
   - Open [Firebase Console](https://console.firebase.google.com/) for project `gen-lang-client-0843023784` (or your own Spark project).
   - Confirm the plan badge shows **Spark (No-cost)** — do **not** attach a billing account or upgrade to Blaze.

2. **Enable Sign-In Methods**
   - Go to **Build → Authentication → Sign-in method**.
   - Confirm **Google** is enabled.
   - To allow email + password registration/login, enable **Email/Password** as well.
   - Under **Authentication → Settings → Authorized domains**, add your deployed `*.web.app` and `*.firebaseapp.com` domains (Firebase Hosting domains are typically added automatically).

3. **Enable Firebase AI Logic (Free Tier)**
   - Go to **Build → AI Logic** in Firebase Console.
   - Click **Get started** and select **Gemini Developer API** (uses the **Spark free tier** — no Cloud Billing account required; do not select Vertex AI if prompted for billing).

4. **Optional (Recommended): Enable Free Firebase App Check**
   - Register a free **reCAPTCHA v3** site key for your `*.web.app` / `*.firebaseapp.com` domains at Google reCAPTCHA Admin.
   - In Firebase Console, go to **Build → App Check → Apps**, select your Web app, and register the reCAPTCHA v3 secret.
   - Copy `.env.example` to `.env.local` and set your public site key:
     ```bash
     VITE_RECAPTCHA_SITE_KEY="your-public-recaptcha-v3-site-key"
     ```
   - Never put private keys or reCAPTCHA secrets in frontend files.

---

## Local Development & Production Build

```bash
# 1. Install dependencies
npm install

# 2. Run TypeScript check and Firestore rules lint
npm run lint
npm run lint:rules

# 3. Start local Vite dev server (http://localhost:3000)
npm run dev

# 4. Generate static production bundle in dist/
npm run build
```

---

## Free Public Deployment with Firebase CLI (Spark Plan)

Install Firebase CLI if you do not have it yet:

```bash
npm install -g firebase-tools
```

Then deploy the static frontend (`dist/`) and security rules using the pre-configured `firebase.json`, `.firebaserc`, `firestore.rules`, and `firestore.indexes.json`:

```bash
# 1. Authenticate your Google account
firebase login

# 2. (Optional) If using a different Spark Firebase project, select it:
# firebase use --add

# 3. Build the static React production bundle
npm run build

# 4. Deploy Firestore rules/indexes and public Firebase Hosting site (free Spark tier)
firebase deploy --only hosting,firestore
```

To redeploy only frontend UI updates later:

```bash
npm run build
firebase deploy --only hosting
```

After deployment completes, Firebase CLI prints your public HTTPS URL:
- `https://gen-lang-client-0843023784.web.app` (or `https://<your-project-id>.web.app`)

---

## Free-Tier Limitations & Academic Safety Notes
- **Gemini Developer API Free Tier**: Subject to Google's free-tier RPM/RPD quotas and regional availability. If quota is exhausted or AI Logic is not yet enabled in Firebase Console, the app displays an explicit error banner and falls back to **deterministic non-AI stock metrics** computed directly from Firestore (never fabricating AI text).
- **Spark Plan Quotas**: Cloud Firestore (1 GiB storage, 50k reads / 20k writes / 20k deletes per day) and Firebase Hosting (10 GB storage, 360 MB/day transfer) are included free with no credit card.
- **PII & Clinical Guardrails**: Donor PII (names, phones, emails, addresses) is never sent to Gemini. All AI suggestions require human staff/medical review.
