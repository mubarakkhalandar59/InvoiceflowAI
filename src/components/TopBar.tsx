import { Menu, UploadCloud } from 'lucide-react';
import type { NavView, UserProfile } from '../types/invoice';
import { getRoleLabel } from '../lib/formatters';

export type DataScopeFilter = 'ALL' | 'LIVE' | 'DEMO';

const VIEW_TITLES: Record<NavView, string> = {
  overview: 'Overview',
  invoices: 'All Invoices',
  upload: 'Upload & Demo',
  processing: 'AI Processing',
  queue: 'Approval Queue',
  audit: 'Audit Logs',
  users: 'User Management',
  rules: 'Workflow Rules',
  settings: 'Settings',
};

export function TopBar(props: {
  activeView: NavView;
  profile: UserProfile;
  dataScope: DataScopeFilter;
  onChangeDataScope: (scope: DataScopeFilter) => void;
  onOpenMobileNav: () => void;
  onNavigateUpload: () => void;
}) {
  const {
    activeView,
    profile,
    dataScope,
    onChangeDataScope,
    onOpenMobileNav,
    onNavigateUpload,
  } = props;

  return (
    <header className="h-[72px] bg-white/95 backdrop-blur-md border-b border-[#E6EAF2] px-5 lg:px-10 flex items-center justify-between gap-6 sticky top-0 z-30">
      {/* Zone 1: Brand Wordmark & View Context */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 text-[#0B0F17] hover:bg-[#F4F6FA] rounded-xl cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#0B0F17] flex items-center justify-center shrink-0">
            <span className="w-3 h-3 rounded-full bg-white" />
          </div>
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="font-display text-lg font-bold tracking-tight text-[#0B0F17] whitespace-nowrap shrink-0">
              INVOICEFLOW AI
            </span>
            <span className="hidden sm:inline text-slate-300" aria-hidden="true">
              /
            </span>
            <span className="hidden sm:inline text-xs font-medium text-slate-500 truncate">
              {VIEW_TITLES[activeView]}
            </span>
          </div>
        </div>
      </div>

      {/* Zone 2 & 3: Scope Segmented Control, User Role Metadata & Cobalt Primary CTA */}
      <div className="flex items-center gap-5 shrink-0">
        <div
          className="hidden md:flex items-center gap-1 p-1 bg-[#EFF2F7] border border-[#E2E7F0] rounded-xl"
          role="group"
          aria-label="Record scope filter"
        >
          {(
            [
              { id: 'ALL', label: 'All Records' },
              { id: 'LIVE', label: 'Live' },
              { id: 'DEMO', label: 'Demo' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeDataScope(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dataScope === opt.id
                  ? 'bg-white text-[#0B0F17] shadow-xs'
                  : 'text-slate-500 hover:text-[#0B0F17]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="hidden xl:inline text-xs text-slate-500 whitespace-nowrap">
          {profile.displayName} ·{' '}
          <span className="font-medium text-[#0B0F17]">
            {getRoleLabel(profile.role)}
          </span>
        </span>

        <button
          type="button"
          onClick={onNavigateUpload}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1E4ED8] hover:bg-[#1942BC] text-white text-xs font-semibold rounded-xl shadow-[0_6px_18px_rgba(30,78,216,0.25)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <UploadCloud className="w-3.5 h-3.5 shrink-0" />
          <span>Upload Invoice →</span>
        </button>
      </div>
    </header>
  );
}
