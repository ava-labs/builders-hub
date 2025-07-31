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
import { useState } from 'react';
import { CircleUserRound } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function UserButton() {
  const { data: session, status } = useSession() ?? {};
  const isAuthenticated = status === 'authenticated';
  
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

  return (
    <>
      {isAuthenticated ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='rounded-full h-12 w-12 cursor-pointer p-1'
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
            align="end"
            className='w-48'
          >
            <div className="px-2 py-1.5">
              <p className="text-sm break-words">
                {session.user.email || 'No email available'}
              </p>
              
              <p className="text-sm break-words mt-1">
                {session.user.name || 'No name available'}
              </p>
            </div>
            <Separator className="my-1" />

            <DropdownMenuItem asChild className='cursor-pointer'>
              <Link href='/profile'>Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSignOut}
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
          className='rounded-full h-12 w-12 cursor-pointer p-0'
        >
          <Link href='/login'>
            <CircleUserRound
              className='!h-8 !w-8 stroke-zinc-900 dark:stroke-white'
              strokeWidth={0.85}
            />
          </Link>
        </Button>
      )}
    </>
  );
}