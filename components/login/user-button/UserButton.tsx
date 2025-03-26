"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isAuthenticated && session?.user?.image ? (
          <Button variant="ghost" size="icon" className="rounded-full h-5 w-5">
            <Image
              src={session.user.image}
              alt="User Avatar"
              width={20}
              height={20}
              className="rounded-full"
            />
          </Button>
        ) : (
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
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-black border-zinc-600 text-white shadow-lg p-1 rounded-md w-48">
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

<SignOutComponent
isOpen={isDialogOpen}
onOpenChange={setIsDialogOpen}
onConfirm={handleSignOut}
/>
</>
  );
}
