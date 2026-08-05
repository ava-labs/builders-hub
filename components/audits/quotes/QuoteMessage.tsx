"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { isLongMessage } from "@/components/audits/shared/format";

/**
 * The firm's pitch, typeset like it decides something (round-5 Q5-3): mono
 * micro-label, near-ink body behind a quiet left rule. Long messages clamp at
 * six lines with an inline toggle; the threshold is a character count so the
 * control renders identically on server and client. Shared by rows and cards
 * (V5-1), so the treatment cannot drift between views.
 */
export function QuoteMessage({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = isLongMessage(message);

  return (
    <div className="mt-3 border-l-2 border-zinc-200 pl-3.5 dark:border-white/15">
      <p className={MONO_LABEL_SM}>Their message</p>
      <p
        className={cn(
          // break-words: an unbroken run (a pasted URL, "aaaa…") must wrap
          // inside the card; expanding the clamp removes the overflow clip
          // that was hiding exactly that case (preview find, 2026-08-05).
          "mt-1 max-w-[78ch] break-words text-sm leading-[1.65] text-zinc-800 dark:text-zinc-200",
          long && !expanded && "line-clamp-6",
        )}
      >
        {message}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1.5 cursor-pointer text-[12.5px] font-semibold text-zinc-600 underline underline-offset-[3px] hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          {expanded ? "Show less" : "Show full message"}
        </button>
      ) : null}
    </div>
  );
}
