import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  addDaysIsoDate,
  generateCode,
  getTodayIsoDate,
} from '../lib/inventoryUtils';
import {
  ActivityCategory,
  ActivityLog,
  AiReport,
  AiReportResponse,
  BloodComponent,
  BloodGroup,
  BloodInventoryBatch,
  BloodRequest,
  BloodTransaction,
  DEFAULT_SYSTEM_SETTINGS,
  Donation,
  Donor,
  DonorAvailability,
  RequestUrgency,
  SystemSettings,
  UserProfile,
  UserRole,
  UserStatus,
} from '../types/bloodBank';

function serializeTimestamp(val: unknown): string {
  if (!val) return '';
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return String(val);
}

function clampStr(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

// --- User Profile & Auth Provisioning ---

export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  department?: string;
  phone?: string;
}): Promise<UserProfile> {
  const path = `users/${params.uid}`;
  try {
    const userRef = doc(db, 'users', params.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const d = snap.data();
      const normalizedStatus: UserStatus =
        d.status === 'disabled' ? 'disabled' : 'active';
      const normalizedRole: UserRole =
        params.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
          ? 'admin'
          : d.role === 'admin'
            ? 'admin'
            : 'staff';

      // Auto-activate legacy pending accounts so no user is blocked by admin approval
      if (d.status === 'pending') {
        await updateDoc(userRef, {
          displayName: clampStr(
            d.displayName || params.displayName || params.email.split('@')[0] || 'Demo User',
            100
          ),
          department: clampStr(d.department || 'Blood Bank Operations', 80),
          phone: clampStr(d.phone ?? params.phone ?? '', 30),
          status: 'active',
          updatedAt: serverTimestamp(),
        });
      }

      return {
        id: snap.id,
        uid: d.uid,
        email: d.email,
        displayName: d.displayName,
        role: normalizedRole,
        status: normalizedStatus,
        department: d.department,
        phone: d.phone ?? '',
        createdAt: serializeTimestamp(d.createdAt),
        updatedAt: serializeTimestamp(d.updatedAt),
      };
    }

    const isBootAdmin =
      params.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
    const role: UserRole = isBootAdmin ? 'admin' : 'staff';
    const status: UserStatus = 'active';

    const payload = {
      uid: params.uid,
      email: clampStr(params.email, 160),
      displayName: clampStr(params.displayName || params.email.split('@')[0] || 'Demo User', 100),
      role,
      status,
      department: clampStr(params.department || (isBootAdmin ? 'Medical Administration' : 'Blood Bank Operations'), 80),
      phone: clampStr(params.phone || '', 30),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, payload);

    // Record auth audit entry
    await logActivity({
      action: isBootAdmin ? 'ADMIN_ACCOUNT_INITIALIZED' : 'USER_REGISTERED_ACTIVE',
      category: 'auth',
      description: isBootAdmin
        ? `Administrator ${payload.displayName} initialized workspace access.`
        : `New user ${payload.displayName} (${payload.email}) registered with immediate active access.`,
      entityId: params.uid,
      actorUid: params.uid,
      actorName: payload.displayName,
      actorRole: role,
    });

    return {
      id: params.uid,
      uid: payload.uid,
      email: payload.email,
      displayName: payload.displayName,
      role,
      status,
      department: payload.department,
      phone: payload.phone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateOwnProfile(
  uid: string,
  updates: { displayName: string; department: string; phone: string }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: clampStr(updates.displayName, 100),
      department: clampStr(updates.department, 80),
      phone: clampStr(updates.phone, 30),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateUserRoleStatus(
  targetUid: string,
  updates: { role: UserRole; status: UserStatus; department: string },
  actor: UserProfile
): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role: updates.role,
      status: updates.status,
      department: clampStr(updates.department, 80),
      updatedAt: serverTimestamp(),
    });
    await logActivity({
      action: 'USER_ROLE_UPDATED',
      category: 'users',
      description: `Updated user ${targetUid} to role=${updates.role}, status=${updates.status}.`,
      entityId: targetUid,
      actorUid: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteUser(targetUid: string, actor: UserProfile): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'users', targetUid));
    await logActivity({
      action: 'USER_REMOVED',
      category: 'users',
      description: `Removed user profile ${targetUid}.`,
      entityId: targetUid,
      actorUid: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Activity Logging ---

export async function logActivity(params: {
  action: string;
  category: ActivityCategory;
  description: string;
  entityId: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
}): Promise<void> {
  const logRef = doc(collection(db, 'activity_logs'));
  try {
    await setDoc(logRef, {
      action: clampStr(params.action, 80),
      category: params.category,
      description: clampStr(params.description, 400),
      entityId: clampStr(params.entityId, 128),
      actorUid: params.actorUid,
      actorName: clampStr(params.actorName, 100),
      actorRole: params.actorRole,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `activity_logs/${logRef.id}`);
  }
}

// --- Realtime Listeners ---

export function subscribeDonors(
  onData: (items: Donor[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'donors';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: Donor[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          donorCode: data.donorCode,
          fullName: data.fullName,
          contactNumber: data.contactNumber,
          email: data.email,
          age: data.age,
          bloodGroup: data.bloodGroup,
          address: data.address,
          lastDonationDate: data.lastDonationDate ?? '',
          availabilityStatus: data.availabilityStatus,
          registrationDate: data.registrationDate,
          createdBy: data.createdBy,
          createdAt: serializeTimestamp(data.createdAt),
          updatedAt: serializeTimestamp(data.updatedAt),
        };
      });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeInventory(
  onData: (items: BloodInventoryBatch[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'blood_inventory';
  const q = query(collection(db, path), orderBy('expiryDate', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: BloodInventoryBatch[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          batchCode: data.batchCode,
          bloodGroup: data.bloodGroup,
          component: data.component,
          unitsAvailable: data.unitsAvailable,
          initialUnits: data.initialUnits,
          collectionDate: data.collectionDate,
          expiryDate: data.expiryDate,
          storageLocation: data.storageLocation,
          status: data.status,
          quarantineReason: data.quarantineReason ?? '',
          donorId: data.donorId ?? '',
          createdBy: data.createdBy,
          createdAt: serializeTimestamp(data.createdAt),
          updatedAt: serializeTimestamp(data.updatedAt),
        };
      });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeTransactions(
  onData: (items: BloodTransaction[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'blood_transactions';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: BloodTransaction[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          transactionType: data.transactionType,
          bloodGroup: data.bloodGroup,
          component: data.component,
          unitsDelta: data.unitsDelta,
          unitsAfter: data.unitsAfter,
          inventoryBatchId: data.inventoryBatchId,
          referenceType: data.referenceType,
          referenceId: data.referenceId ?? '',
          notes: data.notes ?? '',
          performedBy: data.performedBy,
          performedByName: data.performedByName,
          createdAt: serializeTimestamp(data.createdAt),
        };
      });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeRequests(
  onData: (items: BloodRequest[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'blood_requests';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: BloodRequest[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          requestCode: data.requestCode,
          hospitalOrRequesterName: data.hospitalOrRequesterName,
          requiredBloodGroup: data.requiredBloodGroup,
          component: data.component,
          unitsRequested: data.unitsRequested,
          urgency: data.urgency,
          requestDate: data.requestDate,
          requiredDate: data.requiredDate,
          status: data.status,
          notes: data.notes ?? '',
          createdBy: data.createdBy,
          reviewedBy: data.reviewedBy ?? '',
          reviewedByName: data.reviewedByName ?? '',
          fulfilledAt: data.fulfilledAt ?? '',
          createdAt: serializeTimestamp(data.createdAt),
          updatedAt: serializeTimestamp(data.updatedAt),
        };
      });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeDonations(
  onData: (items: Donation[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'donations';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: Donation[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          donationCode: data.donationCode,
          donorId: data.donorId,
          donorCode: data.donorCode,
          donorName: data.donorName,
          bloodGroup: data.bloodGroup,
          component: data.component,
          donationDate: data.donationDate,
          unitsCollected: data.unitsCollected,
          inventoryBatchId: data.inventoryBatchId,
          notes: data.notes ?? '',
          recordedBy: data.recordedBy,
          createdAt: serializeTimestamp(data.createdAt),
        };
      });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeAiReports(
  onData: (items: AiReport[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'ai_reports';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: AiReport[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          reportType: data.reportType,
          totalAvailableUnits: data.totalAvailableUnits,
          nearExpiryUnits: data.nearExpiryUnits,
          expiredUnits: data.expiredUnits,
          quarantinedUnits: data.quarantinedUnits,
          lowStockGroups: Array.isArray(data.lowStockGroups) ? data.lowStockGroups : [],
          summaryText: data.summaryText,
          recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
          safetyDisclaimer: data.safetyDisclaimer,
          lowStockMaxThreshold: data.lowStockMaxThreshold,
          moderateStockMaxThreshold: data.moderateStockMaxThreshold,
          generatedBy: data.generatedBy,
          generatedByName: data.generatedByName,
          createdAt: serializeTimestamp(data.createdAt),
        };
      });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeActivityLogs(
  onData: (items: ActivityLog[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'activity_logs';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: ActivityLog[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          action: data.action,
          category: data.category,
          description: data.description,
          entityId: data.entityId ?? '',
          actorUid: data.actorUid,
          actorName: data.actorName,
          actorRole: data.actorRole,
          createdAt: serializeTimestamp(data.createdAt),
        };
      });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeUsers(
  onData: (items: UserProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'users';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: UserProfile[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: data.uid,
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          status: data.status,
          department: data.department,
          phone: data.phone ?? '',
          createdAt: serializeTimestamp(data.createdAt),
          updatedAt: serializeTimestamp(data.updatedAt),
        };
      });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeSystemSettings(
  onData: (settings: SystemSettings) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const ref = doc(db, 'system_settings', 'thresholds');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SYSTEM_SETTINGS);
        return;
      }
      const d = snap.data();
      onData({
        lowStockMax: Number(d.lowStockMax ?? DEFAULT_SYSTEM_SETTINGS.lowStockMax),
        moderateStockMax: Number(d.moderateStockMax ?? DEFAULT_SYSTEM_SETTINGS.moderateStockMax),
        nearExpiryDays: Number(d.nearExpiryDays ?? DEFAULT_SYSTEM_SETTINGS.nearExpiryDays),
        thresholdNotice: String(d.thresholdNotice ?? DEFAULT_SYSTEM_SETTINGS.thresholdNotice),
        updatedBy: d.updatedBy,
        updatedAt: serializeTimestamp(d.updatedAt),
      });
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.GET, 'system_settings/thresholds');
    }
  );
}

// --- Donor CRUD ---

export async function createDonor(
  input: {
    donorCode: string;
    fullName: string;
    contactNumber: string;
    email: string;
    age: number;
    bloodGroup: BloodGroup;
    address: string;
    lastDonationDate: string;
    availabilityStatus: DonorAvailability;
    registrationDate: string;
  },
  actor: UserProfile
): Promise<string> {
  const donorRef = doc(collection(db, 'donors'));
  try {
    await setDoc(donorRef, {
      donorCode: clampStr(input.donorCode.replace(/[^a-zA-Z0-9_-]/g, ''), 32),
      fullName: clampStr(input.fullName, 100),
      contactNumber: clampStr(input.contactNumber, 25),
      email: clampStr(input.email, 160),
      age: Math.round(input.age),
      bloodGroup: input.bloodGroup,
      address: clampStr(input.address, 300),
      lastDonationDate: clampStr(input.lastDonationDate || '', 20),
      availabilityStatus: input.availabilityStatus,
      registrationDate: clampStr(input.registrationDate || getTodayIsoDate(), 20),
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logActivity({
      action: 'DONOR_REGISTERED',
      category: 'donor',
      description: `Registered donor ${input.donorCode} (${input.bloodGroup}).`,
      entityId: donorRef.id,
      actorUid: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
    });
    return donorRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `donors/${donorRef.id}`);
  }
}

export async function updateDonor(
  donorId: string,
  input: {
    donorCode: string;
    fullName: string;
    contactNumber: string;
    email: string;
    age: number;
    bloodGroup: BloodGroup;
    address: string;
    lastDonationDate: string;
    availabilityStatus: DonorAvailability;
  },
  actor: UserProfile
): Promise<void> {
  const path = `donors/${donorId}`;
  try {
    await updateDoc(doc(db, 'donors', donorId), {
      donorCode: clampStr(input.donorCode.replace(/[^a-zA-Z0-9_-]/g, ''), 32),
      fullName: clampStr(input.fullName, 100),
      contactNumber: clampStr(input.contactNumber, 25),
      email: clampStr(input.email, 160),
      age: Math.round(input.age),
      bloodGroup: input.bloodGroup,
      address: clampStr(input.address, 300),
      lastDonationDate: clampStr(input.lastDonationDate || '', 20),
      availabilityStatus: input.availabilityStatus,
      updatedAt: serverTimestamp(),
    });
    await logActivity({
      action: 'DONOR_UPDATED',
      category: 'donor',
      description: `Updated donor ${input.donorCode} (${input.bloodGroup}, status: ${input.availabilityStatus}).`,
      entityId: donorId,
      actorUid: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDonor(donorId: string, donorCode: string, actor: UserProfile): Promise<void> {
  const path = `donors/${donorId}`;
  try {
    await deleteDoc(doc(db, 'donors', donorId));
    await logActivity({
      action: 'DONOR_DELETED',
      category: 'donor',
      description: `Deleted donor record ${donorCode}.`,
      entityId: donorId,
      actorUid: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Inventory Operations (Atomic Transactions) ---

export async function addBloodBatch(
  input: {
    batchCode: string;
    bloodGroup: BloodGroup;
    component: BloodComponent;
    units: number;
    collectionDate: string;
    expiryDate: string;
    storageLocation: string;
    donorId?: string;
    notes?: string;
  },
  actor: UserProfile
): Promise<string> {
  if (input.units < 1 || !Number.isInteger(input.units)) {
    throw new Error('Units must be a positive whole number.');
  }
  const batchRef = doc(collection(db, 'blood_inventory'));
  const txRef = doc(collection(db, 'blood_transactions'));
  const logRef = doc(collection(db, 'activity_logs'));

  try {
    await runTransaction(db, async (transaction) => {
      const today = getTodayIsoDate();
      const status = input.expiryDate < today ? 'expired' : 'available';

      transaction.set(batchRef, {
        batchCode: clampStr(input.batchCode.replace(/[^a-zA-Z0-9_-]/g, ''), 40),
        bloodGroup: input.bloodGroup,
        component: input.component,
        unitsAvailable: input.units,
        initialUnits: input.units,
        collectionDate: input.collectionDate,
        expiryDate: input.expiryDate,
        storageLocation: clampStr(input.storageLocation, 80),
        status,
        quarantineReason: '',
        donorId: input.donorId ?? '',
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      transaction.set(txRef, {
        transactionType: 'addition',
        bloodGroup: input.bloodGroup,
        component: input.component,
        unitsDelta: input.units,
        unitsAfter: input.units,
        inventoryBatchId: batchRef.id,
        referenceType: 'manual',
        referenceId: input.batchCode,
        notes: clampStr(input.notes || `Added batch ${input.batchCode} (${input.units} units).`, 400),
        performedBy: actor.uid,
        performedByName: clampStr(actor.displayName, 100),
        createdAt: serverTimestamp(),
      });

      transaction.set(logRef, {
        action: 'INVENTORY_BATCH_ADDED',
        category: 'inventory',
        description: `Added ${input.units} units of ${input.bloodGroup} (${input.component}) in batch ${input.batchCode}.`,
        entityId: batchRef.id,
        actorUid: actor.uid,
        actorName: clampStr(actor.displayName, 100),
        actorRole: actor.role,
        createdAt: serverTimestamp(),
      });
    });

    return batchRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `blood_inventory/${batchRef.id}`);
  }
}

export async function adjustBatchStock(
  params: {
    batchId: string;
    deltaUnits: number;
    reason: string;
    storageLocation?: string;
  },
  actor: UserProfile
): Promise<void> {
  const batchRef = doc(db, 'blood_inventory', params.batchId);
  const txRef = doc(collection(db, 'blood_transactions'));
  const logRef = doc(collection(db, 'activity_logs'));

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(batchRef);
      if (!snap.exists()) {
        throw new Error('Inventory batch no longer exists.');
      }
      const current = snap.data();
      const nextUnits = Number(current.unitsAvailable) + params.deltaUnits;
      if (nextUnits < 0) {
        throw new Error(
          `Cannot reduce stock below zero (available: ${current.unitsAvailable}, requested deduction: ${Math.abs(params.deltaUnits)}).`
        );
      }

      const nextInitial = Math.max(Number(current.initialUnits), nextUnits);
      const nextStatus =
        current.status === 'quarantined' || current.status === 'expired'
          ? current.status
          : nextUnits === 0
            ? 'depleted'
            : 'available';

      transaction.update(batchRef, {
        unitsAvailable: nextUnits,
        initialUnits: nextInitial,
        status: nextStatus,
        storageLocation: clampStr(params.storageLocation ?? current.storageLocation, 80),
        updatedAt: serverTimestamp(),
      });

      transaction.set(txRef, {
        transactionType: params.deltaUnits >= 0 ? 'addition' : 'usage',
        bloodGroup: current.bloodGroup,
        component: current.component,
        unitsDelta: params.deltaUnits,
        unitsAfter: nextUnits,
        inventoryBatchId: params.batchId,
        referenceType: 'manual',
        referenceId: current.batchCode,
        notes: clampStr(params.reason || 'Manual stock adjustment', 400),
        performedBy: actor.uid,
        performedByName: clampStr(actor.displayName, 100),
        createdAt: serverTimestamp(),
      });

      transaction.set(logRef, {
        action: 'INVENTORY_ADJUSTED',
        category: 'inventory',
        description: `Adjusted batch ${current.batchCode} (${current.bloodGroup}) by ${params.deltaUnits > 0 ? `+${params.deltaUnits}` : params.deltaUnits} units (now ${nextUnits}).`,
        entityId: params.batchId,
        actorUid: actor.uid,
        actorName: clampStr(actor.displayName, 100),
        actorRole: actor.role,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `blood_inventory/${params.batchId}`);
  }
}

export async function quarantineOrExpireBatch(
  params: {
    batchId: string;
    newStatus: 'quarantined' | 'expired';
    reason: string;
  },
  actor: UserProfile
): Promise<void> {
  const batchRef = doc(db, 'blood_inventory', params.batchId);
  const txRef = doc(collection(db, 'blood_transactions'));
  const logRef = doc(collection(db, 'activity_logs'));

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(batchRef);
      if (!snap.exists()) throw new Error('Inventory batch not found.');
      const current = snap.data();

      transaction.update(batchRef, {
        status: params.newStatus,
        quarantineReason: clampStr(params.reason, 240),
        updatedAt: serverTimestamp(),
      });

      transaction.set(txRef, {
        transactionType: params.newStatus === 'quarantined' ? 'quarantine' : 'expiry_writeoff',
        bloodGroup: current.bloodGroup,
        component: current.component,
        unitsDelta: 0,
        unitsAfter: Number(current.unitsAvailable),
        inventoryBatchId: params.batchId,
        referenceType: 'quarantine',
        referenceId: current.batchCode,
        notes: clampStr(
          `${params.newStatus === 'quarantined' ? 'Quarantined' : 'Marked expired'}: ${params.reason}`,
          400
        ),
        performedBy: actor.uid,
        performedByName: clampStr(actor.displayName, 100),
        createdAt: serverTimestamp(),
      });

      transaction.set(logRef, {
        action: params.newStatus === 'quarantined' ? 'BATCH_QUARANTINED' : 'BATCH_MARKED_EXPIRED',
        category: 'inventory',
        description: `Batch ${current.batchCode} (${current.bloodGroup}, ${current.unitsAvailable} units) marked ${params.newStatus}: ${params.reason}`,
        entityId: params.batchId,
        actorUid: actor.uid,
        actorName: clampStr(actor.displayName, 100),
        actorRole: actor.role,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `blood_inventory/${params.batchId}`);
  }
}

// --- Blood Requests Workflow ---

export async function createBloodRequest(
  input: {
    requestCode: string;
    hospitalOrRequesterName: string;
    requiredBloodGroup: BloodGroup;
    component: BloodComponent;
    unitsRequested: number;
    urgency: RequestUrgency;
    requestDate: string;
    requiredDate: string;
    notes: string;
  },
  actor: UserProfile
): Promise<string> {
  const reqRef = doc(collection(db, 'blood_requests'));
  try {
    await setDoc(reqRef, {
      requestCode: clampStr(input.requestCode.replace(/[^a-zA-Z0-9_-]/g, ''), 32),
      hospitalOrRequesterName: clampStr(input.hospitalOrRequesterName, 140),
      requiredBloodGroup: input.requiredBloodGroup,
      component: input.component,
      unitsRequested: Math.round(input.unitsRequested),
      urgency: input.urgency,
      requestDate: input.requestDate,
      requiredDate: input.requiredDate,
      status: 'pending',
      notes: clampStr(input.notes || '', 500),
      createdBy: actor.uid,
      reviewedBy: '',
      reviewedByName: '',
      fulfilledAt: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logActivity({
      action: 'BLOOD_REQUEST_CREATED',
      category: 'request',
      description: `Created request ${input.requestCode} for ${input.unitsRequested} units of ${input.requiredBloodGroup} (${input.hospitalOrRequesterName}).`,
      entityId: reqRef.id,
      actorUid: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
    });
    return reqRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `blood_requests/${reqRef.id}`);
  }
}

export async function reviewBloodRequest(
  params: {
    requestId: string;
    decision: 'approved' | 'rejected';
    notes?: string;
  },
  actor: UserProfile
): Promise<void> {
  const path = `blood_requests/${params.requestId}`;
  try {
    await runTransaction(db, async (transaction) => {
      const reqRef = doc(db, 'blood_requests', params.requestId);
      const snap = await transaction.get(reqRef);
      if (!snap.exists()) throw new Error('Blood request not found.');
      const current = snap.data();
      if (current.status !== 'pending') {
        throw new Error(`Request is already ${current.status} and cannot be ${params.decision}.`);
      }

      transaction.update(reqRef, {
        status: params.decision,
        notes: clampStr(params.notes ?? current.notes ?? '', 500),
        reviewedBy: actor.uid,
        reviewedByName: clampStr(actor.displayName, 100),
        updatedAt: serverTimestamp(),
      });

      const logRef = doc(collection(db, 'activity_logs'));
      transaction.set(logRef, {
        action: params.decision === 'approved' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
        category: 'request',
        description: `${params.decision === 'approved' ? 'Approved' : 'Rejected'} blood request ${current.requestCode} (${current.unitsRequested} units ${current.requiredBloodGroup}).`,
        entityId: params.requestId,
        actorUid: actor.uid,
        actorName: clampStr(actor.displayName, 100),
        actorRole: actor.role,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fulfillBloodRequest(
  params: {
    requestId: string;
    candidateBatchIds: string[];
  },
  actor: UserProfile
): Promise<void> {
  const reqRef = doc(db, 'blood_requests', params.requestId);
  try {
    await runTransaction(db, async (transaction) => {
      const reqSnap = await transaction.get(reqRef);
      if (!reqSnap.exists()) throw new Error('Blood request not found.');
      const reqData = reqSnap.data();

      if (reqData.status !== 'approved') {
        throw new Error('Only approved requests can be fulfilled.');
      }

      const today = getTodayIsoDate();
      const needed = Number(reqData.unitsRequested);

      // Read all candidate batches before performing any writes
      const batchSnaps = await Promise.all(
        params.candidateBatchIds.map((id) => transaction.get(doc(db, 'blood_inventory', id)))
      );

      const eligibleBatches = batchSnaps
        .filter((s) => s.exists())
        .map((s) => ({ id: s.id, data: s.data() }))
        .filter(
          (b) =>
            b.data.bloodGroup === reqData.requiredBloodGroup &&
            b.data.status === 'available' &&
            b.data.expiryDate >= today &&
            Number(b.data.unitsAvailable) > 0
        )
        .sort((a, b) => String(a.data.expiryDate).localeCompare(String(b.data.expiryDate)));

      // Prefer matching component first, then fallback to other available batches of same blood group if needed
      const exactComponentBatches = eligibleBatches.filter(
        (b) => b.data.component === reqData.component
      );
      const otherComponentBatches = eligibleBatches.filter(
        (b) => b.data.component !== reqData.component
      );
      const orderedBatches = [...exactComponentBatches, ...otherComponentBatches];

      const totalAvailable = exactComponentBatches.reduce(
        (sum, b) => sum + Number(b.data.unitsAvailable),
        0
      );

      if (totalAvailable < needed) {
        const anyComponentTotal = orderedBatches.reduce(
          (sum, b) => sum + Number(b.data.unitsAvailable),
          0
        );
        if (anyComponentTotal < needed) {
          throw new Error(
            `Insufficient available non-expired ${reqData.requiredBloodGroup} stock (needed: ${needed}, available: ${anyComponentTotal}).`
          );
        }
        throw new Error(
          `Insufficient ${reqData.component} units for ${reqData.requiredBloodGroup} (needed: ${needed}, ${reqData.component} available: ${totalAvailable}).`
        );
      }

      let remaining = needed;
      for (const batch of exactComponentBatches) {
        if (remaining <= 0) break;
        const avail = Number(batch.data.unitsAvailable);
        const deduct = Math.min(avail, remaining);
        const nextUnits = avail - deduct;
        remaining -= deduct;

        transaction.update(doc(db, 'blood_inventory', batch.id), {
          unitsAvailable: nextUnits,
          status: nextUnits === 0 ? 'depleted' : 'available',
          updatedAt: serverTimestamp(),
        });

        const txRef = doc(collection(db, 'blood_transactions'));
        transaction.set(txRef, {
          transactionType: 'usage',
          bloodGroup: reqData.requiredBloodGroup,
          component: batch.data.component,
          unitsDelta: -deduct,
          unitsAfter: nextUnits,
          inventoryBatchId: batch.id,
          referenceType: 'request',
          referenceId: reqData.requestCode,
          notes: clampStr(
            `Fulfilled request ${reqData.requestCode} for ${reqData.hospitalOrRequesterName}.`,
            400
          ),
          performedBy: actor.uid,
          performedByName: clampStr(actor.displayName, 100),
          createdAt: serverTimestamp(),
        });
      }

      transaction.update(reqRef, {
        status: 'fulfilled',
        reviewedBy: actor.uid,
        reviewedByName: clampStr(actor.displayName, 100),
        fulfilledAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });

      const logRef = doc(collection(db, 'activity_logs'));
      transaction.set(logRef, {
        action: 'REQUEST_FULFILLED',
        category: 'request',
        description: `Fulfilled request ${reqData.requestCode}: deducted ${needed} units of ${reqData.requiredBloodGroup} (${reqData.component}).`,
        entityId: params.requestId,
        actorUid: actor.uid,
        actorName: clampStr(actor.displayName, 100),
        actorRole: actor.role,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `blood_requests/${params.requestId}`);
  }
}

// --- Donation Recording (Atomic Transaction) ---

export async function recordDonation(
  input: {
    donationCode: string;
    donorId: string;
    component: BloodComponent;
    donationDate: string;
    expiryDate: string;
    unitsCollected: number;
    storageLocation: string;
    notes: string;
  },
  actor: UserProfile
): Promise<string> {
  if (input.unitsCollected < 1 || input.unitsCollected > 5) {
    throw new Error('Collected units per donation must be between 1 and 5.');
  }
  const donorRef = doc(db, 'donors', input.donorId);
  const batchRef = doc(collection(db, 'blood_inventory'));
  const donationRef = doc(collection(db, 'donations'));
  const txRef = doc(collection(db, 'blood_transactions'));
  const logRef = doc(collection(db, 'activity_logs'));

  try {
    await runTransaction(db, async (transaction) => {
      const donorSnap = await transaction.get(donorRef);
      if (!donorSnap.exists()) {
        throw new Error('Selected donor record does not exist.');
      }
      const donor = donorSnap.data();
      if (donor.availabilityStatus === 'inactive') {
        throw new Error('Cannot record a donation for an inactive donor.');
      }

      const batchCode = generateCode('BAT');

      transaction.set(batchRef, {
        batchCode,
        bloodGroup: donor.bloodGroup,
        component: input.component,
        unitsAvailable: input.unitsCollected,
        initialUnits: input.unitsCollected,
        collectionDate: input.donationDate,
        expiryDate: input.expiryDate,
        storageLocation: clampStr(input.storageLocation || 'Cold Unit A-1', 80),
        status: 'available',
        quarantineReason: '',
        donorId: input.donorId,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      transaction.set(donationRef, {
        donationCode: clampStr(input.donationCode.replace(/[^a-zA-Z0-9_-]/g, ''), 32),
        donorId: input.donorId,
        donorCode: donor.donorCode,
        donorName: donor.fullName,
        bloodGroup: donor.bloodGroup,
        component: input.component,
        donationDate: input.donationDate,
        unitsCollected: input.unitsCollected,
        inventoryBatchId: batchRef.id,
        notes: clampStr(input.notes || '', 400),
        recordedBy: actor.uid,
        createdAt: serverTimestamp(),
      });

      transaction.update(donorRef, {
        lastDonationDate: input.donationDate,
        updatedAt: serverTimestamp(),
      });

      transaction.set(txRef, {
        transactionType: 'addition',
        bloodGroup: donor.bloodGroup,
        component: input.component,
        unitsDelta: input.unitsCollected,
        unitsAfter: input.unitsCollected,
        inventoryBatchId: batchRef.id,
        referenceType: 'donation',
        referenceId: input.donationCode,
        notes: clampStr(`Donation ${input.donationCode} from ${donor.donorCode}.`, 400),
        performedBy: actor.uid,
        performedByName: clampStr(actor.displayName, 100),
        createdAt: serverTimestamp(),
      });

      transaction.set(logRef, {
        action: 'DONATION_RECORDED',
        category: 'donation',
        description: `Recorded donation ${input.donationCode}: +${input.unitsCollected} units of ${donor.bloodGroup} (${input.component}) into batch ${batchCode}.`,
        entityId: donationRef.id,
        actorUid: actor.uid,
        actorName: clampStr(actor.displayName, 100),
        actorRole: actor.role,
        createdAt: serverTimestamp(),
      });
    });

    return donationRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `donations/${donationRef.id}`);
  }
}

// --- AI Reports & System Settings ---

export async function saveAiReport(
  report: AiReportResponse,
  actor: UserProfile
): Promise<string> {
  const reportRef = doc(collection(db, 'ai_reports'));
  try {
    await setDoc(reportRef, {
      title: clampStr(report.title, 160),
      reportType: report.reportType,
      totalAvailableUnits: Math.max(0, Math.round(report.totalAvailableUnits)),
      nearExpiryUnits: Math.max(0, Math.round(report.nearExpiryUnits)),
      expiredUnits: Math.max(0, Math.round(report.expiredUnits)),
      quarantinedUnits: Math.max(0, Math.round(report.quarantinedUnits)),
      lowStockGroups: report.lowStockGroups.slice(0, 8),
      summaryText: clampStr(report.summaryText, 12000),
      recommendations: report.recommendations.slice(0, 20),
      safetyDisclaimer: clampStr(report.safetyDisclaimer, 300),
      lowStockMaxThreshold: Math.round(report.lowStockMaxThreshold),
      moderateStockMaxThreshold: Math.round(report.moderateStockMaxThreshold),
      generatedBy: actor.uid,
      generatedByName: clampStr(actor.displayName, 100),
      createdAt: serverTimestamp(),
    });
    await logActivity({
      action: 'AI_REPORT_GENERATED',
      category: 'ai',
      description: `Generated and archived AI inventory report: ${report.title}`,
      entityId: reportRef.id,
      actorUid: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
    });
    return reportRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `ai_reports/${reportRef.id}`);
  }
}

export async function saveSystemSettings(
  settings: {
    lowStockMax: number;
    moderateStockMax: number;
    nearExpiryDays: number;
    thresholdNotice: string;
  },
  actor: UserProfile
): Promise<void> {
  const path = 'system_settings/thresholds';
  try {
    await setDoc(doc(db, 'system_settings', 'thresholds'), {
      lowStockMax: Math.round(settings.lowStockMax),
      moderateStockMax: Math.round(settings.moderateStockMax),
      nearExpiryDays: Math.round(settings.nearExpiryDays),
      thresholdNotice: clampStr(settings.thresholdNotice, 300),
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
    await logActivity({
      action: 'SETTINGS_UPDATED',
      category: 'settings',
      description: `Updated illustrative thresholds (Low <= ${settings.lowStockMax}, Moderate <= ${settings.moderateStockMax}, Near-expiry ${settings.nearExpiryDays}d).`,
      entityId: 'thresholds',
      actorUid: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Non-Destructive Demonstration Dataset Seeder ---

export async function initializeSampleDataset(actor: UserProfile): Promise<boolean> {
  try {
    const [existingBatches, existingDonors] = await Promise.all([
      getDocs(collection(db, 'blood_inventory')),
      getDocs(collection(db, 'donors')),
    ]);
    if (!existingBatches.empty || !existingDonors.empty) {
      return false;
    }

    const today = getTodayIsoDate();

    // Commit in sequential batches so each batch stays well under Firestore's 20-document lookup limit in security rules
    const setupBatch = writeBatch(db);

    // 1. Default system settings
    setupBatch.set(doc(db, 'system_settings', 'thresholds'), {
      ...DEFAULT_SYSTEM_SETTINGS,
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });

    // 2. Sample donors across all 8 blood groups
    const sampleDonors: Array<{
      code: string;
      name: string;
      phone: string;
      email: string;
      age: number;
      bg: BloodGroup;
      address: string;
      status: DonorAvailability;
    }> = [
      { code: 'DNR-1001', name: 'Aarav Menon', phone: '+91 98450 11201', email: 'aarav.menon@example.org', age: 28, bg: 'O+', address: '14 Indiranagar 2nd Stage, Bengaluru', status: 'available' },
      { code: 'DNR-1002', name: 'Priya Nair', phone: '+91 98450 22304', email: 'priya.nair@example.org', age: 31, bg: 'A+', address: '42 Koramangala 4th Block, Bengaluru', status: 'available' },
      { code: 'DNR-1003', name: 'Rohan Kulkarni', phone: '+91 98450 33409', email: 'rohan.k@example.org', age: 26, bg: 'B+', address: '8 Jayanagar 3rd Block, Bengaluru', status: 'available' },
      { code: 'DNR-1004', name: 'Meera Iyer', phone: '+91 98450 44512', email: 'meera.iyer@example.org', age: 34, bg: 'O-', address: '29 Malleswaram 8th Cross, Bengaluru', status: 'available' },
      { code: 'DNR-1005', name: 'Vikram Sharma', phone: '+91 98450 55618', email: 'vikram.s@example.org', age: 29, bg: 'AB+', address: '71 HSR Layout Sector 2, Bengaluru', status: 'available' },
      { code: 'DNR-1006', name: 'Ananya Rao', phone: '+91 98450 66725', email: 'ananya.rao@example.org', age: 24, bg: 'A-', address: '19 Sadashivanagar Main Rd, Bengaluru', status: 'deferred' },
      { code: 'DNR-1007', name: 'Karthik Reddy', phone: '+91 98450 77831', email: 'karthik.r@example.org', age: 37, bg: 'B-', address: '55 Whitefield ITPL Rd, Bengaluru', status: 'available' },
      { code: 'DNR-1008', name: 'Divya Krishnan', phone: '+91 98450 88940', email: 'divya.k@example.org', age: 30, bg: 'AB-', address: '33 Rajajinagar 1st Block, Bengaluru', status: 'available' },
    ];

    const donorIds: Record<string, string> = {};
    for (const d of sampleDonors) {
      const ref = doc(collection(db, 'donors'));
      donorIds[d.bg] = ref.id;
      setupBatch.set(ref, {
        donorCode: d.code,
        fullName: d.name,
        contactNumber: d.phone,
        email: d.email,
        age: d.age,
        bloodGroup: d.bg,
        address: d.address,
        lastDonationDate: addDaysIsoDate(today, -95),
        availabilityStatus: d.status,
        registrationDate: addDaysIsoDate(today, -120),
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await setupBatch.commit();

    // 3. Blood Inventory across all 8 groups (deliberate mix of Low <5, Moderate 5-9, Sufficient >=10, near-expiry, and quarantined)
    const sampleBatches: Array<{
      code: string;
      bg: BloodGroup;
      component: BloodComponent;
      units: number;
      offsetCol: number;
      offsetExp: number;
      loc: string;
      status: 'available' | 'quarantined' | 'expired';
      reason: string;
    }> = [
      { code: 'BAT-101', bg: 'O+', component: 'Red Blood Cells', units: 14, offsetCol: -10, offsetExp: 25, loc: 'Cold Unit A-1', status: 'available', reason: '' },
      { code: 'BAT-102', bg: 'A+', component: 'Whole Blood', units: 11, offsetCol: -8, offsetExp: 22, loc: 'Cold Unit A-2', status: 'available', reason: '' },
      { code: 'BAT-103', bg: 'B+', component: 'Red Blood Cells', units: 8, offsetCol: -14, offsetExp: 16, loc: 'Cold Unit B-1', status: 'available', reason: '' },
      { code: 'BAT-104', bg: 'AB+', component: 'Fresh Frozen Plasma', units: 6, offsetCol: -12, offsetExp: 60, loc: 'Freezer F-1', status: 'available', reason: '' },
      { code: 'BAT-105', bg: 'O-', component: 'Red Blood Cells', units: 2, offsetCol: -20, offsetExp: 4, loc: 'Cold Unit A-3', status: 'available', reason: '' },
      { code: 'BAT-106', bg: 'A-', component: 'Whole Blood', units: 3, offsetCol: -15, offsetExp: 12, loc: 'Cold Unit B-2', status: 'available', reason: '' },
      { code: 'BAT-107', bg: 'B-', component: 'Platelets', units: 2, offsetCol: -2, offsetExp: 3, loc: 'Agitator P-1', status: 'available', reason: '' },
      { code: 'BAT-108', bg: 'AB-', component: 'Whole Blood', units: 1, offsetCol: -18, offsetExp: 9, loc: 'Cold Unit C-1', status: 'available', reason: '' },
      { code: 'BAT-109', bg: 'B+', component: 'Whole Blood', units: 2, offsetCol: -38, offsetExp: -2, loc: 'Quarantine Hold Q-1', status: 'expired', reason: 'Past 35-day shelf window during routine audit' },
      { code: 'BAT-110', bg: 'A+', component: 'Red Blood Cells', units: 1, offsetCol: -5, offsetExp: 28, loc: 'Quarantine Hold Q-2', status: 'quarantined', reason: 'Awaiting confirmatory serology re-verification' },
    ];

    const inventoryBatch = writeBatch(db);
    const createdBatchIds: Record<string, string> = {};

    for (const b of sampleBatches) {
      const bRef = doc(collection(db, 'blood_inventory'));
      const tRef = doc(collection(db, 'blood_transactions'));
      createdBatchIds[b.code] = bRef.id;

      inventoryBatch.set(bRef, {
        batchCode: b.code,
        bloodGroup: b.bg,
        component: b.component,
        unitsAvailable: b.units,
        initialUnits: b.units,
        collectionDate: addDaysIsoDate(today, b.offsetCol),
        expiryDate: addDaysIsoDate(today, b.offsetExp),
        storageLocation: b.loc,
        status: b.status,
        quarantineReason: b.reason,
        donorId: donorIds[b.bg] ?? '',
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      inventoryBatch.set(tRef, {
        transactionType: b.status === 'quarantined' ? 'quarantine' : b.status === 'expired' ? 'expiry_writeoff' : 'addition',
        bloodGroup: b.bg,
        component: b.component,
        unitsDelta: b.units,
        unitsAfter: b.units,
        inventoryBatchId: bRef.id,
        referenceType: 'manual',
        referenceId: b.code,
        notes: `Initial stock batch ${b.code} recorded.`,
        performedBy: actor.uid,
        performedByName: actor.displayName,
        createdAt: serverTimestamp(),
      });
    }

    await inventoryBatch.commit();

    // 4. Sample Donation History + Blood Requests + Audit Entry
    const followUpBatch = writeBatch(db);

    for (const b of sampleBatches) {
      if (b.status === 'available') {
        const donRef = doc(collection(db, 'donations'));
        const donorMeta = sampleDonors.find((d) => d.bg === b.bg);
        if (donorMeta && donorIds[b.bg] && createdBatchIds[b.code]) {
          followUpBatch.set(donRef, {
            donationCode: `DON-${b.code.slice(-3)}`,
            donorId: donorIds[b.bg],
            donorCode: donorMeta.code,
            donorName: donorMeta.name,
            bloodGroup: b.bg,
            component: b.component,
            donationDate: addDaysIsoDate(today, b.offsetCol),
            unitsCollected: Math.min(5, b.units),
            inventoryBatchId: createdBatchIds[b.code],
            notes: 'Routine voluntary blood donation',
            recordedBy: actor.uid,
            createdAt: serverTimestamp(),
          });
        }
      }
    }

    const sampleRequests: Array<{
      code: string;
      hospital: string;
      bg: BloodGroup;
      component: BloodComponent;
      units: number;
      urgency: RequestUrgency;
      notes: string;
    }> = [
      { code: 'REQ-2001', hospital: 'St. Martha Trauma Center', bg: 'O-', component: 'Red Blood Cells', units: 2, urgency: 'emergency', notes: 'Emergency surgical standby order' },
      { code: 'REQ-2002', hospital: 'City General Oncology Ward', bg: 'B-', component: 'Platelets', units: 2, urgency: 'urgent', notes: 'Scheduled platelet transfusion' },
      { code: 'REQ-2003', hospital: 'Metro Maternal Care Hospital', bg: 'A+', component: 'Whole Blood', units: 3, urgency: 'routine', notes: 'Pre-operative maternity reserve' },
    ];

    for (const r of sampleRequests) {
      const rRef = doc(collection(db, 'blood_requests'));
      followUpBatch.set(rRef, {
        requestCode: r.code,
        hospitalOrRequesterName: r.hospital,
        requiredBloodGroup: r.bg,
        component: r.component,
        unitsRequested: r.units,
        urgency: r.urgency,
        requestDate: today,
        requiredDate: addDaysIsoDate(today, r.urgency === 'emergency' ? 0 : 2),
        status: 'pending',
        notes: r.notes,
        createdBy: actor.uid,
        reviewedBy: '',
        reviewedByName: '',
        fulfilledAt: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const logRef = doc(collection(db, 'activity_logs'));
    followUpBatch.set(logRef, {
      action: 'SAMPLE_DATASET_INITIALIZED',
      category: 'settings',
      description: 'Initialized starter donors, 8-group blood inventory batches, donations, and clinical requests.',
      entityId: 'bootstrap',
      actorUid: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });

    await followUpBatch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'blood_inventory');
    return false;
  }
}
