export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const BLOOD_COMPONENTS = [
  'Whole Blood',
  'Red Blood Cells',
  'Platelets',
  'Fresh Frozen Plasma',
  'Cryoprecipitate',
] as const;
export type BloodComponent = (typeof BLOOD_COMPONENTS)[number];

export type UserRole = 'admin' | 'staff';
export type UserStatus = 'active' | 'pending' | 'disabled';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  department: string;
  phone: string;
  createdAt?: string;
  updatedAt?: string;
}

export type DonorAvailability = 'available' | 'deferred' | 'inactive';

export interface Donor {
  id: string;
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
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export type InventoryBatchStatus = 'available' | 'quarantined' | 'expired' | 'depleted';

export interface BloodInventoryBatch {
  id: string;
  batchCode: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  unitsAvailable: number;
  initialUnits: number;
  collectionDate: string;
  expiryDate: string;
  storageLocation: string;
  status: InventoryBatchStatus;
  quarantineReason: string;
  donorId: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TransactionType = 'addition' | 'usage' | 'quarantine' | 'expiry_writeoff' | 'adjustment';

export interface BloodTransaction {
  id: string;
  transactionType: TransactionType;
  bloodGroup: BloodGroup;
  component: string;
  unitsDelta: number;
  unitsAfter: number;
  inventoryBatchId: string;
  referenceType: 'donation' | 'request' | 'manual' | 'quarantine';
  referenceId: string;
  notes: string;
  performedBy: string;
  performedByName: string;
  createdAt?: string;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled';
export type RequestUrgency = 'routine' | 'urgent' | 'emergency';

export interface BloodRequest {
  id: string;
  requestCode: string;
  hospitalOrRequesterName: string;
  requiredBloodGroup: BloodGroup;
  component: BloodComponent;
  unitsRequested: number;
  urgency: RequestUrgency;
  requestDate: string;
  requiredDate: string;
  status: RequestStatus;
  notes: string;
  createdBy: string;
  reviewedBy: string;
  reviewedByName: string;
  fulfilledAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Donation {
  id: string;
  donationCode: string;
  donorId: string;
  donorCode: string;
  donorName: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  donationDate: string;
  unitsCollected: number;
  inventoryBatchId: string;
  notes: string;
  recordedBy: string;
  createdAt?: string;
}

export interface AiReport {
  id: string;
  title: string;
  reportType: 'inventory_analysis' | 'full_report' | 'recruitment_plan';
  totalAvailableUnits: number;
  nearExpiryUnits: number;
  expiredUnits: number;
  quarantinedUnits: number;
  lowStockGroups: string[];
  summaryText: string;
  recommendations: string[];
  safetyDisclaimer: string;
  lowStockMaxThreshold: number;
  moderateStockMaxThreshold: number;
  generatedBy: string;
  generatedByName: string;
  createdAt?: string;
}

export type ActivityCategory =
  | 'auth'
  | 'donor'
  | 'inventory'
  | 'request'
  | 'donation'
  | 'ai'
  | 'settings'
  | 'users';

export interface ActivityLog {
  id: string;
  action: string;
  category: ActivityCategory;
  description: string;
  entityId: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  createdAt?: string;
}

export interface SystemSettings {
  lowStockMax: number;
  moderateStockMax: number;
  nearExpiryDays: number;
  thresholdNotice: string;
  updatedBy?: string;
  updatedAt?: string;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  lowStockMax: 4, // Fewer than 5 units (< 5) = Low stock
  moderateStockMax: 9, // 5–9 units = Moderate stock, 10+ = Sufficient stock
  nearExpiryDays: 7,
  thresholdNotice:
    'Illustrative academic demonstration thresholds only (Low < 5 units, Moderate 5–9 units, Sufficient 10+ units) — not clinical or regulatory standards.',
};

export type StockLevelStatus = 'low' | 'moderate' | 'sufficient';

export interface BloodGroupSummary {
  bloodGroup: BloodGroup;
  availableUnits: number;
  nearExpiryUnits: number;
  expiredUnits: number;
  quarantinedUnits: number;
  activeBatches: number;
  pendingRequestedUnits: number;
  availableDonorsCount: number;
  status: StockLevelStatus;
}

export type AppPage =
  | 'admin-dashboard'
  | 'staff-dashboard'
  | 'donors'
  | 'add-donor'
  | 'inventory'
  | 'add-stock'
  | 'requests'
  | 'create-request'
  | 'donations'
  | 'ai-insights'
  | 'ai-reports'
  | 'ai-chat'
  | 'users'
  | 'activity-logs'
  | 'profile-settings'
  | 'cat3-docs';

export interface AnonymizedOperationalSnapshot {
  generatedAt: string;
  totalAvailableUnits: number;
  nearExpiryUnits: number;
  expiredUnits: number;
  quarantinedUnits: number;
  lowStockGroups: string[];
  moderateStockGroups: string[];
  sufficientStockGroups: string[];
  thresholds: SystemSettings;
  byBloodGroup: BloodGroupSummary[];
  componentBreakdown?: Record<string, number>;
  openRequestsSummary?: {
    pendingCount: number;
    approvedCount: number;
    fulfilledCount: number;
    rejectedCount: number;
    totalPendingAndApprovedUnits: number;
  };
  donationsSummary?: {
    totalRecordedDonations: number;
    totalUnitsCollected: number;
  };
  totalAnonymousDonors?: number;
}

export interface AiStockAnalysisResponse {
  deterministicSummary: AnonymizedOperationalSnapshot;
  modelUsed?: string;
  aiAnalysis: {
    executiveSummary: string;
    groupObservations: string;
    shortageAlerts: Array<{
      bloodGroup: string;
      severity: 'critical' | 'warning' | 'watch';
      reason: string;
      suggestedAction: string;
    }>;
    managementRecommendations: string[];
    donorRecruitmentSuggestions: Array<{
      bloodGroup: string;
      priority: 'high' | 'medium';
      rationale: string;
      campaignIdea: string;
    }>;
    safetyDisclaimer: string;
  };
}

export interface AiReportResponse {
  title: string;
  reportType: 'full_report';
  totalAvailableUnits: number;
  nearExpiryUnits: number;
  expiredUnits: number;
  quarantinedUnits: number;
  lowStockGroups: string[];
  summaryText: string;
  recommendations: string[];
  safetyDisclaimer: string;
  lowStockMaxThreshold: number;
  moderateStockMaxThreshold: number;
}
