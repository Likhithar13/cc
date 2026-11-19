import {
  BLOOD_GROUPS,
  BloodGroup,
  BloodGroupSummary,
  BloodInventoryBatch,
  BloodRequest,
  DEFAULT_SYSTEM_SETTINGS,
  Donor,
  StockLevelStatus,
  SystemSettings,
} from '../types/bloodBank';

export const ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIsoDate(baseDateStr: string, days: number): string {
  const date = new Date(`${baseDateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() + days);
    return fallback.toISOString().slice(0, 10);
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetweenDates(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function getBatchExpiryState(
  batch: BloodInventoryBatch,
  nearExpiryDays = 7,
  today = getTodayIsoDate()
): 'expired' | 'near_expiry' | 'valid' | 'quarantined' | 'depleted' {
  if (batch.status === 'quarantined') return 'quarantined';
  if (batch.status === 'depleted' || batch.unitsAvailable <= 0) return 'depleted';
  if (batch.status === 'expired' || batch.expiryDate < today) return 'expired';
  const daysLeft = daysBetweenDates(today, batch.expiryDate);
  if (daysLeft <= nearExpiryDays) return 'near_expiry';
  return 'valid';
}

export function classifyStockLevel(units: number, settings: SystemSettings): StockLevelStatus {
  if (units <= settings.lowStockMax) return 'low';
  if (units <= settings.moderateStockMax) return 'moderate';
  return 'sufficient';
}

export function computeBloodGroupSummaries(
  batches: BloodInventoryBatch[],
  requests: BloodRequest[],
  donors: Donor[],
  settings: SystemSettings = DEFAULT_SYSTEM_SETTINGS
): BloodGroupSummary[] {
  const today = getTodayIsoDate();

  return BLOOD_GROUPS.map((bloodGroup: BloodGroup) => {
    const groupBatches = batches.filter((b) => b.bloodGroup === bloodGroup);
    let availableUnits = 0;
    let nearExpiryUnits = 0;
    let expiredUnits = 0;
    let quarantinedUnits = 0;
    let activeBatches = 0;

    for (const batch of groupBatches) {
      const state = getBatchExpiryState(batch, settings.nearExpiryDays, today);
      if (state === 'quarantined') {
        quarantinedUnits += batch.unitsAvailable;
      } else if (state === 'expired') {
        expiredUnits += batch.unitsAvailable;
      } else if (state === 'near_expiry') {
        availableUnits += batch.unitsAvailable;
        nearExpiryUnits += batch.unitsAvailable;
        activeBatches += 1;
      } else if (state === 'valid') {
        availableUnits += batch.unitsAvailable;
        activeBatches += 1;
      }
    }

    const pendingRequestedUnits = requests
      .filter(
        (r) =>
          r.requiredBloodGroup === bloodGroup &&
          (r.status === 'pending' || r.status === 'approved')
      )
      .reduce((acc, r) => acc + r.unitsRequested, 0);

    const availableDonorsCount = donors.filter(
      (d) => d.bloodGroup === bloodGroup && d.availabilityStatus === 'available'
    ).length;

    return {
      bloodGroup,
      availableUnits,
      nearExpiryUnits,
      expiredUnits,
      quarantinedUnits,
      activeBatches,
      pendingRequestedUnits,
      availableDonorsCount,
      status: classifyStockLevel(availableUnits, settings),
    };
  });
}

export function generateCode(prefix: string): string {
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  const timePart = Date.now().toString().slice(-4);
  return `${prefix}-${timePart}${randomPart}`;
}

export function formatFirestoreError(err: unknown): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed && typeof parsed.error === 'string') {
        return parsed.error;
      }
    } catch {
      // Plain error message
    }
    return err.message;
  }
  return String(err);
}
