"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export interface MiniGrantApplicationItem {
  id: string;
  projectId: string;
  projectName: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_CLASS: Record<string, string> = {
  submitted: "bg-secondary text-secondary-foreground",
  under_review: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_CLASS[status] ?? "bg-secondary text-secondary-foreground"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/**
 * Lists the signed-in user's Team1 Mini Grants applications. Renders nothing when
 * logged out or when the user has no applications yet.
 */
export function MiniGrantApplications({ className = "" }: { className?: string }) {
  const { status } = useSession();
  const [apps, setApps] = useState<MiniGrantApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch("/api/grants/team1-mini-grants/applications")
      .then((r) => (r.ok ? r.json() : { applications: [] }))
      .then((d) => {
        if (!cancelled) setApps(d.applications ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status !== "authenticated" || loading || apps.length === 0) return null;

  return (
    <section className={`mx-auto max-w-3xl ${className}`}>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Your applications</h2>
      <ul className="space-y-3">
        {apps.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
          >
            <span className="font-medium text-foreground">{a.projectName}</span>
            {/* Status hidden for now — unhide by uncommenting the line below */}
            {/* <StatusBadge status={a.status} /> */}
          </li>
        ))}
      </ul>
    </section>
  );
}
