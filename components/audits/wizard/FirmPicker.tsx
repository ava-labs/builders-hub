"use client";

import { useState } from "react";
import { Check, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicFirm } from "@/server/services/audits/visibility";
import { MONO_LABEL } from "@/components/audits/shared/classes";
import { ChipGroup } from "@/components/audits/shared/ChipGroup";

function warnLine(n: number) {
  return n === 1
    ? "Only 1 firm will see this request. If it doesn't quote by your deadline, the request expires and can be reopened once."
    : `Only ${n} firms will see this request. If neither quotes by your deadline, the request expires and can be reopened once.`;
}

type GroupState = "none" | "partial" | "all";

/**
 * A quick-pick chip that reflects its group's selection: outline when none of
 * the group is picked, dashed when some are, solid with a check when all are
 * (a tap then clears them). Without this the chip looked identical whether a
 * tap added or cleared the group.
 */
function QuickPickChip({
  label,
  count,
  state,
  onClick,
}: {
  label: string;
  count: number;
  state: GroupState;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={state === "all"}
      className={cn(
        "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors md:h-9",
        state === "all"
          ? "border border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : state === "partial"
            ? "border border-dashed border-zinc-400 text-zinc-700 dark:border-white/40 dark:text-zinc-200"
            : "border border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-white/20 dark:text-zinc-200 dark:hover:border-white/40",
      )}
    >
      {state === "all" ? <Check aria-hidden className="h-3 w-3" /> : null}
      {label} <span className="opacity-70">{count}</span>
    </button>
  );
}

/**
 * The request shortlist picker (variant A). Selection is opt-in: an empty
 * value means every active firm (the stored default). Names and counts come
 * from the firms present in the list, so an id that has since been deactivated
 * is neither counted nor named. Firms are never told they were chosen.
 */
export function FirmPicker({
  firms,
  neededServices,
  value,
  onChange,
  defaultOpen = false,
}: {
  firms: PublicFirm[];
  neededServices: string[];
  value: string[];
  onChange: (ids: string[]) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const total = firms.length;
  const chosen = firms.filter((f) => value.includes(f.id)); // resolved, in list order
  const n = chosen.length;
  const summaryNames =
    chosen
      .slice(0, 2)
      .map((f) => f.firm_name)
      .join(", ") + (chosen.length > 2 ? ` +${chosen.length - 2}` : "");
  const allGone = value.length > 0 && n === 0;

  const match = firms.filter(
    (f) => f.services.length > 0 && f.services.some((s) => neededServices.includes(s)),
  );
  const unlisted = firms.filter((f) => f.services.length === 0);
  const dayOne = unlisted.length === total; // every firm has empty services

  const setGroup = (group: PublicFirm[]) => {
    const ids = group.map((f) => f.id);
    const allOn = ids.every((id) => value.includes(id));
    onChange(
      allOn ? value.filter((id) => !ids.includes(id)) : Array.from(new Set([...value, ...ids])),
    );
  };

  const groupState = (group: PublicFirm[]): GroupState => {
    const ids = group.map((f) => f.id);
    if (ids.length === 0) return "none";
    const selected = ids.filter((id) => value.includes(id)).length;
    return selected === 0 ? "none" : selected === ids.length ? "all" : "partial";
  };

  if (!open) {
    return (
      <div className="rounded-[10px] border border-zinc-200 px-4 py-3 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full",
                n > 0
                  ? "border border-brand text-brand dark:border-[#FF394A] dark:text-brand-soft"
                  : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
              )}
            >
              <Check aria-hidden className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {allGone
                  ? `0 of ${total} vetted firms · the firms you chose are no longer listed`
                  : n > 0
                    ? `${n} of ${total} vetted firms · ${summaryNames}`
                    : `All ${total} vetted firms`}
              </p>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {n > 0 || allGone ? "" : "Default. Narrow it if only some firms interest you."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 cursor-pointer text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {n > 0 || allGone ? "Edit" : "Choose firms"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-zinc-200 p-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <p className={cn(MONO_LABEL, "!text-zinc-600 dark:!text-zinc-300")}>
          Who receives this request
        </p>
        <div className="flex items-center gap-3">
          {value.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="cursor-pointer text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Reset to all
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-pointer text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Done
          </button>
        </div>
      </div>

      {allGone ? (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          None of the firms you chose is still listed · reset to all or pick again
        </p>
      ) : dayOne ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Firms haven&apos;t listed their services yet · pick by name
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Quick pick">
          {match.length > 0 ? (
            <QuickPickChip
              label="Offering your services"
              count={match.length}
              state={groupState(match)}
              onClick={() => setGroup(match)}
            />
          ) : (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              No firm lists the services you need yet
            </span>
          )}
          {unlisted.length > 0 && unlisted.length < total ? (
            <QuickPickChip
              label="Services not listed"
              count={unlisted.length}
              state={groupState(unlisted)}
              onClick={() => setGroup(unlisted)}
            />
          ) : null}
        </div>
      )}

      <div className="mt-3">
        <ChipGroup
          multiple
          collapsible
          options={firms.map((f) => ({ value: f.id, label: f.firm_name }))}
          value={value}
          onChange={onChange}
          aria-label="Firms"
        />
      </div>

      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        {n > 0
          ? `${n} of ${total} firms receive this request`
          : `All ${total} firms receive this request · pick to narrow`}
      </p>
      {n > 0 && n < 3 ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{warnLine(n)}</p>
      ) : null}
      <p className="mt-3">
        <a
          href="/audits/firms"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          About these firms <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
        </a>
      </p>
    </div>
  );
}
