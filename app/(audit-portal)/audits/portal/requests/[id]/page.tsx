import { notFound, redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { resolveAuditorByEmail } from "@/server/services/audits/auditors";
import { getRequestForAuditor } from "@/server/services/audits/visibility";
import { NotWhitelisted } from "@/components/audits/portal/NotWhitelisted";
import { PortalRequestDetail } from "@/components/audits/portal/PortalRequestDetail";

export default async function AuditorRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/audits/portal/sign-in");

  const auditor = await resolveAuditorByEmail(email);
  if (!auditor) return <NotWhitelisted email={email} />;

  const { id } = await params;
  const view = await getRequestForAuditor(auditor.id, id);
  if (!view) notFound();

  // Deactivated firms keep read-only access to their history (round-3 N-4).
  return <PortalRequestDetail view={view} firmActive={auditor.active} />;
}
