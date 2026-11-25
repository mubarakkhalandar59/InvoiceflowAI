export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

export type InvoiceStatus =
  | 'AUTO_APPROVED'
  | 'PENDING_MANAGER'
  | 'PENDING_ADMIN'
  | 'ESCALATED'
  | 'HUMAN_APPROVED'
  | 'REJECTED';

export type AssignedTier = 'NONE' | 'MANAGER' | 'ADMIN';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type RecommendedAction =
  | 'AUTO_APPROVE'
  | 'MANAGER_REVIEW'
  | 'ADMIN_REVIEW'
  | 'ESCALATE';

export type StorageMode = 'FIRESTORE_PREVIEW' | 'SERVER_DISK' | 'SYNTHETIC_DEMO';

export type NavView =
  | 'overview'
  | 'invoices'
  | 'upload'
  | 'processing'
  | 'queue'
  | 'audit'
  | 'users'
  | 'rules'
  | 'settings';

export type DemoScenarioId =
  | 'auto_approve_low'
  | 'manager_approval_mid'
  | 'admin_approval_high'
  | 'duplicate_invoice'
  | 'missing_information'
  | 'calculation_mismatch'
  | 'low_confidence';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface GeminiExtractionOutput {
  invoice_number: string | null;
  vendor_name: string | null;
  vendor_details?: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  line_items?: InvoiceLineItem[];
  confidence: number;
  missing_fields: string[];
  risk_flags: string[];
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  reason: string;
}

export interface RuleCheckResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface WorkflowRuleConfig {
  ruleId: string;
  autoApproveMaxInr: number;
  managerMaxInr: number;
  minConfidence: number;
  requireTaxConsistency: boolean;
  blockDuplicateVendorInvoices: boolean;
  updatedBy: string;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InvoiceRecord {
  invoiceId: string;
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageMode: StorageMode;
  isDemo: boolean;
  demoScenario?: string;
  invoiceNumber?: string;
  vendorName?: string;
  vendorDetails?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  inrEquivalent?: number;
  lineItems?: InvoiceLineItem[];
  confidence: number;
  missingFields: string[];
  riskFlags: string[];
  riskLevel: RiskLevel;
  recommendedAction: RecommendedAction;
  aiReason: string;
  arithmeticValid: boolean;
  taxValid: boolean;
  datesValid: boolean;
  duplicateDetected: boolean;
  escalationReasons: string[];
  ruleChecks?: RuleCheckResult[];
  status: InvoiceStatus;
  assignedTier: AssignedTier;
  reviewerId?: string;
  reviewerEmail?: string;
  reviewerRole?: string;
  reviewComment?: string;
  reviewedAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLogEntry {
  logId: string;
  invoiceId: string;
  invoiceOwnerId: string;
  invoiceNumber?: string;
  action: string;
  actorUid: string;
  actorEmail: string;
  actorRole: UserRole | 'SYSTEM';
  previousStatus: string;
  newStatus: string;
  reason: string;
  isDemo: boolean;
  timestamp?: unknown;
}

export interface ProcessedInvoiceResponse {
  invoiceId: string;
  extraction: GeminiExtractionOutput;
  schemaValid: boolean;
  schemaErrors: string[];
  arithmeticValid: boolean;
  taxValid: boolean;
  datesValid: boolean;
  duplicateDetected: boolean;
  inrEquivalent: number;
  escalationReasons: string[];
  ruleChecks: RuleCheckResult[];
  status: 'AUTO_APPROVED' | 'PENDING_MANAGER' | 'PENDING_ADMIN' | 'ESCALATED';
  assignedTier: AssignedTier;
  storageMode: StorageMode;
  previewDataUrl?: string;
  fingerprintId?: string;
  vendorKey?: string;
  invoiceNumberKey?: string;
  aiModel: string;
  processingMs: number;
}
