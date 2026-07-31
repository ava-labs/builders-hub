import { getAuthSession } from "@/lib/auth/authSession";
import { canAdministerAuditProgram } from "@/lib/auth/permissions";
import { AuthLoading } from "@/components/ui/auth-loading";
import { AccessDenied } from "@/components/ui/access-denied";
import { getAdminOverview } from "@/server/services/audits/visibility";
import { AdminNav } from "@/components/audits/admin/AdminNav";

export default async function AuditAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();
  // /audits/admin is in PROTECTED_PATHS: the login modal opens over this.
  if (!session?.user) return <AuthLoading />;
  if (!canAdministerAuditProgram(session)) {
    return (
      <main className="container relative max-w-[1400px] px-4 py-10">
        <AccessDenied message="You need the audit program admin role to view this area." />
      </main>
    );
  }
  const overview = await getAdminOverview();

  return (
    <main className="container relative max-w-[1400px] px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Audit program</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
            No pings by design · this page is the feed
          </p>
        </div>
        <AdminNav needsApprovalCount={overview.needs_approval_count} />
        {children}
      </div>
    </main>
  );
}
