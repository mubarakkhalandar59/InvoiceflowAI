import {
  CheckCircle2,
  Cpu,
  FileSearch,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import type {
  InvoiceRecord,
  NavView,
  ProcessedInvoiceResponse,
} from '../types/invoice';
import { formatCurrency } from '../lib/formatters';
import { RiskText, StatusText } from './StatusText';

export function ProcessingView(props: {
  latestRun: ProcessedInvoiceResponse | null;
  latestInvoice: InvoiceRecord | null;
  onNavigate: (view: NavView) => void;
  onInspectInvoice: (invoice: InvoiceRecord) => void;
}) {
  const { latestRun, latestInvoice, onNavigate, onInspectInvoice } = props;

  if (!latestRun && !latestInvoice) {
    return (
      <div className="p-6 lg:p-10 max-w-[1380px] mx-auto space-y-6">
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#1E4ED8] font-medium">
            Pipeline · Structured Inspection
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0B0F17]">
            AI Processing Pipeline
          </h1>
        </div>
        <div className="bg-white border border-[#E6EAF2] rounded-3xl p-10 text-center max-w-2xl space-y-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <div className="w-12 h-12 rounded-2xl bg-[#F4F6FA] border border-[#E6EAF2] flex items-center justify-center mx-auto text-[#1E4ED8]">
            <Cpu className="w-6 h-6" />
          </div>
          <h2 className="font-display text-xl font-bold text-[#0B0F17]">
            No active extraction selected
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Upload an invoice or trigger a synthetic scenario to inspect the
            live Gemini JSON Schema output alongside the deterministic backend
            policy evaluation.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E4ED8] hover:bg-[#1942BC] text-white text-xs font-semibold cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Go to Upload Invoice</span>
          </button>
        </div>
      </div>
    );
  }

  const ruleChecks =
    latestRun?.ruleChecks || latestInvoice?.ruleChecks || [];
  const escalationReasons =
    latestRun?.escalationReasons || latestInvoice?.escalationReasons || [];

  const structuredPayload = latestRun
    ? latestRun.extraction
    : latestInvoice
    ? {
        invoice_number: latestInvoice.invoiceNumber ?? null,
        vendor_name: latestInvoice.vendorName ?? null,
        invoice_date: latestInvoice.invoiceDate ?? null,
        due_date: latestInvoice.dueDate ?? null,
        currency: latestInvoice.currency,
        subtotal: latestInvoice.subtotal ?? null,
        tax_amount: latestInvoice.taxAmount ?? null,
        total_amount: latestInvoice.totalAmount ?? null,
        confidence: latestInvoice.confidence,
        missing_fields: latestInvoice.missingFields,
        risk_flags: latestInvoice.riskFlags,
        risk_level: latestInvoice.riskLevel,
        recommended_action: latestInvoice.recommendedAction,
        reason: latestInvoice.aiReason,
      }
    : null;

  const status = latestRun?.status || latestInvoice!.status;
  const riskLevel =
    latestRun?.extraction.risk_level || latestInvoice!.riskLevel;
  const confidence =
    latestRun?.extraction.confidence ?? latestInvoice!.confidence;
  const inrEquivalent =
    latestRun?.inrEquivalent ?? latestInvoice?.inrEquivalent ?? 0;

  return (
    <div className="p-6 lg:p-10 max-w-[1380px] mx-auto space-y-6">
      <div className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#1E4ED8] font-medium">
          Pipeline · Structured Inspection
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0B0F17]">
          AI Processing Pipeline
        </h1>
      </div>

      {/* 4-Stage Pipeline Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            step: '01. Upload & Validation',
            detail: latestInvoice?.fileName || 'Document verified',
            icon: UploadCloud,
          },
          {
            step: '02. Gemini Extraction',
            detail: `${latestRun?.aiModel || 'gemini-4-hydrogen'} · ${(
              confidence * 100
            ).toFixed(1)}% conf.`,
            icon: Cpu,
          },
          {
            step: '03. Schema & Sanity',
            detail:
              latestRun && !latestRun.schemaValid
                ? 'Malformed AI output caught'
                : 'Backend Zod schema verified',
            icon: FileSearch,
          },
          {
            step: '04. Decision Engine',
            detail: `Routed -> ${status.replace(/_/g, ' ')}`,
            icon: ShieldCheck,
          },
        ].map((stage) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.step}
              className="bg-white border border-[#E6EAF2] rounded-2xl p-5 space-y-2 shadow-[0_1px_4px_rgba(15,23,42,0.03)]"
            >
              <div className="flex items-center justify-between text-[#0B0F17]">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#1E4ED8] font-semibold">
                  {stage.step}
                </span>
                <Icon className="w-4 h-4 shrink-0 text-slate-400" />
              </div>
              <p className="text-xs font-medium text-[#0B0F17] truncate">
                {stage.detail}
              </p>
            </div>
          );
        })}
      </div>

      {/* Summary Banner */}
      <div className="bg-white border border-[#E6EAF2] rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <StatusText status={status} />
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <RiskText risk={riskLevel} />
          </div>
          <p className="text-sm text-slate-500">
            Evaluated INR equivalent:{' '}
            <span className="font-mono font-bold text-[#0B0F17] tabular-nums">
              {formatCurrency(inrEquivalent, 'INR')}
            </span>
            {latestRun && (
              <span className="text-xs text-slate-400 ml-2 font-mono">
                ({latestRun.processingMs} ms)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {latestInvoice && (
            <button
              type="button"
              onClick={() => onInspectInvoice(latestInvoice)}
              className="px-4 py-2.5 rounded-xl bg-[#F4F6FA] hover:bg-[#EFF2F7] border border-[#E6EAF2] text-xs font-semibold text-[#0B0F17] cursor-pointer"
            >
              Inspect Document
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="px-4 py-2.5 rounded-xl bg-[#1E4ED8] hover:bg-[#1942BC] text-xs font-semibold text-white cursor-pointer"
          >
            Process Another
          </button>
        </div>
      </div>

      {/* Escalation Alert */}
      {escalationReasons.length > 0 && (
        <div className="p-5 rounded-2xl bg-red-50 border border-red-200 space-y-1.5">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-red-700 font-semibold">
            Deterministic Escalation Triggers
          </h3>
          <ul className="list-disc pl-4 text-xs text-red-700 space-y-1">
            {escalationReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Side-by-side: Deterministic Rule Checks & Obsidian JSON Schema Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-[#E6EAF2] rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <div className="px-6 py-4 border-b border-[#E6EAF2]">
            <h3 className="font-display text-base font-bold text-[#0B0F17]">
              Deterministic Policy Checks
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              AI recommendations never override these backend rule evaluations
            </p>
          </div>
          <div className="divide-y divide-[#E6EAF2]">
            {ruleChecks.map((rule) => (
              <div
                key={rule.id}
                className="px-6 py-3.5 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {rule.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold text-[#0B0F17]">{rule.label}</p>
                    <p className="text-slate-500 mt-0.5 leading-relaxed">
                      {rule.detail}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-mono font-semibold shrink-0 ${
                    rule.passed ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {rule.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 bg-[#0B0F17] text-slate-100 rounded-3xl overflow-hidden flex flex-col shadow-[0_14px_34px_rgba(11,15,23,0.16)]">
          <div className="px-6 py-4 border-b border-slate-800">
            <h3 className="font-display text-base font-bold text-white">
              Structured AI Output (JSON Schema)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Validated strictly against the InvoiceFlow extraction schema
            </p>
          </div>
          <pre className="p-6 text-xs font-mono text-blue-200 overflow-x-auto flex-1 leading-relaxed">
            {JSON.stringify(structuredPayload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
