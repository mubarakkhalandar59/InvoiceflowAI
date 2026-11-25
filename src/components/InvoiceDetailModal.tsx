import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AuditLogEntry, InvoiceRecord } from '../types/invoice';
import { fetchServerStoredDocumentBlobUrl } from '../lib/api';
import { fetchProtectedInvoicePreview } from '../lib/firestoreStore';
import { formatCurrency, formatTimestamp } from '../lib/formatters';
import { RiskText, StatusText } from './StatusText';

export function InvoiceDetailModal(props: {
  invoice: InvoiceRecord | null;
  auditLogs: AuditLogEntry[];
  onClose: () => void;
}) {
  const { invoice, auditLogs, onClose } = props;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoice) {
      setPreviewUrl(null);
      return;
    }

    let revokedUrl: string | null = null;
    let active = true;
    setLoadingPreview(true);
    setPreviewError(null);

    async function loadDocument() {
      if (!invoice) return;
      try {
        const fsUrl = await fetchProtectedInvoicePreview(invoice.invoiceId);
        if (fsUrl && active) {
          setPreviewUrl(fsUrl);
          setLoadingPreview(false);
          return;
        }
        if (invoice.storageMode === 'SERVER_DISK') {
          const blobUrl = await fetchServerStoredDocumentBlobUrl(
            invoice.invoiceId
          );
          revokedUrl = blobUrl;
          if (active) {
            setPreviewUrl(blobUrl);
          }
        } else {
          if (active) setPreviewUrl(null);
        }
      } catch (err) {
        if (active) {
          setPreviewError(
            err instanceof Error
              ? err.message
              : 'Unable to load protected invoice document.'
          );
        }
      } finally {
        if (active) setLoadingPreview(false);
      }
    }

    loadDocument();

    return () => {
      active = false;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [invoice]);

  if (!invoice) return null;

  const invoiceAudit = auditLogs.filter(
    (log) => log.invoiceId === invoice.invoiceId
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 lg:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice details for ${invoice.invoiceNumber || invoice.fileName}`}
    >
      <div className="bg-white border border-[#E6EAF2] rounded-3xl shadow-[0_32px_90px_rgba(15,23,42,0.18)] w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E6EAF2] flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-slate-400">
              <span className="text-[#1E4ED8] font-semibold">
                {invoice.isDemo ? 'SYNTHETIC DEMO' : 'LIVE SUBMISSION'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{invoice.invoiceId}</span>
              <span aria-hidden="true">·</span>
              <span>{formatTimestamp(invoice.createdAt)}</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B0F17] truncate">
              {invoice.vendorName || 'Unidentified Vendor'} —{' '}
              <span className="font-mono text-base text-slate-500">
                {invoice.invoiceNumber || 'No Invoice #'}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <StatusText status={invoice.status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice details"
              className="p-2 rounded-xl text-slate-500 hover:text-[#0B0F17] hover:bg-[#F4F6FA] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#E6EAF2]">
          {/* Left: Protected Document Preview */}
          <div className="lg:col-span-5 p-6 bg-[#F8FAFC] flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-[#0B0F17] truncate">
                {invoice.fileName}
              </span>
              <span className="font-mono tabular-nums shrink-0">
                {Math.max(1, Math.round(invoice.fileSize / 1024))} KB
              </span>
            </div>

            <div className="flex-1 min-h-[340px] rounded-2xl border border-[#E6EAF2] bg-white flex items-center justify-center overflow-hidden">
              {loadingPreview ? (
                <p className="text-xs text-slate-400">
                  Loading protected document preview...
                </p>
              ) : previewError ? (
                <div className="p-6 text-center space-y-2">
                  <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
                  <p className="text-xs text-slate-600">{previewError}</p>
                </div>
              ) : previewUrl ? (
                invoice.mimeType === 'application/pdf' && !invoice.isDemo ? (
                  <iframe
                    src={previewUrl}
                    title={invoice.fileName}
                    className="w-full h-[460px] bg-white"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt={`Preview of ${invoice.fileName}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full max-h-[460px] object-contain p-2"
                  />
                )
              ) : (
                <div className="p-6 text-center space-y-2">
                  <FileText className="w-7 h-7 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500">
                    Document preview unavailable for this record.
                  </p>
                </div>
              )}
            </div>

            {invoice.escalationReasons.length > 0 && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-2">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-red-700 font-semibold">
                  Escalation Reasons
                </h3>
                <ul className="space-y-1 text-xs text-red-700 list-disc pl-4">
                  {invoice.escalationReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: Structured Data, Rules & Audit */}
          <div className="lg:col-span-7 p-6 space-y-6 bg-white">
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400 mb-3">
                Extracted Financial Metadata
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E6EAF2]">
                <div>
                  <p className="text-xs text-slate-500">Invoice Number</p>
                  <p className="text-sm font-mono text-[#0B0F17] mt-0.5">
                    {invoice.invoiceNumber || 'Missing'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Invoice Date</p>
                  <p className="text-sm font-mono text-[#0B0F17] mt-0.5 tabular-nums">
                    {invoice.invoiceDate || 'Missing'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Due Date</p>
                  <p className="text-sm font-mono text-[#0B0F17] mt-0.5 tabular-nums">
                    {invoice.dueDate || 'Missing'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Subtotal</p>
                  <p className="text-sm font-mono text-[#0B0F17] mt-0.5 tabular-nums">
                    {formatCurrency(invoice.subtotal, invoice.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Tax Amount</p>
                  <p className="text-sm font-mono text-[#0B0F17] mt-0.5 tabular-nums">
                    {formatCurrency(invoice.taxAmount, invoice.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Amount</p>
                  <p className="text-sm font-mono font-bold text-[#0B0F17] mt-0.5 tabular-nums">
                    {formatCurrency(invoice.totalAmount, invoice.currency)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E6EAF2]">
                <p className="text-xs text-slate-500">Extraction Confidence</p>
                <p className="text-base font-mono font-bold text-[#1E4ED8] mt-1 tabular-nums">
                  {(invoice.confidence * 100).toFixed(1)}%
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E6EAF2]">
                <p className="text-xs text-slate-500">Risk Level</p>
                <div className="mt-1.5">
                  <RiskText risk={invoice.riskLevel} />
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E6EAF2]">
                <p className="text-xs text-slate-500">Assigned Tier</p>
                <p className="text-sm font-semibold text-[#0B0F17] mt-1">
                  {invoice.assignedTier === 'NONE'
                    ? 'Autonomous'
                    : `${invoice.assignedTier} Queue`}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                AI Assessment Summary
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                {invoice.aiReason}
              </p>
              {invoice.riskFlags.length > 0 && (
                <p className="text-xs text-amber-800 pt-1">
                  Risk flags: {invoice.riskFlags.join(' · ')}
                </p>
              )}
            </div>

            {invoice.lineItems && invoice.lineItems.length > 0 && (
              <div>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400 mb-2">
                  Extracted Line Items
                </h3>
                <div className="rounded-2xl border border-[#E6EAF2] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[#F8FAFC] text-slate-500 border-b border-[#E6EAF2]">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium">
                          Description
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium">
                          Qty
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6EAF2]">
                      {invoice.lineItems.map((item, i) => (
                        <tr key={i} className="text-[#0B0F17]">
                          <td className="px-4 py-2.5">{item.description}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                            {formatCurrency(item.amount, invoice.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {invoice.ruleChecks && invoice.ruleChecks.length > 0 && (
              <div>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400 mb-2">
                  Deterministic Backend Rule Trace
                </h3>
                <div className="divide-y divide-[#E6EAF2] rounded-2xl border border-[#E6EAF2] bg-[#F8FAFC]">
                  {invoice.ruleChecks.map((rule) => (
                    <div
                      key={rule.id}
                      className="px-4 py-3 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {rule.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0B0F17]">
                            {rule.label}
                          </p>
                          <p className="text-slate-500 mt-0.5">{rule.detail}</p>
                        </div>
                      </div>
                      <span
                        className={`font-mono font-semibold shrink-0 ${
                          rule.passed ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {rule.passed ? 'PASS' : 'TRIGGERED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invoice.reviewerEmail && (
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E6EAF2] space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0B0F17]">
                  <ShieldCheck className="w-4 h-4 text-[#1E4ED8]" />
                  <span>Human Decision Recorded</span>
                </div>
                <p className="text-xs text-slate-500">
                  Reviewed by {invoice.reviewerEmail} ({invoice.reviewerRole}) ·{' '}
                  {formatTimestamp(invoice.reviewedAt)}
                </p>
                {invoice.reviewComment && (
                  <p className="text-sm text-[#0B0F17] pt-1">
                    “{invoice.reviewComment}”
                  </p>
                )}
              </div>
            )}

            {invoiceAudit.length > 0 && (
              <div>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400 mb-2">
                  Audit Trail
                </h3>
                <div className="space-y-2">
                  {invoiceAudit.map((log) => (
                    <div
                      key={log.logId}
                      className="text-xs flex items-start justify-between gap-4 py-2 border-b border-[#E6EAF2] last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#0B0F17]">
                          {log.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-slate-500 mt-0.5">{log.reason}</p>
                      </div>
                      <span className="font-mono text-slate-400 shrink-0 tabular-nums">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
