"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONO_LABEL } from "@/components/audits/shared/classes";
import { useAuditWizard } from "@/components/audits/wizard/AuditWizardContext";

function SaveIndicator() {
  const { saveState, savedAt } = useAuditWizard();
  if (saveState === "idle") return null;
  const text =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Save failed · retries on your next edit"
        : savedAt
          ? `Draft saved ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
          : "Draft saved";
  return (
    <p role="status" className={MONO_LABEL}>
      {text}
    </p>
  );
}

/** Page header block (design 1b evolved): the wizard finally gets a title. */
export function WizardHeader() {
  const { saveAndExit } = useAuditWizard();
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div>
        <p className={MONO_LABEL}>
          <Link href="/audits" className="hover:text-zinc-800 dark:hover:text-zinc-200">
            Audits
          </Link>{" "}
          / New request
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">New audit request</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-[#A2AFB2]">
          Goes to every whitelisted audit firm at once. Quotes come back privately · free, run by
          Ava Labs.
        </p>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <SaveIndicator />
        <Button type="button" variant="ghost" size="sm" onClick={() => void saveAndExit()}>
          <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
          Save &amp; exit
        </Button>
      </div>
    </div>
  );
}
