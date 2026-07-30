import { adminRequestFiltersSchema } from "@/types/audits";
import { getAdminRequests } from "@/server/services/audits/visibility";
import { RequestsFilters } from "@/components/audits/admin/RequestsFilters";
import { RequestsTable } from "@/components/audits/admin/RequestsTable";

interface AdminRequestsPageProps {
  searchParams: Promise<{ status?: string; subsidy?: string }>;
}

export default async function AuditAdminRequestsPage({ searchParams }: AdminRequestsPageProps) {
  const params = await searchParams;
  const parsed = adminRequestFiltersSchema.safeParse({
    status: params.status,
    subsidy: params.subsidy,
  });
  const filters = parsed.success ? parsed.data : { take: 50 as const, skip: 0 as const };
  const requests = await getAdminRequests(filters);

  return (
    <div className="mt-6 space-y-4">
      <RequestsFilters />
      <RequestsTable rows={requests} />
    </div>
  );
}
