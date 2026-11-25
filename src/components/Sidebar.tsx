import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileCheck2,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Settings,
  SlidersHorizontal,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import type { NavView, UserProfile } from '../types/invoice';
import { getRoleLabel } from '../lib/formatters';

interface NavItem {
  id: NavView;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Array<'EMPLOYEE' | 'MANAGER' | 'ADMIN'>;
  badge?: number;
}

export function Sidebar(props: {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  profile: UserProfile;
  pendingQueueCount: number;
  expanded: boolean;
  onToggleExpand: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSignOut: () => void;
}) {
  const {
    activeView,
    onSelectView,
    profile,
    pendingQueueCount,
    expanded,
    onToggleExpand,
    mobileOpen,
    onCloseMobile,
    onSignOut,
  } = props;

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'],
    },
    {
      id: 'invoices',
      label: 'All Invoices',
      icon: FileSpreadsheet,
      roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'],
    },
    {
      id: 'upload',
      label: 'Upload Invoice',
      icon: UploadCloud,
      roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'],
    },
    {
      id: 'processing',
      label: 'AI Processing',
      icon: Cpu,
      roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'],
    },
    {
      id: 'queue',
      label: 'Approval Queue',
      icon: FileCheck2,
      roles: ['MANAGER', 'ADMIN'],
      badge: pendingQueueCount,
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      icon: Activity,
      roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'],
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      roles: ['ADMIN'],
    },
    {
      id: 'rules',
      label: 'Workflow Rules',
      icon: SlidersHorizontal,
      roles: ['ADMIN'],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'],
    },
  ];

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(profile.role)
  );

  const renderRail = (showLabels: boolean) => (
    <div className="flex flex-col h-full bg-white border-r border-[#E6EAF2] py-5">
      {/* Top Expand/Collapse Toggle */}
      <div
        className={`px-4 mb-5 flex items-center ${
          showLabels ? 'justify-between' : 'justify-center'
        }`}
      >
        {showLabels && (
          <span className="font-display text-sm font-bold text-[#0B0F17] tracking-tight truncate">
            Navigation
          </span>
        )}
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={showLabels ? 'Collapse rail' : 'Expand rail'}
          title={showLabels ? 'Collapse navigation' : 'Expand navigation labels'}
          className="hidden lg:inline-flex w-9 h-9 rounded-xl items-center justify-center text-slate-500 hover:text-[#0B0F17] hover:bg-[#F4F6FA] transition-colors cursor-pointer"
        >
          {showLabels ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden w-9 h-9 rounded-xl inline-flex items-center justify-center text-[#0B0F17] hover:bg-[#F4F6FA]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Items */}
      <nav
        className={`flex-1 overflow-y-auto flex flex-col gap-1.5 ${
          showLabels ? 'px-3' : 'items-center px-2'
        }`}
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectView(item.id);
                onCloseMobile();
              }}
              title={!showLabels ? item.label : undefined}
              className={`relative flex items-center transition-colors cursor-pointer whitespace-nowrap ${
                showLabels
                  ? `w-full px-3.5 py-2.5 rounded-xl justify-between text-xs font-medium ${
                      active
                        ? 'bg-[#EFF2F7] text-[#0B0F17] font-semibold'
                        : 'text-slate-500 hover:text-[#0B0F17] hover:bg-[#F4F6FA]'
                    }`
                  : `w-11 h-11 rounded-xl justify-center ${
                      active
                        ? 'bg-[#EFF2F7] text-[#1E4ED8]'
                        : 'text-slate-500 hover:text-[#0B0F17] hover:bg-[#F4F6FA]'
                    }`
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    active ? 'text-[#1E4ED8]' : 'text-slate-500'
                  }`}
                />
                {showLabels && <span className="truncate">{item.label}</span>}
              </span>
              {typeof item.badge === 'number' &&
                item.badge > 0 &&
                (showLabels ? (
                  <span className="font-mono text-[11px] tabular-nums text-[#1E4ED8] font-semibold">
                    {item.badge}
                  </span>
                ) : (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#1E4ED8] text-white font-mono text-[10px] flex items-center justify-center tabular-nums">
                    {item.badge}
                  </span>
                ))}
            </button>
          );
        })}
      </nav>

      {/* Bottom Sign-Out & Account */}
      <div
        className={`pt-4 mt-4 border-t border-[#E6EAF2] flex flex-col gap-3 ${
          showLabels ? 'px-4' : 'items-center px-2'
        }`}
      >
        {showLabels && (
          <div className="space-y-0.5 px-1">
            <p className="text-xs font-semibold text-[#0B0F17] truncate">
              {profile.displayName}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 truncate">
              {getRoleLabel(profile.role)}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onSignOut}
          title="Sign Out"
          aria-label="Sign Out"
          className={
            showLabels
              ? 'w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[#F4F6FA] border border-[#E6EAF2] hover:bg-[#EFF2F7] text-xs font-medium text-[#0B0F17] rounded-xl transition-colors cursor-pointer'
              : 'w-11 h-11 rounded-xl flex items-center justify-center bg-[#F4F6FA] border border-[#E6EAF2] text-slate-600 hover:text-[#0B0F17] hover:bg-[#EFF2F7] transition-colors cursor-pointer'
          }
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {showLabels && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-150 ${
          expanded ? 'w-[244px]' : 'w-[80px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderRail(expanded)}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">
            {renderRail(true)}
          </div>
        </div>
      )}
    </>
  );
}
