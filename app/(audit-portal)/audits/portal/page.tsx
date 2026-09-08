import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { resolveAuditorByEmail } from "@/server/services/audits/auditors";
import { getAuditorInbox } from "@/server/services/audits/visibility";
import { NotWhitelisted } from "@/components/audits/portal/NotWhitelisted";
import { PortalInbox } from "@/components/audits/portal/PortalInbox";

export default async function AuditorInboxPage() {
  const session = await getAuthSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/audits/portal/sign-in");

  const auditor = await resolveAuditorByEmail(email);
  if (!auditor) return <NotWhitelisted email={email} />;

  // Deactivated firms keep read-only access to their history (round-3 N-4).
  const items = await getAuditorInbox(auditor.id);
  // The signed-in address itself receives the notices (every approved address does).
  return <PortalInbox items={items} notifyEmail={email} readOnly={!auditor.active} />;
}
