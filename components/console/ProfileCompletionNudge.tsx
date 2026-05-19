'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  COMPLETION_STEPS,
  computeCompletion,
} from '@/lib/profile/completion';

const DISMISS_KEY = 'console-profile-nudge-dismissed-until';
const DISMISS_HOURS = 24;
const ROTATE_MS = 8000;

interface ExtendedProfile {
  name?: string | null;
  bio?: string | null;
  country?: string | null;
  github_account?: string | null;
  x_account?: string | null;
  telegram_account?: string | null;
  linkedin_account?: string | null;
  wallet?: string[] | string | null;
  skills?: string[] | null;
  user_type?: {
    is_student?: boolean;
    is_founder?: boolean;
    is_employee?: boolean;
    is_developer?: boolean;
    is_enthusiast?: boolean;
  } | null;
}

interface SummaryReferralTarget {
  key: string;
  group: 'signup' | 'event' | 'grant';
  label: string;
  detail: string;
  targetType: string;
  targetId: string | null;
  destinationUrl: string;
}

interface NudgeMessage {
  title: string;
  detail: string;
  href: string;
}

function rolesFromProfile(p: ExtendedProfile): string[] {
  const t = p.user_type ?? {};
  const out: string[] = [];
  if (t.is_student) out.push('university');
  if (t.is_founder) out.push('founder');
  if (t.is_developer) out.push('developer');
  if (t.is_employee) out.push('employee');
  if (t.is_enthusiast) out.push('enthusiast');
  return out;
}

function readDismissedUntil(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return 0;
  const ts = Number(raw);
  return Number.isFinite(ts) ? ts : 0;
}

