"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/audits/shared/Stepper";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { STEP_ENTER_BACK, STEP_ENTER_FWD } from "@/components/audits/shared/motion";
import {
  AuditWizardProvider,
  useAuditWizard,
} from "@/components/audits/wizard/AuditWizardContext";
import { WizardHeader } from "@/components/audits/wizard/WizardHeader";
import { StepProject } from "@/components/audits/wizard/StepProject";
import { StepScope } from "@/components/audits/wizard/StepScope";
import { StepTimeline } from "@/components/audits/wizard/StepTimeline";
import { StepReview } from "@/components/audits/wizard/StepReview";
import { WIZARD_STEPS, type AuditWizardValues } from "@/components/audits/wizard/types";

const CONTINUE_LABELS = ["Continue to scope", "Continue to timeline", "Continue to review"];

const STEP_TITLES = [
  "Project information",
  "What should auditors look at?",
  "Timeline",
  "Contact & review",
];

const STEP_SUBLINES: (string | null)[] = [
  null,
  "Scope quality is the biggest driver of quote accuracy · nSLOC most of all.",
  null,
  null,
];

function WizardBody({ importProjectId }: { importProjectId: string | null }) {
  const { step, setStep, goNext, goBack, saveDraftNow, submit, submitting, consent } =
    useAuditWizard();

  // Direction for the step entrance: compare against the last committed step.
  const prevStepRef = useRef(step);
  const enterClass = step >= prevStepRef.current ? STEP_ENTER_FWD : STEP_ENTER_BACK;
  useEffect(() => {
    prevStepRef.current = step;
  }, [step]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <WizardHeader />

      <form onSubmit={(event) => event.preventDefault()} noValidate className="mt-6">
        <div className={cn(CARD, "overflow-hidden")}>
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-white/10 sm:px-6">
            <Stepper steps={WIZARD_STEPS} current={step} onJumpBack={setStep} />
          </div>

          <div className="mx-auto w-full max-w-[820px] px-5 py-6 sm:px-6 sm:py-7">
            <div key={step} className={enterClass}>
              <div className="mb-6">
                <p className={MONO_LABEL_SM}>
                  Step {step + 1} of {WIZARD_STEPS.length}
                </p>
                <h2 className="mt-1 text-lg font-semibold">{STEP_TITLES[step]}</h2>
                {STEP_SUBLINES[step] ? (
                  <p className="mt-1 text-sm text-muted-foreground">{STEP_SUBLINES[step]}</p>
                ) : null}
              </div>

              {step === 0 && <StepProject importProjectId={importProjectId} />}
              {step === 1 && <StepScope />}
              {step === 2 && <StepTimeline />}
              {step === 3 && <StepReview />}
            </div>

            {/* Spacer so the mobile fixed action bar never covers the last field. */}
            <div aria-hidden className="h-16 md:hidden" />
            {/* Primary action at thumb reach on mobile (board 1k); in-card footer from md up. */}
            <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-zinc-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-white/10 dark:bg-[#1F1F1F]/95 md:static md:mt-7 md:flex-wrap md:bg-transparent md:px-0 md:pb-0 md:pt-5 md:backdrop-blur-none dark:md:bg-transparent">
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={goBack}>
                  Back
                </Button>
              ) : null}
              <p
                className={cn(
                  MONO_LABEL_SM,
                  "min-w-0 flex-1 leading-tight max-md:text-[9.5px] md:flex-none",
                )}
              >
                {step < WIZARD_STEPS.length - 1 ? (
                  "Nothing is sent until step 4"
                ) : (
                  <>
                    {/* The full sentence wraps four lines beside Submit at
                        375 (round-4 R4-C); mobile keeps the short claim. */}
                    <span className="sm:hidden">Free · no fees</span>
                    <span className="hidden sm:inline">
                      Free · no fees · subsidy reviewed after quotes arrive
                    </span>
                  </>
                )}
              </p>
              <span className="hidden flex-1 md:block" />
              {step < WIZARD_STEPS.length - 1 ? (
                <Button
                  type="button"
                  className="h-11 shrink-0 md:h-10"
                  onClick={() => void goNext()}
                >
                  {/* One label node: a second flex child would stack the
                      button's gap on top of the suffix's leading space. */}
                  <span>
                    Continue
                    <span className="hidden sm:inline">
                      {CONTINUE_LABELS[step].slice("Continue".length)}
                    </span>
                  </span>
                </Button>
              ) : (
                <div className="flex shrink-0 items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 max-[400px]:hidden md:h-10"
                    onClick={() => void saveDraftNow()}
                  >
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    // Consent is a precondition, not a warning: the server
                    // refuses a submission without it either way.
                    disabled={submitting || !consent}
                    onClick={() => void submit()}
                    className="audits-sweep h-11 bg-brand text-white md:h-10"
                  >
                    {submitting ? (
                      <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Submit request
                  </Button>
                </div>
              )}
            </div>
          </div>
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
