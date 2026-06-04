'use client';

import Link from 'next/link';
import posthog from 'posthog-js';
import { Linkedin, Lock } from 'lucide-react';

// Inline mark for the X brand (lucide ships a "Twitter" bird; X uses the
// post-rebrand mark, which we render via an SVG path so we don't depend on
// a third-party icon library staying in sync with the brand.)
function XLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface Props {
  authenticated: boolean;
  missingSocials: ('x' | 'linkedin')[];
  // Where the "Sign in / Complete profile" CTA should send the user back to
  // afterward, so they land here on success.
  returnTo?: string;
  variant?: 'overlay' | 'panel';
  hiddenCount?: number;
}

export function UnlockPrompt({
  authenticated,
  missingSocials,
  returnTo = '/ecosystem-careers',
  variant = 'overlay',
  hiddenCount,
}: Props) {
  const callout = !authenticated
    ? 'Sign in and connect your X + LinkedIn to reveal salaries, apply, and unlock every role.'
    : missingSocials.length === 2
      ? 'Connect your X and LinkedIn profiles to reveal salaries and apply to any role.'
      : missingSocials[0] === 'x'
        ? 'Connect your X profile to reveal salaries and apply to any role.'
        : 'Connect your LinkedIn profile to reveal salaries and apply to any role.';

  const ctaHref = !authenticated
    ? `/login?callbackUrl=${encodeURIComponent(returnTo)}`
    : `/profile?tab=account&return_to=${encodeURIComponent(returnTo)}`;
  const ctaLabel = !authenticated ? 'Sign in' : 'Complete your profile';

  const containerCls =
    variant === 'overlay'
      ? 'absolute inset-x-0 top-12 z-20 flex justify-center px-4 pointer-events-none'
      : 'flex justify-center px-4';

  return (
    <div className={containerCls}>
      <div className="pointer-events-auto max-w-xl w-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-[0_24px_60px_-20px_rgba(0,0,0,0.4)] p-6 sm:p-7 text-center space-y-4">
        <div className="mx-auto w-11 h-11 rounded-full bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {hiddenCount && hiddenCount > 0
              ? `${hiddenCount} more ${hiddenCount === 1 ? 'role' : 'roles'} + salaries waiting`
              : 'Reveal salaries & apply'}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{callout}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80">
            <XLogo className="w-3 h-3" /> X account
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80">
            <Linkedin className="w-3 h-3" /> LinkedIn account
          </span>
        </div>
        <Link
          href={ctaHref}
          onClick={() => {
            posthog?.capture?.('careers_unlock_prompt_clicked', {
              surface: variant,
              authenticated,
              missing: missingSocials,
              return_to: returnTo,
            });
          }}
          className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/30 hover:scale-[1.02] transition-all duration-200"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
