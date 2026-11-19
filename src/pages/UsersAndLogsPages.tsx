import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatFirestoreError } from '../lib/inventoryUtils';
import {
  adminDeleteUser,
  adminUpdateUserRoleStatus,
} from '../services/firestoreService';
import {
  ActivityLog,
  UserProfile,
  UserRole,
  UserStatus,
} from '../types/bloodBank';

function AdminOnlyNotice() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2 max-w-lg mx-auto my-8">
      <ShieldAlert className="w-8 h-8 text-red-700 mx-auto" />
      <h2 className="font-display text-lg font-bold text-slate-900">
        Administrator Access Required
      </h2>
      <p className="text-sm text-slate-500">
        This management view is restricted to active Blood Bank Administrators and protected by Firestore security rules.
      </p>
    </div>
  );
}

export function UsersManagementPage({ users }: { users: UserProfile[] }) {
  const { userProfile, effectiveRole } = useAuth();
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (effectiveRole !== 'admin') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Your Active Prototype Account
        </h2>
        <p className="text-sm text-slate-600">
          Your account is active immediately upon registration with full operational access to donors, inventory, requests, donations, and Gemini AI tools.
        </p>
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
          <div>
            <strong>Name:</strong> {userProfile?.displayName}
          </div>
          <div>
            <strong>Email:</strong> {userProfile?.email}
          </div>
          <div>
            <strong>Status:</strong> Active
          </div>
        </div>
      </div>
    );
  }

  const handleUpdate = async (
    target: UserProfile,
    role: UserRole,
    status: UserStatus
  ) => {
    if (!userProfile) return;
    setBusyUid(target.uid);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await adminUpdateUserRoleStatus(
        target.uid,
        { role, status, department: target.department },
        userProfile
      );
      setSuccessMsg(
        `Updated ${target.displayName} (${target.email}) to ${role} · ${status}.`
      );
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setBusyUid(null);
    }
  };

  const handleDelete = async (target: UserProfile) => {
    if (!userProfile) return;
    setBusyUid(target.uid);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await adminDeleteUser(target.uid, userProfile);
      setSuccessMsg(`Removed user ${target.email}.`);
    } catch (err) {
      setErrorMsg(formatFirestoreError(err));
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          User &amp; Role Directory
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          All newly registered demo users activate automatically with immediate workspace access.
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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {users.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No user profiles found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">User</th>
                  <th className="py-3 px-4 font-medium">Department</th>
                  <th className="py-3 px-4 font-medium">Role</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.uid === userProfile?.uid;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          <UserCog className="w-4 h-4 text-slate-400" />
                          {u.displayName}
                          {isSelf && (
                            <span className="text-[11px] font-mono text-slate-400">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {u.department}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={isSelf || busyUid === u.uid}
                          value={u.role}
                          onChange={(e) =>
                            void handleUpdate(u, e.target.value as UserRole, u.status)
                          }
                          className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md bg-white disabled:opacity-60"
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={isSelf || busyUid === u.uid}
                          value={u.status}
                          onChange={(e) =>
                            void handleUpdate(u, u.role, e.target.value as UserStatus)
                          }
                          className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md bg-white disabled:opacity-60"
                        >
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {!isSelf && (
                          <button
                            type="button"
                            disabled={busyUid === u.uid}
                            onClick={() => void handleDelete(u)}
                            title="Delete user profile"
                            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function ActivityLogsPage({ logs }: { logs: ActivityLog[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (category !== 'ALL' && l.category !== category) return false;
      if (!q) return true;
      return (
        l.action.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.actorName.toLowerCase().includes(q)
      );
    });
  }, [logs, search, category]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          System Activity Logs
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Immutable Firestore audit trail of donor, inventory, request, donation, AI, and RBAC operations.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter logs by action, actor, or description..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="ALL">All Categories</option>
          <option value="auth">Authentication</option>
          <option value="donor">Donors</option>
          <option value="inventory">Inventory</option>
          <option value="request">Blood Requests</option>
          <option value="donation">Donations</option>
          <option value="ai">Gemini AI</option>
          <option value="users">Users &amp; Roles</option>
          <option value="settings">Settings</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No activity logs match your filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium">Action</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {log.createdAt ? log.createdAt.slice(0, 19).replace('T', ' ') : ''}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-semibold capitalize text-slate-700">
                      {log.category}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-red-700 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-700">
                      {log.description}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                        {log.actorName} ({log.actorRole})
                      </span>
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
