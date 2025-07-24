"use client";

import { useState, useEffect } from "react";
import { Button } from "./Button";
import { CircleUserRound, ChevronDown, LogOut } from "lucide-react";

interface UserInfo {
  id: string;
  name?: string;
  email?: string;
  image?: string;
}

interface UserButtonProps {
  showLoginText?: boolean;
  loginText?: string;
}

export function UserButton({ 
  showLoginText = false, 
  loginText = "Login to Builder Hub" 
}: UserButtonProps = {}) {
  const [isClient, setIsClient] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setIsClient(true);
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Try to fetch node registrations as a way to check auth status
      // This endpoint requires authentication and will return 401 if not logged in
      const response = await fetch('/api/node-registrations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // User is authenticated
        setIsAuthenticated(true);
        // We could extract user info from other APIs, but for now we'll show a generic authenticated state
        setUserInfo({
          id: 'user',
          name: 'User',
          email: 'user@example.com'
        });
      } else {
        // User is not authenticated
        setIsAuthenticated(false);
        setUserInfo(null);
      }
    } catch (error) {
      console.debug('Auth check failed:', error);
      setIsAuthenticated(false);
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    // Navigate to the main site's login page
    window.location.href = "/login";
  };

  const handleLogout = () => {
    // Navigate to logout endpoint
    window.location.href = "/api/auth/signout";
  };

  const handleProfile = () => {
    // Navigate to profile page
    window.location.href = "/profile";
  };

  // Show loading state during client-side hydration or auth check
  if (!isClient || isLoading) {
    return (
      <div className="w-10 h-10 ml-4 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
    );
  }

  // If user is authenticated, show user menu
  if (isAuthenticated && userInfo) {
    return (
      <div className="relative ml-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDropdown(!showDropdown)}
          className="h-10 px-3 py-2 w-auto flex items-center gap-2"
        >
          {userInfo.image ? (
            <img
              src={userInfo.image}
              alt="User Avatar"
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <CircleUserRound
              className="!h-6 !w-6 stroke-zinc-900 dark:stroke-white"
              strokeWidth={0.85}
            />
          )}
          {showLoginText && (
            <span className="text-sm font-medium">
              {userInfo.name || userInfo.email || 'User'}
            </span>
          )}
          <ChevronDown className="!h-4 !w-4 stroke-zinc-900 dark:stroke-white" />
        </Button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg shadow-lg z-50">
            <div className="py-1">
              <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-600">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {userInfo.name || 'User'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {userInfo.email || 'user@example.com'}
                </p>
              </div>
              <button
                onClick={handleProfile}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Click outside to close dropdown */}
        {showDropdown && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  }

  // If user is not authenticated, show login button
  return (
    <Button
      variant="outline"
      size={showLoginText ? "default" : "sm"}
      onClick={handleLogin}
      className={showLoginText 
        ? "h-10 ml-4 cursor-pointer px-4 py-2 w-auto" 
        : "rounded-full h-10 w-10 ml-4 cursor-pointer p-0 w-auto"
      }
    >
      <div className={showLoginText ? "flex items-center gap-2" : ""}>
        <CircleUserRound
          className="!h-6 !w-6 stroke-zinc-900 dark:stroke-white"
          strokeWidth={0.85}
        />
        {showLoginText && (
          <span className="text-sm font-medium">{loginText}</span>
        )}
      </div>
    </Button>
  );
} 