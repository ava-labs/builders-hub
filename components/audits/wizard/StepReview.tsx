"use client";

import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
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
import { formatIsoDate } from "@/components/audits/shared/format";
import { FanoutNoticeCard } from "@/components/audits/shared/FanoutNoticeCard";
import { useAuditWizard } from "@/components/audits/wizard/AuditWizardContext";
import type { AuditWizardValues } from "@/components/audits/wizard/types";

function summaryLines(values: AuditWizardValues): { label: string; line: string; step: number }[] {
  const target = values.deployment_target
    ? DEPLOYMENT_TARGET_LABELS[values.deployment_target]
    : "No deployment target";
  const projectParts = [values.project_name || "Untitled request", target];
  if (values.project_types.length > 0) projectParts.push(values.project_types.join(", "));

  const scopeParts = [
    values.services.length > 0
      ? `${values.services[0]}${values.services.length > 1 ? ` +${values.services.length - 1}` : ""}`
      : "No services picked",
    `${values.repos.filter((repo) => repo.url.trim() !== "").length} repos pinned`,
  ];
  if (values.nsloc.trim() !== "") scopeParts.push(`~${values.nsloc} nSLOC`);
  if (values.frameworks.length > 0) scopeParts.push(values.frameworks.join(", "));

  const timelineParts = [
    values.needed_by ? `needed by ${formatIsoDate(values.needed_by)}` : "no needed-by date",
    values.quote_deadline
      ? `quotes close ${formatIsoDate(values.quote_deadline)}`
      : "no quote deadline",
  ];
  if (values.urgency) timelineParts.push(URGENCY_LABELS[values.urgency]);

  return [
    { label: "01 · Project", line: projectParts.join(" · "), step: 0 },
    { label: "02 · Scope", line: scopeParts.join(" · "), step: 1 },
    { label: "03 · Timeline", line: timelineParts.join(" · "), step: 2 },
  ];
}

export function StepReview() {
  const form = useFormContext<AuditWizardValues>();
  const { setStep } = useAuditWizard();
  const values = form.watch();

  return (
    <div className="space-y-6">
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

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="contact_handle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Telegram or Slack{" "}
                <span className="font-normal text-muted-foreground">· optional</span>
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder="@handle" className="h-11 md:h-10" />
              </FormControl>
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
                <Input {...field} inputMode="url" placeholder="https://…" className="h-11 md:h-10" />
              </FormControl>
              <FormDescription>Lets the winning firm book a kickoff call directly.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-white/10">
        {summaryLines(values).map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {row.label}
              </p>
              <p className="mt-1 truncate text-sm">{row.line}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => setStep(row.step)}
            >
              Edit
            </Button>
          </div>
        ))}
      </div>

      <FanoutNoticeCard />
    </div>
  );
}
