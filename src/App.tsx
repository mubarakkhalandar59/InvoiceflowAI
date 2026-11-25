import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import type {
  AuditLogEntry,
  InvoiceRecord,
  NavView,
  ProcessedInvoiceResponse,
  UserProfile,
  WorkflowRuleConfig,
} from './types/invoice';
import {
  auth,
  signOutUser,
  testFirestoreConnection,
} from './lib/firebase';
import {
  DEFAULT_WORKFLOW_RULES,
  ensureUserProfile,
  subscribeAllUsers,
  subscribeAuditLogs,
  subscribeInvoices,
  subscribeWorkflowRules,
} from './lib/firestoreStore';
import { AllInvoicesView } from './components/AllInvoicesView';
import { ApprovalQueueView } from './components/ApprovalQueueView';
import { AuditLogsView } from './components/AuditLogsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import { OverviewView } from './components/OverviewView';
import { ProcessingView } from './components/ProcessingView';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { SignInView } from './components/SignInView';
import { type DataScopeFilter, TopBar } from './components/TopBar';
import { UploadInvoiceView } from './components/UploadInvoiceView';
import { UserManagementView } from './components/UserManagementView';
import { WorkflowRulesView } from './components/WorkflowRulesView';

function MainWorkspace() {
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<NavView>('overview');
  const [dataScope, setDataScope] = useState<DataScopeFilter>('ALL');
  const [railExpanded, setRailExpanded] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [rules, setRules] = useState<WorkflowRuleConfig>(DEFAULT_WORKFLOW_RULES);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [latestRun, setLatestRun] = useState<ProcessedInvoiceResponse | null>(
    null
  );
  const [latestInvoiceId, setLatestInvoiceId] = useState<string | null>(null);
  const [inspectedInvoice, setInspectedInvoice] =
    useState<InvoiceRecord | null>(null);

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setProfile(null);
        setInvoices([]);
        setAuditLogs([]);
        setAllUsers([]);
        setAuthReady(true);
        setLoadingData(false);
        return;
      }

      if (!fbUser.emailVerified) {
        setAuthError(
          'Your Google account email must be verified before accessing InvoiceFlow AI.'
        );
        await signOutUser();
        setAuthReady(true);
        return;
      }

      try {
        setAuthError(null);
        const resolved = await ensureUserProfile(fbUser);
        setProfile(resolved);
      } catch (err) {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Unable to initialize your user profile.'
        );
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !profile) return;
    setLoadingData(true);

    const unsubInvoices = subscribeInvoices(profile, (items) => {
      setInvoices(items);
      setLoadingData(false);
    });
    const unsubAudit = subscribeAuditLogs(profile, setAuditLogs);
    const unsubRules = subscribeWorkflowRules(setRules);
    const unsubUsers =
      profile.role === 'ADMIN' ? subscribeAllUsers(setAllUsers) : () => {};

    return () => {
      unsubInvoices();
      unsubAudit();
      unsubRules();
      unsubUsers();
    };
  }, [authReady, profile?.uid, profile?.role]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center font-mono text-xs uppercase tracking-widest text-slate-500">
        Initializing InvoiceFlow AI session...
      </div>
    );
  }

  if (!profile) {
    return <SignInView authError={authError} />;
  }

  const scopedInvoices = invoices.filter((inv) => {
    if (dataScope === 'LIVE') return !inv.isDemo;
    if (dataScope === 'DEMO') return inv.isDemo;
    return true;
  });

  const scopedAuditLogs = auditLogs.filter((log) => {
    if (dataScope === 'LIVE') return !log.isDemo;
    if (dataScope === 'DEMO') return log.isDemo;
    return true;
  });

  const pendingQueueCount = scopedInvoices.filter((inv) => {
    const isPending =
      inv.status === 'PENDING_MANAGER' ||
      inv.status === 'PENDING_ADMIN' ||
      inv.status === 'ESCALATED';
    if (!isPending) return false;
    if (profile.role === 'ADMIN') return true;
    if (profile.role === 'MANAGER') {
      return (
        inv.assignedTier !== 'ADMIN' &&
        inv.status !== 'PENDING_ADMIN' &&
        (inv.isDemo || inv.ownerId !== profile.uid)
      );
    }
    return false;
  }).length;

  const latestInvoice =
    invoices.find((i) => i.invoiceId === latestInvoiceId) ||
    invoices[0] ||
    null;

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-[#0B0F17] flex justify-center">
      <div className="w-full max-w-[1680px] min-h-screen bg-[#F4F6FA] border-x border-[#E6EAF2] flex">
        <Sidebar
          activeView={activeView}
          onSelectView={setActiveView}
          profile={profile}
          pendingQueueCount={pendingQueueCount}
          expanded={railExpanded}
          onToggleExpand={() => setRailExpanded((e) => !e)}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
          onSignOut={() => signOutUser()}
        />

        <div className="flex-1 min-w-0 flex flex-col bg-[#F4F6FA]">
          <TopBar
            activeView={activeView}
            profile={profile}
            dataScope={dataScope}
            onChangeDataScope={setDataScope}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onNavigateUpload={() => setActiveView('upload')}
          />

          <main className="flex-1">
            {activeView === 'overview' && (
              <OverviewView
                invoices={scopedInvoices}
                auditLogs={scopedAuditLogs}
                profile={profile}
                loading={loadingData}
                onNavigate={setActiveView}
                onInspectInvoice={setInspectedInvoice}
              />
            )}

            {activeView === 'invoices' && (
              <AllInvoicesView
                invoices={scopedInvoices}
                onInspectInvoice={setInspectedInvoice}
              />
            )}

            {activeView === 'upload' && (
              <UploadInvoiceView
                profile={profile}
                existingInvoices={invoices}
                onProcessed={(result, invoiceId) => {
                  setLatestRun(result);
                  setLatestInvoiceId(invoiceId);
                  setActiveView('processing');
                }}
              />
            )}

            {activeView === 'processing' && (
              <ProcessingView
                latestRun={latestRun}
                latestInvoice={latestInvoice}
                onNavigate={setActiveView}
                onInspectInvoice={setInspectedInvoice}
              />
            )}

            {activeView === 'queue' && (
              <ApprovalQueueView invoices={scopedInvoices} profile={profile} />
            )}

            {activeView === 'audit' && (
              <AuditLogsView auditLogs={scopedAuditLogs} />
            )}

            {activeView === 'users' && (
              <UserManagementView users={allUsers} currentUser={profile} />
            )}

            {activeView === 'rules' && (
              <WorkflowRulesView rules={rules} profile={profile} />
            )}

            {activeView === 'settings' && (
              <SettingsView profile={profile} rules={rules} />
            )}
          </main>
        </div>
      </div>

      <InvoiceDetailModal
        invoice={inspectedInvoice}
        auditLogs={auditLogs}
        onClose={() => setInspectedInvoice(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainWorkspace />
    </ErrorBoundary>
  );
}
