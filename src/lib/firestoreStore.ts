import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type {
  AuditLogEntry,
  InvoiceRecord,
  ProcessedInvoiceResponse,
  UserProfile,
  UserRole,
  WorkflowRuleConfig,
} from '../types/invoice';
import { authorizeInvoiceDecision } from './api';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  db,
  handleFirestoreError,
} from './firebase';

function randomLogId(prefix = 'log'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
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

export async function ensureUserProfile(
  fbUser: FirebaseUser
): Promise<UserProfile> {
  const path = `users/${fbUser.uid}`;
  const ref = doc(db, 'users', fbUser.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existing = snap.data() as UserProfile;
      // Ensure bootstrapped admin email always holds ADMIN role
      if (
        fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
        fbUser.emailVerified &&
        existing.role !== 'ADMIN'
      ) {
        await updateDoc(ref, {
          role: 'ADMIN',
          updatedAt: serverTimestamp(),
        });
        return { ...existing, role: 'ADMIN' };
      }
      return existing;
    }

    const isBootstrap =
      fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
      fbUser.emailVerified;
    const assignedRole: UserRole = isBootstrap ? 'ADMIN' : 'EMPLOYEE';

    const newProfile: Record<string, unknown> = {
      uid: fbUser.uid,
      email: fbUser.email || 'unknown@example.com',
      displayName: (fbUser.displayName || fbUser.email || 'User').slice(0, 120),
      role: assignedRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (fbUser.photoURL) {
      newProfile.photoURL = fbUser.photoURL.slice(0, 512);
    }

    await setDoc(ref, newProfile);
    return {
      uid: fbUser.uid,
      email: String(newProfile.email),
      displayName: String(newProfile.displayName),
      photoURL: fbUser.photoURL || undefined,
      role: assignedRole,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveProcessedInvoice(params: {
  result: ProcessedInvoiceResponse;
  fileName: string;
  mimeType: string;
  fileSize: number;
  isDemo: boolean;
  demoScenario?: string;
  owner: UserProfile;
}): Promise<void> {
  const { result, fileName, mimeType, fileSize, isDemo, demoScenario, owner } =
    params;
  const { extraction } = result;
  const path = `invoices/${result.invoiceId}`;

  try {
    const batch = writeBatch(db);
    const invoiceDocRef = doc(db, 'invoices', result.invoiceId);

    const payload: Record<string, unknown> = {
      invoiceId: result.invoiceId,
      ownerId: owner.uid,
      ownerEmail: owner.email.slice(0, 256),
      ownerName: owner.displayName.slice(0, 120),
      fileName: fileName.slice(0, 256),
      mimeType: mimeType.slice(0, 100),
      fileSize: Math.max(0, Math.min(fileSize, 10485760)),
      storageMode: result.storageMode,
      isDemo,
      currency: (extraction.currency || 'INR').slice(0, 10),
      confidence: Math.max(0, Math.min(1, extraction.confidence)),
      missingFields: (extraction.missing_fields || []).slice(0, 20),
      riskFlags: (extraction.risk_flags || []).slice(0, 25),
      riskLevel: extraction.risk_level,
      recommendedAction: extraction.recommended_action,
      aiReason: (extraction.reason || 'Extraction completed.').slice(0, 1000),
      arithmeticValid: result.arithmeticValid,
      taxValid: result.taxValid,
      datesValid: result.datesValid,
      duplicateDetected: result.duplicateDetected,
      escalationReasons: (result.escalationReasons || []).slice(0, 25),
      ruleChecks: (result.ruleChecks || []).slice(0, 20),
      status: result.status,
      assignedTier: result.assignedTier,
      inrEquivalent: result.inrEquivalent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (demoScenario) payload.demoScenario = demoScenario.slice(0, 80);
    if (extraction.invoice_number) {
      payload.invoiceNumber = extraction.invoice_number.slice(0, 120);
    }
    if (extraction.vendor_name) {
      payload.vendorName = extraction.vendor_name.slice(0, 200);
    }
    if (extraction.vendor_details) {
      payload.vendorDetails = extraction.vendor_details.slice(0, 500);
    }
    if (extraction.invoice_date) {
      payload.invoiceDate = extraction.invoice_date.slice(0, 40);
    }
    if (extraction.due_date) {
      payload.dueDate = extraction.due_date.slice(0, 40);
    }
    if (typeof extraction.subtotal === 'number') {
      payload.subtotal = extraction.subtotal;
    }
    if (typeof extraction.tax_amount === 'number') {
      payload.taxAmount = extraction.tax_amount;
    }
    if (typeof extraction.total_amount === 'number') {
      payload.totalAmount = extraction.total_amount;
    }
    if (extraction.line_items && extraction.line_items.length > 0) {
      payload.lineItems = extraction.line_items.slice(0, 50);
    }

    batch.set(invoiceDocRef, payload);

    // Save protected document preview if provided and within Firestore limits
    if (result.previewDataUrl && result.previewDataUrl.length <= 740000) {
      const docPreviewRef = doc(db, 'invoice_documents', result.invoiceId);
      batch.set(docPreviewRef, {
        invoiceId: result.invoiceId,
        ownerId: owner.uid,
        fileName: fileName.slice(0, 256),
        mimeType: mimeType.slice(0, 100),
        dataUrl: result.previewDataUrl,
        isDemo,
        createdAt: serverTimestamp(),
      });
    }

    // Record fingerprint for duplicate detection if clean & not already duplicate
    if (
      result.fingerprintId &&
      result.vendorKey &&
      result.invoiceNumberKey &&
      !result.duplicateDetected
    ) {
      const fpRef = doc(db, 'invoice_fingerprints', result.fingerprintId);
      batch.set(fpRef, {
        fingerprintId: result.fingerprintId,
        vendorKey: result.vendorKey,
        invoiceNumberKey: result.invoiceNumberKey,
        invoiceId: result.invoiceId,
        ownerId: owner.uid,
        isDemo,
        createdAt: serverTimestamp(),
      });
    }

    // Write structured audit log entries for each pipeline stage
    const invNum = extraction.invoice_number || 'UNSPECIFIED';
    const auditEntries: Array<{
      action: string;
      actorRole: UserRole | 'SYSTEM';
      previousStatus: string;
      newStatus: string;
      reason: string;
    }> = [
      {
        action: 'INVOICE_UPLOADED',
        actorRole: owner.role,
        previousStatus: 'NEW',
        newStatus: 'UPLOADED',
        reason: `${isDemo ? '[DEMO] ' : ''}Submitted ${fileName} (${Math.max(
          1,
          Math.round(fileSize / 1024)
        )} KB).`,
      },
      {
        action: 'AI_EXTRACTION_COMPLETED',
        actorRole: 'SYSTEM',
        previousStatus: 'UPLOADED',
        newStatus: 'EXTRACTED',
        reason: `${result.aiModel} extracted fields at ${(
          extraction.confidence * 100
        ).toFixed(1)}% confidence. Schema valid: ${result.schemaValid}.`,
      },
      {
        action:
          result.status === 'AUTO_APPROVED'
            ? 'AUTO_APPROVED'
            : result.status === 'ESCALATED'
            ? 'ESCALATED_FOR_REVIEW'
            : 'ROUTED_FOR_APPROVAL',
        actorRole: 'SYSTEM',
        previousStatus: 'EXTRACTED',
        newStatus: result.status,
        reason:
          result.escalationReasons.length > 0
            ? result.escalationReasons.join(' | ').slice(0, 1000)
            : `Deterministic policy routed invoice (INR eq. ₹${result.inrEquivalent.toLocaleString(
                'en-IN'
              )}) to ${result.status}.`,
      },
    ];

    for (const entry of auditEntries) {
      const logId = randomLogId('log');
      const logRef = doc(db, 'audit_logs', logId);
      batch.set(logRef, {
        logId,
        invoiceId: result.invoiceId,
        invoiceOwnerId: owner.uid,
        invoiceNumber: invNum.slice(0, 120),
        action: entry.action,
        actorUid: owner.uid,
        actorEmail: owner.email.slice(0, 256),
        actorRole: entry.actorRole,
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        reason: entry.reason.slice(0, 1000),
        isDemo,
        timestamp: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function submitHumanDecision(params: {
  invoice: InvoiceRecord;
  decision: 'HUMAN_APPROVED' | 'REJECTED' | 'ESCALATED';
  comment: string;
}): Promise<void> {
  const { invoice, decision, comment } = params;
  const path = `invoices/${invoice.invoiceId}`;

  // 1. Server-side RBAC + JWT authorization check
  const authResult = await authorizeInvoiceDecision({
    invoiceId: invoice.invoiceId,
    action: decision,
    invoiceOwnerId: invoice.ownerId,
    assignedTier: invoice.assignedTier,
    currentStatus: invoice.status,
    isDemo: invoice.isDemo,
    comment,
  });

  // 2. Atomic Firestore update + immutable audit log append
  try {
    const batch = writeBatch(db);
    const invRef = doc(db, 'invoices', invoice.invoiceId);
    const nextTier = decision === 'ESCALATED' ? 'ADMIN' : invoice.assignedTier;

    batch.update(invRef, {
      status: decision,
      assignedTier: nextTier,
      reviewerId: authResult.reviewerId,
      reviewerEmail: authResult.reviewerEmail,
      reviewerRole: authResult.reviewerRole,
      reviewComment: (comment || `${decision} by ${authResult.reviewerRole}`).slice(
        0,
        1000
      ),
      reviewedAt: authResult.reviewedAt,
      updatedAt: serverTimestamp(),
    });

    const logId = randomLogId('log');
    const logRef = doc(db, 'audit_logs', logId);
    batch.set(logRef, {
      logId,
      invoiceId: invoice.invoiceId,
      invoiceOwnerId: invoice.ownerId,
      invoiceNumber: (invoice.invoiceNumber || 'UNSPECIFIED').slice(0, 120),
      action:
        decision === 'HUMAN_APPROVED'
          ? 'HUMAN_APPROVED'
          : decision === 'REJECTED'
          ? 'HUMAN_REJECTED'
          : 'MANUAL_ESCALATION',
      actorUid: authResult.reviewerId,
      actorEmail: authResult.reviewerEmail,
      actorRole: authResult.reviewerRole,
      previousStatus: invoice.status,
      newStatus: decision,
      reason: (
        comment || `Reviewer (${authResult.reviewerRole}) marked invoice ${decision}.`
      ).slice(0, 1000),
      isDemo: invoice.isDemo,
      timestamp: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchProtectedInvoicePreview(
  invoiceId: string
): Promise<string | null> {
  const path = `invoice_documents/${invoiceId}`;
  try {
    const snap = await getDoc(doc(db, 'invoice_documents', invoiceId));
    if (!snap.exists()) return null;
    const data = snap.data() as { dataUrl?: string };
    return data.dataUrl || null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveWorkflowRules(
  rules: WorkflowRuleConfig,
  actorEmail: string
): Promise<void> {
  const path = 'workflow_rules/default';
  try {
    await setDoc(doc(db, 'workflow_rules', 'default'), {
      ruleId: 'default',
      autoApproveMaxInr: Number(rules.autoApproveMaxInr),
      managerMaxInr: Number(rules.managerMaxInr),
      minConfidence: Number(rules.minConfidence),
      requireTaxConsistency: Boolean(rules.requireTaxConsistency),
      blockDuplicateVendorInvoices: Boolean(rules.blockDuplicateVendorInvoices),
      updatedBy: actorEmail.slice(0, 256),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateUserRoleAdmin(
  targetUser: UserProfile,
  newRole: UserRole
): Promise<void> {
  const path = `users/${targetUser.uid}`;
  try {
    await updateDoc(doc(db, 'users', targetUser.uid), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function clearDemoInvoices(
  demoInvoices: InvoiceRecord[]
): Promise<void> {
  for (const inv of demoInvoices) {
    if (!inv.isDemo) continue;
    try {
      await deleteDoc(doc(db, 'invoices', inv.invoiceId));
      await deleteDoc(doc(db, 'invoice_documents', inv.invoiceId)).catch(
        () => undefined
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `invoices/${inv.invoiceId}`);
    }
  }
}

function getTimestampMs(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return Number((ts as { seconds: number }).seconds) * 1000;
  }
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function subscribeInvoices(
  profile: UserProfile,
  onData: (invoices: InvoiceRecord[]) => void
): () => void {
  const colRef = collection(db, 'invoices');
  const q =
    profile.role === 'EMPLOYEE'
      ? query(colRef, where('ownerId', '==', profile.uid))
      : query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => d.data() as InvoiceRecord)
        .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invoices');
    }
  );
}

export function subscribeAuditLogs(
  profile: UserProfile,
  onData: (logs: AuditLogEntry[]) => void
): () => void {
  const colRef = collection(db, 'audit_logs');
  const q =
    profile.role === 'EMPLOYEE'
      ? query(colRef, where('invoiceOwnerId', '==', profile.uid))
      : query(colRef, orderBy('timestamp', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => d.data() as AuditLogEntry)
        .sort((a, b) => getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
    }
  );
}

export function subscribeWorkflowRules(
  onData: (rules: WorkflowRuleConfig) => void
): () => void {
  const ref = doc(db, 'workflow_rules', 'default');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as WorkflowRuleConfig);
      } else {
        onData(DEFAULT_WORKFLOW_RULES);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'workflow_rules/default');
    }
  );
}

export function subscribeAllUsers(
  onData: (users: UserProfile[]) => void
): () => void {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as UserProfile));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  );
}
