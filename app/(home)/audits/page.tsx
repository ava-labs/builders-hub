import { getAuthSession } from "@/lib/auth/authSession";
import { canAdministerAuditProgram } from "@/lib/auth/permissions";
import { prisma } from "@/prisma/prisma";
import { findAuditorByEmail } from "@/server/services/audits/auditors";
import { getOwnerRequests } from "@/server/services/audits/visibility";
import { AuditsLanding } from "@/components/audits/landing/AuditsLanding";
import { FirstRun } from "@/components/audits/landing/FirstRun";
import { MyRequestsList } from "@/components/audits/landing/MyRequestsList";

/**
 * One route, state-routed (locked IA decision): logged out -> public landing;
 * signed in with 0 requests -> first-run empty state; 1+ -> My requests.
 * A pending_ session owns no rows, so it lands on first-run naturally.
 */
export default async function AuditsPage() {
  const session = await getAuthSession();

  const email = session?.user?.email?.trim().toLowerCase();
  // Pure lookup (no first_login_at stamping: that stays a portal-visit event)
  // so whitelisted firms and their approved teammates see the door.
  const identity = email ? await findAuditorByEmail(email) : null;
  const isAuditor = Boolean(identity?.auditor.active);

  return (
    <main className="container relative max-w-[1400px]">
      {session?.user?.id ? (
        <SignedIn
          userId={session.user.id}
          isAdmin={canAdministerAuditProgram(session)}
          isAuditor={isAuditor}
        />
      ) : (
        <SignedOut />
      )}
    </main>
  );
}

async function SignedOut() {
  const firmCount = await prisma.auditor.count({ where: { active: true } });
  return <AuditsLanding firmCount={firmCount} />;
}

async function SignedIn({
  userId,
  isAdmin,
  isAuditor,
}: {
  userId: string;
  isAdmin: boolean;
  isAuditor: boolean;
}) {
  const requests = await getOwnerRequests(userId);
  if (requests.length === 0) return <FirstRun isAdmin={isAdmin} isAuditor={isAuditor} />;
  return <MyRequestsList requests={requests} isAdmin={isAdmin} isAuditor={isAuditor} />;
}
