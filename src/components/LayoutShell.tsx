import React, { useState } from 'react';
import {
  Activity,
  BookOpen,
  Bot,
  ClipboardList,
  Droplet,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PackagePlus,
  PlusCircle,
  Settings,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AppPage } from '../types/bloodBank';

interface NavGroup {
  label: string;
  items: Array<{
    id: AppPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'donors', label: 'Donor Directory', icon: Users },
      { id: 'add-donor', label: 'Add Donor', icon: UserPlus },
      { id: 'inventory', label: 'Blood Inventory', icon: Droplet },
      { id: 'add-stock', label: 'Add / Update Stock', icon: PackagePlus },
      { id: 'requests', label: 'Blood Requests', icon: ClipboardList },
      { id: 'create-request', label: 'Create Request', icon: PlusCircle },
      { id: 'donations', label: 'Donations', icon: Activity },
    ],
  },
  {
    label: 'Gemini Intelligence',
    items: [
      { id: 'ai-insights', label: 'AI Insights', icon: Bot },
      { id: 'ai-reports', label: 'AI Inventory Reports', icon: FileText },
      { id: 'ai-chat', label: 'AI Assistant Chat', icon: MessageSquare },
    ],
  },
  {
    label: 'Administration & Docs',
    items: [
      { id: 'activity-logs', label: 'Activity Logs', icon: ShieldCheck },
      { id: 'users', label: 'Users & Roles', icon: UserCog, adminOnly: true },
      { id: 'profile-settings', label: 'Profile & Settings', icon: Settings },
      { id: 'cat3-docs', label: 'CAT-3 Documentation', icon: BookOpen },
    ],
  },
];

const PAGE_TITLES: Record<AppPage, string> = {
  'admin-dashboard': 'Dashboard',
  'staff-dashboard': 'Dashboard',
  donors: 'Donor Management',
  'add-donor': 'Register New Donor',
  inventory: 'Blood Inventory & Batches',
  'add-stock': 'Add or Adjust Stock',
  requests: 'Blood Request Management',
  'create-request': 'Create Blood Request',
  donations: 'Donation Management',
  'ai-insights': 'AI Insights & Shortage Alerts',
  'ai-reports': 'AI Inventory Reports',
  'ai-chat': 'AI Administrative Assistant',
  users: 'User & Role Management',
  'activity-logs': 'System Activity Logs',
  'profile-settings': 'Profile & Threshold Settings',
  'cat3-docs': 'CAT-3 Case Study Documentation',
};

interface LayoutShellProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  lowStockCount: number;
  children: React.ReactNode;
}

export function LayoutShell({
  currentPage,
  onNavigate,
  lowStockCount,
  children,
}: LayoutShellProps) {
  const { userProfile, effectiveRole, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const avatarSrc =
    effectiveRole === 'admin'
      ? '/src/assets/images/avatar_medical_director_1795074875110.jpg'
      : '/src/assets/images/avatar_lab_staff_1795074876037.jpg';

  const handleSelectPage = (page: AppPage) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="px-5 py-5 border-b border-slate-200 flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleSelectPage('admin-dashboard')}
          className="flex items-center gap-2.5 text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-red-700 text-white flex items-center justify-center shrink-0">
            <Droplet className="w-4 h-4" />
          </div>
          <div>
            <div className="font-display text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
              HemoCore
            </div>
            <div className="text-[11px] text-slate-500 whitespace-nowrap">
              Blood Bank Operations
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.adminOnly || effectiveRole === 'admin'
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 tracking-wide">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectPage(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-red-50 text-red-800 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            active ? 'text-red-700' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.id === 'inventory' && lowStockCount > 0 && (
                        <span className="font-mono tabular-nums text-[11px] font-semibold text-red-700">
                          {lowStockCount} low
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-3">

        <div className="flex items-center gap-3">
          <img
            src={avatarSrc}
            alt={userProfile?.displayName || 'User profile'}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
            className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {userProfile?.displayName || 'Authorized User'}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {effectiveRole === 'admin' ? 'Administrator' : 'Blood Bank Staff'} ·{' '}
              {userProfile?.department || 'Operations'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            title="Sign out"
            className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                HemoCore
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-display text-base sm:text-lg font-semibold text-slate-900 truncate">
                {PAGE_TITLES[currentPage]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('ai-insights')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Bot className="w-3.5 h-3.5 text-red-700" />
              AI Insights
            </button>
            <button
              type="button"
              onClick={() => onNavigate('create-request')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Request
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
