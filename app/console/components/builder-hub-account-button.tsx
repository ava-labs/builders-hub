'use client';

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CircleUserRound, Globe, LogOut, Plus, RefreshCw, RotateCcw, Telescope, User, Wallet } from "lucide-react";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export function BuilderHubAccountButton() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
    
    const isAuthenticated = status === 'authenticated';
    const isLoading = status === 'loading';

    const handleSignOut = () => {
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
        
        signOut({ callbackUrl: '/login' });
    };

    const handleLoginClick = () => {
        // Store current URL as callback for after login
        const currentUrl = window.location.href;
        router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`);
    };

    if (isLoading) {
        return (
            <Button variant="outline" size="sm" disabled>
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">    
                        <CircleUserRound className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <span className="text-sm font-medium leading-none">Loading...</span>
                </div>
            </Button>
        );
    }

    return (isAuthenticated ? (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">    
                            {session?.user?.image ? (
                                <Image
                                    src={session.user.image}
                                    alt="User Avatar"
                                    width={20}
                                    height={20}
                                    className="rounded-md"
                                />
                            ) : (
                                <CircleUserRound className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                            )}
                        </div>
                        <div className="flex gap-2 items-center">
                            <span className="text-sm font-medium leading-none">
                                {session?.user?.name || session?.user?.email?.split('@')[0] || 'User'}
                            </span>
                        </div>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuItem disabled>
                    {session?.user?.email || 'No email available'}
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                    {session?.user?.name || 'No name available'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <User className="mr-2 h-3 w-3" />
                    Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-3 w-3" />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    ) : (
        <Button size="sm" onClick={handleLoginClick}>
            Log In
        </Button>
    ));
}
