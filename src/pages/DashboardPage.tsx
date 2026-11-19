import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  Database,
  Droplet,
  PackagePlus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  ActivityLog,
  AppPage,
  BloodGroupSummary,
  BloodInventoryBatch,
  BloodRequest,
  Donation,
  Donor,
  SystemSettings,
} from '../types/bloodBank';
import { initializeSampleDataset } from '../services/firestoreService';
import { formatFirestoreError } from '../lib/inventoryUtils';

interface DashboardPageProps {
  mode: 'admin' | 'staff';
  donors: Donor[];
  batches: BloodInventoryBatch[];
  requests: BloodRequest[];
  donations: Donation[];
  logs: ActivityLog[];
  summaries: BloodGroupSummary[];
  settings: SystemSettings;
  loadingData: boolean;
  onNavigate: (page: AppPage) => void;
}

export function DashboardPage({
  mode,
  donors,
  batches,
  requests,
  donations,
  logs,
  summaries,
  settings,
  loadingData,
  onNavigate,
}: DashboardPageProps) {
  const { userProfile } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<'activities' | 'donations'>('activities');

  const totalUnitsAvailable = summaries.reduce((s, g) => s + g.availableUnits, 0);
  const totalNearExpiry = summaries.reduce((s, g) => s + g.nearExpiryUnits, 0);
  const totalExpired = summaries.reduce((s, g) => s + g.expiredUnits, 0);
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const lowStockGroups = summaries.filter((g) => g.status === 'low');

  const maxChartUnits = Math.max(
    12,
    ...summaries.map((g) => g.availableUnits)
  );

  const handleInitializeSample = async () => {
    if (!userProfile) return;
    setSeeding(true);
    setSeedError(null);
    try {
      await initializeSampleDataset(userProfile);
    } catch (err) {
      setSeedError(formatFirestoreError(err));
    } finally {
      setSeeding(false);
    }
  };

  if (loadingData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const isEmptyDatabase =
    donors.length === 0 && batches.length === 0 && requests.length === 0;

  return (
    <div className="space-y-6">
      {/* Header Context & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Blood Bank Operations Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Live Firestore inventory metrics across 8 blood groups · {settings.thresholdNotice}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('add-donor')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Donor
          </button>
          <button
            type="button"
            onClick={() => onNavigate('add-stock')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            Add Stock
          </button>
          <button
            type="button"
            onClick={() => onNavigate('donations')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Activity className="w-3.5 h-3.5" />
            Record Donation
          </button>
        </div>
      </div>

      {/* Clear Academic Demonstration Dataset Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
        <div>
          <strong className="text-slate-800">Academic Demonstration Data:</strong>{' '}
          Donors, stock batches across all 8 blood groups, requests, and donations shown here are fictional sample records for CAT-3 prototype evaluation — not real hospital inventory.
        </div>
      </div>

      {/* Empty Database Onboarding Card */}
      {isEmptyDatabase && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              <Database className="w-4 h-4 text-red-700" />
              Firestore Database Ready — No Records Yet
            </div>
            <p className="text-sm text-slate-600">
              Start by registering donors and adding blood inventory batches manually, or load the fictional academic demonstration dataset across all 8 blood groups.
            </p>
            {seedError && <p className="text-xs text-red-700 pt-1">{seedError}</p>}
          </div>
          <button
            type="button"
            disabled={seeding}
            onClick={handleInitializeSample}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {seeding ? 'Loading Sample Data...' : 'Load Demonstration Data'}
          </button>
        </div>
      )}

      {/* Low-Stock & Expiry Alert Strip */}
      {(lowStockGroups.length > 0 || totalNearExpiry > 0 || totalExpired > 0) && (
        <div className="bg-red-50/70 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-800 space-y-0.5">
              <div className="font-semibold text-red-900">
                Stock Attention Notice
              </div>
              <div className="text-xs text-red-800">
                {lowStockGroups.length > 0 && (
                  <span>
                    Low-stock groups (&le; {settings.lowStockMax} units):{' '}
                    <strong className="font-mono">
                      {lowStockGroups.map((g) => `${g.bloodGroup} (${g.availableUnits})`).join(', ')}
                    </strong>
                    .{' '}
                  </span>
                )}
                {totalNearExpiry > 0 && (
                  <span>
                    Near-expiry (&le; {settings.nearExpiryDays}d):{' '}
                    <strong className="font-mono">{totalNearExpiry} units</strong>.{' '}
                  </span>
                )}
                {totalExpired > 0 && (
                  <span>
                    Expired units needing quarantine:{' '}
                    <strong className="font-mono">{totalExpired} units</strong>.
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('ai-insights')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-800 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Bot className="w-3.5 h-3.5" />
            Run Gemini Analysis
          </button>
        </div>
      )}

      {/* 6 Primary KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Donors</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-slate-900">
            {donors.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {donors.filter((d) => d.availabilityStatus === 'available').length} available
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Units Available</span>
            <Droplet className="w-4 h-4 text-red-700" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-slate-900">
            {totalUnitsAvailable}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {lowStockGroups.length} low-stock groups
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Requests</span>
            <ClipboardList className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-slate-900">
            {requests.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {requests.filter((r) => r.status === 'fulfilled').length} fulfilled
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending Requests</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-amber-700">
            {pendingRequests.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Awaiting review</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Approved Requests</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-emerald-700">
            {approvedRequests.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Ready to fulfill</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Donations Logged</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-slate-900">
            {donations.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {donations.reduce((s, d) => s + d.unitsCollected, 0)} units collected
          </div>
        </div>
      </div>

      {/* Blood Group-Wise Inventory Chart & 8-Group Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Blood Group-Wise Available Stock (8 Groups)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Illustrative thresholds: Low &le; {settings.lowStockMax} units · Moderate{' '}
              {settings.lowStockMax + 1}–{settings.moderateStockMax} units · Sufficient &ge;{' '}
              {settings.moderateStockMax + 1} units
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 whitespace-nowrap"
          >
            Open Full Inventory
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Clean Responsive Bar Visualization + Structured Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {summaries.map((group) => {
            const pct = Math.min(100, Math.round((group.availableUnits / maxChartUnits) * 100));
            const barColor =
              group.status === 'low'
                ? 'bg-red-600'
                : group.status === 'moderate'
                  ? 'bg-amber-500'
                  : 'bg-emerald-600';
            const statusTextColor =
              group.status === 'low'
                ? 'text-red-700'
                : group.status === 'moderate'
                  ? 'text-amber-700'
                  : 'text-emerald-700';

            return (
              <div
                key={group.bloodGroup}
                className="border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between bg-slate-50/40"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-base font-bold text-slate-900">
                    {group.bloodGroup}
                  </span>
                  <span className={`text-[11px] font-semibold capitalize ${statusTextColor}`}>
                    {group.status}
                  </span>
                </div>

                <div className="my-3 h-20 flex items-end">
                  <div className="w-full bg-slate-200/70 rounded-sm h-full flex items-end overflow-hidden">
                    <div
                      className={`w-full transition-all duration-300 ${barColor}`}
                      style={{ height: `${Math.max(group.availableUnits > 0 ? 10 : 0, pct)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="font-mono tabular-nums text-lg font-bold text-slate-900">
                    {group.availableUnits}{' '}
                    <span className="text-xs font-normal text-slate-500">units</span>
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {group.pendingRequestedUnits > 0
                      ? `${group.pendingRequestedUnits} req · `
                      : ''}
                    {group.availableDonorsCount} donors
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom 2-Column Operational Feeds */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Recent Blood Requests */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Recent Blood Requests
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('requests')}
              className="text-xs font-semibold text-red-700 hover:text-red-800 whitespace-nowrap"
            >
              Manage All Requests
            </button>
          </div>
          {requests.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No blood requests recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Request</th>
                    <th className="py-2.5 px-4 font-medium">Hospital / Requester</th>
                    <th className="py-2.5 px-4 font-medium">Group</th>
                    <th className="py-2.5 px-4 font-medium text-right">Units</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.slice(0, 6).map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {req.requestCode}
                      </td>
                      <td className="py-2.5 px-4 text-slate-900 font-medium truncate max-w-[180px]">
                        {req.hospitalOrRequesterName}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                        {req.requiredBloodGroup}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-900">
                        {req.unitsRequested}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-semibold capitalize">
                        <span
                          className={
                            req.status === 'fulfilled'
                              ? 'text-emerald-700'
                              : req.status === 'approved'
                                ? 'text-blue-700'
                                : req.status === 'rejected'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                          }
                        >
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent System Activities & Donations */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setFeedTab('activities')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  feedTab === 'activities'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Recent Activities
              </button>
              <button
                type="button"
                onClick={() => setFeedTab('donations')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  feedTab === 'donations'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Recent Donations
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                onNavigate(feedTab === 'activities' ? 'activity-logs' : 'donations')
              }
              className="text-xs font-semibold text-red-700 hover:text-red-800 whitespace-nowrap"
            >
              {feedTab === 'activities' ? 'View All Logs' : 'Open Donations'}
            </button>
          </div>
          {feedTab === 'activities' ? (
            logs.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No audit activity logged yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.slice(0, 6).map((log) => (
                  <div key={log.id} className="px-5 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-medium text-slate-700">
                        {log.action}
                      </span>
                      <span className="text-slate-400 tabular-nums shrink-0">
                        {log.createdAt ? log.createdAt.slice(0, 16).replace('T', ' ') : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-snug">
                      {log.description}
                    </p>
                    <div className="text-[11px] text-slate-400">
                      {log.actorName} · {log.category}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : donations.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No donations recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {donations.slice(0, 6).map((don) => (
                <div key={don.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {don.donorName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {don.donationCode} · {don.component} · {don.donationDate}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-red-700">
                      {don.bloodGroup}
                    </div>
                    <div className="font-mono tabular-nums text-xs text-slate-600">
                      +{don.unitsCollected} units
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
