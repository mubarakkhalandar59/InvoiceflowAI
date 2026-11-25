import { Search } from 'lucide-react';
import { useState } from 'react';
import type { InvoiceRecord, InvoiceStatus } from '../types/invoice';
import { formatCurrency } from '../lib/formatters';
import { RiskText, StatusText } from './StatusText';

export function AllInvoicesView(props: {
  invoices: InvoiceRecord[];
  onInspectInvoice: (invoice: InvoiceRecord) => void;
}) {
  const { invoices, onInspectInvoice } = props;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoiceStatus>('ALL');

  const filtered = invoices.filter((inv) => {
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (inv.vendorName || '').toLowerCase().includes(q) ||
      (inv.invoiceNumber || '').toLowerCase().includes(q) ||
      inv.fileName.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-6 lg:p-10 max-w-[1380px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#1E4ED8] font-medium">
            Ledger · Processed Submissions
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0B0F17]">
            All Invoices
          </h1>
        </div>
        <span className="font-mono text-xs text-slate-500 tabular-nums">
          {filtered.length} Record(s)
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor, invoice #, or file..."
            className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E6EAF2] rounded-xl text-sm text-[#0B0F17] placeholder:text-slate-400 focus:outline-none focus:border-[#1E4ED8]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-white border border-[#E6EAF2] rounded-xl overflow-x-auto shadow-xs">
          {(
            [
              { id: 'ALL', label: 'All' },
              { id: 'AUTO_APPROVED', label: 'Auto' },
              { id: 'PENDING_MANAGER', label: 'Manager' },
              { id: 'PENDING_ADMIN', label: 'Admin' },
              { id: 'ESCALATED', label: 'Escalated' },
              { id: 'HUMAN_APPROVED', label: 'Approved' },
              { id: 'REJECTED', label: 'Rejected' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#0B0F17] text-white'
                  : 'text-slate-500 hover:text-[#0B0F17]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table Card */}
      <div className="bg-white border border-[#E6EAF2] rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F8FAFC] border-b border-[#E6EAF2] font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5 font-medium">Vendor / File</th>
                <th className="px-4 py-3.5 font-medium">Invoice #</th>
                <th className="px-4 py-3.5 font-medium">Source</th>
                <th className="px-4 py-3.5 font-medium">Date</th>
                <th className="px-4 py-3.5 font-medium text-right">Amount</th>
                <th className="px-4 py-3.5 font-medium text-right">Conf.</th>
                <th className="px-4 py-3.5 font-medium">Risk</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF2] text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center text-sm text-slate-500"
                  >
                    No invoices match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr
                    key={inv.invoiceId}
                    onClick={() => onInspectInvoice(inv)}
                    className="hover:bg-[#F8FAFC] transition-colors cursor-pointer h-12"
                  >
                    <td className="px-5 py-3 max-w-[260px]">
                      <p className="font-semibold text-[#0B0F17] truncate">
                        {inv.vendorName || 'Unidentified Vendor'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {inv.fileName}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {inv.invoiceNumber || 'Missing'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] uppercase whitespace-nowrap text-[#1E4ED8] font-medium">
                      {inv.isDemo ? 'DEMO' : 'LIVE'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {inv.invoiceDate || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-[#0B0F17] text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(inv.totalAmount, inv.currency)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 text-right tabular-nums whitespace-nowrap">
                      {(inv.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <RiskText risk={inv.riskLevel} />
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <StatusText status={inv.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
