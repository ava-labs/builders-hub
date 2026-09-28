"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    href: "/audits/portal",
    label: "Inbox",
    isActive: (pathname: string) =>
      pathname === "/audits/portal" || pathname.startsWith("/audits/portal/requests"),
  },
  {
    href: "/audits/portal/firm",
    label: "Firm details",
    isActive: (pathname: string) => pathname.startsWith("/audits/portal/firm"),
  },
];

function awaitingTitle(count: number) {
  return count === 1 ? "1 request awaiting your quote" : `${count} requests awaiting your quote`;
}

/**
 * Second row of the portal bar, the AdminNav recipe: the portal's two pages
 * by name, active one underlined in brand. The count on Inbox is the
 * awaiting-quote bucket, the one standing signal that a quote is due.
 */
export function PortalNav({ awaitingCount }: { awaitingCount: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Auditor portal sections"
      className="mx-auto flex w-full max-w-[1040px] gap-1 px-4"
    >
      {ITEMS.map((item) => {
        const active = item.isActive(pathname);
        const count = item.label === "Inbox" && awaitingCount > 0 ? awaitingCount : null;
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
                className="font-mono text-[10.5px] font-semibold text-brand-deep dark:text-brand-soft"
                title={awaitingTitle(count)}
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
