import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  PlusCircle,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  addDaysIsoDate,
  formatFirestoreError,
  generateCode,
  getTodayIsoDate,
} from '../lib/inventoryUtils';
import {
  createBloodRequest,
  fulfillBloodRequest,
  reviewBloodRequest,
} from '../services/firestoreService';
import {
  AppPage,
  BLOOD_COMPONENTS,
  BLOOD_GROUPS,
  BloodComponent,
  BloodGroup,
  BloodInventoryBatch,
  BloodRequest,
  RequestUrgency,
} from '../types/bloodBank';

interface RequestsPageProps {
  mode: 'list' | 'create';
  requests: BloodRequest[];
  batches: BloodInventoryBatch[];
  onNavigate: (page: AppPage) => void;
}

export function RequestsPage({
  mode,
  requests,
  batches,
  onNavigate,
}: RequestsPageProps) {
  const { userProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create request form
  const [requestCode, setRequestCode] = useState(() => generateCode('REQ'));
  const [hospitalOrRequesterName, setHospitalOrRequesterName] = useState('');
  const [requiredBloodGroup, setRequiredBloodGroup] = useState<BloodGroup>('O+');
  const [component, setComponent] = useState<BloodComponent>('Red Blood Cells');
  const [unitsRequested, setUnitsRequested] = useState('2');
  const [urgency, setUrgency] = useState<RequestUrgency>('routine');
  const [requestDate, setRequestDate] = useState(getTodayIsoDate());
  const [requiredDate, setRequiredDate] = useState(() =>
    addDaysIsoDate(getTodayIsoDate(), 1)
  );
  const [notes, setNotes] = useState('');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.requestCode.toLowerCase().includes(q) ||
        r.hospitalOrRequesterName.toLowerCase().includes(q) ||
        r.requiredBloodGroup.toLowerCase().includes(q)
      );
    });
  }, [requests, search, statusFilter]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const units = Number(unitsRequested);
    if (!Number.isInteger(units) || units < 1 || units > 100) {
      setErrorMsg('Units requested must be a whole number between 1 and 100.');
      return;
    }

    setSaving(true);
    try {
      await createBloodRequest(
        {
          requestCode,
          hospitalOrRequesterName,
          requiredBloodGroup,
          component,
          unitsRequested: units,
          urgency,
          requestDate,
          requiredDate,
          notes,
        },
        userProfile
      );
      setSuccessMsg(`Blood request ${requestCode} created.`);
      setRequestCode(generateCode('REQ'));
      setHospitalOrRequesterName('');
      setNotes('');
      onNavigate('requests');
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (
    req: BloodRequest,
    decision: 'approved' | 'rejected'
  ) => {
    if (!userProfile) return;
    setBusyId(req.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await reviewBloodRequest({ requestId: req.id, decision }, userProfile);
      setSuccessMsg(`Request ${req.requestCode} marked as ${decision}.`);
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleFulfill = async (req: BloodRequest) => {
    if (!userProfile) return;
    setBusyId(req.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const candidateBatchIds = batches
        .filter(
          (b) =>
            b.bloodGroup === req.requiredBloodGroup &&
            b.status === 'available' &&
            b.unitsAvailable > 0
        )
        .map((b) => b.id);

      await fulfillBloodRequest(
        { requestId: req.id, candidateBatchIds },
        userProfile
      );
      setSuccessMsg(
        `Request ${req.requestCode} fulfilled atomically (-${req.unitsRequested} units ${req.requiredBloodGroup}).`
      );
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setBusyId(null);
    }
  };

  if (mode === 'create') {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Create Blood Request
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              All clinical requests require authorized staff or administrator review prior to fulfillment.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('requests')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
          >
            Back to Requests
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form
          onSubmit={handleCreateRequest}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Request ID
              </label>
              <input
                type="text"
                required
                pattern="[a-zA-Z0-9_\-]+"
                value={requestCode}
                onChange={(e) => setRequestCode(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Hospital or Requester Name
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={140}
                value={hospitalOrRequesterName}
                onChange={(e) => setHospitalOrRequesterName(e.target.value)}
                placeholder="St. Martha Trauma Center"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Required Blood Group
              </label>
              <select
                value={requiredBloodGroup}
                onChange={(e) => setRequiredBloodGroup(e.target.value as BloodGroup)}
                className="w-full px-3 py-2 text-sm font-mono font-semibold border border-slate-300 rounded-lg bg-white"
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Blood Component
              </label>
              <select
                value={component}
                onChange={(e) => setComponent(e.target.value as BloodComponent)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {BLOOD_COMPONENTS.map((comp) => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Units Requested
              </label>
              <input
                type="number"
                required
                min={1}
                max={100}
                value={unitsRequested}
                onChange={(e) => setUnitsRequested(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Priority / Urgency
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as RequestUrgency)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Request Date
              </label>
              <input
                type="date"
                required
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Required By Date
              </label>
              <input
                type="date"
                required
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Clinical / Dispatch Notes
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ward reference, cross-match verification note, or dispatch instructions"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('requests')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-60"
            >
              <PlusCircle className="w-4 h-4" />
              {saving ? 'Submitting...' : 'Submit Blood Request'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Blood Request Management
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Human-authorized approval and atomic FIFO stock fulfillment across hospital orders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('create-request')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg whitespace-nowrap shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Create Request
        </button>
      </div>

      {/* Safety Boundary Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0" />
        <span>
          <strong>Clinical Governance:</strong> Only verified blood bank staff and administrators can approve, reject, or fulfill requests. Gemini AI never approves orders or determines blood compatibility.
        </span>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search & Status Segmented Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by request ID, hospital name, or blood group..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
          {(['ALL', 'pending', 'approved', 'fulfilled', 'rejected'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            )
          )}
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-500">No blood requests match your filter.</p>
            <button
              type="button"
              onClick={() => onNavigate('create-request')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Create First Request
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Request ID</th>
                  <th className="py-3 px-4 font-medium">Hospital / Requester</th>
                  <th className="py-3 px-4 font-medium">Group</th>
                  <th className="py-3 px-4 font-medium">Component</th>
                  <th className="py-3 px-4 font-medium text-right">Units</th>
                  <th className="py-3 px-4 font-medium">Required Date</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {req.requestCode}
                      <div className="text-[11px] text-slate-400 capitalize">
                        {req.urgency}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {req.hospitalOrRequesterName}
                      </div>
                      {req.notes && (
                        <div className="text-xs text-slate-500 truncate max-w-[220px]">
                          {req.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-red-700">
                      {req.requiredBloodGroup}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">{req.component}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right font-semibold text-slate-900">
                      {req.unitsRequested}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {req.requiredDate}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold capitalize whitespace-nowrap">
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
                      {req.reviewedByName && (
                        <div className="text-[11px] font-normal text-slate-400">
                          by {req.reviewedByName}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {req.status === 'pending' && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === req.id}
                            onClick={() => void handleReview(req, 'approved')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === req.id}
                            onClick={() => void handleReview(req, 'rejected')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      )}
                      {req.status === 'approved' && (
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => void handleFulfill(req)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md disabled:opacity-50"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          {busyId === req.id ? 'Fulfilling...' : 'Fulfill & Deduct'}
                        </button>
                      )}
                      {(req.status === 'fulfilled' || req.status === 'rejected') && (
                        <span className="text-xs text-slate-400">Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
