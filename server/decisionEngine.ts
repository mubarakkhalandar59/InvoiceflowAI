import type {
  AssignedTier,
  GeminiExtractionOutput,
  RiskLevel,
  RuleCheckResult,
  WorkflowRuleConfig,
} from '../src/types/invoice.ts';

const CURRENCY_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 84,
  EUR: 91,
  GBP: 106,
  AED: 23,
  SGD: 63,
  AUD: 55,
  CAD: 61,
};

export interface DeterministicDecisionResult {
  status: 'AUTO_APPROVED' | 'PENDING_MANAGER' | 'PENDING_ADMIN' | 'ESCALATED';
  assignedTier: AssignedTier;
  riskLevel: RiskLevel;
  inrEquivalent: number;
  arithmeticValid: boolean;
  taxValid: boolean;
  datesValid: boolean;
  duplicateDetected: boolean;
  missingFields: string[];
  escalationReasons: string[];
  ruleChecks: RuleCheckResult[];
}

export function buildInvoiceFingerprintId(
  vendorName: string | null | undefined,
  invoiceNumber: string | null | undefined,
  isDemo: boolean
): { fingerprintId: string; vendorKey: string; invoiceNumberKey: string } | null {
  if (!vendorName || !invoiceNumber) return null;
  const vendorKey = vendorName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 80);
  const invoiceNumberKey = invoiceNumber
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 60);
  if (!vendorKey || !invoiceNumberKey) return null;
  const prefix = isDemo ? 'demo' : 'live';
  const fingerprintId = `${prefix}_${vendorKey}_${invoiceNumberKey}`.slice(0, 120);
  return { fingerprintId, vendorKey, invoiceNumberKey };
}

function parseDateStrict(raw: string | null): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  if (year < 2000 || year > 2040) return null;
  return parsed;
}

function isSuspiciousVendor(
  vendorName: string | null,
  vendorDetails: string | null | undefined,
  aiRiskFlags: string[]
): string | null {
  if (!vendorName) return null;
  const lower = vendorName.trim().toLowerCase();
  const suspiciousTokens = [
    'unknown',
    'test vendor',
    'sample vendor',
    'dummy',
    'fake',
    'n/a',
    'na',
    'tbd',
    'shell corp',
    'offshore anonymous',
  ];
  if (suspiciousTokens.some((token) => lower === token || lower.includes(token))) {
    return `Suspicious or placeholder vendor name detected: "${vendorName}"`;
  }
  const combined = `${vendorName} ${vendorDetails || ''} ${aiRiskFlags.join(' ')}`.toLowerCase();
  if (
    combined.includes('prompt injection') ||
    combined.includes('ignore previous') ||
    combined.includes('suspicious vendor') ||
    combined.includes('mismatch') && combined.includes('vendor')
  ) {
    return 'Suspicious or inconsistent vendor information flagged during verification.';
  }
  return null;
}

