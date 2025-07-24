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
import { CircleUserRound, UserRound } from 'lucide-react';
import { Separator } from '@radix-ui/react-dropdown-menu';

interface UserButtonProps {
  showLoginText?: boolean;
  loginText?: string;
}

export function UserButton({ showLoginText = false, loginText = "Login to Builder Hub" }: UserButtonProps = {}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Always call useSession at the top level
  let sessionData = null;
  let sessionStatus = 'loading';
  let hasSessionProvider = true;
  
  try {
    const sessionResult = useSession();
    sessionData = sessionResult?.data;
    sessionStatus = sessionResult?.status || 'loading';
  } catch (error) {
    console.warn('SessionProvider not available, falling back to unauthenticated state');
    sessionStatus = 'unauthenticated';
    hasSessionProvider = false;
  }

  const isAuthenticated = isClient && hasSessionProvider && sessionStatus === 'authenticated';

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

  // Show loading state during client-side hydration or when session is loading
  if (!isClient || (hasSessionProvider && sessionStatus === 'loading')) {
    return (
      <div className="w-10 h-10 ml-4 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
    );
  }

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
              {sessionData?.user?.image ? (
                <Image
                  src={sessionData.user.image}
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
                {sessionData?.user?.email || 'No email available'}
              </p>
              
              <p className="text-sm break-words mt-1">
                {sessionData?.user?.name || 'No name available'}
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
          size={showLoginText ? 'default' : 'icon'}
          variant='ghost'
          className={showLoginText 
            ? 'h-10 ml-4 cursor-pointer px-4 py-2' 
            : 'rounded-full h-10 w-10 ml-4 cursor-pointer p-0'
          }
        >
          <Link href='/login' className={showLoginText ? 'flex items-center gap-2' : ''}>
            <CircleUserRound
              className='!h-8 !w-8 stroke-zinc-900 dark:stroke-white'
              strokeWidth={0.85}
            />
            {showLoginText && (
              <span className="text-sm font-medium">{loginText}</span>
            )}
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