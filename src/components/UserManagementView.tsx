import { CheckCircle2, ShieldAlert, Users } from 'lucide-react';
import { useState } from 'react';
import type { UserProfile, UserRole } from '../types/invoice';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../lib/firebase';
import { updateUserRoleAdmin } from '../lib/firestoreStore';
import { formatTimestamp } from '../lib/formatters';

export function UserManagementView(props: {
  users: UserProfile[];
  currentUser: UserProfile;
}) {
  const { users, currentUser } = props;
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="p-6 lg:p-10 max-w-[1380px] mx-auto">
        <div className="bg-white border border-[#E6EAF2] rounded-3xl p-10 max-w-xl mx-auto text-center space-y-2 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <ShieldAlert className="w-7 h-7 text-amber-600 mx-auto" />
          <h2 className="font-display text-xl font-bold text-[#0B0F17]">
            Admin Privileges Required
          </h2>
          <p className="text-sm text-slate-500">
            Only Admins can view organization members and assign workflow
            roles.
          </p>
        </div>
      </div>
    );
  }

  const handleRoleChange = async (target: UserProfile, nextRole: UserRole) => {
    setErrorMsg(null);
    setFeedback(null);
    if (
      target.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
      nextRole !== 'ADMIN'
    ) {
      setErrorMsg('The primary bootstrapped Admin account cannot be demoted.');
      return;
    }

    setUpdatingUid(target.uid);
    try {
      await updateUserRoleAdmin(target, nextRole);
      setFeedback(`Updated ${target.email} to ${nextRole}.`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to update user role.'
      );
    } finally {
      setUpdatingUid(null);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#1E4ED8] font-medium">
          Access Control · Organization Directory
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0B0F17]">
          User Management
        </h1>
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="bg-white border border-[#E6EAF2] rounded-3xl p-6 space-y-2 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0B0F17]">
          <Users className="w-4 h-4 text-[#1E4ED8]" />
          <span>Server-Enforced Role Provisioning</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          All new users signing in with Google are assigned the{' '}
          <span className="text-[#0B0F17] font-semibold">Employee</span> role by
          default and cannot elevate their own privileges. To create a Manager
          or Admin account, have that user sign in once with Google, then assign
          their role below.
        </p>
      </section>

      <div className="bg-white border border-[#E6EAF2] rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F8FAFC] border-b border-[#E6EAF2] font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5 font-medium">User</th>
                <th className="px-4 py-3.5 font-medium">Email</th>
                <th className="px-4 py-3.5 font-medium">Joined</th>
                <th className="px-5 py-3.5 font-medium">Assigned Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF2] text-sm">
              {users.map((u) => {
                const isBootstrap =
                  u.email.toLowerCase() ===
                  BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
                return (
                  <tr key={u.uid} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3.5 font-semibold text-[#0B0F17]">
                      {u.displayName}
                      {isBootstrap && (
                        <span className="ml-2 font-mono text-[10px] uppercase text-[#1E4ED8]">
                          · Primary Admin
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {u.email}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-mono text-slate-500 tabular-nums">
                      {formatTimestamp(u.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={u.role}
                        disabled={updatingUid === u.uid || isBootstrap}
                        onChange={(e) =>
                          handleRoleChange(u, e.target.value as UserRole)
                        }
                        aria-label={`Role for ${u.email}`}
                        className="px-3 py-1.5 rounded-xl bg-[#F4F6FA] border border-[#E6EAF2] font-mono text-xs text-[#0B0F17] focus:outline-none focus:border-[#1E4ED8] disabled:opacity-60"
                      >
                        <option value="EMPLOYEE">EMPLOYEE</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
