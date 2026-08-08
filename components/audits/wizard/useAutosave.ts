"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toDraftPayload, type AuditWizardValues } from "@/components/audits/wizard/types";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Server-side draft autosave: watches the form, debounces 800ms, POSTs the
 * first save (creating the draft and pinning ?draft=<id> in the URL so a
 * reload resumes), PATCHes after. Unchanged payloads are skipped; a save
 * landing during another one queues exactly one follow-up. Failures surface
 * as "error" and retry on the next change; nothing is lost locally.
 */
export function useAutosave(
  form: UseFormReturn<AuditWizardValues>,
  options: { initialDraftId: string | null },
) {
  const [saveState, setSaveState] = useState<SaveState>(
    options.initialDraftId ? "saved" : "idle",
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const draftIdRef = useRef<string | null>(options.initialDraftId);
  const lastSavedRef = useRef<string | null>(null);
  const inflightRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A resumed draft starts in sync; don't re-save what was just loaded.
  // Runs once on mount by design (initial values only).
  useEffect(() => {
    if (draftIdRef.current) {
      lastSavedRef.current = JSON.stringify(toDraftPayload(form.getValues()));
    }
  }, [form]);

  const persist = useCallback(
    async (force = false): Promise<string | null> => {
      const json = JSON.stringify(toDraftPayload(form.getValues()));
      if (!force && json === lastSavedRef.current) return draftIdRef.current;
      if (inflightRef.current) {
        pendingRef.current = true;
        return draftIdRef.current;
      }
      inflightRef.current = true;
      setSaveState("saving");
      try {
        if (draftIdRef.current) {
          const res = await fetch(`/api/audits/requests/${draftIdRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: json,
          });
          if (!res.ok) throw new Error(`autosave ${res.status}`);
        } else {
          const res = await fetch("/api/audits/requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: json,
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data?.message ?? "draft create failed");
          draftIdRef.current = data.id as string;
          // Make a reload resume this draft without a server round-trip.
          window.history.replaceState(null, "", `/audits/new?draft=${data.id}`);
        }
        lastSavedRef.current = json;
        setSaveState("saved");
        setSavedAt(new Date());
      } catch {
        setSaveState("error");
      } finally {
        inflightRef.current = false;
        if (pendingRef.current) {
          pendingRef.current = false;
          void persist();
        }
      }
      return draftIdRef.current;
    },
    [form],
  );

  useEffect(() => {
    const subscription = form.watch(() => {
      // Never create an empty draft just from opening the page.
      if (!draftIdRef.current && !form.formState.isDirty) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void persist(), 800);
    });
    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [form, persist]);

  /** Immediate save; force creates the draft even when nothing changed yet. */
  const flush = useCallback(
    (force = false) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      return persist(force);
    },
    [persist],
  );

  return { saveState, savedAt, flush, getDraftId: () => draftIdRef.current };
}
