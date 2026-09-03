"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MONO_LABEL_SM } from "@/components/audits/shared/classes";

/**
 * The firm's pitch, typeset like it decides something (round-5 Q5-3): mono
 * micro-label, near-ink body behind a quiet left rule, clamped at six lines.
 *
 * The toggle earns its place only when the clamp actually hides a line AT THE
 * CURRENT WIDTH, so it is driven by measurement (scrollHeight vs clientHeight,
 * re-checked on resize), not by a character count. A count cannot know line
 * math: the same 470-character message is seven lines on a phone and exactly
 * six on desktop, which shipped a "Show full message" with nothing to show
 * (preview find, 2026-08-06). Server-side the toggle never renders; the mount
 * measurement adds it, so hydration always matches.
 */
export function QuoteMessage({ message }: { message: string }) {
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    if (expanded) return;
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, message]);

  return (
    <div className="mt-3 border-l-2 border-zinc-200 pl-3.5 dark:border-white/15">
      <p className={MONO_LABEL_SM}>Their message</p>
      <p
        ref={bodyRef}
        className={cn(
          // break-words: an unbroken run (a pasted URL, "aaaa…") must wrap
          // inside the card instead of painting across the page.
          "mt-1 max-w-[78ch] break-words text-sm leading-[1.65] text-zinc-800 dark:text-zinc-200",
          !expanded && "line-clamp-6",
        )}
      >
        {message}
      </p>
      {clipped || expanded ? (
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
