import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Save,
  Settings,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatFirestoreError } from '../lib/inventoryUtils';
import {
  initializeSampleDataset,
  saveSystemSettings,
  updateOwnProfile,
} from '../services/firestoreService';
import { SystemSettings } from '../types/bloodBank';

interface ProfileSettingsPageProps {
  settings: SystemSettings;
  hasExistingInventory: boolean;
}

export function ProfileSettingsPage({
  settings,
  hasExistingInventory,
}: ProfileSettingsPageProps) {
  const { userProfile } = useAuth();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [department, setDepartment] = useState(userProfile?.department || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');

  const [lowStockMax, setLowStockMax] = useState(String(settings.lowStockMax));
  const [moderateStockMax, setModerateStockMax] = useState(
    String(settings.moderateStockMax)
  );
  const [nearExpiryDays, setNearExpiryDays] = useState(
    String(settings.nearExpiryDays)
  );
  const [thresholdNotice, setThresholdNotice] = useState(settings.thresholdNotice);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setLowStockMax(String(settings.lowStockMax));
    setModerateStockMax(String(settings.moderateStockMax));
    setNearExpiryDays(String(settings.nearExpiryDays));
    setThresholdNotice(settings.thresholdNotice);
  }, [settings]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setSavingProfile(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateOwnProfile(userProfile.uid, {
        displayName,
        department,
        phone,
      });
      setSuccessMsg('Your user profile has been updated.');
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const low = Number(lowStockMax);
    const mod = Number(moderateStockMax);
    const exp = Number(nearExpiryDays);

    if (!Number.isInteger(low) || low < 1 || low > 100) {
      setErrorMsg('Low-stock upper bound must be between 1 and 100.');
      return;
    }
    if (!Number.isInteger(mod) || mod <= low || mod > 500) {
      setErrorMsg(
        'Moderate-stock upper bound must be greater than Low-stock upper bound (max 500).'
      );
      return;
    }
    if (!Number.isInteger(exp) || exp < 1 || exp > 60) {
      setErrorMsg('Near-expiry window must be between 1 and 60 days.');
      return;
    }

    setSavingSettings(true);
    try {
      await saveSystemSettings(
        {
          lowStockMax: low,
          moderateStockMax: mod,
          nearExpiryDays: exp,
          thresholdNotice,
        },
        userProfile
      );
      setSuccessMsg(
        `Saved illustrative threshold configuration (Low <= ${low}, Moderate <= ${mod}, Near-expiry ${exp}d).`
      );
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleInitializeDataset = async () => {
    if (!userProfile) return;
    setSeeding(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const seeded = await initializeSampleDataset(userProfile);
      setSuccessMsg(
        seeded
          ? 'Demonstration blood bank records initialized in Firestore.'
          : 'Existing records were preserved because inventory is already populated.'
      );
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          Profile &amp; System Settings
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your profile information and configure illustrative blood stock thresholds.
        </p>
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

      {/* User Profile Card */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <UserIcon className="w-4 h-4 text-red-700" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            Account Profile
          </h3>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Email (Verified Identity)
            </label>
            <input
              type="text"
              disabled
              value={userProfile?.email || ''}
              className="w-full px-3 py-2 text-sm bg-slate-50 text-slate-500 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Assigned Role
            </label>
            <input
              type="text"
              disabled
              value={
                userProfile?.role === 'admin'
                  ? 'Administrator (Full Management)'
                  : 'Blood Bank Staff'
              }
              className="w-full px-3 py-2 text-sm bg-slate-50 text-slate-500 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Department
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Contact Phone
            </label>
            <input
              type="tel"
              maxLength={30}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>

      {/* Illustrative Stock Thresholds */}
      <>
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-red-700" />
              <h3 className="font-display text-base font-semibold text-slate-900">
                Illustrative Demonstration Stock Thresholds
              </h3>
            </div>
          </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Default academic thresholds classify fewer than 5 units (&le; 4) as Low stock, 5–9 units as Moderate stock, and 10+ units as Sufficient stock. These values are illustrative demonstration thresholds only, not medical or regulatory standards.
            </p>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Low Stock Upper Bound (&le; units)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={lowStockMax}
                  onChange={(e) => setLowStockMax(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Moderate Stock Upper Bound (&le; units)
                </label>
                <input
                  type="number"
                  required
                  min={2}
                  max={500}
                  value={moderateStockMax}
                  onChange={(e) => setModerateStockMax(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Near-Expiry Warning Window (days)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={60}
                  value={nearExpiryDays}
                  onChange={(e) => setNearExpiryDays(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dashboard Disclaimer Label
              </label>
              <input
                type="text"
                required
                minLength={10}
                maxLength={300}
                value={thresholdNotice}
                onChange={(e) => setThresholdNotice(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {savingSettings ? 'Saving Thresholds...' : 'Save Thresholds'}
              </button>
            </div>
          </form>

          {!hasExistingInventory && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Database className="w-4 h-4 text-red-700" />
                  Academic Demonstration Dataset
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Populate Firestore with sample donors, 8-blood-group stock batches, donations, and clinical requests for faculty demonstration.
                </p>
              </div>
              <button
                type="button"
                disabled={seeding}
                onClick={handleInitializeDataset}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg whitespace-nowrap disabled:opacity-60"
              >
                {seeding ? 'Populating...' : 'Initialize Sample Dataset'}
              </button>
            </div>
          )}
        </>
    </div>
  );
}
