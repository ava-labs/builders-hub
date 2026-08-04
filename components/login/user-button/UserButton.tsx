'use client';

import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { UserRound } from 'lucide-react';
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

const AVATAR_PX = 30;

// v2 design language: a squared hairline box at the same 2rem height as
// the search field and theme toggle. Hover inks the border rather than
// scaling; the dropdown opens on hover so the user can sign out without
// clicking through the box itself.
const WRAPPER_CLASS =
  'inline-flex h-8 w-8 items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-800 no-underline hover:no-underline focus:outline-none transition-colors hover:border-zinc-400 dark:hover:border-zinc-500';
const SLOT_CLASS = 'h-full w-full flex items-center justify-center';
const ICON_CLASS = `${SLOT_CLASS} p-1.5 text-zinc-500 dark:text-zinc-400`;
const INITIALS_CLASS = `${SLOT_CLASS} font-mono text-[10px] tracking-[0.1em] text-zinc-600 dark:text-zinc-300`;

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
  const router = useRouter();

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
      return <UserRound className={ICON_CLASS} strokeWidth={1.25} />;
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
            className="h-full w-full object-cover"
          />
        </span>
      );
    }
    if (nameInitials) {
      return <span className={INITIALS_CLASS}>{nameInitials}</span>;
    }
    return <UserRound className={ICON_CLASS} strokeWidth={1.25} />;
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

  // Authenticated — hover opens a small account menu (Profile, extras,
  // Sign out), while clicking the avatar navigates straight to /profile.
  // Without the explicit onClick the Radix trigger would just toggle the
  // hover-opened menu shut, so a click on the pill did nothing.
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
              aria-label="Profile"
              className={WRAPPER_CLASS}
              onClick={() => router.push('/profile')}
            >
              {renderAvatar()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44 rounded-none border border-zinc-200 bg-white p-0 text-zinc-700 shadow-[0_12px_24px_-12px_rgb(0_0_0_/_0.15)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            onMouseEnter={() => setMenuOpen(true)}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <DropdownMenuItem asChild className="cursor-pointer rounded-none px-3 py-2 text-sm focus:bg-zinc-100 focus:text-zinc-950 dark:focus:bg-zinc-900 dark:focus:text-zinc-50">
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-0 bg-zinc-200 dark:bg-zinc-800" />
            <DropdownMenuItem
              onClick={() => setSignOutOpen(true)}
              className="cursor-pointer rounded-none px-3 py-2 text-sm focus:bg-zinc-100 focus:text-zinc-950 dark:focus:bg-zinc-900 dark:focus:text-zinc-50"
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
