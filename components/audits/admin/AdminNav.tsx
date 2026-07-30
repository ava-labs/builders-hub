"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/audits/admin", label: "Overview", exact: true },
  { href: "/audits/admin/requests", label: "Requests", exact: false },
  { href: "/audits/admin/auditors", label: "Auditors", exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Audit program sections"
      className="mt-5 flex gap-1 border-b border-zinc-200 dark:border-white/10"
    >
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-11 items-center border-b-2 px-3.5 text-sm md:h-10",
              active
                ? "border-brand font-semibold text-zinc-950 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
