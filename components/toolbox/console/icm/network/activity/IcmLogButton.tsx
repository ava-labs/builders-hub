'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NavTrailingPill } from '@/components/console/nav-trailing-pill';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import { cn } from '@/lib/utils';

/**
 * Trailing pill for the StepFlow nav row. Opens a Sheet listing recent
 * ICM activity events (messenger / registry / demo deploys, relayer config
 * saves, message sends + deliveries).
 *
 * Replaces the removed `IcmRibbon` center pill so the activity log stays
 * one click away from any phase without occupying its own ribbon row.
 */
export function IcmLogButton() {
  const [open, setOpen] = useState(false);
  const events = useIcmSetupStore((s) => s.activityLog);
  const count = events.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <NavTrailingPill
          icon={MessageSquare}
          label="Activity"
          badge={count > 0 ? String(count) : undefined}
          focusRingClassName="focus-visible:ring-amber-400/60"
        />
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>ICM activity log</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <LogSheetBody />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LogSheetBody() {
  const events = useIcmSetupStore((s) => s.activityLog);
  if (events.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No events yet. As you deploy contracts and send messages, they will appear here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {events.map((event) => (
        <li key={event.id} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{event.label}</span>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wide',
                event.status === 'confirmed' && 'text-emerald-600 dark:text-emerald-400',
                event.status === 'pending' && 'text-amber-600 dark:text-amber-400',
                event.status === 'delivered' && 'text-emerald-600 dark:text-emerald-400',
                event.status === 'failed' && 'text-red-600 dark:text-red-400',
              )}
            >
              {event.status}
            </span>
          </div>
          {event.sublabel && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{event.sublabel}</p>}
        </li>
      ))}
    </ul>
  );
}
