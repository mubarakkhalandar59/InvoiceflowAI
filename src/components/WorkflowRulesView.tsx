import {
  CheckCircle2,
  Save,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UserProfile, WorkflowRuleConfig } from '../types/invoice';
import { saveWorkflowRules } from '../lib/firestoreStore';

export function WorkflowRulesView(props: {
  rules: WorkflowRuleConfig;
  profile: UserProfile;
}) {
  const { rules, profile } = props;

  const [autoApproveMaxInr, setAutoApproveMaxInr] = useState(
    rules.autoApproveMaxInr
  );
  const [managerMaxInr, setManagerMaxInr] = useState(rules.managerMaxInr);
  const [minConfidence, setMinConfidence] = useState(rules.minConfidence);
  const [requireTaxConsistency, setRequireTaxConsistency] = useState(
    rules.requireTaxConsistency
  );
  const [blockDuplicates, setBlockDuplicates] = useState(
    rules.blockDuplicateVendorInvoices
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setAutoApproveMaxInr(rules.autoApproveMaxInr);
    setManagerMaxInr(rules.managerMaxInr);
    setMinConfidence(rules.minConfidence);
    setRequireTaxConsistency(rules.requireTaxConsistency);
    setBlockDuplicates(rules.blockDuplicateVendorInvoices);
  }, [rules]);

  if (profile.role !== 'ADMIN') {
    return (
      <div className="p-6 lg:p-10 max-w-[1380px] mx-auto">
        <div className="bg-white border border-[#E6EAF2] rounded-3xl p-10 max-w-xl mx-auto text-center space-y-2 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <ShieldAlert className="w-7 h-7 text-amber-600 mx-auto" />
          <h2 className="font-display text-xl font-bold text-[#0B0F17]">
            Admin Privileges Required
          </h2>
          <p className="text-sm text-slate-500">
            Only Admins can modify deterministic approval thresholds and safety
            gates.
          </p>
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedMsg(null);

    if (autoApproveMaxInr < 0 || managerMaxInr < autoApproveMaxInr) {
      setErrorMsg(
        'Manager ceiling must be greater than or equal to the auto-approval ceiling.'
      );
      return;
    }
    if (minConfidence < 0.5 || minConfidence > 0.99) {
      setErrorMsg('Minimum confidence must be between 0.50 and 0.99.');
      return;
    }

    setSaving(true);
    try {
      await saveWorkflowRules(
        {
          ruleId: 'default',
          autoApproveMaxInr,
          managerMaxInr,
          minConfidence,
          requireTaxConsistency,
          blockDuplicateVendorInvoices: blockDuplicates,
          updatedBy: profile.email,
        },
        profile.email
      );
      setSavedMsg(
        'Workflow policy thresholds saved to Firestore and active on backend evaluations.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to save workflow rules.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#1E4ED8] font-medium">
          Governance · Threshold Policy
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0B0F17]">
          Workflow Rules
        </h1>
      </div>

      {savedMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="bg-white border border-[#E6EAF2] rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3 pb-4 border-b border-[#E6EAF2]">
          <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#1E4ED8] flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-[#0B0F17]">
              Deterministic Approval Policy
            </h2>
            <p className="text-xs text-slate-500">
              AI extraction recommendations never override these backend limits.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="auto-max"
              className="block font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500 mb-1.5"
            >
              Auto-Approval Maximum (INR ₹)
            </label>
            <input
              id="auto-max"
              type="number"
              min={0}
              max={1000000}
              value={autoApproveMaxInr}
              onChange={(e) => setAutoApproveMaxInr(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E6EAF2] font-mono text-sm text-[#0B0F17] focus:outline-none focus:border-[#1E4ED8]"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Default: ₹10,000 when all validations pass.
            </p>
          </div>

          <div>
            <label
              htmlFor="manager-max"
              className="block font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500 mb-1.5"
            >
              Manager Approval Ceiling (INR ₹)
            </label>
            <input
              id="manager-max"
              type="number"
              min={0}
              max={10000000}
              value={managerMaxInr}
              onChange={(e) => setManagerMaxInr(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E6EAF2] font-mono text-sm text-[#0B0F17] focus:outline-none focus:border-[#1E4ED8]"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Invoices above this ceiling route to Admin. Default: ₹50,000.
            </p>
          </div>

          <div>
            <label
              htmlFor="min-conf"
              className="block font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500 mb-1.5"
            >
              Minimum AI Extraction Confidence (0.50 – 0.99)
            </label>
            <input
              id="min-conf"
              type="number"
              step="0.01"
              min={0.5}
              max={0.99}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E6EAF2] font-mono text-sm text-[#0B0F17] focus:outline-none focus:border-[#1E4ED8]"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Scores below threshold automatically escalate. Default: 0.90.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-[#E6EAF2]">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-[#0B0F17]">
                Enforce Tax Consistency Checks
              </p>
              <p className="text-xs text-slate-500">
                Escalate invoices with anomalous tax percentages or missing tax
                breakdowns.
              </p>
            </div>
            <input
              type="checkbox"
              checked={requireTaxConsistency}
              onChange={(e) => setRequireTaxConsistency(e.target.checked)}
              className="w-4 h-4 accent-[#1E4ED8]"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-[#0B0F17]">
                Block Duplicate Vendor Invoice Numbers
              </p>
              <p className="text-xs text-slate-500">
                Automatically escalate repeated invoice numbers for the same
                vendor.
              </p>
            </div>
            <input
              type="checkbox"
              checked={blockDuplicates}
              onChange={(e) => setBlockDuplicates(e.target.checked)}
              className="w-4 h-4 accent-[#1E4ED8]"
            />
          </label>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1E4ED8] hover:bg-[#1942BC] disabled:opacity-50 text-white text-xs font-semibold shadow-[0_6px_18px_rgba(30,78,216,0.22)] transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Policy...' : 'Save Workflow Rules'}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
