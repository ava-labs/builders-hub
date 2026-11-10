"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LINE = "text-xs text-zinc-500 dark:text-zinc-400";
const LINK =
  "cursor-pointer text-left text-xs text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

/**
 * One person's GitHub username, shown next to that person. Read-only unless
 * the caller passes onSave, which the portal firm page does for the signed-in
 * person's own entry only (each person edits their own); the whitelist sheet
 * never does. onSave returns the stored value or throws a message to show.
 */
export function GithubUsername({
  value,
  onSave,
  className,
}: {
  value: string | null;
  onSave?: (draft: string) => Promise<string | null>;
  className?: string;
}) {
  const [saved, setSaved] = useState(value);
  // null while not editing; the input's text while editing.
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const shown = onSave ? saved : value;
  // Truthiness, not null: a teammate just added on the page has no field yet.
  const name = shown ? (
    <>
      GitHub · <span className="font-mono">{shown}</span>
    </>
  ) : null;

  if (!onSave) {
    return <p className={cn(LINE, className)}>{name ?? "No GitHub username yet"}</p>;
  }

  if (draft === null) {
    return (
      <p className={cn(LINE, className)}>
        {name ? (
          <>
            {name}
            <button
              type="button"
              onClick={() => setDraft(saved ?? "")}
              aria-label="Edit your GitHub username"
              className={cn(LINK, "ml-2")}
            >
              Edit
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setDraft("")} className={LINK}>
            Add your GitHub username
          </button>
        )}
      </p>
    );
  }

  const save = async () => {
    setBusy(true);
    try {
      setSaved(await onSave(draft));
      setDraft(null);
      toast.success("Saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={cn("mt-1.5 flex flex-wrap items-center gap-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {/* Mounted by the person's own click on Edit or Add, so focus follows it. */}
      <Input
        aria-label="Your GitHub username"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={busy}
        placeholder="github-username"
        autoFocus
        className="h-8 min-w-40 flex-1 font-mono text-[13px] sm:w-56 sm:flex-none"
      />
      {/* One unit, so a narrow row wraps both under the input together. */}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setDraft(null)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