export function evaluateDeterministicRules(params: {
  extraction: GeminiExtractionOutput;
  schemaValid: boolean;
  schemaErrors: string[];
  duplicateDetected: boolean;
  rules: WorkflowRuleConfig;
}): DeterministicDecisionResult {
  const { extraction, schemaValid, schemaErrors, duplicateDetected, rules } = params;

  const escalationReasons: string[] = [];
  const ruleChecks: RuleCheckResult[] = [];

  // 1. Backend Schema Validation Gate
  if (!schemaValid) {
    escalationReasons.push(
      `Malformed AI output rejected: ${schemaErrors[0] || 'Invalid JSON Schema response'}`
    );
  }
  ruleChecks.push({
    id: 'schema_validation',
    label: 'Structured JSON Schema Gate',
    passed: schemaValid,
    detail: schemaValid
      ? 'AI output passed strict backend Zod schema validation.'
      : schemaErrors.join('; '),
  });

  // 2. Mandatory Fields Check
  const computedMissing = new Set<string>(extraction.missing_fields || []);
  if (!extraction.invoice_number) computedMissing.add('invoice_number');
  if (!extraction.vendor_name) computedMissing.add('vendor_name');
  if (!extraction.invoice_date) computedMissing.add('invoice_date');
  if (!extraction.due_date) computedMissing.add('due_date');
  if (!extraction.currency) computedMissing.add('currency');
  if (extraction.subtotal === null || extraction.subtotal === undefined) {
    computedMissing.add('subtotal');
  }
  if (extraction.tax_amount === null || extraction.tax_amount === undefined) {
    computedMissing.add('tax_amount');
  }
  if (extraction.total_amount === null || extraction.total_amount === undefined) {
    computedMissing.add('total_amount');
  }
  const missingFields = Array.from(computedMissing);
  const fieldsComplete = missingFields.length === 0;
  if (!fieldsComplete) {
    escalationReasons.push(
      `Missing mandatory invoice fields: ${missingFields.join(', ')}`
    );
  }
  ruleChecks.push({
    id: 'mandatory_fields',
    label: 'Mandatory Fields Completeness',
    passed: fieldsComplete,
    detail: fieldsComplete
      ? 'All required header and financial fields extracted.'
      : `Missing: ${missingFields.join(', ')}`,
  });

  // 3. Duplicate Invoice Check
  const duplicateBlocked = rules.blockDuplicateVendorInvoices && duplicateDetected;
  if (duplicateBlocked) {
    escalationReasons.push(
      `Duplicate invoice detected for vendor "${extraction.vendor_name}" (${extraction.invoice_number}).`
    );
  }
  ruleChecks.push({
    id: 'duplicate_check',
    label: 'Vendor + Invoice Duplicate Guard',
    passed: !duplicateBlocked,
    detail: duplicateBlocked
      ? `Matches an existing processed invoice for ${extraction.vendor_name} #${extraction.invoice_number}.`
      : 'No duplicate vendor invoice number found.',
  });

  // 4. Arithmetic Consistency Check
  let arithmeticValid = true;
  let arithmeticDetail = 'Subtotal + tax matches total amount.';
  if (
    extraction.subtotal === null ||
    extraction.tax_amount === null ||
    extraction.total_amount === null
  ) {
    arithmeticValid = false;
    arithmeticDetail = 'Cannot verify arithmetic because subtotal, tax, or total is missing.';
  } else {
    if (
      extraction.subtotal < 0 ||
      extraction.tax_amount < 0 ||
      extraction.total_amount <= 0
    ) {
      arithmeticValid = false;
      arithmeticDetail = 'Negative or zero monetary total detected.';
    } else {
      const expectedTotal = Number(
        (extraction.subtotal + extraction.tax_amount).toFixed(2)
      );
      const diff = Math.abs(expectedTotal - extraction.total_amount);
      if (diff > 1.0) {
        arithmeticValid = false;
        arithmeticDetail = `Subtotal (${extraction.subtotal}) + Tax (${extraction.tax_amount}) = ${expectedTotal}, which differs from Total (${extraction.total_amount}) by ${diff.toFixed(2)}.`;
      } else if (extraction.line_items && extraction.line_items.length > 0) {
        const lineSum = extraction.line_items.reduce(
          (acc, item) => acc + (Number.isFinite(item.amount) ? item.amount : 0),
          0
        );
        const lineDiff = Math.abs(lineSum - extraction.subtotal);
        if (lineDiff > 1.5) {
          arithmeticValid = false;
          arithmeticDetail = `Line items sum (${lineSum.toFixed(2)}) does not match subtotal (${extraction.subtotal.toFixed(2)}).`;
        }
      }
    }
  }
  if (!arithmeticValid) {
    escalationReasons.push(`Arithmetic mismatch: ${arithmeticDetail}`);
  }
  ruleChecks.push({
    id: 'arithmetic_check',
    label: 'Arithmetic & Line-Item Integrity',
    passed: arithmeticValid,
    detail: arithmeticDetail,
  });

  // 5. Tax Consistency Check
  let taxValid = true;
  let taxDetail = 'Tax amount falls within valid statutory range.';
  if (rules.requireTaxConsistency) {
    if (extraction.subtotal === null || extraction.tax_amount === null) {
      taxValid = false;
      taxDetail = 'Tax consistency cannot be verified with missing subtotal or tax.';
    } else if (extraction.tax_amount < 0) {
      taxValid = false;
      taxDetail = 'Negative tax amount is invalid.';
    } else if (
      extraction.subtotal > 0 &&
      extraction.tax_amount / extraction.subtotal > 0.4
    ) {
      taxValid = false;
      const pct = ((extraction.tax_amount / extraction.subtotal) * 100).toFixed(1);
      taxDetail = `Anomalous tax ratio (${pct}% of subtotal exceeds 40% ceiling).`;
    }
  }
  if (!taxValid) {
    escalationReasons.push(`Tax inconsistency: ${taxDetail}`);
  }
  ruleChecks.push({
    id: 'tax_consistency',
    label: 'Tax Rate & Statutory Sanity',
    passed: taxValid,
    detail: taxDetail,
  });

  // 6. Date Validity Check
  let datesValid = true;
  let dateDetail = 'Invoice and due dates are valid and chronological.';
  const invDate = parseDateStrict(extraction.invoice_date);
  const dueDate = parseDateStrict(extraction.due_date);
  if (!invDate || !dueDate) {
    datesValid = false;
    dateDetail = 'Invoice date or due date is missing or unparseable.';
  } else if (dueDate.getTime() < invDate.getTime()) {
    datesValid = false;
    dateDetail = `Due date (${extraction.due_date}) precedes invoice date (${extraction.invoice_date}).`;
  } else {
    const maxFutureMs = Date.now() + 45 * 24 * 60 * 60 * 1000;
    if (invDate.getTime() > maxFutureMs) {
      datesValid = false;
      dateDetail = `Invoice date (${extraction.invoice_date}) is anomalously far in the future.`;
    }
  }
  if (!datesValid) {
    escalationReasons.push(`Invalid dates: ${dateDetail}`);
  }
  ruleChecks.push({
    id: 'date_validity',
    label: 'Date Format & Chronology',
    passed: datesValid,
    detail: dateDetail,
  });

  // 7. Suspicious Vendor Check
  const vendorIssue = isSuspiciousVendor(
    extraction.vendor_name,
    extraction.vendor_details,
    extraction.risk_flags || []
  );
  const vendorOk = vendorIssue === null;
  if (!vendorOk && vendorIssue) {
    escalationReasons.push(vendorIssue);
  }
  ruleChecks.push({
    id: 'vendor_integrity',
    label: 'Vendor Authenticity & Risk Flags',
    passed: vendorOk,
    detail: vendorOk
      ? 'Vendor identity and metadata passed consistency checks.'
      : vendorIssue || 'Vendor risk flagged.',
  });

  // 8. Confidence Floor Check
  const confidenceOk = extraction.confidence >= rules.minConfidence;
  if (!confidenceOk) {
    escalationReasons.push(
      `Extraction confidence (${(extraction.confidence * 100).toFixed(0)}%) is below the ${(rules.minConfidence * 100).toFixed(0)}% minimum threshold.`
    );
  }
  ruleChecks.push({
    id: 'confidence_threshold',
    label: `AI Confidence Floor (>= ${(rules.minConfidence * 100).toFixed(0)}%)`,
    passed: confidenceOk,
    detail: `Measured extraction confidence: ${(extraction.confidence * 100).toFixed(1)}%`,
  });

  // 9. Compute INR Equivalent & Deterministic Routing
  const currencyCode = (extraction.currency || 'INR').toUpperCase().trim();
  const rate = CURRENCY_TO_INR[currencyCode] ?? 1;
  const rawTotal = extraction.total_amount ?? 0;
  const inrEquivalent = Number((rawTotal * rate).toFixed(2));

  let status: DeterministicDecisionResult['status'];
  let assignedTier: AssignedTier;
  let riskLevel: RiskLevel = extraction.risk_level;

  if (escalationReasons.length > 0) {
    status = 'ESCALATED';
    assignedTier = inrEquivalent > rules.managerMaxInr || duplicateBlocked ? 'ADMIN' : 'MANAGER';
    riskLevel = duplicateBlocked || !schemaValid || !arithmeticValid ? 'HIGH' : 'MEDIUM';
  } else if (inrEquivalent <= rules.autoApproveMaxInr) {
    status = 'AUTO_APPROVED';
    assignedTier = 'NONE';
    riskLevel = 'LOW';
  } else if (inrEquivalent <= rules.managerMaxInr) {
    status = 'PENDING_MANAGER';
    assignedTier = 'MANAGER';
    riskLevel = riskLevel === 'HIGH' ? 'MEDIUM' : riskLevel;
  } else {
    status = 'PENDING_ADMIN';
    assignedTier = 'ADMIN';
    riskLevel = 'MEDIUM';
  }

  ruleChecks.push({
    id: 'monetary_tier',
    label: 'Monetary Policy Tier Routing',
    passed: status === 'AUTO_APPROVED',
    detail:
      currencyCode === 'INR'
        ? `Amount ₹${inrEquivalent.toLocaleString('en-IN')} evaluated against Auto <= ₹${rules.autoApproveMaxInr.toLocaleString('en-IN')}, Manager <= ₹${rules.managerMaxInr.toLocaleString('en-IN')}.`
        : `Amount ${currencyCode} ${rawTotal.toLocaleString('en-US')} (≈ ₹${inrEquivalent.toLocaleString('en-IN')}) evaluated against INR policy thresholds.`,
  });

  return {
    status,
    assignedTier,
    riskLevel,
    inrEquivalent,
    arithmeticValid,
    taxValid,
    datesValid,
    duplicateDetected: duplicateBlocked,
    missingFields,
    escalationReasons,
    ruleChecks,
  };
}
