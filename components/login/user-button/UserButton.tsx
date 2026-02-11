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
import { useState, useMemo, useEffect } from 'react';
import { CircleUserRound } from 'lucide-react';
import { Separator } from '@radix-ui/react-dropdown-menu';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
export function UserButton() {
  const { data: session, status } = useSession() ?? {};
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isAuthenticated = status === 'authenticated';
  const { openLoginModal } = useLoginModalTrigger();

  // Dividir el correo por @ para evitar cortes no deseados
  const formattedEmail = useMemo(() => {
    const email = session?.user?.email;
    if (!email) return null;

    const atIndex = email.indexOf('@');
    if (atIndex === -1) return { localPart: email, domain: null };

    return {
      localPart: email.substring(0, atIndex),
      domain: email.substring(atIndex), // Incluye el @
    };
  }, [session?.user?.email]);
  const handleSignOut = (): void => {
    // Clean up any stored redirect URLs before logout
    if (typeof window !== "undefined") {
      localStorage.removeItem("redirectAfterProfile");

      // Clean up any form data stored in localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("formData_")) {
          localStorage.removeItem(key);
        }
      });
    }

    signOut();
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
  }, [session?.user])

  return (
    <>
      {isAuthenticated ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='rounded-full h-10 w-10 ml-1 cursor-pointer p-1'
            >
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt='User Avatar'
                  width={32}
                  height={32}
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
                className="text-sm truncate cursor-default"
                title={session.user.email || 'No email available'}
              >
                {session.user.email || 'No email available'}
              </div>

              {session.user.name && session.user.name !== session.user.email && (
                <p className="text-sm break-words mt-1">
                  {session.user.name}
                </p>
              )}
            </div>
            <Separator className="h-px bg-zinc-200 dark:bg-zinc-600 my-1" />

            <DropdownMenuItem asChild className='cursor-pointer'>
              <Link href='/profile'>Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className='cursor-pointer'>
              <Link href='/profile#achievements'>Achievements Board</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className='cursor-pointer'>
              <Link href='/profile#projects'>Projects</Link>
            </DropdownMenuItem>
            {
              (session?.user?.custom_attributes.includes('devrel') || session?.user?.custom_attributes?.includes('notify_event')) && (
                <DropdownMenuItem asChild className='cursor-pointer'>
                  <Link href='/send-notifications'>Send notifications</Link>
                </DropdownMenuItem>
              )
            }
            {
              (session?.user?.custom_attributes.includes('devrel') || session?.user?.custom_attributes?.includes('hackathonCreator')) && (
                <DropdownMenuItem asChild className='cursor-pointer'>
                  <Link href='/hackathons/edit'>Edit Hackathons</Link>
                </DropdownMenuItem>
              )
            }
            {/* <DropdownMenuItem asChild className='cursor-pointer'>
              <Link href='/profile#settings'>Settings</Link>
            </DropdownMenuItem> */}


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
            className='!h-8 !w-8 stroke-zinc-900 dark:stroke-white'
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
