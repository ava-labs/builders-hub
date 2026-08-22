"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/audits/admin", label: "Overview", exact: true },
  { href: "/audits/admin/requests", label: "Requests", exact: false },
  { href: "/audits/admin/auditors", label: "Auditors", exact: false },
];

/** The dashboard is the feed (zero pings by design): the amber count on
 * Requests is the one standing signal that a decision is waiting. */
export function AdminNav({ needsApprovalCount = 0 }: { needsApprovalCount?: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Audit program sections"
      className="mt-5 flex gap-1 border-b border-zinc-200 dark:border-white/10"
    >
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const count = item.label === "Requests" && needsApprovalCount > 0 ? needsApprovalCount : null;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-11 items-center gap-1.5 border-b-2 px-3.5 text-sm md:h-10",
              active
                ? "border-brand font-semibold text-zinc-950 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {item.label}
            {count !== null ? (
              <span
                className="font-mono text-[10.5px] font-semibold text-amber-700 dark:text-amber-400"
                title={`${count} awaiting a subsidy decision`}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
