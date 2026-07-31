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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RequestsFilters />
        <a href="/api/audits/admin/requests/export" target="_self" className="inline-flex h-10 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition-colors hover:border-zinc-500 dark:border-white/15 dark:hover:border-white/40">
          Export CSV
        </a>
      </div>
      <RequestsTable rows={requests} />
    </div>
  );
}
