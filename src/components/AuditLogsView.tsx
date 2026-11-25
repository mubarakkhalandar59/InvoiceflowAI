import { Lock, Search } from 'lucide-react';
import { useState } from 'react';
import type { AuditLogEntry } from '../types/invoice';
import { formatTimestamp } from '../lib/formatters';

export function AuditLogsView({ auditLogs }: { auditLogs: AuditLogEntry[] }) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filtered = auditLogs.filter((log) => {
    const matchesAction =
      actionFilter === 'ALL' || log.action === actionFilter;
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      (log.invoiceNumber || '').toLowerCase().includes(q) ||
      log.actorEmail.toLowerCase().includes(q) ||
      log.reason.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q);
    return matchesAction && matchesQuery;
  });

  const uniqueActions = Array.from(new Set(auditLogs.map((l) => l.action)));

  return (
    <div className="p-6 lg:p-10 max-w-[1380px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#1E4ED8] font-medium">
            Compliance · Immutable Record
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0B0F17]">
            Audit Logs
          </h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          <span>Append-only immutable trail</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by invoice #, user, or reason..."
            className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E6EAF2] rounded-xl text-sm text-[#0B0F17] placeholder:text-slate-400 focus:outline-none focus:border-[#1E4ED8]"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Filter audit action"
          className="px-3.5 py-2.5 bg-white border border-[#E6EAF2] rounded-xl font-mono text-xs text-[#0B0F17] focus:outline-none focus:border-[#1E4ED8]"
        >
          <option value="ALL">All Event Types</option>
          {uniqueActions.map((act) => (
            <option key={act} value={act}>
              {act.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-[#E6EAF2] rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F8FAFC] border-b border-[#E6EAF2] font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5 font-medium">Timestamp</th>
                <th className="px-4 py-3.5 font-medium">Action</th>
                <th className="px-4 py-3.5 font-medium">Invoice #</th>
                <th className="px-4 py-3.5 font-medium">Actor</th>
                <th className="px-4 py-3.5 font-medium">Transition</th>
                <th className="px-5 py-3.5 font-medium">Reason / Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF2] text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center text-sm text-slate-500"
                  >
                    No audit trail records found.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.logId} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3.5 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#0B0F17] whitespace-nowrap">
                      {log.action.replace(/_/g, ' ')}
                      {log.isDemo && (
                        <span className="ml-2 font-mono text-[10px] text-[#1E4ED8]">
                          · DEMO
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-700 whitespace-nowrap">
                      {log.invoiceNumber || log.invoiceId}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                      <span>{log.actorEmail}</span>
                      <span className="text-slate-400 ml-1.5 font-mono">
                        ({log.actorRole})
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600 whitespace-nowrap">
                      {log.previousStatus} → {log.newStatus}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 max-w-md">
                      {log.reason}
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
