"use client";

import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuditWizardValues } from "@/components/audits/wizard/types";

export function RepoRepeater() {
  const { control, register } = useFormContext<AuditWizardValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "repos" });

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">GitHub repositories</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pin a branch or commit per repo. Private repos: grant read access after you accept a
          quote.
        </p>
      </div>
      {/* The URL takes the full width on phones (board 1k: field pairs stack);
          ref + remove wrap onto their own line below sm. */}
      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-wrap items-start gap-2">
          <Input
            {...register(`repos.${index}.url`)}
            placeholder="https://github.com/org/repo"
            inputMode="url"
            className="h-11 w-full sm:w-auto sm:flex-1 md:h-10"
            aria-label={`Repository ${index + 1} URL`}
          />
          <Input
            {...register(`repos.${index}.ref`)}
            placeholder="branch or commit"
            className="h-11 min-w-0 flex-1 sm:w-40 sm:flex-none md:h-10"
            aria-label={`Repository ${index + 1} branch or commit`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 md:h-10 md:w-10"
            onClick={() => remove(index)}
            aria-label={`Remove repository ${index + 1}`}
          >
            <X aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="group h-11 md:h-9"
        onClick={() => append({ url: "", ref: "" })}
      >
        <Plus
          aria-hidden
          className="mr-1.5 h-4 w-4 transition-transform duration-200 group-hover:rotate-90"
        />
        Add repository
      </Button>
    </div>
  );
}
