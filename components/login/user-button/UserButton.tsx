'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import SignOutComponent from '../sign-out/SignOut';
import { useState, useEffect } from 'react';
import { CircleUserRound } from 'lucide-react';
import { Separator } from '@radix-ui/react-dropdown-menu';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
import { DiceBearAvatar } from '@/components/profile/components/DiceBearAvatar';
import type { AvatarSeed } from '@/components/profile/components/DiceBearAvatar';
import { useUserAvatar } from '@/components/context/UserAvatarContext';
import { useRouter } from 'next/navigation';

const AVATAR_SIZE = 32;

import { canAccessBuilderInsights, canAccessEvaluationTools } from '@/lib/auth/permissions';

function extractGithubUsername(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/github\.com\/([^/?#\s]+)/i);
  if (match) return match[1];
  return trimmed.replace(/^@/, '');
}

export function UserButton() {
  const { data: session, status } = useSession() ?? {};
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [localSeed, setLocalSeed] = useState<AvatarSeed | null>(null);
  const [localEnabled, setLocalEnabled] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const avatarContext = useUserAvatar();
  const isAuthenticated = status === 'authenticated';
  const { openLoginModal } = useLoginModalTrigger();
  const canAccessEvaluate = canAccessEvaluationTools(session?.user?.custom_attributes);
  const canAccessInsights = canAccessBuilderInsights(session?.user?.custom_attributes);
  const router = useRouter();

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

  // Fetch the GitHub handle so the dropdown can show @username instead of email/name.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!isAuthenticated || !userId) {
      setGithubUsername(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/profile/extended/${userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const handle = extractGithubUsername(data.github_account);
        setGithubUsername(handle || null);
      })
      .catch(() => {
        if (!cancelled) setGithubUsername(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, session?.user?.id]);

  const handleSignOut = (): void => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("redirectAfterProfile");
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("formData_")) {
          localStorage.removeItem(key);
        }
      });
    }
    signOut({ redirect: false }).then(() => {
      router.push('/');
    });
  };

  useEffect(() => {
    if (!session?.user) {
      localStorage.removeItem("session_payload");
      return;
    }
    const payload: { id: string; custom_attributes: string[] } = {
      id: session.user.id,
      custom_attributes: session.user.custom_attributes ?? [],
    };
    localStorage.setItem("session_payload", JSON.stringify(payload));
  }, [session?.user]);

  const displayHandle = githubUsername
    ? `@${githubUsername}`
    : session?.user?.name || session?.user?.email || 'Account';

  return (
    <>
      {isAuthenticated ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='rounded-full h-10 w-10 ml-1 cursor-pointer p-1 overflow-hidden'
            >
              {nounAvatarEnabled && nounAvatarSeed ? (
                <div className='h-10 w-10 rounded-full overflow-hidden flex items-center justify-center shrink-0'>
                  <DiceBearAvatar
                    seed={nounAvatarSeed}
                    size='small'
                    className='pointer-events-none scale-[0.71] origin-center'
                  />
                </div>
              ) : session.user.image ? (
                <Image
                  src={session.user.image}
                  alt='User Avatar'
                  width={AVATAR_SIZE}
                  height={AVATAR_SIZE}
                  className='rounded-full'
                />
              ) : (
                <CircleUserRound
                  className='h-8 w-8! stroke-zinc-900 dark:stroke-white'
                  strokeWidth={0.85}
                />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='bg-white text-black dark:bg-zinc-900 dark:text-white
            border border-zinc-200 dark:border-zinc-600
            shadow-lg p-1 rounded-md w-48'
          >
            <div className="px-2 py-1.5">
              <div
                className="text-sm font-medium truncate cursor-default"
                title={displayHandle}
              >
                {displayHandle}
              </div>
            </div>
            <Separator className="h-px bg-zinc-200 dark:bg-zinc-600 my-1" />

            <DropdownMenuItem asChild className='cursor-pointer'>
              <Link href='/profile'>Profile</Link>
            </DropdownMenuItem>
            {canAccessEvaluate && (
              <DropdownMenuItem asChild className='cursor-pointer'>
                <Link href='/evaluate'>Evaluate Hackathons</Link>
              </DropdownMenuItem>
            )}
            {canAccessInsights && (
              <DropdownMenuItem asChild className='cursor-pointer'>
                <Link href='/builder-insights'>Builder Insights</Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => setIsDialogOpen(true)}
              className='cursor-pointer'
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          size='icon'
          variant='ghost'
          className='rounded-full h-10 w-10 ml-4 cursor-pointer p-0'
          onClick={() => {
            const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';
            openLoginModal(currentUrl);
          }}
        >
          <CircleUserRound
            className='h-8! w-8! stroke-zinc-900 dark:stroke-white'
            strokeWidth={0.85}
          />
        </Button>
      )}

      <SignOutComponent
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleSignOut}
      />
    </>
  );
}
