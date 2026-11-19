import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  Schema,
  type Content,
} from 'firebase/ai';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { app, auth, db } from '../lib/firebase';
import {
  computeBloodGroupSummaries,
  getBatchExpiryState,
  getTodayIsoDate,
} from '../lib/inventoryUtils';
import {
  AiReportResponse,
  AiStockAnalysisResponse,
  AnonymizedOperationalSnapshot,
  BloodInventoryBatch,
  BloodRequest,
  DEFAULT_SYSTEM_SETTINGS,
  Donation,
  Donor,
  SystemSettings,
} from '../types/bloodBank';

export const GEMINI_FREE_TIER_MODEL = 'gemini-2.5-flash';

export const SAFETY_DISCLAIMER =
  'AI Administrative Suggestion Only — Requires review and authorization by qualified blood bank staff or medical leadership. Never use AI output for clinical compatibility, donor eligibility, or blood release decisions.';

export interface OperationalDatasetInput {
  batches: BloodInventoryBatch[];
  requests: BloodRequest[];
  donors: Donor[];
  donations: Donation[];
  settings: SystemSettings;
}

export class AiUnavailableError extends Error {
  readonly deterministicSummary: AnonymizedOperationalSnapshot;

  constructor(
    message: string,
    deterministicSummary: AnonymizedOperationalSnapshot
  ) {
    super(message);
    this.name = 'AiUnavailableError';
    this.deterministicSummary = deterministicSummary;
  }
}

export function buildAnonymizedOperationalSnapshot(
  input: OperationalDatasetInput
): AnonymizedOperationalSnapshot {
  const today = getTodayIsoDate();
  const byBloodGroup = computeBloodGroupSummaries(
    input.batches,
    input.requests,
    input.donors,
    input.settings
  );

  const componentBreakdown: Record<string, number> = {};
  for (const batch of input.batches) {
    const state = getBatchExpiryState(
      batch,
      input.settings.nearExpiryDays,
      today
    );
    if (state === 'valid' || state === 'near_expiry') {
      componentBreakdown[batch.component] =
        (componentBreakdown[batch.component] ?? 0) + batch.unitsAvailable;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalAvailableUnits: byBloodGroup.reduce(
      (sum, g) => sum + g.availableUnits,
      0
    ),
    nearExpiryUnits: byBloodGroup.reduce(
      (sum, g) => sum + g.nearExpiryUnits,
      0
    ),
    expiredUnits: byBloodGroup.reduce((sum, g) => sum + g.expiredUnits, 0),
    quarantinedUnits: byBloodGroup.reduce(
      (sum, g) => sum + g.quarantinedUnits,
      0
    ),
    lowStockGroups: byBloodGroup
      .filter((g) => g.status === 'low')
      .map((g) => g.bloodGroup),
    moderateStockGroups: byBloodGroup
      .filter((g) => g.status === 'moderate')
      .map((g) => g.bloodGroup),
    sufficientStockGroups: byBloodGroup
      .filter((g) => g.status === 'sufficient')
      .map((g) => g.bloodGroup),
    thresholds: input.settings,
    byBloodGroup,
    componentBreakdown,
    openRequestsSummary: {
      pendingCount: input.requests.filter((r) => r.status === 'pending').length,
      approvedCount: input.requests.filter((r) => r.status === 'approved').length,
      fulfilledCount: input.requests.filter((r) => r.status === 'fulfilled').length,
      rejectedCount: input.requests.filter((r) => r.status === 'rejected').length,
      totalPendingAndApprovedUnits: input.requests
        .filter((r) => r.status === 'pending' || r.status === 'approved')
        .reduce((sum, r) => sum + r.unitsRequested, 0),
    },
    donationsSummary: {
      totalRecordedDonations: input.donations.length,
      totalUnitsCollected: input.donations.reduce(
        (sum, d) => sum + d.unitsCollected,
        0
      ),
    },
    // Strictly anonymous aggregate count — zero donor PII (names/emails/phones/addresses excluded)
    totalAnonymousDonors: input.donors.length,
  };
}

export async function fetchLiveAnonymizedSnapshotFromFirestore(): Promise<AnonymizedOperationalSnapshot> {
  if (!auth.currentUser) {
    throw new Error('Authentication required before running Firestore inventory analysis.');
  }

  const [invSnap, reqSnap, donorSnap, donSnap, settingsSnap] = await Promise.all([
    getDocs(collection(db, 'blood_inventory')),
    getDocs(collection(db, 'blood_requests')),
    getDocs(collection(db, 'donors')),
    getDocs(collection(db, 'donations')),
    getDoc(doc(db, 'system_settings', 'thresholds')),
  ]);

  const batches = invSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as BloodInventoryBatch[];

  const requests = reqSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as BloodRequest[];

  // Strip donor PII immediately upon reading; retain only bloodGroup & availabilityStatus
  const donors = donorSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      donorCode: '',
      fullName: '',
      contactNumber: '',
      email: '',
      age: 0,
      bloodGroup: data.bloodGroup,
      address: '',
      lastDonationDate: '',
      availabilityStatus: data.availabilityStatus,
      registrationDate: '',
      createdBy: '',
    } as Donor;
  });

  const donations = donSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      donationCode: data.donationCode,
      donorId: data.donorId,
      donorCode: '',
      donorName: '',
      bloodGroup: data.bloodGroup,
      component: data.component,
      donationDate: data.donationDate,
      unitsCollected: Number(data.unitsCollected ?? 0),
      inventoryBatchId: data.inventoryBatchId,
      notes: '',
      recordedBy: data.recordedBy,
    } as Donation;
  });

  const settings: SystemSettings = settingsSnap.exists()
    ? {
        lowStockMax: Number(
          settingsSnap.data().lowStockMax ?? DEFAULT_SYSTEM_SETTINGS.lowStockMax
        ),
        moderateStockMax: Number(
          settingsSnap.data().moderateStockMax ??
            DEFAULT_SYSTEM_SETTINGS.moderateStockMax
        ),
        nearExpiryDays: Number(
          settingsSnap.data().nearExpiryDays ??
            DEFAULT_SYSTEM_SETTINGS.nearExpiryDays
        ),
        thresholdNotice: String(
          settingsSnap.data().thresholdNotice ??
            DEFAULT_SYSTEM_SETTINGS.thresholdNotice
        ),
      }
    : DEFAULT_SYSTEM_SETTINGS;

  return buildAnonymizedOperationalSnapshot({
    batches,
    requests,
    donors,
    donations,
    settings,
  });
}

