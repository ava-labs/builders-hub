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
  if (!auditor) return <NotWhitelisted email={email} reason="unknown" />;
  if (!auditor.active) return <NotWhitelisted email={email} reason="deactivated" />;

  const items = await getAuditorInbox(auditor.id);
  return <PortalInbox items={items} quoteEmail={auditor.quote_email} />;
}
