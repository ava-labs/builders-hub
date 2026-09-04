import { Button } from "@/components/ui/button";
import { adminRequestFiltersSchema } from "@/types/audits";
import { getAdminRequests } from "@/server/services/audits/visibility";
import { RequestsFilters } from "@/components/audits/admin/RequestsFilters";
import { RequestsTable } from "@/components/audits/admin/RequestsTable";

interface AdminRequestsPageProps {
  searchParams: Promise<{ status?: string; subsidy?: string; deadline_before?: string }>;
}

export default async function AuditAdminRequestsPage({ searchParams }: AdminRequestsPageProps) {
  const params = await searchParams;
  const parsed = adminRequestFiltersSchema.safeParse({
    status: params.status,
    subsidy: params.subsidy,
    deadline_before: params.deadline_before,
  });
  const filters = parsed.success ? parsed.data : { take: 50 as const, skip: 0 as const };
  const requests = await getAdminRequests(filters);

  return (
    <div className="mt-6 space-y-4">
      {/* The board's table header: title + caption left, controls right (1a). */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold">Requests</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            sorted by next deadline · subsidy caps at 75%
          </p>
        </div>
        <span className="flex-1" />
        <RequestsFilters />
        <Button asChild variant="outline" className="h-10">
          <a href="/api/audits/admin/requests/export" target="_self">
            Export CSV
          </a>
        </Button>
      </div>
      <RequestsTable rows={requests} />
    </div>
  );
}
