import { getAdminAuditors } from "@/server/services/audits/visibility";
import { AuditorsManager } from "@/components/audits/admin/AuditorsManager";
import { denyIfNotAuditAdmin } from "@/app/(home)/audits/admin/require-admin";

export default async function AuditAdminAuditorsPage() {
  await denyIfNotAuditAdmin();

  const auditors = await getAdminAuditors();
  return <AuditorsManager auditors={auditors} />;
}
