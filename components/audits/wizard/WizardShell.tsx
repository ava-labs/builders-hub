"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/audits/shared/Stepper";
import {
  AuditWizardProvider,
  useAuditWizard,
} from "@/components/audits/wizard/AuditWizardContext";
import { StepProject } from "@/components/audits/wizard/StepProject";
import { StepScope } from "@/components/audits/wizard/StepScope";
import { StepTimeline } from "@/components/audits/wizard/StepTimeline";
import { StepReview } from "@/components/audits/wizard/StepReview";
import { WIZARD_STEPS, type AuditWizardValues } from "@/components/audits/wizard/types";

const CONTINUE_LABELS = ["Continue to scope", "Continue to timeline", "Continue to review"];

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
    <p
      role="status"
      className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400"
    >
      {text}
    </p>
  );
}

function WizardBody({ importProjectId }: { importProjectId: string | null }) {
  const { step, setStep, goNext, goBack, saveDraftNow, saveAndExit, submit, submitting } =
    useAuditWizard();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          <Link href="/audits" className="hover:text-zinc-800 dark:hover:text-zinc-200">
            Audits
          </Link>{" "}
          / New request
        </p>
        <div className="flex items-center gap-3">
          <SaveIndicator />
          <Button type="button" variant="ghost" size="sm" onClick={() => void saveAndExit()}>
            <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
            Save &amp; exit
          </Button>
        </div>
      </div>

      <div className="mb-6 flex justify-center">
        <Stepper steps={WIZARD_STEPS} current={step} onJumpBack={setStep} />
      </div>

      <form onSubmit={(event) => event.preventDefault()} noValidate>
        <div className="space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8">
          {step === 0 && <StepProject importProjectId={importProjectId} />}
          {step === 1 && <StepScope />}
          {step === 2 && <StepTimeline />}
          {step === 3 && <StepReview />}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={goBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < WIZARD_STEPS.length - 1 ? (
            <Button type="button" className="h-11 md:h-10" onClick={() => void goNext()}>
              {CONTINUE_LABELS[step]}
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 md:h-10"
                onClick={() => void saveDraftNow()}
              >
                Save draft
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className="h-11 bg-brand text-white hover:bg-brand-deep md:h-10"
              >
                {submitting ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit request
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

export interface AuditWizardProps {
  initialDraft: { id: string; values: AuditWizardValues } | null;
  prefill: { contact_name: string; contact_email: string };
  importProjectId: string | null;
}

export function AuditWizard({ initialDraft, prefill, importProjectId }: AuditWizardProps) {
  return (
    <AuditWizardProvider initialDraft={initialDraft} prefill={prefill}>
      <WizardBody importProjectId={importProjectId} />
    </AuditWizardProvider>
  );
}