function getFirebaseAiInstance() {
  // Uses Firebase AI Logic with the free-tier-eligible Gemini Developer API backend (no Cloud Billing required)
  return getAI(app, { backend: new GoogleAIBackend() });
}

function formatGeminiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes('api-not-enabled') ||
    lower.includes('firebasevertexai.googleapis.com') ||
    lower.includes('generativelanguage.googleapis.com') ||
    (lower.includes('403') && lower.includes('api'))
  ) {
    return 'Firebase AI Logic is not enabled yet for this Firebase project. In Firebase Console (Spark plan, no billing required), go to Build > AI Logic > Get started > Gemini Developer API (Free Tier). Deterministic Firestore metrics are shown below.';
  }

  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    return 'Gemini Developer API free-tier quota is temporarily exhausted or rate-limited. Deterministic Firestore stock metrics are displayed below as a non-AI fallback.';
  }

  if (lower.includes('app-check') || lower.includes('app check')) {
    return 'Firebase App Check verification rejected the AI request. Verify App Check configuration in Firebase Console. Deterministic Firestore metrics are displayed below.';
  }

  return `Gemini AI request could not complete (${raw}). Deterministic Firestore metrics are shown below as a non-AI fallback.`;
}

function cleanJsonText(rawText: string): string {
  return rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export async function runGeminiStockAnalysis(
  liveDataset?: OperationalDatasetInput
): Promise<AiStockAnalysisResponse> {
  if (!auth.currentUser) {
    throw new Error('Authentication required before running Gemini AI stock analysis.');
  }

  const snapshot = liveDataset
    ? buildAnonymizedOperationalSnapshot(liveDataset)
    : await fetchLiveAnonymizedSnapshotFromFirestore();

  try {
    const ai = getFirebaseAiInstance();
    const model = getGenerativeModel(ai, {
      model: GEMINI_FREE_TIER_MODEL,
      systemInstruction:
        'You are an administrative operations analyst for a blood bank management system. ' +
        'Strictly follow safety rules: NEVER make clinical or medical decisions, NEVER determine blood compatibility, NEVER decide donor medical eligibility, and NEVER approve/reject blood requests. ' +
        'Provide clear, plain-language administrative summaries and suggestions only, strictly grounded in the exact numbers provided in the snapshot.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: Schema.object({
          properties: {
            executiveSummary: Schema.string({
              description:
                'Plain-language administrative overview of current 8-group stock status.',
            }),
            groupObservations: Schema.string({
              description:
                'Explanation covering low, moderate, and sufficient blood groups.',
            }),
            shortageAlerts: Schema.array({
              items: Schema.object({
                properties: {
                  bloodGroup: Schema.string(),
                  severity: Schema.enumString({
                    enum: ['critical', 'warning', 'watch'],
                  }),
                  reason: Schema.string(),
                  suggestedAction: Schema.string(),
                },
              }),
            }),
            managementRecommendations: Schema.array({
              items: Schema.string(),
            }),
            donorRecruitmentSuggestions: Schema.array({
              items: Schema.object({
                properties: {
                  bloodGroup: Schema.string(),
                  priority: Schema.enumString({ enum: ['high', 'medium'] }),
                  rationale: Schema.string(),
                  campaignIdea: Schema.string(),
                },
              }),
            }),
          },
        }),
      },
    });

    const prompt = `Analyze the following deterministic, anonymized blood bank operational snapshot retrieved from Firestore.
All stock quantities and status classifications (low/moderate/sufficient) are already calculated deterministically. Do NOT alter or invent any numbers.
Return structured administrative insights, shortage alerts, general stock-management actions, and anonymous donor recruitment campaign suggestions.

OPERATIONAL SNAPSHOT (ZERO PII):
${JSON.stringify(snapshot, null, 2)}`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(cleanJsonText(result.response.text() || '{}'));

    return {
      deterministicSummary: snapshot,
      modelUsed: GEMINI_FREE_TIER_MODEL,
      aiAnalysis: {
        executiveSummary: parsed.executiveSummary || 'Analysis completed.',
        groupObservations: parsed.groupObservations || '',
        shortageAlerts: Array.isArray(parsed.shortageAlerts)
          ? parsed.shortageAlerts
          : [],
        managementRecommendations: Array.isArray(parsed.managementRecommendations)
          ? parsed.managementRecommendations
          : [],
        donorRecruitmentSuggestions: Array.isArray(
          parsed.donorRecruitmentSuggestions
        )
          ? parsed.donorRecruitmentSuggestions
          : [],
        safetyDisclaimer: SAFETY_DISCLAIMER,
      },
    };
  } catch (err) {
    throw new AiUnavailableError(formatGeminiErrorMessage(err), snapshot);
  }
}

