import { getAuthSession } from "@/lib/auth/authSession";
import { canAdministerAuditProgram } from "@/lib/auth/permissions";
import { prisma } from "@/prisma/prisma";
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

  return (
    <main className="container relative max-w-[1400px]">
      {session?.user?.id ? (
        <SignedIn userId={session.user.id} isAdmin={canAdministerAuditProgram(session)} />
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

async function SignedIn({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const requests = await getOwnerRequests(userId);
  if (requests.length === 0) return <FirstRun isAdmin={isAdmin} />;
  return <MyRequestsList requests={requests} isAdmin={isAdmin} />;
}
