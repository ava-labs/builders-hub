"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Form } from "@/components/ui/form";
import { zodResolver } from "@/lib/zodResolver";
import { auditSubmitSchema } from "@/types/audits";
import { useAutosave, type SaveState } from "@/components/audits/wizard/useAutosave";
import {
  FIELD_STEP,
  STEP_FIELDS,
  WIZARD_STEPS,
  wizardDefaults,
  type AuditWizardValues,
} from "@/components/audits/wizard/types";

interface AuditWizardContextValue {
  form: UseFormReturn<AuditWizardValues>;
  step: number;
  setStep: (step: number) => void;
  goNext: () => Promise<void>;
  goBack: () => void;
  saveState: SaveState;
  savedAt: Date | null;
  saveDraftNow: () => Promise<void>;
  /** Flush the draft, then leave for My requests. Nothing typed = just leave. */
  saveAndExit: () => Promise<void>;
  submit: () => Promise<void>;
  submitting: boolean;
  /** Step 4's consent checkbox, read by the shell to arm Submit. Deliberately
      NOT autosaved: consent is given at the moment of sending, so resuming a
      draft asks again. */
  consent: boolean;
  setConsent: (next: boolean) => void;
}

const AuditWizardContext = createContext<AuditWizardContextValue | null>(null);

export function useAuditWizard(): AuditWizardContextValue {
  const value = useContext(AuditWizardContext);
  if (!value) throw new Error("useAuditWizard must be used inside AuditWizardProvider");
  return value;
}

interface AuditWizardProviderProps {
  initialDraft: { id: string; values: AuditWizardValues } | null;
  prefill: { contact_name: string; contact_email: string };
  children: ReactNode;
}

export function AuditWizardProvider({ initialDraft, prefill, children }: AuditWizardProviderProps) {
  const router = useRouter();
  const [step, setStepState] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);

  const form = useForm<AuditWizardValues>({
    // The resolver carries the SUBMIT-level rules; steps only ever trigger
    // their own fields, so untouched steps never show errors early.
    resolver: zodResolver<AuditWizardValues>(auditSubmitSchema),
    defaultValues: initialDraft?.values ?? wizardDefaults(prefill),
    mode: "onBlur",
  });

  const { saveState, savedAt, flush, getDraftId } = useAutosave(form, {
    initialDraftId: initialDraft?.id ?? null,
  });

  const setStep = useCallback(
    (next: number) => {
      // Leaving a step flushes the pending autosave (design: jump-back edits).
      void flush();
      setStepState(Math.max(0, Math.min(WIZARD_STEPS.length - 1, next)));
    },
    [flush],
  );

  const goNext = useCallback(async () => {
    const valid = await form.trigger(STEP_FIELDS[step]);
    if (!valid) return;
    setStep(step + 1);
  }, [form, step, setStep]);

  const goBack = useCallback(() => setStep(step - 1), [setStep, step]);

  const saveDraftNow = useCallback(async () => {
    const id = await flush(true);
    if (id) toast.success("Draft saved. Find it under Drafts in My requests.");
    else toast.error("We couldn't save your draft. Check your session and try again.");
  }, [flush]);

  const saveAndExit = useCallback(async () => {
    // An untouched wizard has nothing worth keeping; leave quietly.
    if (!form.formState.isDirty && !initialDraft) {
      router.push("/audits");
      return;
    }
    const id = await flush(true);
    if (id) toast.success("Draft saved. Find it under Drafts in My requests.");
    else toast.error("We couldn't save your draft, but your session may have expired.");
    router.push("/audits");
  }, [flush, form, initialDraft, router]);

  const submit = useCallback(async () => {
    const valid = await form.trigger(STEP_FIELDS[3]);
    if (!valid) return;
    setSubmitting(true);
    try {
      const draftId = await flush(true);
      if (!draftId) {
        toast.error("We couldn't save your draft, so nothing was submitted.");
        return;
      }
      const res = await fetch(`/api/audits/requests/${draftId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The server refuses without it; the checkbox on step 4 is what sets it.
        body: JSON.stringify({ contact_consent: true }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        const errors = body?.errors as Record<string, string[] | undefined> | undefined;
        if (errors) {
          for (const [field, messages] of Object.entries(errors)) {
            if (!messages?.length || !(field in FIELD_STEP)) continue;
            form.setError(field as keyof AuditWizardValues, { message: messages[0] });
          }
          const firstBadStep = Object.keys(errors)
            .map((field) => FIELD_STEP[field])
            .filter((s) => s !== undefined)
            .sort((a, b) => a - b)[0];
          if (firstBadStep !== undefined) setStep(firstBadStep);
        }
        toast.error(body?.message ?? "We couldn't submit your request right now.");
        return;
      }
      router.push(`/audits/${draftId}?submitted=1`);
    } finally {
      setSubmitting(false);
    }
  }, [flush, form, router, setStep]);

  const value = useMemo(
    () => ({
      form,
      step,
      setStep,
      goNext,
      goBack,
      saveState,
      savedAt,
      saveDraftNow,
      saveAndExit,
      submit,
      submitting,
      consent,
      setConsent,
    }),
    [
      form,
      step,
      setStep,
      goNext,
      goBack,
      saveState,
      savedAt,
      saveDraftNow,
      saveAndExit,
      submit,
      submitting,
      consent,
    ],
  );

  return (
    <AuditWizardContext.Provider value={value}>
      <Form {...form}>{children}</Form>
    </AuditWizardContext.Provider>
  );
}