export async function generateGeminiInventoryReport(
  liveDataset?: OperationalDatasetInput
): Promise<{
  report: AiReportResponse;
  deterministicSummary: AnonymizedOperationalSnapshot;
  modelUsed: string;
}> {
  if (!auth.currentUser) {
    throw new Error('Authentication required before generating an AI inventory report.');
  }

  const snapshot = liveDataset
    ? buildAnonymizedOperationalSnapshot(liveDataset)
    : await fetchLiveAnonymizedSnapshotFromFirestore();

  try {
    const ai = getFirebaseAiInstance();
    const model = getGenerativeModel(ai, {
      model: GEMINI_FREE_TIER_MODEL,
      systemInstruction:
        'You are generating an administrative blood bank inventory summary report for facility leadership. ' +
        'Use only the exact figures from the snapshot. Never make clinical decisions, blood compatibility determinations, or donor eligibility assessments. ' +
        'Frame every action item as an administrative recommendation requiring human staff/medical review.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: Schema.object({
          properties: {
            title: Schema.string(),
            summaryText: Schema.string({
              description:
                'Well-structured multi-paragraph administrative inventory report covering total units, all 8 blood groups, low-stock groups, near-expiry/expired/quarantined stock, and observations.',
            }),
            recommendations: Schema.array({
              items: Schema.string(),
            }),
          },
        }),
      },
    });

    const prompt = `Generate a formal administrative Blood Bank Inventory Report based strictly on this verified, anonymized Firestore snapshot.
Include:
1. Total available units and overall operational readiness
2. Blood group-wise summary across all 8 groups (A+, A-, B+, B-, AB+, AB-, O+, O-)
3. Low-stock groups requiring attention
4. Near-expiry, expired, and quarantined stock observations
5. General administrative observations and actionable stock-management recommendations

ANONYMIZED SNAPSHOT (ZERO PII):
${JSON.stringify(snapshot, null, 2)}`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(cleanJsonText(result.response.text() || '{}'));

    return {
      deterministicSummary: snapshot,
      modelUsed: GEMINI_FREE_TIER_MODEL,
      report: {
        title:
          parsed.title ||
          `Administrative Inventory Report — ${getTodayIsoDate()}`,
        reportType: 'full_report',
        totalAvailableUnits: snapshot.totalAvailableUnits,
        nearExpiryUnits: snapshot.nearExpiryUnits,
        expiredUnits: snapshot.expiredUnits,
        quarantinedUnits: snapshot.quarantinedUnits,
        lowStockGroups: snapshot.lowStockGroups,
        summaryText:
          parsed.summaryText || 'Report generated from live inventory data.',
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations
          : [],
        safetyDisclaimer: SAFETY_DISCLAIMER,
        lowStockMaxThreshold: snapshot.thresholds.lowStockMax,
        moderateStockMaxThreshold: snapshot.thresholds.moderateStockMax,
      },
    };
  } catch (err) {
    throw new AiUnavailableError(formatGeminiErrorMessage(err), snapshot);
  }
}

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export async function sendGeminiAssistantMessage(
  message: string,
  history: ChatHistoryTurn[],
  liveDataset?: OperationalDatasetInput
): Promise<{
  reply: string;
  safetyDisclaimer: string;
  snapshotTimestamp: string;
  totalAvailableUnits: number;
  modelUsed: string;
}> {
  if (!auth.currentUser) {
    throw new Error('Authentication required before using the AI assistant.');
  }

  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error('Message text is required.');
  }

  const snapshot = liveDataset
    ? buildAnonymizedOperationalSnapshot(liveDataset)
    : await fetchLiveAnonymizedSnapshotFromFirestore();

  try {
    const ai = getFirebaseAiInstance();
    const systemInstruction = `You are the HemoCore Administrative Blood Bank Assistant.
You are answering an authorized blood bank user (${auth.currentUser.displayName || auth.currentUser.email || 'Authorized User'}).
Below is the LIVE, AUTHORITATIVE, ANONYMIZED Firestore database snapshot right now:

${JSON.stringify(snapshot, null, 2)}

STRICT RULES:
1. Answer ONLY using the verified data in the snapshot above. Never invent stock quantities, batches, or claim access to personal donor details (names, phones, emails, addresses are strictly excluded for privacy).
2. NEVER make medical decisions, determine blood compatibility (e.g. cross-matching), evaluate donor medical eligibility, or approve/reject/fulfill blood requests.
3. If asked to perform a clinical decision or release blood, politely explain that clinical/release decisions require qualified human medical staff and direct them to the Blood Requests or Inventory page.
4. Always note briefly when giving recommendations that they are administrative suggestions requiring human review.
5. Keep responses concise, structured, and accurate with exact unit counts.`;

    const model = getGenerativeModel(ai, {
      model: GEMINI_FREE_TIER_MODEL,
      systemInstruction,
    });

    // Gemini chat history must start with a 'user' turn when non-empty
    const normalizedHistory: Content[] = [];
    for (const turn of history.slice(-10)) {
      const role = turn.role === 'assistant' ? 'model' : 'user';
      if (normalizedHistory.length === 0 && role !== 'user') {
        continue;
      }
      normalizedHistory.push({
        role,
        parts: [{ type: 'text', text: String(turn.text ?? '') }],
      });
    }

    const chat = model.startChat({
      history: normalizedHistory,
    });

    const result = await chat.sendMessage(trimmed);
    return {
      reply: result.response.text() || 'Unable to generate a response.',
      safetyDisclaimer: SAFETY_DISCLAIMER,
      snapshotTimestamp: snapshot.generatedAt,
      totalAvailableUnits: snapshot.totalAvailableUnits,
      modelUsed: GEMINI_FREE_TIER_MODEL,
    };
  } catch (err) {
    throw new AiUnavailableError(formatGeminiErrorMessage(err), snapshot);
  }
}
