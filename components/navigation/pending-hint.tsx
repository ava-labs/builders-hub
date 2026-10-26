'use client';

import Link, { useLinkStatus } from 'next/link';
import { useEffect, useState, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** How long a click may wait for its page before the hint shows: a fast navigation never flashes it. */
export const PENDING_HINT_DELAY_MS = 120;

/**
 * The hint's effect: while `pending`, report `true` once the wait passes PENDING_HINT_DELAY_MS. The cleanup (the
 * navigation ended, or the link unmounted) clears the timer and reports `false`. A timer, not a CSS delay: the
 * Reduce Motion policy drops every animation delay, and the hint must wait there too.
 */
export function watchPending(pending: boolean, setLate: (late: boolean) => void): (() => void) | undefined {
  if (!pending) return undefined;
  const timer = setTimeout(() => setLate(true), PENDING_HINT_DELAY_MS);
  return () => {
    clearTimeout(timer);
    setLate(false);
  };
}

/**
 * site-link-pending: a 2px line under a navbar link whose page is still loading. Developers, Console and Ecosystem
 * skip prefetch and the app has no loading.tsx, so a slow click shows nothing until the page arrives. Always rendered
 * and absolutely placed, so nothing shifts; app/global.css draws it (.nav-pending-hint).
 */
export function PendingHint() {
  const { pending } = useLinkStatus();
  const [late, setLate] = useState(false);
  useEffect(() => watchPending(pending, setLate), [pending]);
  return <span aria-hidden className="nav-pending-hint" data-shown={(pending && late) || undefined} />;
}

/** A navbar trigger's Link with the hint inside it: useLinkStatus reads the Link it sits in. */
export function PendingLink({ children, className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={cn('relative', className)}>
      {children}
      <PendingHint />
    </Link>
  );
}
