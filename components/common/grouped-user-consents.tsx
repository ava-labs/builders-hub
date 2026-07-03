"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type GroupedConsentItem = {
  /** Stable key, also used to derive the input id. */
  key: string;
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
};

export type GroupedUserConsentsProps = {
  groupLabel: string;
  groupHint?: string;
  items: GroupedConsentItem[];
  className?: string;
};

/**
 * Renders a section of User-level consent checkboxes under a static group
 * heading. Each item is an independent checkbox — there is no parent toggle
 * and no collapse behavior.
 */
export function GroupedUserConsents({
  groupLabel,
  groupHint,
  items,
  className,
}: GroupedUserConsentsProps) {
  const reactId = React.useId();

  if (items.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-sm text-foreground">{groupLabel}</p>
        {groupHint ? (
          <p className="text-xs text-muted-foreground mt-1">{groupHint}</p>
        ) : null}
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const id = `${reactId}-${item.key}`;
          return (
            <div key={item.key} className="flex items-start space-x-3">
              <Checkbox
                id={id}
                checked={item.checked}
                onCheckedChange={(value) =>
                  item.onCheckedChange(value === true)
                }
              />
              <div className="flex-1">
                <label
                  htmlFor={id}
                  className="text-sm text-foreground cursor-pointer"
                >
                  {item.label}
                </label>
                {item.hint ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.hint}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
