"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  documentationOptions,
  apiReferenceOptions,
  nodesOptions,
  toolingOptions,
  acpsOptions,
} from "./docs-nav-config";

const tabs = [
  {
    label: "Network",
    href: "/docs/primary-network",
    items: documentationOptions,
    pathMatch: (path: string) =>
      path === "/docs/primary-network" ||
      path === "/docs" ||
      (path.startsWith("/docs/") &&
        !path.startsWith("/docs/api-reference") &&
        !path.startsWith("/docs/rpcs") &&
        !path.startsWith("/docs/nodes") &&
        !path.startsWith("/docs/tooling") &&
        !path.startsWith("/docs/acps")),
  },
  {
    label: "Nodes",
    href: "/docs/nodes",
    items: nodesOptions,
    pathMatch: (path: string) => path.startsWith("/docs/rpcs") || path.startsWith("/docs/nodes"),
  },
  {
    label: "APIs",
    href: "/docs/api-reference/data-api",
    items: apiReferenceOptions,
    pathMatch: (path: string) => path.startsWith("/docs/api-reference"),
  },
  {
    label: "Tools",
    href: "/docs/tooling/avalanche-sdk",
    items: toolingOptions,
    pathMatch: (path: string) => path.startsWith("/docs/tooling"),
  },
  {
    label: "ACPs",
    href: "/docs/acps",
    items: acpsOptions,
    pathMatch: (path: string) => path.startsWith("/docs/acps"),
  },
];

export function DocsSubNav() {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  return (
    <div
      className="fixed top-14 z-[30] w-full border-b border-border bg-background"
      id="docs-subnav"
    >
      <div className="flex h-12 items-center gap-1 lg:gap-2 overflow-x-auto relative pl-8 pr-4 md:pl-16 md:pr-4 justify-start">
        {tabs.map((tab) => {
          const isActive = tab.pathMatch(pathname);
          const hasItems = tab.items && tab.items.length > 0;

          // Only show chevron if has items AND NOT mobile
          const showChevron = hasItems && !isMobile;

          const LinkContent = (
            <span className="flex items-center gap-1">
              {tab.label}
              {showChevron && (
                <ChevronDown
                  className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180"
                />
              )}
            </span>
          );

          const LinkElement = (
            <Link
              key={tab.href}
              href={tab.href}
              data-active={isActive ? "true" : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "text-sm font-medium whitespace-nowrap rounded-md px-3 py-2 transition-all docs-subnav-link group",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {LinkContent}
            </Link>
          );

          // If mobile, or no items, just render the link without hover card
          if (hasItems && !isMobile) {
            return (
              <HoverCard key={tab.href} openDelay={100} closeDelay={200}>
                <HoverCardTrigger asChild>
                  {LinkElement}
                </HoverCardTrigger>
                <HoverCardContent className="w-80" align="start">
                  <div className="grid gap-2">
                    {tab.items?.map((item) => (
                      <Link
                        key={item.url}
                        href={item.url}
                        className="flex items-start gap-2 rounded-md p-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <div className="mt-0.5 text-muted-foreground">
                          {item.icon}
                        </div>
                        <div className="grid gap-0.5">
                          <p className="text-sm font-medium leading-none">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          }

          return LinkElement;
        })}
      </div>
    </div>
  );
}
