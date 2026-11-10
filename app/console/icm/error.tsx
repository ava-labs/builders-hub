'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import { EYEBROW } from '@/components/toolbox/console/icm/ui';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('ICM Error:', error);
    posthog.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] items-start py-8">
      <section className="w-full max-w-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <header className="flex flex-col gap-1 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <p className={EYEBROW}>ICM · Error</p>
          <h2 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50">Something went wrong</h2>
        </header>
        <div className="flex flex-col gap-4 px-5 py-5">
          <Alert variant="error">{error.message || 'Something went wrong with this operation.'}</Alert>
          {error.digest && (
            <p className="font-mono text-[11.5px] text-zinc-500 [overflow-wrap:anywhere] dark:text-zinc-400">
              Error ID <span className="text-zinc-900 dark:text-zinc-50">{error.digest}</span>
            </p>
          )}
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            See the browser console for details, then reload the page.
          </p>
        </div>
        <footer className="flex justify-end border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <Button onClick={() => reset()} className="w-auto">
            Reload page
          </Button>
        </footer>
      </section>
    </div>
  );
}
