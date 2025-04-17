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
import { useState } from 'react';
import { CircleUserRound, UserRound } from 'lucide-react';

export function UserButton() {
  const { data: session, status } = useSession();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isAuthenticated = status === 'authenticated';
  const handleSignOut = (): void => {
    signOut();
  };
  return (
    <>
      {isAuthenticated && session?.user?.image ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='rounded-full h-10 w-10 ml-4 cursor-pointer p-1'
            >
              <Image
                src={session.user.image}
                alt='User Avatar'
                width={32}
                height={32}
                className='rounded-full'
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='bg-white text-black dark:bg-zinc-900 dark:text-white
    border border-zinc-200 dark:border-zinc-600
    shadow-lg p-1 rounded-md w-48'
          >
            <DropdownMenuItem>
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
              Sign Out
            </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          size='icon'
          variant='ghost'
          className='rounded-full h-10 w-10 ml-4 cursor-pointer p-0'
        >
          <Link
            href='/login'
          >
            <CircleUserRound className='!h-8 !w-8 stroke-zinc-900 dark:stroke-white' strokeWidth={0.85} />
          </Link>
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
