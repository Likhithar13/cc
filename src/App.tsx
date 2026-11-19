import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LayoutShell } from './components/LayoutShell';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { computeBloodGroupSummaries } from './lib/inventoryUtils';
import { AiChatPage } from './pages/AiChatPage';
import { AiInsightsPage } from './pages/AiInsightsPage';
import { AiReportsPage } from './pages/AiReportsPage';
import { Cat3DocsPage } from './pages/Cat3DocsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DonationsPage } from './pages/DonationsPage';
import { DonorsPage } from './pages/DonorsPage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';
import { RequestsPage } from './pages/RequestsPage';
import {
  ActivityLogsPage,
  UsersManagementPage,
} from './pages/UsersAndLogsPages';
import {
  initializeSampleDataset,
  subscribeActivityLogs,
  subscribeAiReports,
  subscribeDonations,
  subscribeDonors,
  subscribeInventory,
  subscribeRequests,
  subscribeSystemSettings,
  subscribeTransactions,
  subscribeUsers,
} from './services/firestoreService';
import {
  ActivityLog,
  AiReport,
  AppPage,
  BloodInventoryBatch,
  BloodRequest,
  BloodTransaction,
  DEFAULT_SYSTEM_SETTINGS,
  Donation,
  Donor,
  SystemSettings,
  UserProfile,
} from './types/bloodBank';

