'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('ICTT Error:', error);
    posthog.captureException(error);
  }, [error]);

  return (
    <div className="not-prose flex min-h-[400px] items-center py-10">
      <div className="w-full max-w-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <header className="flex items-center gap-2 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <AlertTriangle aria-hidden className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Interchain Token Transfer
          </p>
        </header>
        <div className="flex flex-col gap-3 px-5 py-5">
          <h2 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50">Something went wrong</h2>
          <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300 [overflow-wrap:anywhere]">
            {error.message || 'This step hit an error.'}
          </p>
          {error.digest && (
            <p className="font-mono text-[11px] text-zinc-400 [overflow-wrap:anywhere] dark:text-zinc-500">
              Error ID {error.digest}
            </p>
          )}
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            Details are in the browser console. Reload to try again.
          </p>
        </div>
        <footer className="flex justify-end border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <Button onClick={() => reset()} icon={<RotateCcw aria-hidden className="h-3.5 w-3.5" />} className="w-auto">
            Reload
          </Button>
        </footer>
      </div>
    </div>
  );
}
