'use client';

import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { CircleUserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
import { DiceBearAvatar } from '@/components/profile/components/DiceBearAvatar';
import type { AvatarSeed } from '@/components/profile/components/DiceBearAvatar';
import { useUserAvatar } from '@/components/context/UserAvatarContext';
import SignOutComponent from '../sign-out/SignOut';
import { canAccessBuilderInsights } from '@/lib/auth/permissions';

const AVATAR_PX = 36;

// No outlined box — the avatar sits on the navbar at toggle height (~36px)
// so a profile picture, initials, and placeholder all line up with the
// ThemeToggle next to it. Hover lifts +20%; the dropdown opens on hover
// so the user can sign out without clicking through the pill itself.
const WRAPPER_CLASS =
  'inline-flex items-center justify-center rounded-full no-underline hover:no-underline focus:outline-none transition-transform duration-150 hover:scale-[1.2]';
const SLOT_CLASS = 'size-9 rounded-full flex items-center justify-center';
const ICON_CLASS = `${SLOT_CLASS} p-1.5 text-zinc-400 dark:text-zinc-600`;
const INITIALS_CLASS = `${SLOT_CLASS} text-sm font-bold tracking-tight text-[#b8b8c0] dark:text-zinc-600`;

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
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const avatarContext = useUserAvatar();
  const isAuthenticated = status === 'authenticated';
  const { openLoginModal } = useLoginModalTrigger();

  const nounAvatarSeed = avatarContext?.nounAvatarSeed ?? localSeed;
  const nounAvatarEnabled = avatarContext?.nounAvatarEnabled ?? localEnabled;

  const canAccessInsights = canAccessBuilderInsights(session?.user?.custom_attributes);

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

  const handleSignOutConfirm = async (): Promise<void> => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('redirectAfterProfile');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('formData_')) localStorage.removeItem(key);
      });
    }
    await signOut({ redirect: false });
    window.location.href = '/';
  };

  const renderAvatar = () => {
    if (!isAuthenticated || !session?.user) {
      return <CircleUserRound className={ICON_CLASS} strokeWidth={0.85} />;
    }
    const nameInitials = initialsFromName(session.user.name);
    if (nounAvatarEnabled && nounAvatarSeed) {
      return (
        <span className={`${SLOT_CLASS} overflow-hidden`}>
          <DiceBearAvatar
            seed={nounAvatarSeed}
            size="small"
            className="pointer-events-none scale-[0.45] origin-center"
          />
        </span>
      );
    }
    if (session.user.image) {
      return (
        <span className={`${SLOT_CLASS} overflow-hidden`}>
          <Image
            src={session.user.image}
            alt="User Avatar"
            width={AVATAR_PX}
            height={AVATAR_PX}
            className="rounded-full"
          />
        </span>
      );
    }
    if (nameInitials) {
      return <span className={INITIALS_CLASS}>{nameInitials}</span>;
    }
    return <CircleUserRound className={ICON_CLASS} strokeWidth={0.85} />;
  };

  // Unauthenticated — clicking the avatar still opens the login modal,
  // matching the rest of the public-page UX.
  if (!isAuthenticated) {
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
        {renderAvatar()}
      </button>
    );
  }

  // Authenticated — hover opens a small account menu (Profile + Sign Out).
  // The pill itself no longer navigates on click; the dropdown is the only
  // path so the user has an explicit choice every time.
  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <div
          onMouseEnter={() => setMenuOpen(true)}
          onMouseLeave={() => setMenuOpen(false)}
          className="inline-flex"
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className={WRAPPER_CLASS}
            >
              {renderAvatar()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-white text-black dark:bg-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 shadow-lg p-1 rounded-md w-40"
            onMouseEnter={() => setMenuOpen(true)}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-700" />
            <DropdownMenuItem
              onClick={() => setSignOutOpen(true)}
              className="cursor-pointer"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </div>
      </DropdownMenu>
      <SignOutComponent
        isOpen={signOutOpen}
        onOpenChange={setSignOutOpen}
        onConfirm={handleSignOutConfirm}
      />
    </>
  );
}
