import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Eye,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  formatFirestoreError,
  generateCode,
  getTodayIsoDate,
} from '../lib/inventoryUtils';
import {
  createDonor,
  deleteDonor,
  updateDonor,
} from '../services/firestoreService';
import {
  AppPage,
  BLOOD_GROUPS,
  BloodGroup,
  Donation,
  Donor,
  DonorAvailability,
} from '../types/bloodBank';

interface DonorsPageProps {
  mode: 'list' | 'add';
  donors: Donor[];
  donations: Donation[];
  onNavigate: (page: AppPage) => void;
}

export function DonorsPage({
  mode,
  donors,
  donations,
  onNavigate,
}: DonorsPageProps) {
  const { userProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState<string>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('ALL');

  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);

  // Form state for Add or Edit
  const [donorCode, setDonorCode] = useState(() => generateCode('DNR'));
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('25');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [address, setAddress] = useState('');
  const [lastDonationDate, setLastDonationDate] = useState('');
  const [availabilityStatus, setAvailabilityStatus] =
    useState<DonorAvailability>('available');
  const [registrationDate, setRegistrationDate] = useState(getTodayIsoDate());

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredDonors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return donors.filter((d) => {
      if (bloodGroupFilter !== 'ALL' && d.bloodGroup !== bloodGroupFilter) {
        return false;
      }
      if (
        availabilityFilter !== 'ALL' &&
        d.availabilityStatus !== availabilityFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        d.fullName.toLowerCase().includes(q) ||
        d.donorCode.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        d.contactNumber.toLowerCase().includes(q)
      );
    });
  }, [donors, search, bloodGroupFilter, availabilityFilter]);

  const openEditModal = (donor: Donor) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setEditingDonor(donor);
    setDonorCode(donor.donorCode);
    setFullName(donor.fullName);
    setContactNumber(donor.contactNumber);
    setEmail(donor.email);
    setAge(String(donor.age));
    setBloodGroup(donor.bloodGroup);
    setAddress(donor.address);
    setLastDonationDate(donor.lastDonationDate || '');
    setAvailabilityStatus(donor.availabilityStatus);
  };

  const handleSaveDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 65) {
      setErrorMsg('Donor age must be a whole number between 18 and 65.');
      return;
    }
    if (contactNumber.trim().length < 7) {
      setErrorMsg('Please provide a valid contact phone number (at least 7 characters).');
      return;
    }

    setSaving(true);
    try {
      if (editingDonor) {
        await updateDonor(
          editingDonor.id,
          {
            donorCode,
            fullName,
            contactNumber,
            email,
            age: parsedAge,
            bloodGroup,
            address,
            lastDonationDate,
            availabilityStatus,
          },
          userProfile
        );
        setEditingDonor(null);
        setSuccessMsg(`Updated donor ${donorCode} successfully.`);
      } else {
        await createDonor(
          {
            donorCode,
            fullName,
            contactNumber,
            email,
            age: parsedAge,
            bloodGroup,
            address,
            lastDonationDate,
            availabilityStatus,
            registrationDate,
          },
          userProfile
        );
        setSuccessMsg(`Registered donor ${donorCode} (${fullName}) successfully.`);
        setDonorCode(generateCode('DNR'));
        setFullName('');
        setContactNumber('');
        setEmail('');
        setAge('25');
        setAddress('');
        setLastDonationDate('');
        setAvailabilityStatus('available');
        if (mode === 'add') {
          onNavigate('donors');
        }
      }
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateOrDelete = async (donor: Donor, hardDelete: boolean) => {
    if (!userProfile) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (hardDelete) {
        await deleteDonor(donor.id, donor.donorCode, userProfile);
        setSuccessMsg(`Deleted donor ${donor.donorCode}.`);
        if (selectedDonor?.id === donor.id) setSelectedDonor(null);
      } else {
        await updateDonor(
          donor.id,
          {
            donorCode: donor.donorCode,
            fullName: donor.fullName,
            contactNumber: donor.contactNumber,
            email: donor.email,
            age: donor.age,
            bloodGroup: donor.bloodGroup,
            address: donor.address,
            lastDonationDate: donor.lastDonationDate,
            availabilityStatus: 'inactive',
          },
          userProfile
        );
        setSuccessMsg(`Deactivated donor ${donor.donorCode}.`);
      }
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    }
  };

  if (mode === 'add') {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Register New Blood Donor
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Personal donor information is protected in Firestore and never shared with Google Gemini.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('donors')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
          >
            Back to Directory
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form
          onSubmit={handleSaveDonor}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Donor ID
              </label>
              <input
                type="text"
                required
                pattern="[a-zA-Z0-9_\-]+"
                value={donorCode}
                onChange={(e) => setDonorCode(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Priya Nair"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contact Number
              </label>
              <input
                type="tel"
                required
                minLength={7}
                maxLength={25}
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+91 98450 12345"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="donor@example.org"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Age (18–65)
              </label>
              <input
                type="number"
                required
                min={18}
                max={65}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Blood Group
              </label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                className="w-full px-3 py-2 text-sm font-mono font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
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
                Availability Status
              </label>
              <select
                value={availabilityStatus}
                onChange={(e) =>
                  setAvailabilityStatus(e.target.value as DonorAvailability)
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
              >
                <option value="available">Available</option>
                <option value="deferred">Deferred</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Last Donation Date (optional)
              </label>
              <input
                type="date"
                value={lastDonationDate}
                onChange={(e) => setLastDonationDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Registration Date
              </label>
              <input
                type="date"
                required
                value={registrationDate}
                onChange={(e) => setRegistrationDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Residential Address
            </label>
            <textarea
              required
              rows={2}
              minLength={3}
              maxLength={300}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, locality, city"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('donors')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors disabled:opacity-60"
            >
              <UserPlus className="w-4 h-4" />
              {saving ? 'Saving Donor...' : 'Save Donor Record'}
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
            Registered Blood Donors
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {donors.length} total records · PII restricted to verified clinical staff and administrators
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('add-donor')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Add Donor
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

      {/* Search & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by donor name, ID, email, or phone..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
          />
        </div>
        <select
          value={bloodGroupFilter}
          onChange={(e) => setBloodGroupFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="ALL">All Blood Groups</option>
          {BLOOD_GROUPS.map((bg) => (
            <option key={bg} value={bg}>
              {bg}
            </option>
          ))}
        </select>
        <select
          value={availabilityFilter}
          onChange={(e) => setAvailabilityFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="ALL">All Statuses</option>
          <option value="available">Available</option>
          <option value="deferred">Deferred</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Donors Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredDonors.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-500">
              No donors match your current filters.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('add-donor')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register First Donor
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Donor ID</th>
                  <th className="py-3 px-4 font-medium">Full Name</th>
                  <th className="py-3 px-4 font-medium">Blood Group</th>
                  <th className="py-3 px-4 font-medium text-right">Age</th>
                  <th className="py-3 px-4 font-medium">Contact</th>
                  <th className="py-3 px-4 font-medium">Last Donation</th>
                  <th className="py-3 px-4 font-medium">Availability</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDonors.map((donor) => (
                  <tr key={donor.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {donor.donorCode}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div>{donor.fullName}</div>
                      <div className="text-xs text-slate-500">{donor.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-red-700">
                      {donor.bloodGroup}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-700">
                      {donor.age}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-700 whitespace-nowrap">
                      {donor.contactNumber}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                      {donor.lastDonationDate || 'Never'}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold capitalize">
                      <span
                        className={
                          donor.availabilityStatus === 'available'
                            ? 'text-emerald-700'
                            : donor.availabilityStatus === 'deferred'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }
                      >
                        {donor.availabilityStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedDonor(donor)}
                          title="View details"
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(donor)}
                          title="Edit donor"
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeactivateOrDelete(donor, true)}
                          title="Delete donor"
                          className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Donor Details Modal */}
      {selectedDonor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-xs text-slate-500">
                  {selectedDonor.donorCode} · Registered {selectedDonor.registrationDate}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  {selectedDonor.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDonor(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div>
                <div className="text-xs text-slate-500">Blood Group</div>
                <div className="font-mono font-bold text-red-700 text-base">
                  {selectedDonor.bloodGroup}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Availability</div>
                <div className="font-semibold capitalize text-slate-900">
                  {selectedDonor.availabilityStatus}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Phone</div>
                <div className="font-mono text-xs text-slate-800">
                  {selectedDonor.contactNumber}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Age</div>
                <div className="font-mono text-slate-800">{selectedDonor.age} yrs</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-slate-500">Email</div>
                <div className="text-slate-800">{selectedDonor.email}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-slate-500">Address</div>
                <div className="text-slate-800">{selectedDonor.address}</div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">
                Recorded Donations ({donations.filter((d) => d.donorId === selectedDonor.id).length})
              </h4>
              <div className="space-y-1.5">
                {donations
                  .filter((d) => d.donorId === selectedDonor.id)
                  .map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between text-xs p-2.5 border border-slate-200 rounded-lg"
                    >
                      <span className="font-mono text-slate-700">
                        {d.donationCode} · {d.donationDate}
                      </span>
                      <span className="text-slate-600">{d.component}</span>
                      <span className="font-mono font-semibold text-slate-900">
                        +{d.unitsCollected} units
                      </span>
                    </div>
                  ))}
                {donations.filter((d) => d.donorId === selectedDonor.id).length === 0 && (
                  <p className="text-xs text-slate-500">No donations logged yet for this donor.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {selectedDonor.availabilityStatus !== 'inactive' ? (
                <button
                  type="button"
                  onClick={() => void handleDeactivateOrDelete(selectedDonor, false)}
                  className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg"
                >
                  Deactivate Donor
                </button>
              ) : (
                <span className="text-xs text-slate-400">Donor is inactive</span>
              )}
              <button
                type="button"
                onClick={() => {
                  const target = selectedDonor;
                  setSelectedDonor(null);
                  openEditModal(target);
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Edit Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Donor Modal */}
      {editingDonor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900">
                Edit Donor · {editingDonor.donorCode}
              </h3>
              <button
                type="button"
                onClick={() => setEditingDonor(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDonor} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Age (18–65)
                  </label>
                  <input
                    type="number"
                    required
                    min={18}
                    max={65}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
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
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
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
                    Availability
                  </label>
                  <select
                    value={availabilityStatus}
                    onChange={(e) =>
                      setAvailabilityStatus(e.target.value as DonorAvailability)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="available">Available</option>
                    <option value="deferred">Deferred</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDonor(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-60"
                >
                  {saving ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
