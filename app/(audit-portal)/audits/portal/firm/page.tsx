import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { resolveAuditorByEmail } from "@/server/services/audits/auditors";
import { getOwnFirm } from "@/server/services/audits/visibility";
import { NotWhitelisted } from "@/components/audits/portal/NotWhitelisted";
import { FirmDetails } from "@/components/audits/portal/FirmDetails";

export default async function FirmDetailsPage() {
  const session = await getAuthSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/audits/portal/sign-in");

  const auditor = await resolveAuditorByEmail(email);
  if (!auditor) return <NotWhitelisted email={email} />;

  const firm = await getOwnFirm(auditor.id);
  if (!firm) return <NotWhitelisted email={email} />;

  return (
    <FirmDetails firm={firm} isOwner={email === auditor.quote_email} readOnly={!auditor.active} />
  );
}
