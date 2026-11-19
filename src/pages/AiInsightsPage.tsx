import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
} from 'lucide-react';
import {
  AiUnavailableError,
  fetchAiStockAnalysis,
  type OperationalDatasetInput,
} from '../services/apiService';
import {
  AiStockAnalysisResponse,
  AnonymizedOperationalSnapshot,
  BloodGroupSummary,
  SystemSettings,
} from '../types/bloodBank';

interface AiInsightsPageProps {
  summaries: BloodGroupSummary[];
  settings: SystemSettings;
  liveDataset?: OperationalDatasetInput;
}

export function AiInsightsPage({
  summaries,
  settings,
  liveDataset,
}: AiInsightsPageProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<AiStockAnalysisResponse | null>(null);
  const [fallbackSnapshot, setFallbackSnapshot] =
    useState<AnonymizedOperationalSnapshot | null>(null);

  const handleRunAnalysis = async () => {
    setLoading(true);
    setErrorMsg(null);
    setFallbackSnapshot(null);
    try {
      const data = await fetchAiStockAnalysis(liveDataset);
      setResult(data);
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        setErrorMsg(err.message);
        setFallbackSnapshot(err.deterministicSummary);
        setResult(null);
      } else {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Failed to run Gemini stock analysis.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const activeSummaries =
    result?.deterministicSummary.byBloodGroup ??
    fallbackSnapshot?.byBloodGroup ??
    summaries;
  const lowGroups = activeSummaries.filter((g) => g.status === 'low');
  const modGroups = activeSummaries.filter((g) => g.status === 'moderate');
  const sufGroups = activeSummaries.filter((g) => g.status === 'sufficient');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Google Gemini AI Insights &amp; Shortage Alerts
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Uses Firebase AI Logic (Gemini Developer API free tier) with strictly anonymized live Firestore totals.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={handleRunAnalysis}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyzing with Gemini...' : 'Run Gemini Stock Analysis'}
        </button>
      </div>

      {/* Mandatory AI Safety & Privacy Guardrail Notice */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <div className="font-semibold">
            AI Administrative Safety &amp; Privacy Guardrails Active
          </div>
          <p>
            All AI outputs are <strong>administrative suggestions requiring human review</strong>. Gemini never receives donor PII (names, phone numbers, emails, addresses) and never makes medical, blood compatibility, donor eligibility, or request approval decisions. {settings.thresholdNotice}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold">Gemini AI Unavailable</div>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Deterministic Stock Classification */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-red-700">
            <span>Low Stock (&le; {settings.lowStockMax} units)</span>
            <TrendingDown className="w-4 h-4" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {lowGroups.length} groups
          </div>
          <div className="mt-2 text-xs text-slate-600 font-mono">
            {lowGroups.length > 0
              ? lowGroups
                  .map((g) => `${g.bloodGroup} (${g.availableUnits}u)`)
                  .join(' · ')
              : 'None'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
            <span>
              Moderate Stock ({settings.lowStockMax + 1}–{settings.moderateStockMax}{' '}
              units)
            </span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {modGroups.length} groups
          </div>
          <div className="mt-2 text-xs text-slate-600 font-mono">
            {modGroups.length > 0
              ? modGroups
                  .map((g) => `${g.bloodGroup} (${g.availableUnits}u)`)
                  .join(' · ')
              : 'None'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
            <span>
              Sufficient Stock (&ge; {settings.moderateStockMax + 1} units)
            </span>
            <Bot className="w-4 h-4" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {sufGroups.length} groups
          </div>
          <div className="mt-2 text-xs text-slate-600 font-mono">
            {sufGroups.length > 0
              ? sufGroups
                  .map((g) => `${g.bloodGroup} (${g.availableUnits}u)`)
                  .join(' · ')
              : 'None'}
          </div>
        </div>
      </div>

      {/* Deterministic Fallback View (only shown when Gemini call failed; clearly labeled Non-AI) */}
      {!result && fallbackSnapshot && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Deterministic Firestore Stock Fallback (Non-AI)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Computed directly from live Firestore batches &amp; requests — not generated by Gemini.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Snapshot:{' '}
              {fallbackSnapshot.generatedAt.slice(0, 19).replace('T', ' ')} UTC
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500">Available Units</div>
              <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {fallbackSnapshot.totalAvailableUnits}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500">Near-Expiry</div>
              <div className="font-mono text-lg font-bold text-amber-700 tabular-nums">
                {fallbackSnapshot.nearExpiryUnits}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500">Expired</div>
              <div className="font-mono text-lg font-bold text-red-700 tabular-nums">
                {fallbackSnapshot.expiredUnits}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500">Quarantined</div>
              <div className="font-mono text-lg font-bold text-slate-700 tabular-nums">
                {fallbackSnapshot.quarantinedUnits}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 px-3 font-medium">Blood Group</th>
                  <th className="py-2 px-3 font-medium text-right">Available</th>
                  <th className="py-2 px-3 font-medium text-right">Near-Expiry</th>
                  <th className="py-2 px-3 font-medium text-right">Open Req.</th>
                  <th className="py-2 px-3 font-medium text-right">Avail. Donors</th>
                  <th className="py-2 px-3 font-medium">Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fallbackSnapshot.byBloodGroup.map((g) => (
                  <tr key={g.bloodGroup}>
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">
                      {g.bloodGroup}
                    </td>
                    <td className="py-2 px-3 font-mono text-right tabular-nums">
                      {g.availableUnits}
                    </td>
                    <td className="py-2 px-3 font-mono text-right tabular-nums text-amber-700">
                      {g.nearExpiryUnits}
                    </td>
                    <td className="py-2 px-3 font-mono text-right tabular-nums">
                      {g.pendingRequestedUnits}
                    </td>
                    <td className="py-2 px-3 font-mono text-right tabular-nums">
                      {g.availableDonorsCount}
                    </td>
                    <td className="py-2 px-3 font-semibold capitalize">
                      <span
                        className={
                          g.status === 'low'
                            ? 'text-red-700'
                            : g.status === 'moderate'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }
                      >
                        {g.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!result && !fallbackSnapshot ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Bot className="w-8 h-8 text-red-700 mx-auto" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            Ready to Analyze Live Blood Bank Inventory
          </h3>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            Click <strong>Run Gemini Stock Analysis</strong> above to send anonymized live Firestore metrics to Firebase AI Logic (Gemini Developer API free tier) for plain-language stock observations, shortage alerts, and anonymous donor recruitment suggestions.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={handleRunAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg"
          >
            <Bot className="w-3.5 h-3.5" />
            Generate AI Insights Now
          </button>
        </div>
      ) : result ? (
        <div className="space-y-6">
          {/* Executive Summary & Observations */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Gemini Operational Stock Explanation
              </h3>
              <span className="text-xs font-mono text-slate-500">
                {result.modelUsed || 'gemini-2.5-flash'} · Snapshot:{' '}
                {result.deterministicSummary.generatedAt
                  .slice(0, 19)
                  .replace('T', ' ')}{' '}
                UTC
              </span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">
              {result.aiAnalysis.executiveSummary}
            </p>
            {result.aiAnalysis.groupObservations && (
              <p className="text-sm text-slate-600 leading-relaxed">
                {result.aiAnalysis.groupObservations}
              </p>
            )}
            <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
              {result.aiAnalysis.safetyDisclaimer}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* AI Shortage Alerts */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-700" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  AI Shortage &amp; Attention Alerts
                </h3>
              </div>
              {result.aiAnalysis.shortageAlerts.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No urgent shortage alerts flagged by Gemini for current stock totals.
                </p>
              ) : (
                <div className="space-y-3">
                  {result.aiAnalysis.shortageAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-red-700">
                          Blood Group {alert.bloodGroup}
                        </span>
                        <span
                          className={`text-xs font-semibold capitalize ${
                            alert.severity === 'critical'
                              ? 'text-red-700'
                              : alert.severity === 'warning'
                                ? 'text-amber-700'
                                : 'text-slate-600'
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">{alert.reason}</p>
                      <p className="text-xs text-slate-500">
                        <strong>Suggested action:</strong> {alert.suggestedAction}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Donor Recruitment Suggestions (Zero PII) */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-red-700" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  AI Donor Recruitment Suggestions (Zero PII)
                </h3>
              </div>
              {result.aiAnalysis.donorRecruitmentSuggestions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No targeted recruitment campaigns needed at current levels.
                </p>
              ) : (
                <div className="space-y-3">
                  {result.aiAnalysis.donorRecruitmentSuggestions.map(
                    (item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/50 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {item.bloodGroup} Campaign
                          </span>
                          <span className="text-xs font-semibold capitalize text-red-700">
                            {item.priority} priority
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">{item.rationale}</p>
                        <p className="text-xs text-slate-500">
                          <strong>Outreach suggestion:</strong>{' '}
                          {item.campaignIdea}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* General Stock-Management Recommendations */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="font-display text-base font-semibold text-slate-900">
              General Stock-Management Recommendations (Human Review Required)
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700">
              {result.aiAnalysis.managementRecommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
