"use client";

import { Check } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DEPLOYMENT_TARGET_LABELS, URGENCY_LABELS } from "@/lib/audits/constants";
import { MONO_LABEL } from "@/components/audits/shared/classes";
import { CHECK_POP } from "@/components/audits/shared/motion";
import { formatIsoDate, lowerFirst } from "@/components/audits/shared/format";
import { FanoutNoticeCard } from "@/components/audits/shared/FanoutNoticeCard";
import { useAuditWizard } from "@/components/audits/wizard/AuditWizardContext";
import type { AuditWizardValues } from "@/components/audits/wizard/types";

function summaryLines(values: AuditWizardValues): { label: string; line: string; step: number }[] {
  const target = values.deployment_target
    ? DEPLOYMENT_TARGET_LABELS[values.deployment_target]
    : "No deployment target";
  const projectParts = [values.project_name || "Untitled request", target];
  if (values.project_types.length > 0) projectParts.push(values.project_types.join(", "));

  const repoCount = values.repos.filter((repo) => repo.url.trim() !== "").length;
  const scopeParts = [
    values.services.length > 0
      ? `${values.services[0]}${values.services.length > 1 ? ` +${values.services.length - 1}` : ""}`
      : "No services picked",
  ];
  if (repoCount > 0) scopeParts.push(`${repoCount} ${repoCount === 1 ? "repo" : "repos"} pinned`);
  if (values.nsloc.trim() !== "") scopeParts.push(`~${values.nsloc} nSLOC`);
  if (values.frameworks.length > 0) scopeParts.push(values.frameworks.join(", "));

  const timelineParts = [
    values.needed_by ? `needed by ${formatIsoDate(values.needed_by)}` : "no needed-by date",
    values.quote_deadline
      ? `quotes close ${formatIsoDate(values.quote_deadline)}`
      : "no quote deadline",
  ];
  if (values.urgency) timelineParts.push(lowerFirst(URGENCY_LABELS[values.urgency]));

  return [
    { label: "01 · Project", line: projectParts.join(" · "), step: 0 },
    { label: "02 · Scope", line: scopeParts.join(" · "), step: 1 },
    { label: "03 · Timeline", line: timelineParts.join(" · "), step: 2 },
  ];
}

export function StepReview() {
  const form = useFormContext<AuditWizardValues>();
  const { setStep, consent, setConsent } = useAuditWizard();
  const values = form.watch();

  return (
    <div className="space-y-6">
      {/* Contacts pair like every other step's field pairs (board 1c). */}
      <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
        <FormField
          control={form.control}
          name="contact_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Contact name <span className="text-brand">*</span>
              </FormLabel>
              <FormControl>
                <Input {...field} autoComplete="name" className="h-11 md:h-10" />
              </FormControl>
              <FormDescription>Who the winning firm will reach out to.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Contact email <span className="text-brand">*</span>
              </FormLabel>
              <FormControl>
                <Input {...field} inputMode="email" autoComplete="email" className="h-11 md:h-10" />
              </FormControl>
              <FormDescription>Pre-filled from your Builder Hub account.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
        <FormField
          control={form.control}
          name="contact_handle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Telegram <span className="font-normal text-muted-foreground">· optional</span>
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder="@handle" className="h-11 md:h-10" />
              </FormControl>
              <FormDescription>For quick questions during the audit.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contact_calendar_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Calendar link <span className="font-normal text-muted-foreground">· optional</span>
              </FormLabel>
              <FormControl>
                <Input {...field} inputMode="url" placeholder="cal.com/you" className="h-11 md:h-10" />
              </FormControl>
              <FormDescription>Lets the winning firm book a kickoff call directly.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Completed-step receipt rows: check circle + wash + underlined Edit (board 1c). */}
      <div className="space-y-2">
        {summaryLines(values).map((row, index) => (
          <div
            key={row.label}
            className="flex items-start gap-3 rounded-[10px] border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <span
              className={cn(
                CHECK_POP,
                "mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white fill-mode-backwards dark:bg-zinc-100 dark:text-zinc-900",
              )}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <Check aria-hidden className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={MONO_LABEL}>{row.label}</p>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">
                {row.line}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(row.step)}
              className="shrink-0 cursor-pointer text-sm text-zinc-600 underline underline-offset-2 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      <FanoutNoticeCard />

      {/* The consent gate. Placeholder wording until Legal supplies the final
          text; the timestamp is stamped server-side at submission. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 dark:border-white/10">
        <Checkbox
          checked={consent}
          onCheckedChange={(next) => setConsent(next === true)}
          className="mt-0.5"
          aria-describedby="consent-copy"
        />
        <span id="consent-copy" className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          I understand that my contact details in this request are shared with the vetted audit
          firms on the Ava Labs whitelist, and with the winning firm once I accept a quote.
        </span>
      </label>
    </div>
  );
}
