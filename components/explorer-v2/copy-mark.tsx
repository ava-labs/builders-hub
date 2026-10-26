"use client";

import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/* exp-copy-morph: a copy button's icon turns into a check as one control
   changing state, and back the same way. The two icons sit stacked in one
   grid cell: the one leaving goes to opacity 0, scale 0.9 and a 2px blur in
   120ms, the one arriving comes back from there in 180ms, both on the strong
   ease-out (a transition takes the timing of the state it goes to). A press
   scales the icon to 0.95 in 120ms; the button carries the group/copy class.
   Under Reduce Motion the icons cross-fade, opacity only, with no press. */
const ICON = "col-start-1 row-start-1 transition-[opacity,scale,filter,color]";
const SHOWN = "opacity-100 duration-180 ease-out";
const HIDDEN = "opacity-0 duration-120 ease-out motion-safe:scale-90 motion-safe:blur-[2px]";

/** the copy icon and its check in one cell: `idle` colours the copy icon,
 *  `done` the check */
export function CopyMark({
  copied,
  size,
  done,
  idle,
  className,
}: {
  copied: boolean;
  size: string;
  done: string;
  idle?: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("grid shrink-0 transition-[scale] duration-120 ease-out motion-safe:group-active/copy:scale-95", className)}>
      <Copy className={cn(ICON, size, idle, copied ? HIDDEN : SHOWN)} />
      <Check className={cn(ICON, size, done, copied ? SHOWN : HIDDEN)} />
    </span>
  );
}
