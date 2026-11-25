import fs from 'node:fs';
import path from 'node:path';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { NextFunction, Request, Response } from 'express';
import type { UserRole, WorkflowRuleConfig } from '../src/types/invoice.ts';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig: FirebaseAppletConfig = JSON.parse(
  fs.readFileSync(configPath, 'utf-8')
);

const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });

const adminAuth = getAuth(adminApp);

export const BOOTSTRAPPED_ADMIN_EMAIL = 'mubarakkhalandar59@gmail.com';

export interface VerifiedCaller {
  uid: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  idToken: string;
}

export interface AuthenticatedRequest extends Request {
  caller?: VerifiedCaller;
}

function getFirestoreBaseUrl(): string {
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(dbId)}/documents`;
}

function decodeFirestoreValue(val: Record<string, unknown> | undefined): unknown {
  if (!val) return undefined;
  if ('stringValue' in val) return String(val.stringValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  return undefined;
}

async function resolveTrustedRole(
  uid: string,
  email: string,
  emailVerified: boolean,
  idToken: string
): Promise<UserRole> {
  if (emailVerified && email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return 'ADMIN';
  }
  try {
    const url = `${getFirestoreBaseUrl()}/users/${encodeURIComponent(uid)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      return 'EMPLOYEE';
    }
    const doc = (await res.json()) as {
      fields?: Record<string, Record<string, unknown>>;
    };
    const roleVal = decodeFirestoreValue(doc.fields?.role);
    if (roleVal === 'ADMIN' || roleVal === 'MANAGER' || roleVal === 'EMPLOYEE') {
      return roleVal;
    }
  } catch {
    // Fall back safely to lowest-privilege role on lookup error
  }
  return 'EMPLOYEE';
}

export async function requireVerifiedAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer authorization token.' });
    return;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Empty Firebase ID token.' });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = decoded.email || '';
    const emailVerified = Boolean(decoded.email_verified);
    if (!emailVerified) {
      res.status(401).json({
        error: 'A verified email address is required to access InvoiceFlow AI.',
      });
      return;
    }
    const role = await resolveTrustedRole(
      decoded.uid,
      email,
      emailVerified,
      idToken
    );
    req.caller = {
      uid: decoded.uid,
      email,
      emailVerified,
      role,
      idToken,
    };
    next();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Invalid or expired Firebase ID token.';
    res.status(401).json({ error: `Authentication verification failed: ${message}` });
  }
}

export const DEFAULT_WORKFLOW_RULES: WorkflowRuleConfig = {
  ruleId: 'default',
  autoApproveMaxInr: 10000,
  managerMaxInr: 50000,
  minConfidence: 0.9,
  requireTaxConsistency: true,
  blockDuplicateVendorInvoices: true,
  updatedBy: BOOTSTRAPPED_ADMIN_EMAIL,
};

export async function fetchActiveWorkflowRules(
  idToken: string
): Promise<WorkflowRuleConfig> {
  try {
    const url = `${getFirestoreBaseUrl()}/workflow_rules/default`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      return DEFAULT_WORKFLOW_RULES;
    }
    const doc = (await res.json()) as {
      fields?: Record<string, Record<string, unknown>>;
    };
    const f = doc.fields;
    if (!f) return DEFAULT_WORKFLOW_RULES;
    const autoApproveMaxInr = Number(
      decodeFirestoreValue(f.autoApproveMaxInr) ?? DEFAULT_WORKFLOW_RULES.autoApproveMaxInr
    );
    const managerMaxInr = Number(
      decodeFirestoreValue(f.managerMaxInr) ?? DEFAULT_WORKFLOW_RULES.managerMaxInr
    );
    const minConfidence = Number(
      decodeFirestoreValue(f.minConfidence) ?? DEFAULT_WORKFLOW_RULES.minConfidence
    );
    const requireTaxConsistency = Boolean(
      decodeFirestoreValue(f.requireTaxConsistency) ??
        DEFAULT_WORKFLOW_RULES.requireTaxConsistency
    );
    const blockDuplicateVendorInvoices = Boolean(
      decodeFirestoreValue(f.blockDuplicateVendorInvoices) ??
        DEFAULT_WORKFLOW_RULES.blockDuplicateVendorInvoices
    );
    return {
      ruleId: 'default',
      autoApproveMaxInr: Number.isFinite(autoApproveMaxInr)
        ? autoApproveMaxInr
        : DEFAULT_WORKFLOW_RULES.autoApproveMaxInr,
      managerMaxInr: Number.isFinite(managerMaxInr)
        ? managerMaxInr
        : DEFAULT_WORKFLOW_RULES.managerMaxInr,
      minConfidence: Number.isFinite(minConfidence)
        ? minConfidence
        : DEFAULT_WORKFLOW_RULES.minConfidence,
      requireTaxConsistency,
      blockDuplicateVendorInvoices,
      updatedBy:
        String(decodeFirestoreValue(f.updatedBy) ?? DEFAULT_WORKFLOW_RULES.updatedBy),
    };
  } catch {
    return DEFAULT_WORKFLOW_RULES;
  }
}

export async function checkDuplicateFingerprint(
  idToken: string,
  fingerprintId: string
): Promise<boolean> {
  try {
    const url = `${getFirestoreBaseUrl()}/invoice_fingerprints/${encodeURIComponent(
      fingerprintId
    )}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
