'use client';

import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { CircleUserRound } from 'lucide-react';
import { Separator } from "../../../components/ui/separator";
import { useState } from 'react';

interface UserButtonProps {
  className?: string;
}

// Mock session data - in a real implementation, you'd use next-auth or similar
const mockSession = {
  user: {
    email: "user@example.com",
    name: "Demo User",
    image: null
  }
};

export function UserButton({ className }: UserButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // For demo purposes, we'll assume not authenticated initially
  // In a real implementation, you'd check actual auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleSignOut = (): void => {
    // Clean up any stored data
    if (typeof window !== "undefined") {
      localStorage.removeItem("redirectAfterProfile");
      
      // Clean up any form data stored in localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("formData_")) {
          localStorage.removeItem(key);
        }
      });
    }
    
    setIsAuthenticated(false);
  };

  const handleLogin = () => {
    // For demo purposes, simulate login
    setIsAuthenticated(true);
    // In a real implementation, redirect to login page or open auth modal
    // window.open('https://your-main-site.com/login', '_blank');
  };

  return (
    <div className={className}>
      {isAuthenticated ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='rounded-full h-8 w-8 cursor-pointer p-1'
            >
              {mockSession.user.image ? (
                <img
                  src={mockSession.user.image}
                  alt='User Avatar'
                  width={24}
                  height={24}
                  className='rounded-full'
                />
              ) : (
                <CircleUserRound
                  className='!h-6 !w-6 stroke-current'
                  strokeWidth={0.85}
                />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='bg-background text-foreground border shadow-lg p-1 rounded-md w-48'
            align="end"
          >
            <div className="px-2 py-1.5">
              <p className="text-sm break-words">
                {mockSession.user.email || 'No email available'}
              </p>
              
              <p className="text-sm break-words mt-1">
                {mockSession.user.name || 'No name available'}
              </p>
            </div>
            <Separator className="my-1" />

            <DropdownMenuItem asChild className='cursor-pointer'>
              <a href="/" target="_blank" rel="noopener noreferrer">
                Builder Hub Profile
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSignOut}
              className='cursor-pointer text-red-600 dark:text-red-400'
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          size='sm'
          variant='outline'
          className='h-8 text-xs'
          onClick={handleLogin}
        >
          <CircleUserRound className='mr-2 h-3 w-3' />
          Login to Builder Hub
        </Button>
      )}
    </div>
  );
} 