function AuthenticatedWorkspace() {
  const { firebaseUser, userProfile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>('admin-dashboard');

  const [donors, setDonors] = useState<Donor[]>([]);
  const [batches, setBatches] = useState<BloodInventoryBatch[]>([]);
  const [transactions, setTransactions] = useState<BloodTransaction[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [aiReports, setAiReports] = useState<AiReport[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [loadingData, setLoadingData] = useState(true);
  const autoSeedAttemptedRef = useRef(false);

  const isAuthorizedActive =
    Boolean(firebaseUser) &&
    Boolean(userProfile) &&
    userProfile?.status === 'active';

  // Attach Firestore subscriptions strictly after Auth is ready & active
  useEffect(() => {
    if (!isAuthorizedActive || !userProfile) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    let initialLoaded = 0;
    const markLoaded = () => {
      initialLoaded += 1;
      if (initialLoaded >= 5) {
        setLoadingData(false);
      }
    };

    const handleSubError = (label: string) => (err: Error) => {
      console.error(`Firestore subscription error (${label}):`, err);
      markLoaded();
    };

    const unsubs: Array<() => void> = [];

    unsubs.push(
      subscribeDonors(
        (data) => {
          setDonors(data);
          markLoaded();
        },
        handleSubError('donors')
      )
    );
    unsubs.push(
      subscribeInventory(
        (data) => {
          setBatches(data);
          markLoaded();
        },
        handleSubError('blood_inventory')
      )
    );
    unsubs.push(
      subscribeTransactions(
        (data) => {
          setTransactions(data);
          markLoaded();
        },
        handleSubError('blood_transactions')
      )
    );
    unsubs.push(
      subscribeRequests(
        (data) => {
          setRequests(data);
          markLoaded();
        },
        handleSubError('blood_requests')
      )
    );
    unsubs.push(
      subscribeDonations(
        (data) => {
          setDonations(data);
          markLoaded();
        },
        handleSubError('donations')
      )
    );
    unsubs.push(subscribeAiReports(setAiReports, handleSubError('ai_reports')));
    unsubs.push(subscribeSystemSettings(setSettings, handleSubError('system_settings')));
    unsubs.push(subscribeActivityLogs(setActivityLogs, handleSubError('activity_logs')));

    if (userProfile.role === 'admin') {
      unsubs.push(subscribeUsers(setUsers, handleSubError('users')));
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [isAuthorizedActive, userProfile?.uid, userProfile?.role]);

  // Non-destructive demonstration dataset bootstrap when database is completely empty
  useEffect(() => {
    if (
      !isAuthorizedActive ||
      loadingData ||
      !userProfile ||
      autoSeedAttemptedRef.current
    ) {
      return;
    }

    if (donors.length === 0 && batches.length === 0 && requests.length === 0) {
      autoSeedAttemptedRef.current = true;
      void initializeSampleDataset(userProfile).catch(() => {
        // Non-fatal if another user or existing rules prevent seeding
      });
    }
  }, [
    isAuthorizedActive,
    loadingData,
    userProfile,
    donors.length,
    batches.length,
    requests.length,
  ]);

  const summaries = useMemo(
    () => computeBloodGroupSummaries(batches, requests, donors, settings),
    [batches, requests, donors, settings]
  );

  const lowStockCount = useMemo(
    () => summaries.filter((s) => s.status === 'low').length,
    [summaries]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-600">
          Loading HemoCore workspace...
        </div>
      </div>
    );
  }

  if (!isAuthorizedActive) {
    return <LoginPage />;
  }

  const safePage: AppPage = currentPage;

  return (
    <LayoutShell
      currentPage={safePage}
      onNavigate={setCurrentPage}
      lowStockCount={lowStockCount}
    >
      {(safePage === 'admin-dashboard' || safePage === 'staff-dashboard') && (
        <DashboardPage
          mode="admin"
          donors={donors}
          batches={batches}
          requests={requests}
          donations={donations}
          logs={activityLogs}
          summaries={summaries}
          settings={settings}
          loadingData={loadingData}
          onNavigate={setCurrentPage}
        />
      )}
      {safePage === 'donors' && (
        <DonorsPage
          mode="list"
          donors={donors}
          donations={donations}
          onNavigate={setCurrentPage}
        />
      )}
      {safePage === 'add-donor' && (
        <DonorsPage
          mode="add"
          donors={donors}
          donations={donations}
          onNavigate={setCurrentPage}
        />
      )}
      {safePage === 'inventory' && (
        <InventoryPage
          mode="list"
          batches={batches}
          transactions={transactions}
          summaries={summaries}
          settings={settings}
          onNavigate={setCurrentPage}
        />
      )}
      {safePage === 'add-stock' && (
        <InventoryPage
          mode="add"
          batches={batches}
          transactions={transactions}
          summaries={summaries}
          settings={settings}
          onNavigate={setCurrentPage}
        />
      )}
      {safePage === 'requests' && (
        <RequestsPage
          mode="list"
          requests={requests}
          batches={batches}
          onNavigate={setCurrentPage}
        />
      )}
      {safePage === 'create-request' && (
        <RequestsPage
          mode="create"
          requests={requests}
          batches={batches}
          onNavigate={setCurrentPage}
        />
      )}
      {safePage === 'donations' && (
        <DonationsPage donors={donors} donations={donations} />
      )}
      {safePage === 'ai-insights' && (
        <AiInsightsPage
          summaries={summaries}
          settings={settings}
          liveDataset={{ batches, requests, donors, donations, settings }}
        />
      )}
      {safePage === 'ai-reports' && (
        <AiReportsPage
          reports={aiReports}
          liveDataset={{ batches, requests, donors, donations, settings }}
        />
      )}
      {safePage === 'ai-chat' && (
        <AiChatPage
          liveDataset={{ batches, requests, donors, donations, settings }}
        />
      )}
      {safePage === 'users' && <UsersManagementPage users={users} />}
      {safePage === 'activity-logs' && (
        <ActivityLogsPage logs={activityLogs} />
      )}
      {safePage === 'profile-settings' && (
        <ProfileSettingsPage
          settings={settings}
          hasExistingInventory={batches.length > 0}
        />
      )}
      {safePage === 'cat3-docs' && <Cat3DocsPage />}
    </LayoutShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthenticatedWorkspace />
      </AuthProvider>
    </ErrorBoundary>
  );
}
