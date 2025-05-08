<<<<<<< HEAD
"use client";

import { Button } from "@/components/ui/button";
=======
'use client';

import { Button } from '@/components/ui/button';
>>>>>>> upstream/master
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
<<<<<<< HEAD
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import SignOutComponent from "../sign-out/SignOut";
import { useState } from "react";

export function UserButton() {
  const { data: session, status } = useSession();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isAuthenticated = status === "authenticated";
  const handleSignOut = (): void => {
    signOut();
  };
  return (
    <>
      {isAuthenticated && session?.user?.image ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-5 w-5"
            >
              <Image
                src={session.user.image}
                alt="User Avatar"
                width={20}
                height={20}
                className="rounded-full"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white text-black dark:bg-zinc-900 dark:text-white
    border border-zinc-200 dark:border-zinc-600
    shadow-lg p-1 rounded-md w-48">
            {isAuthenticated ? (
              <>
                <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
                  Sign Out
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem>
                <Link href="/login">Sign In</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link href="/login">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-circle-user-round !text-black dark:!text-white !h-[24px] !w-[24px] !stroke-[1.2px]"
            type="button"
            id="radix-:R1khpnkd7:"
            aria-haspopup="menu"
            aria-expanded="false"
            data-state="closed"
          >
            <path d="M18 20a6 6 0 0 0-12 0"></path>
            <circle cx="12" cy="10" r="4"></circle>
            <circle className="!text-zinc-800 " cx="12" cy="12" r="10"></circle>
          </svg>
        </Link>
=======
} from '@/components/ui/dropdown-menu';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import SignOutComponent from '../sign-out/SignOut';
import { useState } from 'react';
import { CircleUserRound, UserRound } from 'lucide-react';
import { Separator } from '@radix-ui/react-dropdown-menu';
export function UserButton() {
  const { data: session, status } = useSession() ?? {};
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isAuthenticated = status === 'authenticated';
  const handleSignOut = (): void => {
    signOut();
  };
  console.debug('session', session, isAuthenticated);
  return (
    <>
      {isAuthenticated ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='rounded-full h-10 w-10 ml-4 cursor-pointer p-1'
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
                  className='!h-8 !w-8 stroke-zinc-900 dark:stroke-white'
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
              <p className="text-sm break-words">
                {session.user.email || 'No email available'}
              </p>
              
              <p className="text-sm break-words mt-1">
                {session.user.name || 'No name available'}
              </p>
            </div>
            <Separator className="h-px bg-zinc-200 dark:bg-zinc-600 my-1" />

            <DropdownMenuItem asChild className='cursor-pointer'>
              <Link href='/profile'>Profile</Link>
            </DropdownMenuItem>
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
        >
          <Link href='/login'>
            <CircleUserRound
              className='!h-8 !w-8 stroke-zinc-900 dark:stroke-white'
              strokeWidth={0.85}
            />
          </Link>
        </Button>
>>>>>>> upstream/master
      )}

      <SignOutComponent
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleSignOut}
      />
    </>
  );
}
