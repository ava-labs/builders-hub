'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Clears a step flow's store, including the selected L1, and removes the ?subnetId= query from the URL.
 * The flow stores keep the L1 and the progress across reloads. This control starts the flow again.
 * Show it on step 1 of the flow: it stays on the current step.
 *
 * The button shows only while `show` is true (an L1 is selected), so a click removes it. The click then moves the
 * focus to the field with the id `focusId` (step 1's Subnet ID field), and a status text tells a screen reader that
 * the flow is cleared. The status element stays in the page, so its new text is read.
 */
export function StartOverButton({
  show,
  onStartOver,
  focusId,
  className,
}: {
  show: boolean;
  onStartOver: () => void;
  focusId: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hasQuery = useSearchParams().toString() !== '';
  const [cleared, setCleared] = useState(false);
  // An L1 is selected again: remove the status text
  if (show && cleared) setCleared(false);

  return (
    <div className={cn('flex shrink-0 items-center', className)}>
      {show && (
        <button
          type="button"
          onClick={() => {
            onStartOver();
            if (hasQuery) router.replace(pathname, { scroll: false });
            setCleared(true);
            document.getElementById(focusId)?.focus();
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Start over
        </button>
      )}
      <span role="status" className="text-xs text-zinc-500 dark:text-zinc-400">
        {cleared && !show ? 'The flow is cleared.' : ''}
      </span>
    </div>
  );
}
