import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTopHackathonTrafficSources } from "@/server/services/hackathonTrafficSources";

interface TopTrafficSourcesCardProps {
  hackathonId: string;
  days?: number;
  limit?: number;
}

function formatPct(reached: number, visitors: number): string {
  if (!visitors) return "—";
  const pct = (reached / visitors) * 100;
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  return `${pct.toFixed(1)}%`;
}

export default async function TopTrafficSourcesCard({
  hackathonId,
  days = 90,
  limit = 3,
}: TopTrafficSourcesCardProps) {
  const sources = await getTopHackathonTrafficSources(hackathonId, {
    days,
    limit,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top traffic sources</CardTitle>
        <CardDescription>
          Where visitors came from in the last {days} days. Pulled from PostHog
          pageviews matched to this hackathon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No PostHog data yet. Sources will populate once visitors land on
            this hackathon and analytics are configured
            (<code>POSTHOG_PROJECT_ID</code> + <code>POSTHOG_PERSONAL_API_KEY</code>).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium">Visitors</th>
                  <th className="py-2 font-medium">→ Registration step</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((row) => (
                  <tr key={row.source} className="border-b border-zinc-900 last:border-0">
                    <td className="py-2 pr-4 font-medium">{row.source}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.visitors.toLocaleString()}
                    </td>
                    <td className="py-2 tabular-nums">
                      {row.reachedRegister.toLocaleString()}{" "}
                      <span className="text-muted-foreground">
                        ({formatPct(row.reachedRegister, row.visitors)})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
