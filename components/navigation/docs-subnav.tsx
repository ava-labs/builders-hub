"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const tabs = [
  {
    label: "General",
    href: "/docs/primary-network",
    pathMatch: (path: string) =>
      path === "/docs/primary-network" ||
      path === "/docs" ||
      (path.startsWith("/docs/") &&
        !path.startsWith("/docs/api-reference") &&
        !path.startsWith("/docs/rpcs") &&
        !path.startsWith("/docs/tooling") &&
        !path.startsWith("/docs/acps")),
  },
  {
    label: "Node RPCs",
    href: "/docs/rpcs/c-chain",
    pathMatch: (path: string) => path.startsWith("/docs/rpcs"),
  },
  {
    label: "Data APIs",
    href: "/docs/api-reference/data-api",
    pathMatch: (path: string) => path.startsWith("/docs/api-reference"),
  },
  {
    label: "Developer Tools",
    href: "/docs/tooling/avalanche-sdk",
    pathMatch: (path: string) => path.startsWith("/docs/tooling"),
  },
  {
    label: "ACPs",
    href: "/docs/acps",
    pathMatch: (path: string) => path.startsWith("/docs/acps"),
  },
];

export function DocsSubNav() {
  const pathname = usePathname();

  return (
    <div
      className="fixed top-14 z-[30] w-full border-b border-border bg-background"
      id="docs-subnav"
    >
      <div className="flex h-12 items-center gap-1 lg:gap-2 overflow-x-auto relative px-4 md:pl-16 md:pr-4 justify-center md:justify-start">
        {tabs.map((tab) => {
          const isActive = tab.pathMatch(pathname);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-active={isActive ? "true" : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "text-sm font-medium whitespace-nowrap rounded-md px-3 py-2 transition-all docs-subnav-link",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
