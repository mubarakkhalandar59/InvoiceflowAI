import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UserProfile, WorkflowRuleConfig } from '../types/invoice';
import { fetchServerCallerInfo } from '../lib/api';
import { formatInrCompact, getRoleLabel } from '../lib/formatters';

export function SettingsView(props: {
  profile: UserProfile;
  rules: WorkflowRuleConfig;
}) {
  const { profile, rules } = props;
  const [jwtVerifiedRole, setJwtVerifiedRole] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    fetchServerCallerInfo()
      .then((info) => setJwtVerifiedRole(info.role))
      .catch((err) =>
        setVerifyError(
          err instanceof Error ? err.message : 'Unable to verify token.'
        )
      );
  }, [profile.uid, profile.role]);

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#1E4ED8] font-medium">
          Account · Session &amp; Policy
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0B0F17]">
          Workspace Settings
        </h1>
      </div>

      <section className="bg-white border border-[#E6EAF2] rounded-3xl p-6 sm:p-8 space-y-5 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <h2 className="font-display text-base font-bold text-[#0B0F17] border-b border-[#E6EAF2] pb-3">
          Verified Identity &amp; Session
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E6EAF2]">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
              Signed-In Account
            </p>
            <p className="font-semibold text-[#0B0F17] mt-1">
              {profile.displayName}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{profile.email}</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E6EAF2]">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
              Server-Trusted Role
            </p>
            <p className="font-mono text-[#0B0F17] font-semibold mt-1">
              {getRoleLabel(profile.role)} ({profile.role})
            </p>
            {jwtVerifiedRole ? (
              <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Backend JWT verified ({jwtVerifiedRole})</span>
              </p>
            ) : verifyError ? (
              <p className="text-xs text-red-700 mt-1">{verifyError}</p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">
                Verifying Firebase ID token...
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#E6EAF2] rounded-3xl p-6 sm:p-8 space-y-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2.5 text-[#0B0F17] font-display font-bold text-base border-b border-[#E6EAF2] pb-3">
          <ShieldCheck className="w-4 h-4 text-[#1E4ED8]" />
          <span>Active Policy &amp; Safeguards</span>
        </div>
        <div className="divide-y divide-[#E6EAF2] text-xs">
          <div className="py-3.5 flex items-center justify-between">
            <span className="text-slate-500">Auto-Approval Ceiling</span>
            <span className="font-mono font-semibold text-[#0B0F17] tabular-nums">
              {formatInrCompact(rules.autoApproveMaxInr)}
            </span>
          </div>
          <div className="py-3.5 flex items-center justify-between">
            <span className="text-slate-500">Manager Approval Ceiling</span>
            <span className="font-mono font-semibold text-[#0B0F17] tabular-nums">
              {formatInrCompact(rules.managerMaxInr)}
            </span>
          </div>
          <div className="py-3.5 flex items-center justify-between">
            <span className="text-slate-500">
              Minimum Extraction Confidence
            </span>
            <span className="font-mono font-semibold text-[#0B0F17] tabular-nums">
              {(rules.minConfidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="py-3.5 flex items-center justify-between">
            <span className="text-slate-500">AI Extraction Pipeline</span>
            <span className="font-mono text-[#1E4ED8] font-medium">
              Gemini Flash Multi-Model Fallback
            </span>
          </div>
          <div className="py-3.5 flex items-center justify-between">
            <span className="text-slate-500">Automatic Payment Transfers</span>
            <span className="font-mono text-emerald-700 flex items-center gap-1.5 font-medium">
              <Lock className="w-3 h-3" />
              <span>Disabled (Approval Only)</span>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
