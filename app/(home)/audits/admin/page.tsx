import Link from "next/link";
import { getAdminOverview, getAdminRequests } from "@/server/services/audits/visibility";
import { OverviewTiles } from "@/components/audits/admin/OverviewTiles";
import { RequestsTable } from "@/components/audits/admin/RequestsTable";

export default async function AuditAdminOverviewPage() {
  const [overview, requests] = await Promise.all([
    getAdminOverview(),
    getAdminRequests({ take: 8, skip: 0 }),
  ]);

  return (
    <div className="mt-6 space-y-6">
      <OverviewTiles overview={overview} />
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Requests</h2>
          <Link
            href="/audits/admin/requests"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            View all with filters
          </Link>
        </div>
        <RequestsTable rows={requests} />
      </div>
    </div>
  );
}
