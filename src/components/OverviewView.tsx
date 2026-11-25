import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Globe2,
  LayoutGrid,
  List,
  Play,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { useState } from 'react';
import type {
  AuditLogEntry,
  InvoiceRecord,
  NavView,
  UserProfile,
} from '../types/invoice';
import {
  formatCurrency,
  formatInrCompact,
  formatTimestamp,
} from '../lib/formatters';
import { StatusText } from './StatusText';

export function OverviewView(props: {
  invoices: InvoiceRecord[];
  auditLogs: AuditLogEntry[];
  profile: UserProfile;
  loading: boolean;
  onNavigate: (view: NavView) => void;
  onInspectInvoice: (invoice: InvoiceRecord) => void;
}) {
  const {
    invoices,
    auditLogs,
    profile,
    loading,
    onNavigate,
    onInspectInvoice,
  } = props;

  const [layoutMode, setLayoutMode] = useState<'BENTO' | 'INDEX'>('BENTO');
  const [strictHighlight, setStrictHighlight] = useState(true);

  const totalCount = invoices.length;
  const pendingCount = invoices.filter(
    (i) => i.status === 'PENDING_MANAGER' || i.status === 'PENDING_ADMIN'
  ).length;
  const escalatedCount = invoices.filter(
    (i) => i.status === 'ESCALATED'
  ).length;
  const autoApprovedCount = invoices.filter(
    (i) => i.status === 'AUTO_APPROVED'
  ).length;
  const humanApprovedCount = invoices.filter(
    (i) => i.status === 'HUMAN_APPROVED'
  ).length;
  const rejectedCount = invoices.filter((i) => i.status === 'REJECTED').length;

  const totalValueInr = invoices.reduce(
    (sum, inv) => sum + (Number(inv.inrEquivalent) || 0),
    0
  );

  const autoRate =
    totalCount > 0 ? Math.round((autoApprovedCount / totalCount) * 100) : 0;

  const lowRiskCount = invoices.filter((i) => i.riskLevel === 'LOW').length;
  const mediumRiskCount = invoices.filter((i) => i.riskLevel === 'MEDIUM').length;
  const highRiskCount = invoices.filter((i) => i.riskLevel === 'HIGH').length;

  const latestInvoice = invoices[0] || null;

  const dateBuckets = new Map<
    string,
    { total: number; auto: number; review: number }
  >();
  for (const inv of [...invoices].reverse()) {
    const label = inv.invoiceDate || 'Recent';
    const current = dateBuckets.get(label) || { total: 0, auto: 0, review: 0 };
    current.total += 1;
    if (inv.status === 'AUTO_APPROVED') current.auto += 1;
    else current.review += 1;
    dateBuckets.set(label, current);
  }
  const trendEntries = Array.from(dateBuckets.entries()).slice(-7);
  const maxTrend = Math.max(1, ...trendEntries.map(([, v]) => v.total));

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-[1380px] mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-5 h-72 bg-white border border-[#E6EAF2] rounded-3xl animate-pulse" />
          <div className="md:col-span-4 h-72 bg-white border border-[#E6EAF2] rounded-3xl animate-pulse" />
          <div className="md:col-span-3 h-72 bg-[#1E4ED8]/20 rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1380px] mx-auto space-y-8">
      {/* Studio Hero Header matching Reference Screenshot */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#1E4ED8] font-medium">
            Overview · Autonomous Workflows 2026
          </p>
          <h1 className="font-display text-4xl sm:text-[2.75rem] font-bold tracking-[-0.03em] text-[#0B0F17] leading-[1.08] [text-wrap:balance]">
            Architectures for intelligent invoice processing.
          </h1>
          <p className="text-sm sm:text-[15px] text-slate-500 leading-relaxed max-w-xl">
            InvoiceFlow AI engineers high-frequency document extraction,
            deterministic policy routing, and human-controlled approval queues
            for modern finance teams.
          </p>
        </div>

        {/* Right Controls: Segmented Bento Deck / Index View + Obsidian Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="flex items-center gap-1 p-1 bg-white border border-[#E6EAF2] rounded-xl shadow-xs"
            role="group"
            aria-label="Overview layout mode"
          >
            <button
              type="button"
              onClick={() => setLayoutMode('BENTO')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                layoutMode === 'BENTO'
                  ? 'bg-[#EFF2F7] text-[#0B0F17] font-semibold'
                  : 'text-slate-500 hover:text-[#0B0F17]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Bento Deck</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('INDEX')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                layoutMode === 'INDEX'
                  ? 'bg-[#EFF2F7] text-[#0B0F17] font-semibold'
                  : 'text-slate-500 hover:text-[#0B0F17]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Index View</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              onNavigate(
                profile.role === 'EMPLOYEE' ? 'upload' : 'queue'
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0B0F17] hover:bg-[#1E293B] text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>
              {profile.role === 'EMPLOYEE'
                ? 'Submit Invoice'
                : `Review (${pendingCount + escalatedCount})`}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {layoutMode === 'BENTO' ? (
        <>
          {/* 6-Card Bento Grid matching Reference Screenshot */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Card 1: Wide Flagship White Card */}
            <div className="md:col-span-12 lg:col-span-5 bg-white border border-[#E6EAF2] rounded-3xl p-7 shadow-[0_2px_12px_rgba(15,23,42,0.03)] relative overflow-hidden flex flex-col justify-between min-h-[320px]">
              <img
                src="/src/assets/images/fintech_ledger_hero_1795535644154.jpg"
                alt="Architectural verification surfaces"
                referrerPolicy="no-referrer"
                className="absolute right-0 top-0 bottom-0 w-1/2 object-cover opacity-25 pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/40 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between text-xs">
                <span className="font-medium text-[#1E4ED8]">
                  Flagship Workflow
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                  01 / Pipeline
                </span>
              </div>

              <div className="relative z-10 space-y-2.5 my-6 max-w-xs">
                <h2 className="font-display text-2xl font-bold text-[#0B0F17] tracking-tight leading-snug">
                  Autonomous Extraction &amp; Policy Routing
                </h2>
                <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed">
                  Real-time Gemini structured JSON extraction paired with
                  deterministic ₹10,000 / ₹50,000 approval gates and duplicate
                  fingerprinting.
                </p>
              </div>

              <div className="relative z-10 flex items-end justify-between gap-4 pt-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                    Key Outcome
                  </p>
                  <p className="text-xs font-semibold text-[#0B0F17] mt-0.5">
                    100% Deterministic Audit Compliance
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('upload')}
                  aria-label="Open invoice upload and extraction"
                  className="w-10 h-10 rounded-xl bg-[#F4F6FA] hover:bg-[#1E4ED8] text-[#0B0F17] hover:text-white border border-[#E6EAF2] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Card 2: Center Tall Card with Inset Document Preview */}
            <div className="md:col-span-6 lg:col-span-4 bg-white border border-[#E6EAF2] rounded-3xl p-7 shadow-[0_2px_12px_rgba(15,23,42,0.03)] flex flex-col justify-between min-h-[320px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#0B0F17]">
                  Schema &amp; Logic
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#1E4ED8]" />
              </div>

              {/* Clean Inset Surface */}
              <div className="my-5 p-4 rounded-2xl bg-[#F4F6FA] border border-[#E6EAF2] space-y-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>
                    {latestInvoice
                      ? latestInvoice.invoiceNumber || latestInvoice.fileName
                      : 'No Invoice Selected'}
                  </span>
                  <span className="text-[#1E4ED8] font-semibold">
                    {latestInvoice
                      ? `${(latestInvoice.confidence * 100).toFixed(0)}% Conf.`
                      : 'Zod Ready'}
                  </span>
                </div>
                <div className="bg-white border border-[#E6EAF2] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#0B0F17] truncate">
                    {latestInvoice
                      ? latestInvoice.vendorName || 'Unidentified Vendor'
                      : 'Upload PDF or Demo'}
                  </span>
                  <span className="font-mono text-xs font-semibold text-[#0B0F17] tabular-nums shrink-0">
                    {latestInvoice
                      ? formatCurrency(
                          latestInvoice.totalAmount,
                          latestInvoice.currency
                        )
                      : '₹0'}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="font-display text-lg font-bold text-[#0B0F17]">
                  Adaptive Validation Engine
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Strict backend JSON Schema verification ensures malformed or
                  low-confidence outputs escalate safely.
                </p>
                <div className="pt-4 mt-4 border-t border-[#E6EAF2] flex items-center justify-between text-xs">
                  <span className="text-slate-400">Enterprise Ready</span>
                  <button
                    type="button"
                    onClick={() =>
                      latestInvoice
                        ? onInspectInvoice(latestInvoice)
                        : onNavigate('processing')
                    }
                    className="inline-flex items-center gap-1 font-semibold text-[#1E4ED8] hover:underline cursor-pointer"
                  >
                    <span>Inspect Output</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Right Vibrant Cobalt Royal Blue Manifesto Card */}
            <div className="md:col-span-6 lg:col-span-3 bg-gradient-to-br from-[#2B62F0] via-[#214BD8] to-[#1739B0] rounded-3xl p-7 text-white shadow-[0_14px_34px_rgba(30,78,216,0.28)] flex flex-col justify-between min-h-[320px]">
              <div className="flex items-center justify-between text-xs text-white/80">
                <span className="font-medium">Policy Core</span>
                <Cpu className="w-4 h-4 text-white/80" />
              </div>

              <div className="my-6 space-y-2.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-100">
                  Core Thesis
                </p>
                <h3 className="font-display text-2xl font-bold tracking-tight leading-tight">
                  ENGINEERED FOR PRECISION &amp; HUMAN CONTROL.
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStrictHighlight((s) => !s);
                  if (profile.role === 'ADMIN') onNavigate('rules');
                  else onNavigate('processing');
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white/15 hover:bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-between gap-2 text-xs font-medium text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 truncate">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Strict Policy Mode</span>
                </span>
                <span
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
                    strictHighlight
                      ? 'bg-white justify-end'
                      : 'bg-white/30 justify-start'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full ${
                      strictHighlight ? 'bg-[#1E4ED8]' : 'bg-white'
                    }`}
                  />
                </span>
              </button>
            </div>

            {/* Card 4: Bottom Left White Volume Card */}
            <div className="md:col-span-6 lg:col-span-4 bg-white border border-[#E6EAF2] rounded-3xl p-7 shadow-[0_2px_12px_rgba(15,23,42,0.03)] flex flex-col justify-between min-h-[210px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#0B0F17]">
                  Active Deployments
                </span>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                  {formatInrCompact(totalValueInr)}
                </span>
              </div>

              <div className="my-4">
                <div className="font-display text-4xl font-bold text-[#0B0F17] tabular-nums tracking-tight">
                  +{totalCount}
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Invoices evaluated across live uploads and sandbox runs.{' '}
                  {autoApprovedCount} auto-approved ({autoRate}% autonomous).
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-[#EFF2F7] overflow-hidden">
                  <div
                    className="h-full bg-[#1E4ED8] rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(6, autoRate)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 5: Bottom Middle Deep Obsidian Contrast Card */}
            <div className="md:col-span-6 lg:col-span-4 bg-gradient-to-br from-[#111827] via-[#0B0F17] to-[#06090F] rounded-3xl p-7 text-white shadow-[0_14px_34px_rgba(11,15,23,0.18)] flex flex-col justify-between min-h-[210px]">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-medium">Review &amp; Escalations</span>
                <Globe2 className="w-4 h-4 text-slate-400" />
              </div>

              <div className="my-4">
                <div className="font-display text-4xl font-bold text-white tabular-nums tracking-tight">
                  +{pendingCount + escalatedCount}
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Invoices awaiting Manager or Admin verification, including
                  high-value tiers and flagged anomalies.
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 pt-1">
                <span>
                  Pending: {pendingCount} · Escalated: {escalatedCount}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate(
                      profile.role === 'EMPLOYEE' ? 'invoices' : 'queue'
                    )
                  }
                  className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                >
                  Open ›
                </button>
              </div>
            </div>

            {/* Card 6: Bottom Right Safeguards Matrix Card */}
            <div className="md:col-span-12 lg:col-span-4 bg-white border border-[#E6EAF2] rounded-3xl p-7 shadow-[0_2px_12px_rgba(15,23,42,0.03)] flex flex-col justify-between min-h-[210px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#0B0F17]">
                  Core Safeguards
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  6 Gates Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 my-4 text-xs text-[#0B0F17]">
                <span className="font-medium">· Duplicate Detection</span>
                <span className="font-medium">· Arithmetic Audit</span>
                <span className="font-medium">· Tax Consistency</span>
                <span className="font-medium">· Confidence ≥ 90%</span>
                <span className="font-medium">· RBAC Enforcement</span>
                <span className="font-medium">· Immutable Audit</span>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E6EAF2]">
                <span className="text-slate-400">Modular Policy Engine</span>
                <button
                  type="button"
                  onClick={() => onNavigate('invoices')}
                  className="font-semibold text-[#1E4ED8] hover:underline cursor-pointer"
                >
                  Explore Ledger ›
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Index View: Dense Metrics Strip + Trends & Risk Charts */
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Invoices', value: totalCount.toString(), tone: 'text-[#0B0F17]' },
              { label: 'Pending Review', value: pendingCount.toString(), tone: 'text-amber-600' },
              { label: 'Escalated', value: escalatedCount.toString(), tone: 'text-red-600' },
              { label: 'Auto-Approved', value: autoApprovedCount.toString(), tone: 'text-emerald-600' },
              { label: 'Human-Approved', value: humanApprovedCount.toString(), tone: 'text-emerald-600' },
              { label: 'Rejected', value: rejectedCount.toString(), tone: 'text-red-600' },
              { label: 'Low Risk', value: lowRiskCount.toString(), tone: 'text-[#1E4ED8]' },
              { label: 'Total Value', value: formatInrCompact(totalValueInr), tone: 'text-[#0B0F17]' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="bg-white border border-[#E6EAF2] rounded-2xl p-5 flex flex-col justify-between gap-2 shadow-[0_1px_4px_rgba(15,23,42,0.03)]"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                  {kpi.label}
                </span>
                <span
                  className={`text-2xl font-mono font-bold tabular-nums ${kpi.tone}`}
                >
                  {kpi.value}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-[#E6EAF2] rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#E6EAF2] pb-3">
                <h2 className="font-display text-base font-bold text-[#0B0F17]">
                  Processing Trends
                </h2>
                <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.08em]">
                  <span className="text-emerald-600">Auto-Approved</span>
                  <span className="text-[#1E4ED8]">Review / Escalated</span>
                </div>
              </div>
              {trendEntries.length === 0 ? (
                <p className="text-xs text-slate-400 py-10 text-center">
                  Upload or simulate invoices to populate daily trends.
                </p>
              ) : (
                <div className="h-44 flex items-end gap-3 pt-4 border-b border-[#E6EAF2] pb-2">
                  {trendEntries.map(([dateLabel, counts]) => {
                    const autoPct = Math.round((counts.auto / maxTrend) * 100);
                    const revPct = Math.round((counts.review / maxTrend) * 100);
                    return (
                      <div
                        key={dateLabel}
                        className="flex-1 flex flex-col items-center gap-2 min-w-0"
                      >
                        <div className="w-full max-w-[42px] h-32 flex flex-col justify-end gap-1">
                          {counts.review > 0 && (
                            <div
                              style={{ height: `${Math.max(12, revPct)}%` }}
                              className="w-full bg-[#1E4ED8] rounded-t-md"
                              title={`Review/Escalated: ${counts.review}`}
                            />
                          )}
                          {counts.auto > 0 && (
                            <div
                              style={{ height: `${Math.max(12, autoPct)}%` }}
                              className="w-full bg-emerald-500 rounded-t-md"
                              title={`Auto-Approved: ${counts.auto}`}
                            />
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 truncate max-w-full">
                          {dateLabel.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 bg-white border border-[#E6EAF2] rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#E6EAF2] pb-3">
                <h2 className="font-display text-base font-bold text-[#0B0F17]">
                  Risk Distribution
                </h2>
                <ShieldCheck className="w-4 h-4 text-[#1E4ED8]" />
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Low Risk', count: lowRiskCount, bar: 'bg-emerald-500', text: 'text-emerald-700' },
                  { label: 'Medium Risk', count: mediumRiskCount, bar: 'bg-amber-500', text: 'text-amber-700' },
                  { label: 'High Risk', count: highRiskCount, bar: 'bg-red-500', text: 'text-red-700' },
                ].map((tier) => {
                  const pct =
                    totalCount > 0 ? Math.round((tier.count / totalCount) * 100) : 0;
                  return (
                    <div key={tier.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${tier.text}`}>
                          {tier.label}
                        </span>
                        <span className="font-mono tabular-nums text-[#0B0F17]">
                          {tier.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-[#EFF2F7] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${tier.bar} rounded-full transition-all duration-200`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State Prompt or Live Recent Activity Tables */}
      {invoices.length === 0 ? (
        <div className="bg-white border border-[#E6EAF2] rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <div className="space-y-1.5 text-center sm:text-left">
            <h3 className="font-display text-lg font-bold text-[#0B0F17]">
              No invoices recorded yet
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
              Upload a real PDF or image invoice for Gemini structured
              extraction, or launch the 7 synthetic demo scenarios to test every
              deterministic approval rule.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1E4ED8] hover:bg-[#1942BC] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Invoice</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F4F6FA] hover:bg-[#EFF2F7] border border-[#E6EAF2] text-[#0B0F17] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 text-[#1E4ED8]" />
              <span>Demo Sandbox</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-[#E6EAF2] rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
            <div className="px-6 py-4 border-b border-[#E6EAF2] flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[#0B0F17]">
                Recent Invoices
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('invoices')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E4ED8] hover:underline cursor-pointer"
              >
                <span>View All ({invoices.length})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-[#E6EAF2]">
              {invoices.slice(0, 5).map((inv) => (
                <button
                  key={inv.invoiceId}
                  type="button"
                  onClick={() => onInspectInvoice(inv)}
                  className="w-full px-6 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0B0F17] truncate">
                      <span className="truncate">
                        {inv.vendorName || 'Unidentified Vendor'}
                      </span>
                      {inv.isDemo && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#1E4ED8] shrink-0">
                          · DEMO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono truncate mt-0.5">
                      {inv.invoiceNumber || inv.fileName} ·{' '}
                      {(inv.confidence * 100).toFixed(0)}% conf.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <StatusText status={inv.status} />
                    <span className="text-sm font-mono font-semibold tabular-nums text-[#0B0F17] w-24 text-right">
                      {formatInrCompact(inv.inrEquivalent || 0)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-[#E6EAF2] rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
            <div className="px-6 py-4 border-b border-[#E6EAF2] flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[#0B0F17]">
                Recent Activity
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('audit')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E4ED8] hover:underline cursor-pointer"
              >
                <span>Audit Logs</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-[#E6EAF2]">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.logId} className="px-6 py-3.5 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#0B0F17]">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-slate-400 tabular-nums shrink-0 text-[11px]">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {log.invoiceNumber || log.invoiceId} · {log.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
