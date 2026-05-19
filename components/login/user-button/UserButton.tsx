'use client';

import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { CircleUserRound } from 'lucide-react';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
import { DiceBearAvatar } from '@/components/profile/components/DiceBearAvatar';
import type { AvatarSeed } from '@/components/profile/components/DiceBearAvatar';
import { useUserAvatar } from '@/components/context/UserAvatarContext';

const AVATAR_PX = 18;

// Matches the ThemeToggle pill exactly so the navbar controls share one
// visual rhythm. The inner slot (size-6.5 with p-1.5) is the footprint of a
// single sun/moon glyph; every avatar variant (initials, image, dicebear,
// fallback icon) renders inside the same 26px square so the pill is the same
// width and height as an individual toggle icon.
const PILL_CLASS =
  'inline-flex items-center justify-center rounded-full border p-1 ml-2 hover:bg-fd-accent transition-colors';
const SLOT_CLASS = 'size-6.5 rounded-full flex items-center justify-center';
const ICON_CLASS = `${SLOT_CLASS} p-1.5 text-fd-muted-foreground`;
const INITIALS_CLASS = `${SLOT_CLASS} text-[10px] font-semibold tracking-tighter text-fd-muted-foreground bg-fd-muted/60`;

function initialsFromName(name?: string | null): string {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0] ?? '')
    .join('')
    .toUpperCase();
}

export function UserButton() {
  const { data: session, status } = useSession() ?? {};
  const [localSeed, setLocalSeed] = useState<AvatarSeed | null>(null);
  const [localEnabled, setLocalEnabled] = useState(false);
  const avatarContext = useUserAvatar();
  const isAuthenticated = status === 'authenticated';
  const { openLoginModal } = useLoginModalTrigger();

  const nounAvatarSeed = avatarContext?.nounAvatarSeed ?? localSeed;
  const nounAvatarEnabled = avatarContext?.nounAvatarEnabled ?? localEnabled;

  useEffect(() => {
    if (!isAuthenticated) {
      avatarContext?.setNounAvatar(null, false);
      setLocalSeed(null);
      setLocalEnabled(false);
      return;
    }
    let cancelled = false;
    fetch('/api/user/noun-avatar')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          const seed = data.seed ?? null;
          const enabled = data.enabled ?? false;
          avatarContext?.setNounAvatar(seed, enabled);
          setLocalSeed(seed);
          setLocalEnabled(enabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          avatarContext?.setNounAvatar(null, false);
          setLocalSeed(null);
          setLocalEnabled(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, avatarContext?.setNounAvatar]);

  useEffect(() => {
    if (!session?.user) {
      localStorage.removeItem('session_payload');
      return;
    }
    const payload: { id: string; custom_attributes: string[] } = {
      id: session.user.id,
      custom_attributes: session.user.custom_attributes ?? [],
    };
    localStorage.setItem('session_payload', JSON.stringify(payload));
  }, [session?.user]);

  if (isAuthenticated) {
    const nameInitials = initialsFromName(session.user?.name);
    return (
      <Link href="/profile" aria-label="Profile" className={PILL_CLASS}>
        {nounAvatarEnabled && nounAvatarSeed ? (
          <span className={`${SLOT_CLASS} overflow-hidden`}>
            <DiceBearAvatar
              seed={nounAvatarSeed}
              size="small"
              className="pointer-events-none scale-[0.45] origin-center"
            />
          </span>
        ) : session.user.image ? (
          <span className={`${SLOT_CLASS} overflow-hidden`}>
            <Image
              src={session.user.image}
              alt="User Avatar"
              width={AVATAR_PX}
              height={AVATAR_PX}
              className="rounded-full"
            />
          </span>
        ) : nameInitials ? (
          <span className={INITIALS_CLASS}>{nameInitials}</span>
        ) : (
          <CircleUserRound className={ICON_CLASS} strokeWidth={1.75} />
        )}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label="Login"
      className={PILL_CLASS}
      onClick={() => {
        const currentUrl =
          typeof window !== 'undefined' ? window.location.href : '/';
        openLoginModal(currentUrl);
      }}
    >
      <CircleUserRound className={ICON_CLASS} strokeWidth={1.75} />
    </button>
  );
}
