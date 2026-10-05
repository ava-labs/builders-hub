"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { FOCUS, MONO_LABEL, scrollBehavior } from "../ui";

/* ------------------------------------------------------------------ */
/* The profile's sections. Each one is a page of grouped rows; the URL  */
/* names it (?tab=), so a link can open any section and Back works.     */
/* The ids personal, projects, achievements, insights and notifications */
/* are kept: other pages link to them.                                  */
/* ------------------------------------------------------------------ */

export type SectionId =
  | "personal"
  | "accounts"
  | "referrals"
  | "settings"
  | "projects"
  | "achievements"
  | "console"
  | "query"
  | "alerts"
  | "insights"
  | "notifications";

export type SectionGroup = "Account" | "Activity" | "Team";

export interface SectionSpec {
  id: SectionId;
  label: string;
  group: SectionGroup;
  /** a count in the list, when it says something */
  count?: number | null;
}

export const SECTION_GROUPS: ReadonlyArray<SectionGroup> = ["Account", "Activity", "Team"];

export function sectionHref(id: SectionId): string {
  return id === "personal" ? "/profile" : `/profile?tab=${id}`;
}

/* ------------------------------------------------------------------ */
/* Avatar: the generated avatar, else the photo, else the initials, in  */
/* the site's square chrome.                                            */
export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  imageUrl,
  size,
  className,
}: {
  name: string;
  imageUrl: string | null;
  size: number;
  className?: string;
}) {
  const src = imageUrl;
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-zinc-200 bg-zinc-50 font-mono font-bold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
    >
      {src ? (
        <Image src={src} alt="" width={size} height={size} unoptimized className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The section tabs on a phone and a tablet: one row in the page, not   */
/* a bar, so the profile reads as one page. The side list takes over    */
/* from lg. role, not <nav>: the global nav underline (!important)      */
/* hides the focus ring.                                                */
export function ProfileTabs({
  sections,
  active,
  onSelect,
}: {
  sections: ReadonlyArray<SectionSpec>;
  active: SectionId;
  onSelect: (id: SectionId, e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const tabsRef = React.useRef<HTMLDivElement>(null);

  // keep the active tab in view, where the row scrolls
  React.useEffect(() => {
    const row = tabsRef.current;
    const tab = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    const left = tab.offsetLeft - row.clientWidth / 2 + tab.clientWidth / 2;
    row.scrollTo({ left, behavior: scrollBehavior() });
  }, [active]);

  return (
    <div
      ref={tabsRef}
      role="navigation"
      aria-label="Profile sections"
      className="scrollbar-hide -mx-5 mb-8 flex items-stretch gap-x-4 overflow-x-auto border-b border-zinc-200 px-5 md:-mx-6 md:gap-x-5 md:px-6 lg:hidden dark:border-zinc-800"
    >
      {sections.map((s) => {
        const on = s.id === active;
        return (
          <Link
            key={s.id}
            href={sectionHref(s.id)}
            onClick={(e) => onSelect(s.id, e)}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center whitespace-nowrap py-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors",
              on
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              FOCUS,
              // the row scrolls, so its box clips a ring drawn outside the tab
              "focus-visible:ring-inset focus-visible:ring-offset-0",
            )}
          >
            {s.label}
            {on && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#E6212F]" />}
          </Link>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The side list (lg and up): who you are, then the sections by group.  */
export function ProfileRail({
  sections,
  active,
  onSelect,
  identity,
}: {
  sections: ReadonlyArray<SectionSpec>;
  active: SectionId;
  onSelect: (id: SectionId, e: React.MouseEvent<HTMLAnchorElement>) => void;
  identity: React.ReactNode;
}) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-[calc(var(--fd-banner-height,0px)+3.5rem+2.5rem)]">
        {identity}
        {/* role, not <nav>: the site's global nav rules (padding, the red
            underline on aria-current) are for the top bars, not this list */}
        <div role="navigation" aria-label="Profile sections" className="mt-8 flex flex-col gap-6">
          {SECTION_GROUPS.map((group) => {
            const items = sections.filter((s) => s.group === group);
            if (!items.length) return null;
            return (
              <div key={group}>
                <p className={cn(MONO_LABEL, "mb-2 px-3 text-zinc-500 dark:text-zinc-400")}>{group}</p>
                <ul className="m-0 flex list-none flex-col p-0">
                  {items.map((s) => {
                    const on = s.id === active;
                    return (
                      <li key={s.id}>
                        <Link
                          href={sectionHref(s.id)}
                          onClick={(e) => onSelect(s.id, e)}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "relative flex h-9 items-center justify-between gap-3 px-3 text-[14px] transition-colors",
                            on
                              ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100",
                            FOCUS,
                          )}
                        >
                          {on && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-[#E6212F]" />}
                          <span className="truncate">{s.label}</span>
                          {typeof s.count === "number" && s.count > 0 && (
                            <span
                              className={cn(
                                "font-mono text-[11px] tabular-nums dark:text-zinc-400",
                                on ? "text-zinc-600" : "text-zinc-500",
                              )}
                            >
                              {s.count.toLocaleString()}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Identity: avatar, name, handle and email. The rail shows it from lg;  */
/* a phone shows it over the section.                                   */
export function Identity({
  name,
  handle,
  email,
  imageUrl,
  teamLabel,
  completion,
  onJumpToNext,
  compact = false,
}: {
  name: string;
  handle: string;
  email: string;
  imageUrl: string | null;
  teamLabel: string | null;
  /** how much of the profile is filled, and the next step */
  completion: { pct: number; nextLabel: string | null };
  onJumpToNext?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex gap-3", compact ? "items-center" : "flex-col")}>
      <Avatar name={name} imageUrl={imageUrl} size={compact ? 44 : 64} />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium text-zinc-900 dark:text-zinc-50">{name || "Your name"}</p>
        <p className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          {handle ? `@${handle}` : email}
        </p>
        {!compact && handle && (
          <p className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{email}</p>
        )}
        {teamLabel && (
          <p className={cn(MONO_LABEL, "mt-2 text-[#E6212F] dark:text-[#FF394A]")}>Team {teamLabel}</p>
        )}
      </div>
      {!compact && completion.pct < 100 && (
        <div className="mt-1 w-full">
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn(MONO_LABEL, "text-zinc-500 dark:text-zinc-400")}>Profile</span>
            <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{completion.pct}%</span>
          </div>
          <div
            className="mt-1.5 h-[3px] w-full bg-zinc-200 dark:bg-zinc-800"
            role="progressbar"
            aria-label="Profile filled in"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completion.pct}
          >
            <div className="h-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${completion.pct}%` }} />
          </div>
          {completion.nextLabel && onJumpToNext && (
            <button
              type="button"
              onClick={onJumpToNext}
              className={cn(
                "mt-2 text-left text-[12px] text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100",
                FOCUS,
              )}
            >
              Next: {completion.nextLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
