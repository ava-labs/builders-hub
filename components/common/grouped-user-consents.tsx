"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

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
  defaultExpanded?: boolean;
  className?: string;
};

/**
 * Renders a group of User-level consent checkboxes with a parent toggle that
 * checks/unchecks all children at once and shows an indeterminate state when
 * only some children are checked. When only one item is provided, the parent
 * wrapper collapses into a single flat checkbox to avoid superfluous nesting.
 */
export function GroupedUserConsents({
  groupLabel,
  groupHint,
  items,
  defaultExpanded = false,
  className,
}: GroupedUserConsentsProps) {
  const parentInputId = React.useId();
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  if (items.length === 0) return null;

  if (items.length === 1) {
    const item = items[0];
    const id = `${parentInputId}-${item.key}`;
    return (
      <div className={cn("flex items-start space-x-3", className)}>
        <Checkbox
          id={id}
          checked={item.checked}
          onCheckedChange={(value) => item.onCheckedChange(value === true)}
        />
        <div className="flex-1">
          <label
            htmlFor={id}
            className="text-sm text-foreground cursor-pointer"
          >
            {item.label}
          </label>
          {item.hint ? (
            <p className="text-xs text-muted-foreground mt-1">{item.hint}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const allChecked = items.every((i) => i.checked);
  const noneChecked = items.every((i) => !i.checked);
  const parentState: boolean | "indeterminate" = allChecked
    ? true
    : noneChecked
      ? false
      : "indeterminate";

  const handleParentChange = () => {
    const next = !allChecked;
    items.forEach((i) => i.onCheckedChange(next));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start space-x-3">
        <Checkbox
          id={parentInputId}
          checked={parentState}
          onCheckedChange={handleParentChange}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <label
              htmlFor={parentInputId}
              className="text-sm text-foreground cursor-pointer"
            >
              {groupLabel}
            </label>
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              aria-controls={`${parentInputId}-details`}
              aria-label={expanded ? "Collapse details" : "Expand details"}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </button>
          </div>
          {groupHint ? (
            <p className="text-xs text-muted-foreground mt-1">{groupHint}</p>
          ) : null}
        </div>
      </div>
      {expanded ? (
        <div id={`${parentInputId}-details`} className="pl-7 space-y-3">
          {items.map((item) => {
            const id = `${parentInputId}-${item.key}`;
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
      ) : null}
    </div>
  );
}
