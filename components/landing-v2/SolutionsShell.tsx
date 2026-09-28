"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import ConsoleBar from "@/components/landing-v2/ConsoleBar";
import { PILLARS } from "@/components/landing-v2/pillars";

/* ------------------------------------------------------------------ */
/* Solutions shell: the explorer's chrome grammar for /solutions       */
/*                                                                      */
/* Same sheet column as NetworkShell (90rem, hairline edges past that   */
/* width) and the same sticky subnav spine: a scope label, a divider,   */
/* then one underline tab per surface. The index and the four pillars   */
/* read as one sectioned product, like the explorer's network facets.   */
/* ------------------------------------------------------------------ */

const TABS = [
  { label: "Overview", href: "/solutions" },
  ...PILLARS.map((p) => ({ label: p.label, href: `/solutions/${p.slug}` })),
];

export default function SolutionsShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto min-h-screen w-full max-w-[90rem] border-x border-transparent bg-white px-5 pb-24 pt-10 md:px-6 min-[90rem]:border-zinc-200/90 dark:bg-zinc-950 dark:min-[90rem]:border-zinc-800/90">
        <SolutionsSubnav className="mb-6" />
        {children}
      </div>
      <ConsoleBar />
    </main>
  );
}

function SolutionsSubnav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    // sticky just below the global navbar, the same offsets and layers as
    // ExplorerSubnav so the two products pin identically
    <div
      className={cn(
        "sticky top-[calc(var(--fd-banner-height,0px)+3.5rem)] z-[35] -mx-5 flex items-stretch justify-between gap-x-4 border-b border-zinc-200 bg-white/85 px-5 backdrop-blur-[12px] md:-mx-6 md:px-6 dark:border-zinc-800 dark:bg-zinc-950/85",
        className,
      )}
    >
      <div className="flex min-w-0 items-stretch gap-x-3 sm:gap-x-4 md:gap-x-5">
        <Link href="/solutions" className="flex shrink-0 items-center gap-2.5">
          <AvalancheLogo className="h-5 w-5 shrink-0 text-zinc-900 dark:text-zinc-100 [&_path]:fill-current" />
          <span className="hidden font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900 sm:block dark:text-zinc-100">
            Solutions
          </span>
        </Link>
        <div className="my-3.5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800" />
        <nav
          aria-label="Solutions sections"
          className="scrollbar-hide flex items-stretch gap-x-3 overflow-x-auto sm:gap-x-4 md:gap-x-5"
        >
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors",
                  active
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100",
                )}
              >
                {tab.label}
                {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#E6212F]" />}
              </Link>
            );
          })}
        </nav>
      </div>
      {/* the rail's one action, set like the explorer's network control */}
      <Link
        href="/console"
        className="group hidden shrink-0 items-center gap-2 self-center border border-zinc-200 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-900 transition-colors hover:border-zinc-900 sm:inline-flex dark:border-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-100"
      >
        Console
        <ArrowRight className="h-3 w-3 text-[#E6212F] transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
