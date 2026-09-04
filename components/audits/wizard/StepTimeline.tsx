"use client";

import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { QUOTE_DEADLINE_HELPER_COPY, URGENCY_LABELS } from "@/lib/audits/constants";
import { URGENCY_OPTIONS } from "@/lib/audits/status";
import { ChipGroup } from "@/components/audits/shared/ChipGroup";
import { DateField } from "@/components/audits/wizard/fields/DateField";
import type { AuditWizardValues } from "@/components/audits/wizard/types";

const URGENCY_CHIPS = URGENCY_OPTIONS.map((value) => ({
  value,
  label: URGENCY_LABELS[value],
}));

export function StepTimeline() {
  const form = useFormContext<AuditWizardValues>();

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 md:grid-cols-2">
        <DateField
          control={form.control}
          name="needed_by"
          label="Needed by"
          required
          helper="The latest completion date for the audit."
        />

        <DateField
          control={form.control}
          name="quote_deadline"
          label="Quote deadline"
          required
          helper={QUOTE_DEADLINE_HELPER_COPY}
        />
      </div>

      <FormField
        control={form.control}
        name="urgency"
        render={({ field }) => (
          <FormItem>
            <FormLabel>How urgent is this?</FormLabel>
            <ChipGroup
              options={URGENCY_CHIPS}
              value={field.value ? [field.value] : []}
              onChange={(next) => field.onChange(next[0] ?? "")}
              aria-label="Urgency"
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
