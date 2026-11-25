import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileText,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { InvoiceRecord, UserProfile } from '../types/invoice';
import { fetchServerStoredDocumentBlobUrl } from '../lib/api';
import {
  fetchProtectedInvoicePreview,
  submitHumanDecision,
} from '../lib/firestoreStore';
import { formatCurrency, formatTimestamp } from '../lib/formatters';
import { RiskText, StatusText } from './StatusText';

export function ApprovalQueueView(props: {
  invoices: InvoiceRecord[];
  profile: UserProfile;
}) {
  const { invoices, profile } = props;

  const queueItems = invoices.filter((inv) => {
    const isPending =
      inv.status === 'PENDING_MANAGER' ||
      inv.status === 'PENDING_ADMIN' ||
      inv.status === 'ESCALATED';
    if (!isPending) return false;
    if (profile.role === 'ADMIN') return true;
    if (profile.role === 'MANAGER') {
      return (
        inv.assignedTier !== 'ADMIN' &&
        inv.status !== 'PENDING_ADMIN' &&
        (inv.isDemo || inv.ownerId !== profile.uid)
      );
    }
    return false;
  });

  const [selectedId, setSelectedId] = useState<string | null>(
    queueItems[0]?.invoiceId || null
  );
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const selectedInvoice =
    queueItems.find((i) => i.invoiceId === selectedId) || queueItems[0] || null;

  useEffect(() => {
    if (!selectedInvoice) {
      setPreviewUrl(null);
      return;
    }
    let revokedUrl: string | null = null;
    let active = true;
    setLoadingDoc(true);

    async function load() {
      if (!selectedInvoice) return;
      try {
        const fsUrl = await fetchProtectedInvoicePreview(
          selectedInvoice.invoiceId
        );
        if (fsUrl && active) {
          setPreviewUrl(fsUrl);
          setLoadingDoc(false);
          return;
        }
        if (selectedInvoice.storageMode === 'SERVER_DISK') {
          const blobUrl = await fetchServerStoredDocumentBlobUrl(
            selectedInvoice.invoiceId
          );
          revokedUrl = blobUrl;
          if (active) setPreviewUrl(blobUrl);
        } else if (active) {
          setPreviewUrl(null);
        }
      } catch {
        if (active) setPreviewUrl(null);
      } finally {
        if (active) setLoadingDoc(false);
      }
    }

    load();
    return () => {
      active = false;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [selectedInvoice?.invoiceId]);

  const handleDecision = async (
    decision: 'HUMAN_APPROVED' | 'REJECTED' | 'ESCALATED'
  ) => {
    if (!selectedInvoice) return;
    if (
      (decision === 'REJECTED' || decision === 'ESCALATED') &&
      !comment.trim()
    ) {
      setFeedback({
        type: 'error',
        message:
          'Please enter a review comment explaining your rejection or escalation.',
      });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      await submitHumanDecision({
        invoice: selectedInvoice,
        decision,
        comment: comment.trim(),
      });
      setComment('');
      setFeedback({
        type: 'success',
        message: `Invoice ${
          selectedInvoice.invoiceNumber || selectedInvoice.fileName
        } marked ${decision.replace(/_/g, ' ')} and logged to audit trail.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Unable to record decision.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (profile.role === 'EMPLOYEE') {
    return (
      <div className="p-6 lg:p-10 max-w-[1380px] mx-auto">
        <div className="bg-white border border-[#E6EAF2] rounded-3xl p-10 max-w-xl mx-auto text-center space-y-2 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <ShieldAlert className="w-7 h-7 text-amber-600 mx-auto" />
          <h2 className="font-display text-xl font-bold text-[#0B0F17]">
            Approval Queue Restricted
          </h2>
          <p className="text-sm text-slate-500">
            Only Manager and Admin roles can review and approve pending
            invoices.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1380px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#1E4ED8] font-medium">
            Human Review · Role-Gated Decisions
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0B0F17]">
            Approval Queue
          </h1>
        </div>
        <span className="font-mono text-xs text-slate-500">
          {queueItems.length} Pending · Role [{profile.role}]
        </span>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {queueItems.length === 0 ? (
        <div className="bg-white border border-[#E6EAF2] rounded-3xl p-10 text-center max-w-xl space-y-2 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <FileCheck2 className="w-7 h-7 text-emerald-600 mx-auto" />
          <h2 className="font-display text-xl font-bold text-[#0B0F17]">
            Approval Queue Clear
          </h2>
          <p className="text-sm text-slate-500">
            There are no pending or escalated invoices awaiting your review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Queue Selector */}
          <div className="lg:col-span-4 bg-white border border-[#E6EAF2] rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
            <div className="px-5 py-4 border-b border-[#E6EAF2] flex items-center justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0B0F17] font-semibold">
                Awaiting Review ({queueItems.length})
              </h2>
            </div>
            <div className="divide-y divide-[#E6EAF2] max-h-[680px] overflow-y-auto">
              {queueItems.map((inv) => {
                const active = selectedInvoice?.invoiceId === inv.invoiceId;
                return (
                  <button
                    key={inv.invoiceId}
                    type="button"
                    onClick={() => {
                      setSelectedId(inv.invoiceId);
                      setFeedback(null);
                    }}
                    className={`w-full px-5 py-4 text-left transition-colors cursor-pointer space-y-1.5 ${
                      active ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#0B0F17] truncate">
                        {inv.vendorName || 'Unidentified Vendor'}
                      </span>
                      <span className="text-xs font-mono font-semibold text-[#0B0F17] tabular-nums shrink-0">
                        {formatCurrency(inv.totalAmount, inv.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <StatusText status={inv.status} />
                      <span className="font-mono text-[10px] uppercase text-[#1E4ED8]">
                        {inv.isDemo ? 'DEMO' : 'LIVE'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Inspection & Decision Workbench */}
          {selectedInvoice && (
            <div className="lg:col-span-8 bg-white border border-[#E6EAF2] rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E6EAF2]">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-slate-400">
                    {selectedInvoice.invoiceNumber || 'Missing Invoice #'} ·
                    Submitted by {selectedInvoice.ownerEmail} ·{' '}
                    {formatTimestamp(selectedInvoice.createdAt)}
                  </p>
                  <h2 className="font-display text-2xl font-bold text-[#0B0F17] truncate mt-1">
                    {selectedInvoice.vendorName || 'Unidentified Vendor'}
                  </h2>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <RiskText risk={selectedInvoice.riskLevel} />
                  <StatusText status={selectedInvoice.status} />
                </div>
              </div>

              {selectedInvoice.escalationReasons.length > 0 && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-1.5">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-red-700 font-semibold">
                    Why This Invoice Was Escalated
                  </h3>
                  <ul className="list-disc pl-4 text-xs text-red-700 space-y-1">
                    {selectedInvoice.escalationReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-6 rounded-2xl border border-[#E6EAF2] bg-[#F8FAFC] min-h-[260px] flex items-center justify-center overflow-hidden">
                  {loadingDoc ? (
                    <span className="text-xs text-slate-400">
                      Loading document...
                    </span>
                  ) : previewUrl ? (
                    selectedInvoice.mimeType === 'application/pdf' &&
                    !selectedInvoice.isDemo ? (
                      <iframe
                        src={previewUrl}
                        title={selectedInvoice.fileName}
                        className="w-full h-[300px] bg-white"
                      />
                    ) : (
                      <img
                        src={previewUrl}
                        alt={selectedInvoice.fileName}
                        referrerPolicy="no-referrer"
                        className="w-full max-h-[300px] object-contain p-2"
                      />
                    )
                  ) : (
                    <div className="p-6 text-center space-y-1.5">
                      <FileText className="w-6 h-6 text-slate-400 mx-auto" />
                      <p className="text-xs text-slate-500">
                        {selectedInvoice.fileName}
                      </p>
                    </div>
                  )}
                </div>

                <div className="xl:col-span-6 space-y-3">
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E6EAF2] text-xs">
                    <div>
                      <span className="text-slate-500">Invoice Date</span>
                      <p className="font-mono text-[#0B0F17] mt-0.5">
                        {selectedInvoice.invoiceDate || 'Missing'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Due Date</span>
                      <p className="font-mono text-[#0B0F17] mt-0.5">
                        {selectedInvoice.dueDate || 'Missing'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Subtotal</span>
                      <p className="font-mono text-[#0B0F17] mt-0.5 tabular-nums">
                        {formatCurrency(
                          selectedInvoice.subtotal,
                          selectedInvoice.currency
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Tax</span>
                      <p className="font-mono text-[#0B0F17] mt-0.5 tabular-nums">
                        {formatCurrency(
                          selectedInvoice.taxAmount,
                          selectedInvoice.currency
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Total Billed</span>
                      <p className="font-mono font-bold text-[#0B0F17] mt-0.5 tabular-nums">
                        {formatCurrency(
                          selectedInvoice.totalAmount,
                          selectedInvoice.currency
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">AI Confidence</span>
                      <p className="font-mono font-semibold text-[#1E4ED8] mt-0.5 tabular-nums">
                        {(selectedInvoice.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {selectedInvoice.riskFlags.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                      <span className="font-semibold">AI Risk Flags: </span>
                      {selectedInvoice.riskFlags.join(' · ')}
                    </div>
                  )}

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {selectedInvoice.aiReason}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E6EAF2] space-y-4">
                <div>
                  <label
                    htmlFor="review-comment"
                    className="block font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500 mb-2"
                  >
                    Reviewer Decision Comment (required for rejection or
                    escalation)
                  </label>
                  <textarea
                    id="review-comment"
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Document verification notes, vendor confirmation, or discrepancy reason..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E6EAF2] text-sm text-[#0B0F17] placeholder:text-slate-400 focus:outline-none focus:border-[#1E4ED8]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {profile.role === 'MANAGER' &&
                    selectedInvoice.status !== 'ESCALATED' && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleDecision('ESCALATED')}
                        className="px-4 py-2.5 rounded-xl border border-[#E6EAF2] hover:border-[#0B0F17] bg-[#F4F6FA] text-[#0B0F17] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Escalate to Admin
                      </button>
                    )}

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDecision('REJECTED')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Invoice</span>
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDecision('HUMAN_APPROVED')}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#1E4ED8] hover:bg-[#1942BC] text-white text-xs font-semibold shadow-[0_6px_18px_rgba(30,78,216,0.22)] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {submitting ? 'Recording...' : 'Approve Invoice'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
