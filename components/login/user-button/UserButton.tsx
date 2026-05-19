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

const AVATAR_PX = 53;

// Avatar slot sits a touch larger than the ThemeToggle pill so it reads as
// its own anchor in the navbar. Profile pictures fill the full 53px slot;
// the placeholder glyph keeps a hair-thin stroke and a lighter grey in
// light mode / darker grey in dark mode so the line blends into the navbar
// instead of standing out.
const WRAPPER_CLASS =
  'inline-flex items-center justify-center rounded-full no-underline hover:no-underline focus:outline-none transition-transform duration-150 hover:scale-[1.2]';
const SLOT_CLASS = 'size-[53px] rounded-full flex items-center justify-center';
const ICON_CLASS = `${SLOT_CLASS} p-2 text-zinc-400 dark:text-zinc-600`;
const INITIALS_CLASS = `${SLOT_CLASS} text-[26px] font-bold tracking-tight text-[#b8b8c0] dark:text-zinc-600`;

function initialsFromName(name?: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    // Single word — show the first two letters so "Jeff" reads as "JE"
    // instead of a lonely "J" floating in the slot.
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
      <Link href="/profile" aria-label="Profile" className={WRAPPER_CLASS}>
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
          <CircleUserRound className={ICON_CLASS} strokeWidth={0.85} />
        )}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label="Login"
      className={WRAPPER_CLASS}
      onClick={() => {
        const currentUrl =
          typeof window !== 'undefined' ? window.location.href : '/';
        openLoginModal(currentUrl);
      }}
    >
      <CircleUserRound className={ICON_CLASS} strokeWidth={0.85} />
    </button>
  );
}
