import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Play,
  RotateCcw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
  DemoScenarioId,
  InvoiceRecord,
  ProcessedInvoiceResponse,
  UserProfile,
} from '../types/invoice';
import {
  type DemoScenarioSummary,
  fetchDemoScenarios,
  processDemoScenario,
  uploadAndProcessInvoice,
} from '../lib/api';
import { clearDemoInvoices, saveProcessedInvoice } from '../lib/firestoreStore';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const MAX_BYTES = 5 * 1024 * 1024;

export function UploadInvoiceView(props: {
  profile: UserProfile;
  existingInvoices: InvoiceRecord[];
  onProcessed: (result: ProcessedInvoiceResponse, invoiceId: string) => void;
}) {
  const { profile, existingInvoices, onProcessed } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [scenarios, setScenarios] = useState<DemoScenarioSummary[]>([]);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [clearingDemo, setClearingDemo] = useState(false);

  useEffect(() => {
    fetchDemoScenarios()
      .then(setScenarios)
      .catch((err) => {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Unable to connect to the backend API.'
        );
      });
  }, []);

  const normalizeFileMime = (file: File): string => {
    if (file.type === 'image/jpg') return 'image/jpeg';
    if (file.type) return file.type;
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    return '';
  };

  const prepareFileForUpload = async (file: File): Promise<File> => {
    const mime = normalizeFileMime(file);
    if (!mime.startsWith('image/') || file.size <= 900 * 1024) {
      return file;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (!blob || blob.size >= file.size) return file;
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'invoice';
      return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
    } catch {
      return file;
    }
  };

  const validateAndSelectFile = (file: File | undefined) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!file) return;
    const resolvedType = normalizeFileMime(file);
    if (!ALLOWED_TYPES.has(resolvedType)) {
      setErrorMsg(
        `Unsupported file type (${file.type || 'unknown'}). Upload a PDF, PNG, JPEG, or WebP invoice.`
      );
      return;
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      setErrorMsg('File size must be between 1 byte and 5 MB.');
      return;
    }
    setSelectedFile(file);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadProgress(10);
    setProcessingLabel('Preparing & uploading invoice...');

    try {
      const uploadFile = await prepareFileForUpload(selectedFile);
      const result = await uploadAndProcessInvoice(uploadFile, (pct) => {
        setUploadProgress(pct);
        if (pct >= 70) {
          setProcessingLabel(
            'Running Gemini structured extraction & deterministic policy rules...'
          );
        }
      });

      setProcessingLabel('Writing invoice metadata & immutable audit logs...');
      await saveProcessedInvoice({
        result,
        fileName: selectedFile.name,
        mimeType: normalizeFileMime(uploadFile) || selectedFile.type,
        fileSize: uploadFile.size,
        isDemo: false,
        owner: profile,
      });

      setUploadProgress(100);
      setSelectedFile(null);
      setSuccessMsg(
        `Invoice processed (${result.status.replace(/_/g, ' ')}) in ${result.processingMs} ms.`
      );
      onProcessed(result, result.invoiceId);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Invoice processing failed.'
      );
    } finally {
      setProcessing(false);
      setProcessingLabel('');
    }
  };

  const handleRunDemoScenario = async (scenario: DemoScenarioSummary) => {
    setRunningScenario(scenario.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await processDemoScenario(scenario.id);
      await saveProcessedInvoice({
        result,
        fileName: scenario.fileName,
        mimeType: 'image/svg+xml',
        fileSize: 18400,
        isDemo: true,
        demoScenario: scenario.id,
        owner: profile,
      });
      setSuccessMsg(
        `Demo "${scenario.title}" evaluated -> ${result.status.replace(/_/g, ' ')}.`
      );
      onProcessed(result, result.invoiceId);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to run demo scenario.'
      );
    } finally {
      setRunningScenario(null);
    }
  };

  const handleRunAllDemos = async () => {
    setRunningScenario('ALL');
    setErrorMsg(null);
    setSuccessMsg(null);
    let lastResult: ProcessedInvoiceResponse | null = null;
    try {
      for (const scenario of scenarios) {
        const result = await processDemoScenario(scenario.id as DemoScenarioId);
        await saveProcessedInvoice({
          result,
          fileName: scenario.fileName,
          mimeType: 'image/svg+xml',
          fileSize: 18400,
          isDemo: true,
          demoScenario: scenario.id,
          owner: profile,
        });
        lastResult = result;
      }
      if (lastResult) {
        setSuccessMsg(
          'All 7 synthetic demo scenarios extracted by Gemini and routed by deterministic policy rules.'
        );
        onProcessed(lastResult, lastResult.invoiceId);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Batch demo execution failed.'
      );
    } finally {
      setRunningScenario(null);
    }
  };

  const demoCount = existingInvoices.filter((i) => i.isDemo).length;

  const handleClearDemos = async () => {
    setClearingDemo(true);
    setErrorMsg(null);
    try {
      await clearDemoInvoices(existingInvoices);
      setSuccessMsg('Cleared synthetic demo invoices from workspace.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to clear demo invoices.'
      );
    } finally {
      setClearingDemo(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1380px] mx-auto space-y-8">
      <div className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#1E4ED8] font-medium">
          Ingestion · Extraction &amp; Validation
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0B0F17]">
          Upload &amp; Evaluate Invoice
        </h1>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Real Invoice Upload Card */}
      <section className="bg-white border border-[#E6EAF2] rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0B0F17]">
              Upload Real Invoice Document
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Accepted formats: PDF, PNG, JPEG, or WebP up to 5 MB. Files are
              validated on the server and extracted using Gemini structured JSON
              output.
            </p>
          </div>
          <span className="font-mono text-[11px] text-[#1E4ED8] shrink-0">
            5 MB Limit
          </span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            validateAndSelectFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-[#1E4ED8] bg-[#EFF6FF]'
              : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#1E4ED8]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => validateAndSelectFile(e.target.files?.[0])}
          />
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#E6EAF2] shadow-xs flex items-center justify-center mx-auto mb-4 text-[#1E4ED8]">
            <UploadCloud className="w-6 h-6" />
          </div>
          {selectedFile ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#0B0F17] flex items-center justify-center gap-2">
                <FileText className="w-4 h-4 text-[#1E4ED8]" />
                <span>{selectedFile.name}</span>
              </p>
              <p className="text-xs font-mono text-slate-500 tabular-nums">
                {selectedFile.type || 'document'} ·{' '}
                {Math.max(1, Math.round(selectedFile.size / 1024))} KB
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#0B0F17]">
                Drop an invoice PDF or image here, or click to browse
              </p>
              <p className="text-xs text-slate-500">
                Documents are treated as untrusted input and stored privately
              </p>
            </div>
          )}
        </div>

        {processing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>{processingLabel}</span>
              <span className="font-mono tabular-nums font-semibold text-[#1E4ED8]">
                {uploadProgress}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#EFF2F7] overflow-hidden">
              <div
                className="h-full bg-[#1E4ED8] transition-all duration-150 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {selectedFile && !processing && (
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F4F6FA] hover:bg-[#EFF2F7] border border-[#E6EAF2] text-xs font-semibold text-[#0B0F17] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
          <button
            type="button"
            disabled={!selectedFile || processing}
            onClick={handleUploadSubmit}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E4ED8] hover:bg-[#1942BC] disabled:opacity-50 text-white text-xs font-semibold shadow-[0_6px_18px_rgba(30,78,216,0.22)] transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>
              {processing ? 'Processing Invoice...' : 'Extract & Evaluate'}
            </span>
          </button>
        </div>
      </section>

      {/* Synthetic Demo Sandbox Section */}
      <section className="bg-white border border-[#E6EAF2] rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0B0F17]">
              Synthetic Demo Sandbox (7 Workflow Scenarios)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Evaluate autonomous approval, Manager/Admin tiers, and escalation
              safeguards without uploading private files. All records created
              here are marked as <span className="font-mono text-[#1E4ED8]">DEMO</span>.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {profile.role === 'ADMIN' && demoCount > 0 && (
              <button
                type="button"
                disabled={clearingDemo || Boolean(runningScenario)}
                onClick={handleClearDemos}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F4F6FA] hover:bg-[#EFF2F7] border border-[#E6EAF2] text-xs font-semibold text-[#0B0F17] cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{clearingDemo ? 'Clearing...' : 'Reset Demo Data'}</span>
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(runningScenario) || scenarios.length === 0}
              onClick={handleRunAllDemos}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B0F17] hover:bg-[#1E293B] disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {runningScenario === 'ALL'
                  ? 'Running All 7...'
                  : 'Run All 7 Scenarios'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((scenario) => {
            const busy =
              runningScenario === scenario.id || runningScenario === 'ALL';
            return (
              <div
                key={scenario.id}
                className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E6EAF2] flex items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-[11px] text-[#1E4ED8] font-mono font-medium">
                    <span>{scenario.expectedOutcome}</span>
                    <span aria-hidden="true">·</span>
                    <span>{scenario.invoiceNumber}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#0B0F17] truncate">
                    {scenario.title}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {scenario.subtitle}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={Boolean(runningScenario)}
                  onClick={() => handleRunDemoScenario(scenario)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#1E4ED8] hover:text-white border border-[#E6EAF2] disabled:opacity-50 text-[#0B0F17] text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>{busy ? 'Running...' : 'Simulate'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
