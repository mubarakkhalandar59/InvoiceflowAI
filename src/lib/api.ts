import type {
  DemoScenarioId,
  ProcessedInvoiceResponse,
  UserRole,
} from '../types/invoice';
import { auth } from './firebase';

async function getVerifiedToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must sign in before calling backend services.');
  }
  return user.getIdToken();
}

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function isStartingServerHtml(status: number, rawText: string): boolean {
  if (status !== 200 && status !== 502 && status !== 503) return false;
  const trimmed = (rawText || '').trim();
  if (!trimmed.toLowerCase().includes('<html')) return false;
  const title = extractHtmlTitle(trimmed)?.toLowerCase() || '';
  return title.includes('starting server');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function parseApiPayload(
  status: number,
  rawText: string,
  responseUrl?: string
): Record<string, unknown> {
  const trimmed = (rawText || '').trim();
  if (!trimmed) {
    if (status >= 200 && status < 300) return {};
    throw new Error(
      `Backend returned an empty error response (HTTP ${status}).`
    );
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const isHtml =
      trimmed.startsWith('<!') ||
      trimmed.toLowerCase().includes('<html') ||
      trimmed.toLowerCase().includes('<body');
    if (status === 413) {
      throw new Error(
        'The uploaded file is too large for the server gateway (HTTP 413). Try a smaller PDF or image under 2 MB.'
      );
    }
    if (status === 504 || status === 502 || status === 503) {
      throw new Error(
        `Backend extraction gateway timed out or restarted (HTTP ${status}). Please retry.`
      );
    }
    if (isHtml) {
      const title = extractHtmlTitle(trimmed);
      const urlInfo = responseUrl ? ` at ${responseUrl}` : '';
      if (title && title.toLowerCase().includes('invoiceflow')) {
        throw new Error(
          `Backend API route fell back to the frontend page (HTTP ${status}${urlInfo}). Please use the live Development preview or re-publish the app so the Node.js server is active.`
        );
      }
      throw new Error(
        `Unexpected HTML response (${title || 'HTML page'}, HTTP ${status}${urlInfo}). Please refresh the page and try again.`
      );
    }
    throw new Error(
      `Unexpected backend response (HTTP ${status}): ${trimmed.slice(0, 140)}`
    );
  }
}

async function fetchJsonSafe(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(input, {
      credentials: 'same-origin',
      ...init,
    });
    const raw = await res.text();
    if (isStartingServerHtml(res.status, raw) && attempt < maxAttempts) {
      await sleep(2500);
      continue;
    }
    const data = parseApiPayload(res.status, raw, res.url);
    if (!res.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : `Request failed with HTTP ${res.status}`
      );
    }
    return data;
  }
  throw new Error('Backend server is still starting. Please try again in a moment.');
}

export interface ServerHealthInfo {
  ok: boolean;
  service: string;
  geminiConfigured?: boolean;
}

export async function fetchServerHealth(): Promise<ServerHealthInfo> {
  const data = await fetchJsonSafe('/api/health');
  return data as unknown as ServerHealthInfo;
}

export interface ServerCallerInfo {
  uid: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
}

export async function fetchServerCallerInfo(): Promise<ServerCallerInfo> {
  const token = await getVerifiedToken();
  const data = await fetchJsonSafe('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data as unknown as ServerCallerInfo;
}

export interface DemoScenarioSummary {
  id: DemoScenarioId;
  title: string;
  subtitle: string;
  expectedOutcome: string;
  fileName: string;
  vendorName: string;
  invoiceNumber: string;
  totalDisplay: string;
  note: string;
}

export async function fetchDemoScenarios(): Promise<DemoScenarioSummary[]> {
  const token = await getVerifiedToken();
  const data = await fetchJsonSafe('/api/demo/scenarios', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.scenarios as DemoScenarioSummary[];
}

export async function uploadAndProcessInvoice(
  file: File,
  onProgress: (percent: number) => void
): Promise<ProcessedInvoiceResponse> {
  const token = await getVerifiedToken();

  onProgress(30);
  const progressTimer = window.setInterval(() => {
    onProgress(70);
  }, 500);

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 90000);

  try {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const formData = new FormData();
      formData.append('invoice', file);

      const res = await fetch('/api/invoices/process', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        signal: controller.signal,
      });
      const raw = await res.text();
      if (isStartingServerHtml(res.status, raw) && attempt < maxAttempts) {
        onProgress(45);
        await sleep(2500);
        continue;
      }
      const parsed = parseApiPayload(res.status, raw, res.url);
      if (!res.ok) {
        throw new Error(
          typeof parsed.error === 'string'
            ? parsed.error
            : `Server returned status ${res.status}`
        );
      }
      onProgress(100);
      return parsed as unknown as ProcessedInvoiceResponse;
    }
    throw new Error(
      'Backend server is still starting. Please wait a few seconds and retry.'
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        'Invoice extraction timed out after 90 seconds. Please retry with a smaller or clearer image.'
      );
    }
    throw err;
  } finally {
    window.clearInterval(progressTimer);
    window.clearTimeout(timeoutId);
  }
}

export async function processDemoScenario(
  scenarioId: DemoScenarioId
): Promise<ProcessedInvoiceResponse> {
  const token = await getVerifiedToken();
  const data = await fetchJsonSafe('/api/invoices/process-demo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ scenarioId }),
  });
  return data as unknown as ProcessedInvoiceResponse;
}

export async function authorizeInvoiceDecision(params: {
  invoiceId: string;
  action: 'HUMAN_APPROVED' | 'REJECTED' | 'ESCALATED';
  invoiceOwnerId: string;
  assignedTier: 'NONE' | 'MANAGER' | 'ADMIN';
  currentStatus: string;
  isDemo: boolean;
  comment?: string;
}): Promise<{
  authorized: boolean;
  reviewerId: string;
  reviewerEmail: string;
  reviewerRole: UserRole;
  reviewedAt: string;
}> {
  const token = await getVerifiedToken();
  const data = await fetchJsonSafe(
    `/api/invoices/${encodeURIComponent(params.invoiceId)}/authorize-decision`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: params.action,
        invoiceOwnerId: params.invoiceOwnerId,
        assignedTier: params.assignedTier,
        currentStatus: params.currentStatus,
        isDemo: params.isDemo,
        comment: params.comment,
      }),
    }
  );
  return data as unknown as {
    authorized: boolean;
    reviewerId: string;
    reviewerEmail: string;
    reviewerRole: UserRole;
    reviewedAt: string;
  };
}

export async function fetchServerStoredDocumentBlobUrl(
  invoiceId: string
): Promise<string> {
  const token = await getVerifiedToken();
  const res = await fetch(
    `/api/invoices/${encodeURIComponent(invoiceId)}/document`,
    {
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const raw = await res.text();
    const parsed = parseApiPayload(res.status, raw, res.url);
    throw new Error(
      typeof parsed.error === 'string'
        ? parsed.error
        : 'Unable to fetch protected invoice document.'
    );
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
