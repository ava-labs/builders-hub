import type { AdminRequestDetail } from "@/server/services/audits/visibility";
import { formatUsd } from "@/components/audits/shared/format";

type TrailEvent = AdminRequestDetail["events"][number];

function metaOf(event: TrailEvent): Record<string, unknown> {
  return event.meta && typeof event.meta === "object" && !Array.isArray(event.meta)
    ? (event.meta as Record<string, unknown>)
    : {};
}

function eventLine(event: TrailEvent): string {
  const meta = metaOf(event);
  const firm = typeof meta.firm_name === "string" ? meta.firm_name : null;
  const price = typeof meta.price_usd === "number" ? formatUsd(meta.price_usd) : null;
  const admin = typeof meta.admin_name === "string" ? meta.admin_name : null;

  switch (event.action) {
    case "request_submitted":
      return `Request submitted${typeof meta.project_name === "string" ? ` by ${meta.project_name}` : ""}`;
    case "fanout_created":
      return `Fanned out to ${typeof meta.auditor_count === "number" ? meta.auditor_count : "all"} whitelisted firms`;
    case "quote_submitted":
      return ["Quote submitted", firm, price].filter(Boolean).join(" · ");
    case "quote_updated":
      return ["Quote updated", firm, price].filter(Boolean).join(" · ");
    case "quote_accepted":
      return ["Quote accepted", firm, price].filter(Boolean).join(" · ");
    case "contacts_revealed":
      return "Contacts revealed both ways";
    case "subsidy_approved":
      return ["Subsidy approved", `${typeof meta.pct === "number" ? meta.pct : "?"}%`, admin ? `by ${admin}` : null]
        .filter(Boolean)
        .join(" · ");
    case "subsidy_declined":
      return ["Subsidy declined", admin ? `by ${admin}` : null].filter(Boolean).join(" · ");
    case "request_withdrawn":
      return "Request withdrawn by the project";
    case "request_reopened":
      return "Request reopened for one more round";
    default:
      return event.action.replaceAll("_", " ");
  }
}

const stamp = (date: Date) => {
  const iso = new Date(date).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
};

/** The audit trail admins rely on instead of pings (design 1b). */
export function ActivityTrail({ events }: { events: AdminRequestDetail["events"] }) {
  return (
    <section>
      <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        Activity · the audit trail admins rely on instead of pings
      </h2>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Nothing yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5 border-l border-zinc-200 pl-4 dark:border-white/10">
          {events.map((event) => (
            <li key={event.id} className="text-sm">
              <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                {stamp(event.created_at)}
              </span>{" "}
              <span className="text-zinc-700 dark:text-zinc-300">{eventLine(event)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
