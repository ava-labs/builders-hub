'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'ictt-legacy-banner-dismissed';

interface LegacyBannerProps {
  className?: string;
}

export function LegacyBanner({ className }: LegacyBannerProps) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setDismissed(true);
  };

  if (dismissed === null || dismissed) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/20',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex-1 leading-relaxed text-zinc-700 dark:text-zinc-200">
        <strong className="font-semibold text-amber-900 dark:text-amber-200">
          You&apos;re on the legacy ICTT flow.
        </strong>{' '}
        The new bridge console is now the default and will replace this view on the next release.{' '}
        <Link
          href="/console/ictt"
          className="inline-flex items-center gap-1 font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
        >
          Open new bridge console
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss legacy banner"
        className="rounded-md p-1 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
