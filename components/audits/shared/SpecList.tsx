import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface SpecItem {
  label: string;
  children: React.ReactNode;
}

/**
 * Hairline definition rows (Auditor board 1d), a local mirror of the
 * explorer-v2 SpecRow motif: left-aligned bodies, no framer dependency.
 */
export function SpecList({ items, className }: { items: SpecItem[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[110px_minmax(0,1fr)] sm:grid-cols-[150px_minmax(0,1fr)]", className)}>
      {items.map((item, index) => (
        <Fragment key={item.label}>
          <div
            className={cn(
              "py-2.5 pr-4 text-xs text-zinc-500 dark:text-zinc-400",
              index > 0 && "border-t border-zinc-100 dark:border-white/[0.06]",
            )}
          >
            {item.label}
          </div>
          <div
            className={cn(
              "py-2.5 text-sm text-zinc-900 dark:text-zinc-100",
              index > 0 && "border-t border-zinc-100 dark:border-white/[0.06]",
            )}
          >
            {item.children}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
