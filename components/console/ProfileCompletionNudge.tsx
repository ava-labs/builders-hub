'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Sparkles, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  COMPLETION_STEPS,
  computeCompletion,
  type CompletionStep,
} from '@/lib/profile/completion';

const DISMISS_KEY = 'console-profile-nudge-dismissed-until';
const DISMISS_HOURS = 24;

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

function rolesFromProfile(profile: ExtendedProfile): string[] {
  const t = profile.user_type ?? {};
  const out: string[] = [];
  if (t.is_student) out.push('university');
  if (t.is_founder) out.push('founder');
  if (t.is_developer) out.push('developer');
  if (t.is_employee) out.push('employee');
  if (t.is_enthusiast) out.push('enthusiast');
  return out;
}

function isDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() < ts;
}

export function ProfileCompletionNudge() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [missing, setMissing] = useState<CompletionStep[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    setDismissed(isDismissed());
  }, []);

  // Re-evaluate dismissal whenever the user changes route within the console
  // so a long session naturally resurfaces the nudge once the 24h window lapses.
  useEffect(() => {
    setDismissed(isDismissed());
  }, [pathname]);

  // Pull just enough of the profile to compute the steps the nudge covers.
  // Hackathon/project/console steps are out of scope here — those are tracked
  // on the profile page itself.
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setMissing([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/profile/extended/${session.user.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((profile: ExtendedProfile | null) => {
        if (cancelled || !profile) return;
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
        // Only nudge for things the user controls from the profile page —
        // skip engagement steps (hackathon/project/console).
        const engagementKeys = new Set(['hackathon', 'project', 'console']);
        const remaining = COMPLETION_STEPS.filter(
          (step) => !engagementKeys.has(step.key) && !stepStatus[step.key],
        );
        setMissing(remaining);
      })
      .catch(() => {
        if (!cancelled) setMissing([]);
      });
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  // Rotate through the visible tip every ~12s and surface a fresh one on each
  // console navigation. Mirrors the rhythm of the chat bubble's prompt cycle.
  useEffect(() => {
    if (!mounted || missing.length === 0 || dismissed) return;

    setShowPrompt(true);
    const hideTimer = setTimeout(() => setShowPrompt(false), 6000);
    const rotateTimer = setTimeout(() => {
      setCurrentStep((p) => (p + 1) % Math.max(missing.length, 1));
      setShowPrompt(true);
      promptTimeoutRef.current = setTimeout(() => setShowPrompt(false), 6000);
    }, 12000);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(rotateTimer);
      if (promptTimeoutRef.current) clearTimeout(promptTimeoutRef.current);
    };
  }, [pathname, missing.length, dismissed, mounted]);

  if (!pathname.startsWith('/console')) return null;
  if (status !== 'authenticated') return null;
  if (missing.length === 0) return null;
  if (dismissed) return null;

  const step = missing[currentStep % missing.length];

  const handleGoToProfile = () => {
    router.push('/profile');
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    const until = Date.now() + DISMISS_HOURS * 60 * 60 * 1000;
    window.localStorage.setItem(DISMISS_KEY, String(until));
    setDismissed(true);
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      data-profile-nudge
    >
      {mounted && (
        <div
          className={cn(
            'transform transition-all duration-500 ease-out',
            showPrompt
              ? 'translate-y-0 opacity-100 scale-100'
              : 'translate-y-2 opacity-0 scale-95 pointer-events-none',
          )}
        >
          <div className="relative bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white px-4 py-2.5 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-[240px]">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">{step.label}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white dark:bg-zinc-900 border-r border-b border-zinc-200 dark:border-zinc-800 transform rotate-45" />
          </div>
        </div>
      )}

      <button
        onClick={handleGoToProfile}
        className={cn(
          'group relative w-12 h-12 rounded-full shadow-lg border flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl',
          'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/50',
          'hover:border-zinc-300 dark:hover:border-zinc-600',
        )}
        aria-label={`Complete your profile: ${step.label}`}
        title={`${missing.length} step${missing.length === 1 ? '' : 's'} left on your profile`}
      >
        <UserPlus className="w-5 h-5 text-zinc-700 dark:text-zinc-300 relative z-10 transition-transform group-hover:scale-110" />
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
          {missing.length}
        </span>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss profile reminder for 24 hours"
          className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        >
          <X className="w-3 h-3" />
        </button>
      </button>
    </div>
  );
}
