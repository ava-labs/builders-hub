'use client';

import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { CircleUserRound } from 'lucide-react';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
import { DiceBearAvatar } from '@/components/profile/components/DiceBearAvatar';
import type { AvatarSeed } from '@/components/profile/components/DiceBearAvatar';
import { useUserAvatar } from '@/components/context/UserAvatarContext';

const AVATAR_SIZE = 32;

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
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="rounded-full h-10 w-10 ml-1 cursor-pointer p-1 overflow-hidden"
      >
        <Link href="/profile" aria-label="Profile">
          {nounAvatarEnabled && nounAvatarSeed ? (
            <span className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center shrink-0">
              <DiceBearAvatar
                seed={nounAvatarSeed}
                size="small"
                className="pointer-events-none scale-[0.71] origin-center"
              />
            </span>
          ) : session.user.image ? (
            <Image
              src={session.user.image}
              alt="User Avatar"
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              className="rounded-full"
            />
          ) : (
            <CircleUserRound
              className="h-5! w-5! stroke-zinc-900 dark:stroke-white"
              strokeWidth={1.5}
            />
          )}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="rounded-full h-10 w-10 ml-4 cursor-pointer p-0"
      onClick={() => {
        const currentUrl =
          typeof window !== 'undefined' ? window.location.href : '/';
        openLoginModal(currentUrl);
      }}
      aria-label="Login"
    >
      <CircleUserRound
        className="h-5! w-5! stroke-zinc-900 dark:stroke-white"
        strokeWidth={1.5}
      />
    </Button>
  );
}
