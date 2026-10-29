import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RWA_INCIDENT, RWA_INCIDENT_BANNER } from "@/lib/rwa/constants/incident";
import { truncate } from "@/components/explorer-v2/format";

/* The incident banner at the top of the RWA dashboard. It tells the reader
   not to deposit into the drained tranche pool, on that pool's facility page
   only. The flag in lib/rwa/constants/incident.ts turns it off. */
export function RwaIncidentBanner({ facilityPool }: { facilityPool: string }) {
  if (!RWA_INCIDENT_BANNER || facilityPool.toLowerCase() !== RWA_INCIDENT.pool.toLowerCase()) return null;
  const { title, date, pool } = RWA_INCIDENT;
  return (
    <Alert variant="destructive" className="border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">
      <TriangleAlert />
      <AlertTitle className="line-clamp-none font-semibold">{title}</AlertTitle>
      <AlertDescription className="text-red-700/90 dark:text-red-300/90">
        <p>
          On {date}, an exploit drained funds from the tranche pool at{" "}
          <a
            href={`https://snowtrace.io/address/${pool}`}
            target="_blank"
            rel="noopener noreferrer"
            title={pool}
            className="font-mono underline underline-offset-2"
          >
            {truncate(pool, 6)}
          </a>
          . Do not deposit into this pool. The facility administrator is investigating. This page shows historical data only.
        </p>
      </AlertDescription>
    </Alert>
  );
}
