import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileSearch,
  ShieldCheck,
} from 'lucide-react';
import type { InvoiceStatus, RiskLevel } from '../types/invoice';
import { getRiskDisplay, getStatusDisplay } from '../lib/formatters';

export function StatusText({ status }: { status: InvoiceStatus }) {
  const { label, textClass } = getStatusDisplay(status);
  const Icon =
    status === 'AUTO_APPROVED' || status === 'HUMAN_APPROVED'
      ? CheckCircle2
      : status === 'REJECTED' || status === 'ESCALATED'
      ? AlertCircle
      : status === 'PENDING_ADMIN'
      ? ShieldCheck
      : Clock;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${textClass}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

export function RiskText({ risk }: { risk: RiskLevel }) {
  const { label, textClass } = getRiskDisplay(risk);
  const Icon = risk === 'HIGH' ? AlertCircle : risk === 'MEDIUM' ? FileSearch : CheckCircle2;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${textClass}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}
