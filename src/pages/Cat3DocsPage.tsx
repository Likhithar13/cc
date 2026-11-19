import React from 'react';
import { BookOpen, Layers, Printer } from 'lucide-react';

export function Cat3DocsPage() {
  return (
    <div className="max-w-5xl space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="text-xs font-mono text-red-700 font-semibold">
            CAT-3 INDIVIDUAL CASE STUDY DOCUMENTATION
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">
            AI-Enabled Blood Bank Management System Using Google Gemini
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Complete engineering documentation, zero-billing Firebase Spark architecture diagram, database schema, and faculty viva walkthrough.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg no-print shrink-0 whitespace-nowrap"
        >
          <Printer className="w-4 h-4" />
          Print Documentation
        </button>
      </div>

      {/* System Architecture Diagram (SVG) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-red-700" />
          <h3 className="font-display text-base font-bold text-slate-900">
            09. System Architecture Diagram (Firebase Spark Free Plan)
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Zero-billing serverless architecture hosted on Firebase Hosting with Firebase Authentication, Firestore Security Rules, App Check, and Firebase AI Logic.
        </p>

        <div className="overflow-x-auto py-2">
          <svg
            viewBox="0 0 980 220"
            className="w-full min-w-[740px] h-auto"
            role="img"
            aria-label="System Architecture Diagram: Browser User to Static React SPA on Firebase Hosting to Firebase Auth, Cloud Firestore, App Check, and Firebase AI Logic Gemini Free Tier"
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
              </marker>
            </defs>

            {/* Box 1: User */}
            <rect x="10" y="55" width="125" height="90" rx="10" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
            <text x="72" y="92" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0F172A">Demo User</text>
            <text x="72" y="112" textAnchor="middle" fontSize="11" fill="#64748B">Browser Client</text>

            {/* Arrow 1 -> 2 */}
            <line x1="135" y1="100" x2="173" y2="100" stroke="#475569" strokeWidth="1.8" markerEnd="url(#arrow)" />

            {/* Box 2: Firebase Hosting + React SPA */}
            <rect x="177" y="42" width="175" height="116" rx="10" fill="#FFFFFF" stroke="#B91C1C" strokeWidth="1.5" />
            <text x="264" y="75" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0F172A">React + TypeScript</text>
            <text x="264" y="94" textAnchor="middle" fontSize="11" fill="#475569">Firebase Hosting (Static)</text>
            <text x="264" y="112" textAnchor="middle" fontSize="11" fill="#475569">Deterministic Metrics</text>
            <text x="264" y="130" textAnchor="middle" fontSize="10" fill="#B91C1C">Zero-PII Stripper Layer</text>

            {/* Arrow 2 -> 3 (Firebase Auth + Firestore) */}
            <line x1="352" y1="75" x2="405" y2="55" stroke="#475569" strokeWidth="1.8" markerEnd="url(#arrow)" />

            {/* Box 3: Firebase Auth & Firestore */}
            <rect x="410" y="12" width="210" height="84" rx="10" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
            <text x="515" y="40" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0F172A">Firebase Auth &amp; Firestore</text>
            <text x="515" y="58" textAnchor="middle" fontSize="10.5" fill="#78350F">Spark Plan · 9 Collections</text>
            <text x="515" y="75" textAnchor="middle" fontSize="10.5" fill="#78350F">Rules + Atomic Transactions</text>

            {/* Arrow 2 -> 4 (App Check + Firebase AI Logic) */}
            <line x1="352" y1="125" x2="405" y2="148" stroke="#475569" strokeWidth="1.8" markerEnd="url(#arrow)" />

            {/* Box 4: Firebase AI Logic + App Check */}
            <rect x="410" y="115" width="210" height="84" rx="10" fill="#FEF2F2" stroke="#DC2626" strokeWidth="1.5" />
            <text x="515" y="143" textAnchor="middle" fontSize="12" fontWeight="700" fill="#991B1B">Firebase AI Logic</text>
            <text x="515" y="161" textAnchor="middle" fontSize="10.5" fill="#7F1D1D">GoogleAIBackend (Free Tier)</text>
            <text x="515" y="178" textAnchor="middle" fontSize="10.5" fill="#7F1D1D">App Check + gemini-2.5-flash</text>

            {/* Arrow 3 & 4 -> 5 */}
            <line x1="620" y1="54" x2="682" y2="90" stroke="#475569" strokeWidth="1.8" markerEnd="url(#arrow)" />
            <line x1="620" y1="156" x2="682" y2="115" stroke="#475569" strokeWidth="1.8" markerEnd="url(#arrow)" />

            {/* Box 5: AI Insights & Fallback UI */}
            <rect x="686" y="45" width="275" height="110" rx="10" fill="#F0FDF4" stroke="#16A34A" strokeWidth="1.5" />
            <text x="823" y="80" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#14532D">Dashboard &amp; AI Insights UI</text>
            <text x="823" y="100" textAnchor="middle" fontSize="10.5" fill="#166534">Alerts, Reports &amp; Chat</text>
            <text x="823" y="118" textAnchor="middle" fontSize="10" fill="#15803D">Deterministic Non-AI Fallback</text>
            <text x="823" y="135" textAnchor="middle" fontSize="10" fill="#15803D">Human Review Notice</text>
          </svg>
        </div>
      </section>

      {/* 16 Structured CAT-3 Sections */}
      <div className="grid md:grid-cols-2 gap-5">
        {[
          {
            num: '01',
            title: 'Problem Statement',
            body: 'Traditional blood bank management relies on manual registers or basic CRUD portals that lack real-time shortage visibility, atomic stock integrity during simultaneous requests, strict access enforcement, and intelligent operational forecasting.',
          },
          {
            num: '02',
            title: 'Proposed Solution',
            body: 'HemoCore is a 100% free, zero-billing AI-enabled Blood Bank Management System combining a static React + TypeScript SPA on Firebase Hosting (Spark plan), Firebase Authentication, atomic Cloud Firestore ledgers, Firebase App Check, and Firebase AI Logic with the Gemini Developer API free tier.',
          },
          {
            num: '03',
            title: 'Objectives',
            body: 'Automate donor, inventory, request, and donation workflows across all 8 blood groups; prevent negative stock via atomic FIFO transactions; enforce authentication and user privacy via Firestore security rules; and deliver grounded Gemini shortage alerts, reports, and chat assistance with deterministic fallback.',
          },
          {
            num: '04',
            title: 'Existing System',
            body: 'Baseline systems store static tables without expiry/quarantine batch tracking, lack immutable stock transaction logs, require paid server hosting, and provide zero AI-assisted operational summarization.',
          },
          {
            num: '05',
            title: 'Proposed System',
            body: 'Introduces batch-level cold-chain inventory tracking (valid, near-expiry, expired, quarantined, depleted), atomic request fulfillment & donation crediting, configurable demonstration stock thresholds, immutable audit logs, and serverless Gemini administrative intelligence.',
          },
          {
            num: '06',
            title: 'Technology Stack (Zero-Billing Spark Plan)',
            body: 'Frontend: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Vite static build. Auth & Database: Firebase Authentication + Cloud Firestore (Spark free tier). Security: Firestore Security Rules + Firebase App Check (reCAPTCHA v3). AI: Firebase AI Logic SDK (GoogleAIBackend, gemini-2.5-flash free tier). Hosting: Firebase Hosting.',
          },
          {
            num: '07',
            title: 'System Architecture',
            body: 'Serverless single-page architecture: Static React bundle served from Firebase Hosting connects directly to Firebase Authentication, Cloud Firestore (enforced by firestore.rules), and Firebase AI Logic. No Cloud Run, Cloud SQL, Cloud Functions, or paid billing account is required.',
          },
          {
            num: '08',
            title: 'Database Design (9 Firestore Collections)',
            body: 'Collections: users (private owner/admin profiles), donors (PII-protected donor directory), blood_inventory (traceable stock batches), blood_transactions (immutable stock ledger), blood_requests (hospital orders), donations (donor-linked collections), ai_reports (archived Gemini reports), activity_logs (audit trail), and system_settings (thresholds).',
          },
          {
            num: '10',
            title: 'Flow of the Tool (Simple Presentation Walkthrough)',
            body: '1. User registers or signs in via Firebase Auth and activates immediately. 2. Staff registers donors, logs donations (auto-crediting stock), and processes hospital blood requests (FIFO atomic deduction). 3. Deterministic logic strips all donor PII and computes anonymized totals. 4. Firebase AI Logic queries Gemini free tier to generate shortage alerts, reports, and chat answers.',
          },
          {
            num: '11',
            title: 'Google Gemini Integration & AI Safety',
            body: 'Uses Firebase AI Logic (GoogleAIBackend) with structured JSON schemas and grounded chat. Safety invariants: zero donor PII sent to Gemini; deterministic client math calculates all quantities; AI never determines blood compatibility, donor eligibility, or request approvals; honest error display with deterministic fallback if quota is unavailable.',
          },
          {
            num: '12',
            title: 'Implementation Details',
            body: 'Atomic Firestore runTransaction() prevents negative stock during request fulfillment and donation intake. Hardened firestore.rules enforce schema blueprints, user profile isolation (owner-only/admin), immutable ledgers, and active-user access, verified with @firebase/eslint-plugin-security-rules.',
          },
          {
            num: '13',
            title: 'Testing & Verification',
            body: 'Verified TypeScript compilation (tsc --noEmit), Vite static production build (dist/), ESLint security rules validation on firestore.rules, Firebase Auth flows, atomic Firestore transactions, and Firebase AI Logic Gemini integration with deterministic fallback.',
          },
          {
            num: '14',
            title: 'Outcome',
            body: 'A publicly deployable, zero-cost academic Blood Bank Management System running entirely on Firebase Spark with live dashboards, full CRUD workflows, audit trails, printable AI inventory reports, and real-time operational Q&A.',
          },
          {
            num: '15',
            title: 'Future Enhancements',
            body: 'Hospital HL7/FHIR order integration, barcode/QR blood bag label scanning, automated opt-in donor recall campaigns, and multi-branch cold-chain IoT temperature telemetry.',
          },
          {
            num: '16',
            title: 'Conclusion',
            body: 'By pairing deterministic Firestore transactions, hardened security rules, and Firebase Hosting with Firebase AI Logic on the Spark plan, HemoCore proves generative AI can enhance clinical administrative workflows at zero hosting cost without compromising patient safety or donor privacy.',
          },
        ].map((item) => (
          <div
            key={item.num}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-red-700">
                {item.num}.
              </span>
              <h3 className="font-display text-sm font-bold text-slate-900">
                {item.title}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>

      {/* Faculty Viva Demo Script */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-red-700" />
          <h3 className="font-display text-base font-bold text-slate-900">
            Step-by-Step Faculty Demonstration Guide
          </h3>
        </div>
        <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-700 leading-relaxed">
          <li>
            <strong>Instant Registration &amp; Login:</strong> Register with Name, Email, and Password (or Continue with Google) to activate immediately and land directly on the Dashboard.
          </li>
          <li>
            <strong>Live Dashboard &amp; Thresholds:</strong> Inspect live demonstration donor counts, 8-blood-group inventory bars, pending/approved requests, and low-stock alerts (using configurable illustrative thresholds under Profile &amp; Settings).
          </li>
          <li>
            <strong>Donor &amp; Donation Atomic Flow:</strong> Open Donor Directory &rarr; Add Donor, then open Donations &rarr; Record Donation to show automatic creation of an inventory batch, donor last-donation update, and transaction ledger entry.
          </li>
          <li>
            <strong>Blood Request FIFO Fulfillment:</strong> Create a Blood Request, Approve it, then click <em>Fulfill &amp; Deduct</em> to demonstrate atomic non-negative stock deduction and transaction history logging.
          </li>
          <li>
            <strong>Firebase AI Logic Gemini Features:</strong> Open <em>AI Insights</em> (shortage alerts &amp; zero-PII recruitment), <em>AI Inventory Reports</em> (report generation + TXT export), and <em>AI Assistant Chat</em> (ask &ldquo;Which blood group has the lowest stock?&rdquo;) to prove live Firestore grounding, clinical safety guardrails, and honest deterministic fallback.
          </li>
        </ol>
      </section>
    </div>
  );
}
