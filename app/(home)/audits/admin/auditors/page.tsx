import { getAdminAuditors } from "@/server/services/audits/visibility";
import { AuditorsManager } from "@/components/audits/admin/AuditorsManager";

export default async function AuditAdminAuditorsPage() {
  const auditors = await getAdminAuditors();
  return <AuditorsManager auditors={auditors} />;
}
