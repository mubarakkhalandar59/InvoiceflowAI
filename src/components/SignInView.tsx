import { ArrowRight, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { signInWithGoogle } from '../lib/firebase';

export function SignInView({ authError }: { authError: string | null }) {
  const [signingIn, setSigningIn] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setSigningIn(true);
    setLocalError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Google Sign-In failed.'
      );
    } finally {
      setSigningIn(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-[#0B0F17] flex items-center justify-center p-6 lg:p-12">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 bg-white border border-[#E6EAF2] rounded-3xl shadow-[0_24px_60px_rgba(15,23,42,0.06)] overflow-hidden items-stretch">
        {/* Left Cobalt-Obsidian Visual Panel */}
        <div className="lg:col-span-6 relative min-h-[300px] lg:min-h-[580px] bg-gradient-to-br from-[#214BD8] via-[#1739B0] to-[#0B0F17] flex flex-col justify-between p-10 text-white">
          <img
            src="/src/assets/images/fintech_ledger_hero_1795535644154.jpg"
            alt="Architectural ledger geometry representing InvoiceFlow AI verification layers"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17]/95 via-[#1739B0]/65 to-[#2563EB]/45" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-[#0B0F17] flex items-center justify-center shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1E4ED8]" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-white">
              INVOICEFLOW AI
            </span>
          </div>

          <div className="relative z-10 space-y-5">
            <h1 className="font-display text-4xl lg:text-[2.6rem] font-bold tracking-tight leading-[1.08] text-white [text-wrap:balance]">
              Intelligent Invoice Processing. Human-Controlled Decisions.
            </h1>
            <p className="text-sm text-white/80 leading-relaxed max-w-md">
              Autonomous Gemini extraction paired with deterministic financial
              policy rules, role-gated approvals, and immutable audit trails.
            </p>
            <div className="pt-2 space-y-2.5 text-xs text-white/90">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>
                  Structured JSON Schema extraction with backend verification
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-200 shrink-0" />
                <span>
                  Deterministic ₹10,000 / ₹50,000 tiers and anomaly escalation
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-blue-200 shrink-0" />
                <span>
                  Firebase JWT authentication with server-enforced RBAC
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sign-In Form */}
        <div className="lg:col-span-6 p-8 lg:p-14 flex flex-col justify-center space-y-8 bg-white">
          <div className="space-y-2.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#1E4ED8] font-medium">
              Enterprise Financial Workflow
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#0B0F17] tracking-tight leading-tight">
              Sign in to Portal
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed pt-1">
              Authenticate with your verified Google account. Permissions are
              enforced server-side via signed Firebase ID tokens.
            </p>
          </div>

          {displayError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
              {displayError}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-[#1E4ED8] hover:bg-[#1942BC] disabled:opacity-60 text-white text-sm font-semibold shadow-[0_8px_20px_rgba(30,78,216,0.25)] transition-colors cursor-pointer"
            >
              <span>
                {signingIn ? 'Verifying Google Session...' : 'Continue with Google'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-6 border-t border-[#E6EAF2] space-y-2.5">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-400">
              Role Provisioning Policy
            </h3>
            <div className="space-y-1.5 text-xs text-slate-500 leading-relaxed">
              <p>
                New accounts default to{' '}
                <span className="text-[#0B0F17] font-semibold">Employee</span>{' '}
                with upload and personal history access.
              </p>
              <p>
                Managers and Admins review escalated or high-value invoices and
                manage thresholds in{' '}
                <span className="text-[#0B0F17] font-semibold">
                  User Management
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
