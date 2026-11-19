import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  PackagePlus,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  addDaysIsoDate,
  formatFirestoreError,
  generateCode,
  getBatchExpiryState,
  getTodayIsoDate,
} from '../lib/inventoryUtils';
import {
  addBloodBatch,
  adjustBatchStock,
  quarantineOrExpireBatch,
} from '../services/firestoreService';
import {
  AppPage,
  BLOOD_COMPONENTS,
  BLOOD_GROUPS,
  BloodComponent,
  BloodGroup,
  BloodGroupSummary,
  BloodInventoryBatch,
  BloodTransaction,
  SystemSettings,
} from '../types/bloodBank';

interface InventoryPageProps {
  mode: 'list' | 'add';
  batches: BloodInventoryBatch[];
  transactions: BloodTransaction[];
  summaries: BloodGroupSummary[];
  settings: SystemSettings;
  onNavigate: (page: AppPage) => void;
}

export function InventoryPage({
  mode,
  batches,
  transactions,
  summaries,
  settings,
  onNavigate,
}: InventoryPageProps) {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'batches' | 'transactions'>('batches');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [stateFilter, setStateFilter] = useState<string>('ALL');

  // Add batch form state
  const [stockActionMode, setStockActionMode] = useState<'new_batch' | 'adjust_existing'>('new_batch');
  const [batchCode, setBatchCode] = useState(() => generateCode('BAT'));
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [component, setComponent] = useState<BloodComponent>('Red Blood Cells');
  const [units, setUnits] = useState('5');
  const [collectionDate, setCollectionDate] = useState(getTodayIsoDate());
  const [expiryDate, setExpiryDate] = useState(() => addDaysIsoDate(getTodayIsoDate(), 35));
  const [storageLocation, setStorageLocation] = useState('Cold Unit A-1');
  const [notes, setNotes] = useState('');

  // Adjust existing batch state
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [adjustDelta, setAdjustDelta] = useState('2');
  const [adjustDirection, setAdjustDirection] = useState<'add' | 'use'>('add');
  const [adjustReason, setAdjustReason] = useState('');

  // Modal state for Quarantine / Adjust
  const [quarantineModalBatch, setQuarantineModalBatch] =
    useState<BloodInventoryBatch | null>(null);
  const [quarantineStatus, setQuarantineStatus] = useState<'quarantined' | 'expired'>('quarantined');
  const [quarantineReason, setQuarantineReason] = useState('');

  const [adjustModalBatch, setAdjustModalBatch] =
    useState<BloodInventoryBatch | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const today = getTodayIsoDate();

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (groupFilter !== 'ALL' && b.bloodGroup !== groupFilter) return false;
      const state = getBatchExpiryState(b, settings.nearExpiryDays, today);
      if (stateFilter !== 'ALL' && state !== stateFilter) return false;
      return true;
    });
  }, [batches, groupFilter, stateFilter, settings.nearExpiryDays, today]);

  const handleAddNewBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedUnits = Number(units);
    if (!Number.isInteger(parsedUnits) || parsedUnits < 1) {
      setErrorMsg('Units must be a whole number of at least 1.');
      return;
    }
    if (expiryDate < collectionDate) {
      setErrorMsg('Expiry date cannot be earlier than collection date.');
      return;
    }

    setSubmitting(true);
    try {
      await addBloodBatch(
        {
          batchCode,
          bloodGroup,
          component,
          units: parsedUnits,
          collectionDate,
          expiryDate,
          storageLocation,
          notes,
        },
        userProfile
      );
      setSuccessMsg(`Added batch ${batchCode} (+${parsedUnits} units ${bloodGroup}).`);
      setBatchCode(generateCode('BAT'));
      setNotes('');
      if (mode === 'add') {
        onNavigate('inventory');
      }
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustExisting = async (e: React.FormEvent, targetBatchId?: string) => {
    e.preventDefault();
    if (!userProfile) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const batchId = targetBatchId || selectedBatchId;
    const qty = Number(adjustDelta);
    if (!batchId) {
      setErrorMsg('Please select an inventory batch.');
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setErrorMsg('Adjustment quantity must be a positive whole number.');
      return;
    }

    const delta = adjustDirection === 'add' ? qty : -qty;
    setSubmitting(true);
    try {
      await adjustBatchStock(
        {
          batchId,
          deltaUnits: delta,
          reason:
            adjustReason.trim() ||
            (adjustDirection === 'add' ? 'Manual stock addition' : 'Clinical stock usage'),
        },
        userProfile
      );
      setSuccessMsg(
        `Inventory updated (${delta > 0 ? `+${delta}` : delta} units) and logged to transaction ledger.`
      );
      setAdjustModalBatch(null);
      setAdjustReason('');
      if (mode === 'add') {
        onNavigate('inventory');
      }
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuarantineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !quarantineModalBatch) return;
    if (!quarantineReason.trim()) {
      setErrorMsg('Please provide a reason for quarantine or expiry write-off.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await quarantineOrExpireBatch(
        {
          batchId: quarantineModalBatch.id,
          newStatus: quarantineStatus,
          reason: quarantineReason.trim(),
        },
        userProfile
      );
      setSuccessMsg(
        `Batch ${quarantineModalBatch.batchCode} marked as ${quarantineStatus}.`
      );
      setQuarantineModalBatch(null);
      setQuarantineReason('');
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'add') {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Add or Update Blood Stock
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Atomic Firestore transactions ensure stock never becomes negative and every change is audited.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
          >
            Back to Inventory
          </button>
        </div>

        <div className="inline-flex p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setStockActionMode('new_batch')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              stockActionMode === 'new_batch'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Add New Batch
          </button>
          <button
            type="button"
            onClick={() => setStockActionMode('adjust_existing')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              stockActionMode === 'adjust_existing'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Adjust Existing Batch
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {stockActionMode === 'new_batch' ? (
          <form
            onSubmit={handleAddNewBatch}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Batch Code
                </label>
                <input
                  type="text"
                  required
                  pattern="[a-zA-Z0-9_\-]+"
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Blood Group
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
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
                  Number of Units
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={500}
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Collection Date
                </label>
                <input
                  type="date"
                  required
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cold-Chain Storage Location
                </label>
                <input
                  type="text"
                  required
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="Cold Unit A-1"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Transaction Notes (optional)
                </label>
                <input
                  type="text"
                  maxLength={350}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Routine regional blood drive intake"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onNavigate('inventory')}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-60"
              >
                <PackagePlus className="w-4 h-4" />
                {submitting ? 'Adding Batch...' : 'Add Stock Batch'}
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => void handleAdjustExisting(e)}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Inventory Batch
                </label>
                <select
                  required
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">-- Choose a batch --</option>
                  {batches
                    .filter((b) => b.status === 'available' || b.status === 'depleted')
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batchCode} · {b.bloodGroup} · {b.component} ({b.unitsAvailable} units avail · exp {b.expiryDate})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Operation Type
                </label>
                <select
                  value={adjustDirection}
                  onChange={(e) => setAdjustDirection(e.target.value as 'add' | 'use')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="add">Record Stock Addition (+)</option>
                  <option value="use">Record Stock Usage (-)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Units Delta
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={500}
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason / Clinical Reference
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ward issuance or verified unit intake"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onNavigate('inventory')}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-60"
              >
                {submitting ? 'Updating...' : 'Apply Atomic Update'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Blood Inventory &amp; Batch Control
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Track all 8 blood groups, blood components, expiry windows, quarantine holds, and immutable stock ledger.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('add-stock')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <PackagePlus className="w-4 h-4" />
          Add / Update Stock
        </button>
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

      {/* 8-Blood-Group Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {summaries.map((g) => (
          <button
            key={g.bloodGroup}
            type="button"
            onClick={() =>
              setGroupFilter(groupFilter === g.bloodGroup ? 'ALL' : g.bloodGroup)
            }
            className={`text-left border rounded-xl p-3.5 transition-colors ${
              groupFilter === g.bloodGroup
                ? 'border-red-700 bg-red-50/40'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-base font-bold text-slate-900">
                {g.bloodGroup}
              </span>
              <span
                className={`text-[11px] font-semibold capitalize ${
                  g.status === 'low'
                    ? 'text-red-700'
                    : g.status === 'moderate'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                }`}
              >
                {g.status}
              </span>
            </div>
            <div className="mt-2 font-mono tabular-nums text-xl font-bold text-slate-900">
              {g.availableUnits}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {g.nearExpiryUnits > 0 ? `${g.nearExpiryUnits} near exp` : `${g.activeBatches} batches`}
            </div>
          </button>
        ))}
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setActiveTab('batches')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'batches'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stock Batches ({batches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Transaction History ({transactions.length})
          </button>
        </div>

        {activeTab === 'batches' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Blood Groups</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Batch States</option>
              <option value="valid">Valid Available</option>
              <option value="near_expiry">Near Expiry (&le; {settings.nearExpiryDays}d)</option>
              <option value="expired">Expired</option>
              <option value="quarantined">Quarantined</option>
              <option value="depleted">Depleted</option>
            </select>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'batches' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredBatches.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-slate-500">No inventory batches match the selected filters.</p>
              <button
                type="button"
                onClick={() => onNavigate('add-stock')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                Add Blood Batch
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-medium">Batch ID</th>
                    <th className="py-3 px-4 font-medium">Group</th>
                    <th className="py-3 px-4 font-medium">Component</th>
                    <th className="py-3 px-4 font-medium text-right">Units</th>
                    <th className="py-3 px-4 font-medium">Collected</th>
                    <th className="py-3 px-4 font-medium">Expires</th>
                    <th className="py-3 px-4 font-medium">Storage</th>
                    <th className="py-3 px-4 font-medium">State</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBatches.map((batch) => {
                    const state = getBatchExpiryState(batch, settings.nearExpiryDays, today);
                    return (
                      <tr key={batch.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                          {batch.batchCode}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-red-700">
                          {batch.bloodGroup}
                        </td>
                        <td className="py-3 px-4 text-slate-800">
                          {batch.component}
                          {batch.quarantineReason && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                              {batch.quarantineReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-right font-semibold text-slate-900">
                          {batch.unitsAvailable} / {batch.initialUnits}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {batch.collectionDate}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                          {batch.expiryDate}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {batch.storageLocation}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap">
                          {state === 'valid' && (
                            <span className="text-emerald-700">Available</span>
                          )}
                          {state === 'near_expiry' && (
                            <span className="text-amber-700 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Near Expiry
                            </span>
                          )}
                          {state === 'expired' && (
                            <span className="text-red-700 inline-flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Expired
                            </span>
                          )}
                          {state === 'quarantined' && (
                            <span className="text-red-800">Quarantined</span>
                          )}
                          {state === 'depleted' && (
                            <span className="text-slate-400">Depleted</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {(state === 'valid' || state === 'near_expiry' || state === 'depleted') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAdjustModalBatch(batch);
                                  setAdjustDelta('1');
                                  setAdjustDirection('use');
                                  setAdjustReason('');
                                }}
                                title="Adjust stock units"
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>
                            )}
                            {batch.status !== 'quarantined' && batch.status !== 'depleted' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setQuarantineModalBatch(batch);
                                  setQuarantineStatus(
                                    state === 'expired' ? 'expired' : 'quarantined'
                                  );
                                  setQuarantineReason(
                                    state === 'expired'
                                      ? 'Past shelf expiry window'
                                      : ''
                                  );
                                }}
                                title="Quarantine or write off batch"
                                className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded"
                              >
                                <ShieldAlert className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No stock transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-medium">Timestamp</th>
                    <th className="py-3 px-4 font-medium">Type</th>
                    <th className="py-3 px-4 font-medium">Group</th>
                    <th className="py-3 px-4 font-medium">Component</th>
                    <th className="py-3 px-4 font-medium text-right">Delta</th>
                    <th className="py-3 px-4 font-medium text-right">After</th>
                    <th className="py-3 px-4 font-medium">Reference</th>
                    <th className="py-3 px-4 font-medium">Notes</th>
                    <th className="py-3 px-4 font-medium">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {tx.createdAt ? tx.createdAt.slice(0, 16).replace('T', ' ') : ''}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-semibold capitalize text-slate-700">
                        {tx.transactionType.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-red-700">
                        {tx.bloodGroup}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-700">{tx.component}</td>
                      <td
                        className={`py-2.5 px-4 font-mono tabular-nums text-right font-semibold ${
                          tx.unitsDelta > 0
                            ? 'text-emerald-700'
                            : tx.unitsDelta < 0
                              ? 'text-red-700'
                              : 'text-slate-600'
                        }`}
                      >
                        {tx.unitsDelta > 0 ? `+${tx.unitsDelta}` : tx.unitsDelta}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-900">
                        {tx.unitsAfter}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600">
                        {tx.referenceId}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 max-w-[220px] truncate">
                        {tx.notes}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">
                        {tx.performedByName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Quick Stock Adjustment */}
      {adjustModalBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">
                Adjust Batch · {adjustModalBatch.batchCode} ({adjustModalBatch.bloodGroup})
              </h3>
              <button
                type="button"
                onClick={() => setAdjustModalBatch(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Current available units: <strong className="font-mono">{adjustModalBatch.unitsAvailable}</strong>
            </p>
            <form
              onSubmit={(e) => void handleAdjustExisting(e, adjustModalBatch.id)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Action
                  </label>
                  <select
                    value={adjustDirection}
                    onChange={(e) => setAdjustDirection(e.target.value as 'add' | 'use')}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="use">Deduct Usage (-)</option>
                    <option value="add">Add Units (+)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Units
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={500}
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Emergency ward dispatch or reconciliation"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalBatch(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg"
                >
                  {submitting ? 'Updating...' : 'Commit Atomic Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quarantine / Expiry Write-Off */}
      {quarantineModalBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">
                Quarantine / Expire · {quarantineModalBatch.batchCode}
              </h3>
              <button
                type="button"
                onClick={() => setQuarantineModalBatch(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleQuarantineSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Classification
                </label>
                <select
                  value={quarantineStatus}
                  onChange={(e) =>
                    setQuarantineStatus(e.target.value as 'quarantined' | 'expired')
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="quarantined">Quarantined (Unsuitable / Hold)</option>
                  <option value="expired">Expired (Past Shelf Window)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason (required for audit log)
                </label>
                <textarea
                  required
                  rows={2}
                  maxLength={240}
                  value={quarantineReason}
                  onChange={(e) => setQuarantineReason(e.target.value)}
                  placeholder="Describe cold-chain excursion, failed QC, or expiry date."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuarantineModalBatch(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg"
                >
                  {submitting ? 'Saving...' : 'Confirm Status Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
