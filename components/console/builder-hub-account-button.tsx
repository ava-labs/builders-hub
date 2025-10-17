'use client';

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CircleUserRound, LogOut, User } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { LoginModal } from "@/components/login/LoginModal";

export function BuilderHubAccountButton() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { openLoginModal } = useLoginModalTrigger();
    
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
        openLoginModal(currentUrl);
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

    return (
        <>
            <LoginModal />
            {isAuthenticated ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                            {session?.user?.image ? (
                                <Image
                                    src={session.user.image}
                                    alt="User Avatar"
                                    width={20}
                                    height={20}
                                    className="rounded-md"
                                />
                            ) : (
                                <CircleUserRound className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                            )}
                            <span className="sr-only">Account menu</span>
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
            )}
        </>
    );
}