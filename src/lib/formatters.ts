import type { InvoiceStatus, RiskLevel, UserRole } from '../types/invoice';

export function formatCurrency(
  amount: number | null | undefined,
  currency = 'INR'
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }
  const code = (currency || 'INR').toUpperCase();
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString('en-IN')}`;
  }
}

export function formatInrCompact(amount: number): string {
  if (!Number.isFinite(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTimestamp(ts: unknown): string {
  if (!ts) return 'Just now';
  let date: Date | null = null;
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    date = (ts as { toDate: () => Date }).toDate();
  } else if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    date = new Date(Number((ts as { seconds: number }).seconds) * 1000);
  } else if (typeof ts === 'string') {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return 'Just now';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusDisplay(status: InvoiceStatus): {
  label: string;
  textClass: string;
} {
  switch (status) {
    case 'AUTO_APPROVED':
      return { label: 'Auto-Approved', textClass: 'text-emerald-700' };
    case 'HUMAN_APPROVED':
      return { label: 'Human Approved', textClass: 'text-emerald-700' };
    case 'PENDING_MANAGER':
      return { label: 'Pending Manager', textClass: 'text-amber-700' };
    case 'PENDING_ADMIN':
      return { label: 'Pending Admin', textClass: 'text-indigo-700' };
    case 'ESCALATED':
      return { label: 'Escalated', textClass: 'text-red-700' };
    case 'REJECTED':
      return { label: 'Rejected', textClass: 'text-red-700' };
    default:
      return { label: status, textClass: 'text-[#0B0F17]' };
  }
}

export function getRiskDisplay(risk: RiskLevel): {
  label: string;
  textClass: string;
} {
  switch (risk) {
    case 'LOW':
      return { label: 'Low Risk', textClass: 'text-emerald-700' };
    case 'MEDIUM':
      return { label: 'Medium Risk', textClass: 'text-amber-700' };
    case 'HIGH':
      return { label: 'High Risk', textClass: 'text-red-700' };
  }
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return 'Admin';
    case 'MANAGER':
      return 'Manager';
    case 'EMPLOYEE':
      return 'Employee';
  }
}
