'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';

/** The console's route-level error screen, shared by every `error.tsx` under /console. */
export function ConsoleRouteError({
  error,
  reset,
  fallbackMessage,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  fallbackMessage: string;
}) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <div className="w-full max-w-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-red-700 dark:text-red-400">
              Error
            </p>
            <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Oops! Something went wrong
            </h2>
            <p className="mt-1 break-words text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {error.message || fallbackMessage}
            </p>
          </div>
        </div>
        <div className="space-y-3 px-6 py-5">
          {error.digest && (
            <div className="border border-red-200 bg-red-50/60 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/20">
              <p className="break-all font-mono text-[12px] text-red-800 dark:text-red-300">{`Error ID: ${error.digest}`}</p>
            </div>
          )}
          <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
            See details in your browser console. Please reload the page.
          </p>
        </div>
        <div className="flex justify-end border-t border-zinc-200 bg-zinc-50/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <Button onClick={() => reset()} icon={<RotateCcw className="h-3.5 w-3.5" />} className="w-auto">
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}
