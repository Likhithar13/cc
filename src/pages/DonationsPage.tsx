import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  addDaysIsoDate,
  formatFirestoreError,
  generateCode,
  getTodayIsoDate,
} from '../lib/inventoryUtils';
import { recordDonation } from '../services/firestoreService';
import {
  BLOOD_COMPONENTS,
  BloodComponent,
  Donation,
  Donor,
} from '../types/bloodBank';

interface DonationsPageProps {
  donors: Donor[];
  donations: Donation[];
}

export function DonationsPage({ donors, donations }: DonationsPageProps) {
  const { userProfile } = useAuth();
  const [donationCode, setDonationCode] = useState(() => generateCode('DON'));
  const [donorId, setDonorId] = useState('');
  const [component, setComponent] = useState<BloodComponent>('Whole Blood');
  const [donationDate, setDonationDate] = useState(getTodayIsoDate());
  const [expiryDate, setExpiryDate] = useState(() =>
    addDaysIsoDate(getTodayIsoDate(), 35)
  );
  const [unitsCollected, setUnitsCollected] = useState('1');
  const [storageLocation, setStorageLocation] = useState('Cold Unit A-1');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedDonor = donors.find((d) => d.id === donorId) ?? null;
  const eligibleDonors = donors.filter((d) => d.availabilityStatus !== 'inactive');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!donorId) {
      setErrorMsg('Please select a registered donor.');
      return;
    }
    const units = Number(unitsCollected);
    if (!Number.isInteger(units) || units < 1 || units > 5) {
      setErrorMsg('Units collected per donation must be between 1 and 5.');
      return;
    }

    setSubmitting(true);
    try {
      await recordDonation(
        {
          donationCode,
          donorId,
          component,
          donationDate,
          expiryDate,
          unitsCollected: units,
          storageLocation,
          notes,
        },
        userProfile
      );
      setSuccessMsg(
        `Donation ${donationCode} recorded atomically (+${units} units ${selectedDonor?.bloodGroup ?? ''} added to inventory).`
      );
      setDonationCode(generateCode('DON'));
      setNotes('');
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          Donation Management
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Register authorized blood donations and automatically credit blood inventory batches via Firestore transactions.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0" />
        <span>
          <strong>Medical Safety Rule:</strong> Donor eligibility screening is performed solely by qualified clinical staff. AI never evaluates donor medical eligibility.
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

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Register Donation Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h3 className="font-display text-base font-semibold text-slate-900">
            Register New Donation
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Donation Reference ID
            </label>
            <input
              type="text"
              required
              pattern="[a-zA-Z0-9_\-]+"
              value={donationCode}
              onChange={(e) => setDonationCode(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select Donor
            </label>
            <select
              required
              value={donorId}
              onChange={(e) => setDonorId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">-- Choose registered donor --</option>
              {eligibleDonors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.donorCode} · {d.fullName} ({d.bloodGroup} · {d.availabilityStatus})
                </option>
              ))}
            </select>
          </div>

          {selectedDonor && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center justify-between">
              <span>
                Confirmed Blood Group:{' '}
                <strong className="font-mono text-red-700">
                  {selectedDonor.bloodGroup}
                </strong>
              </span>
              <span className="text-slate-500">
                Last donation: {selectedDonor.lastDonationDate || 'None'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Component
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
                Units Collected (1–5)
              </label>
              <input
                type="number"
                required
                min={1}
                max={5}
                value={unitsCollected}
                onChange={(e) => setUnitsCollected(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Donation Date
              </label>
              <input
                type="date"
                required
                value={donationDate}
                onChange={(e) => setDonationDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Batch Expiry Date
              </label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Storage Location
            </label>
            <input
              type="text"
              required
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Collection Notes (optional)
            </label>
            <input
              type="text"
              maxLength={350}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Routine voluntary donation, cold-chain verified"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-60"
          >
            <Activity className="w-4 h-4" />
            {submitting ? 'Recording Donation...' : 'Record Donation & Credit Stock'}
          </button>
        </form>

        {/* Donation History Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Donation History ({donations.length})
            </h3>
          </div>
          {donations.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No donations recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-medium">Donation ID</th>
                    <th className="py-3 px-4 font-medium">Donor</th>
                    <th className="py-3 px-4 font-medium">Group</th>
                    <th className="py-3 px-4 font-medium">Component</th>
                    <th className="py-3 px-4 font-medium text-right">Units</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {donations.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {d.donationCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{d.donorName}</div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {d.donorCode}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-red-700">
                        {d.bloodGroup}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">{d.component}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right font-semibold text-emerald-700">
                        +{d.unitsCollected}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {d.donationDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
