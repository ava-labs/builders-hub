"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, FOCUS, MONO_LABEL } from "../ui";

/* The one save of the page: it shows only while the form has edits, and
   nothing saves until the user presses Save. Rendered only when needed, so
   no hidden button stays in the tab order. A failed save shows its message
   in the bar, next to the buttons, where no toast can cover them. */
export function SaveBar({
  saving,
  error,
  onSave,
  onDiscard,
  onReview,
}: {
  saving?: boolean;
  /** why the last save failed; the caller clears it */
  error?: string | null;
  onSave: () => void;
  onDiscard: () => void;
  /** on a section without the edited fields: go back to them */
  onReview?: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      data-savebar=""
      className="sticky bottom-4 z-30 mt-8 flex flex-wrap items-center justify-between gap-3 border border-zinc-900 bg-white/95 px-4 py-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)] backdrop-blur-[12px] sm:px-5 dark:border-zinc-100 dark:bg-zinc-950/95"
    >
      <p className="flex items-center gap-2.5 text-[14px] text-zinc-900 dark:text-zinc-100">
        <span aria-hidden className="h-2 w-2 shrink-0 bg-[#E6212F]" />
        <span>
          <span className="font-medium">Unsaved changes.</span>{" "}
          {onReview ? (
            <button
              type="button"
              onClick={onReview}
              className={cn("text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100", FOCUS)}
            >
              Review them
            </button>
          ) : (
            <span className={cn(MONO_LABEL, "hidden text-zinc-500 sm:inline dark:text-zinc-400")}>Not saved yet</span>
          )}
        </span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button variant="primary" onClick={onSave} busy={saving}>
          {saving ? "Saving" : "Save"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="basis-full text-[13px] text-[#E6212F] dark:text-[#FF394A]">
          {error}
        </p>
      )}
    </div>
  );
}
