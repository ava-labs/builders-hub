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

// Matches the ThemeToggle pill: same border, padding, and total height so
// the navbar controls share one visual rhythm. The inner glyph (size-6.5
// rounded-full p-1.5) mirrors a single sun/moon icon.
const PILL_CLASS =
  'inline-flex items-center justify-center rounded-full border p-1 ml-2 hover:bg-fd-accent transition-colors';
const ICON_CLASS =
  'size-6.5 rounded-full p-1.5 text-fd-muted-foreground';

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
    return (
      <Link href="/profile" aria-label="Profile" className={PILL_CLASS}>
        {nounAvatarEnabled && nounAvatarSeed ? (
          <span className="size-6.5 rounded-full overflow-hidden flex items-center justify-center">
            <DiceBearAvatar
              seed={nounAvatarSeed}
              size="small"
              className="pointer-events-none scale-[0.45] origin-center"
            />
          </span>
        ) : session.user.image ? (
          <Image
            src={session.user.image}
            alt="User Avatar"
            width={AVATAR_PX}
            height={AVATAR_PX}
            className="rounded-full"
          />
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
