"use client";

import { Plus, X } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuditWizardValues } from "@/components/audits/wizard/types";

/** Simple grow-as-needed URL list bound to the doc_links array. */
export function MultiLinkInput() {
  const { setValue, watch } = useFormContext<AuditWizardValues>();
  const links = watch("doc_links");

  const update = (next: string[]) => setValue("doc_links", next, { shouldDirty: true });

  return (
    <div className="space-y-2">
      {links.map((link, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={link}
            onChange={(event) =>
              update(links.map((l, i) => (i === index ? event.target.value : l)))
            }
            placeholder="docs.yourproject.com/spec"
            inputMode="url"
            className="h-11 flex-1 md:h-10"
            aria-label={`Doc link ${index + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 md:h-10 md:w-10"
            onClick={() => update(links.filter((_, i) => i !== index))}
            aria-label={`Remove doc link ${index + 1}`}
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
        onClick={() => update([...links, ""])}
      >
        <Plus
          aria-hidden
          className="mr-1.5 h-4 w-4 transition-transform duration-200 group-hover:rotate-90"
        />
        Add link
      </Button>
    </div>
  );
}