export function ProfileCompletionNudge() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<ExtendedProfile | null>(null);
  const [referralTargets, setReferralTargets] = useState<SummaryReferralTarget[]>(
    [],
  );
  const [cursor, setCursor] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState(0);

  const rotateTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    setDismissedUntil(readDismissedUntil());
  }, []);

  useEffect(() => {
    setDismissedUntil(readDismissedUntil());
  }, [pathname]);

  // Fetch profile + referral targets in parallel. The summary endpoint already
  // returns the same referralTargets the profile page uses, so we lean on it
  // instead of inventing a parallel "upcoming programs" feed.
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setProfile(null);
      setReferralTargets([]);
      return;
    }
    let cancelled = false;
    void Promise.all([
      fetch(`/api/profile/extended/${session.user.id}`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch('/api/profile/summary').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([p, s]) => {
        if (cancelled) return;
        setProfile((p as ExtendedProfile) ?? null);
        const targets = (s?.referralTargets ?? []) as SummaryReferralTarget[];
        setReferralTargets(targets);
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(null);
          setReferralTargets([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  // Build the rotating message list: incomplete profile steps first; if the
  // profile is complete, advertise the active referral programs (events first,
  // then grants — the bh_signup row is always present so we skip it).
  const messages: NudgeMessage[] = useMemo(() => {
    // While the profile fetch is in flight (or if it failed), still surface
    // the referral catalog so the nudge isn't silent.
    if (!profile) {
      const ranked = [...referralTargets].sort((a, b) => {
        const order: Record<string, number> = { event: 0, grant: 1, signup: 2 };
        return (order[a.group] ?? 9) - (order[b.group] ?? 9);
      });
      const fromTargets: NudgeMessage[] = ranked.map((t) => ({
        title:
          t.group === 'signup'
            ? 'Invite builders to Builder Hub'
            : `Refer builders to ${t.label}`,
        detail: t.detail || 'Grab your link from the profile referral panel',
        href: '/profile',
      }));
      if (fromTargets.length > 0) return fromTargets;
      return [
        {
          title: 'Invite builders to Builder Hub',
          detail: 'Grab your referral link from the profile page',
          href: '/profile',
        },
      ];
    }
    const walletList = Array.isArray(profile.wallet)
      ? profile.wallet
      : profile.wallet
        ? [profile.wallet]
        : [];
    const { status: stepStatus } = computeCompletion({
      fullName: profile.name ?? '',
      bio: profile.bio ?? '',
      country: profile.country ?? '',
      roles: rolesFromProfile(profile),
      github: profile.github_account ?? '',
      xAccount: profile.x_account ?? '',
      telegram: profile.telegram_account ?? '',
      linkedin: profile.linkedin_account ?? '',
      wallets: walletList,
      skills: profile.skills ?? [],
    });
    const skip = new Set(['hackathon', 'project', 'console']);
    const remaining = COMPLETION_STEPS.filter(
      (s) => !skip.has(s.key) && !stepStatus[s.key],
    );
    if (remaining.length > 0) {
      return remaining.map((s) => ({
        title: s.label,
        detail: s.description,
        href: '/profile',
      }));
    }
    // Profile is complete — promote active referral programs. Events and
    // grants surface first; the always-present bh_signup row anchors the
    // list so the nudge never goes empty just because there's no live
    // hackathon at the moment.
    const ranked = [...referralTargets].sort((a, b) => {
      const order: Record<string, number> = { event: 0, grant: 1, signup: 2 };
      return (order[a.group] ?? 9) - (order[b.group] ?? 9);
    });
    const fromTargets: NudgeMessage[] = ranked.map((t) => ({
      title:
        t.group === 'signup'
          ? 'Invite builders to Builder Hub'
          : `Refer builders to ${t.label}`,
      detail: t.detail || 'Grab your link from the profile referral panel',
      href: '/profile',
    }));
    if (fromTargets.length > 0) return fromTargets;
    // Last-resort baseline so the nudge isn't silent if the summary fetch
    // failed or no programs are active.
    return [
      {
        title: 'Invite builders to Builder Hub',
        detail: 'Grab your referral link from the profile page',
        href: '/profile',
      },
    ];
  }, [profile, referralTargets]);

  const isVisible =
    mounted &&
    status === 'authenticated' &&
    messages.length > 0 &&
    Date.now() >= dismissedUntil &&
    pathname.startsWith('/console');

  // Keep the tooltip always visible while there's something to say — just
  // rotate the message index every ROTATE_MS so the user always sees the
  // next-step hint near the profile pill, the way the chat bubble keeps
  // its prompt visible at the bottom-right.
  useEffect(() => {
    if (!isVisible || messages.length <= 1) return;
    rotateTimer.current = setInterval(() => {
      setCursor((c) => (c + 1) % messages.length);
    }, ROTATE_MS);
    return () => {
      if (rotateTimer.current) clearInterval(rotateTimer.current);
    };
  }, [isVisible, messages.length]);

  if (!isVisible) return null;

  const message = messages[cursor % messages.length];

  const handleClick = () => {
    router.push(message.href);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    const until = Date.now() + DISMISS_HOURS * 60 * 60 * 1000;
    window.localStorage.setItem(DISMISS_KEY, String(until));
    setDismissedUntil(until);
  };

  return (
    <div
      className={cn(
        'fixed right-4 z-[60] animate-in fade-in slide-in-from-top-2 duration-300',
      )}
      style={{ top: 'calc(var(--fd-nav-height, 56px) + 12px)' }}
      data-profile-nudge
    >
      <div className="relative max-w-[260px]">
        <button
          type="button"
          onClick={handleClick}
          className="block w-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white px-4 py-2.5 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 text-left hover:shadow-2xl transition-shadow"
        >
          <div className="flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">{message.title}</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">
                {message.detail}
              </p>
            </div>
          </div>
        </button>
        {/* Arrow pointing up to the profile pill in the navbar */}
        <span
          aria-hidden
          className="absolute -top-2 right-5 w-4 h-4 bg-white dark:bg-zinc-900 border-l border-t border-zinc-200 dark:border-zinc-800 transform rotate-45 pointer-events-none"
        />
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss for 24 hours"
          className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 flex items-center justify-center"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
