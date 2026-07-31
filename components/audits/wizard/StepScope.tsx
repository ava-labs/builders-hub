"use client";

import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AUDIT_FRAMEWORKS, AUDIT_LANGUAGES, AUDIT_SERVICES } from "@/lib/audits/constants";
import { ChipGroup, asChips } from "@/components/audits/shared/ChipGroup";
import { RepoRepeater } from "@/components/audits/wizard/RepoRepeater";
import { MultiLinkInput } from "@/components/audits/wizard/MultiLinkInput";
import { AttachmentUploader } from "@/components/audits/wizard/AttachmentUploader";
import type { AuditWizardValues } from "@/components/audits/wizard/types";

export function StepScope() {
  const form = useFormContext<AuditWizardValues>();

  return (
    <div className="space-y-6">
      {/* Step title + subline render once in the card header (WizardShell). */}
      <FormField
        control={form.control}
        name="services"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Services needed <span className="text-brand">*</span>
            </FormLabel>
            <ChipGroup
              multiple
              collapsible
              options={asChips(AUDIT_SERVICES)}
              value={field.value}
              onChange={field.onChange}
              aria-label="Services needed"
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="scope"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Security service scope <span className="text-brand">*</span>
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                rows={4}
                placeholder="What should be audited, what matters most, what can be excluded."
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <RepoRepeater />

      <div className="grid items-start gap-6 md:grid-cols-2">
        <FormField
          control={form.control}
          name="languages"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Languages</FormLabel>
              <ChipGroup
                multiple
                options={asChips(AUDIT_LANGUAGES)}
                value={field.value}
                onChange={field.onChange}
                aria-label="Languages"
              />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="frameworks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frameworks</FormLabel>
              <ChipGroup
                multiple
                options={asChips(AUDIT_FRAMEWORKS)}
                value={field.value}
                onChange={field.onChange}
                aria-label="Frameworks"
              />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="nsloc"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Lines of code to audit</FormLabel>
            <FormControl>
              <Input
                {...field}
                inputMode="numeric"
                placeholder="4200"
                className="h-11 md:h-10 max-w-48"
              />
            </FormControl>
            <FormDescription>The single strongest input for quote accuracy.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Docs / spec links</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Whitepaper, spec, coverage report · links or attached files (pdf / text / image, ≤128MB
            each).
          </p>
        </div>
        <MultiLinkInput />
        <AttachmentUploader />
      </div>
    </div>
  );
}
