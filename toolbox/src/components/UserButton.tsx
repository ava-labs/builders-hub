"use client";

import { useState, useEffect } from "react";
import { Button } from "./Button";
import { CircleUserRound } from "lucide-react";

interface UserButtonProps {
  showLoginText?: boolean;
  loginText?: string;
}

export function UserButton({ 
  showLoginText = false, 
  loginText = "Login to Builder Hub" 
}: UserButtonProps = {}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Show loading state during client-side hydration
  if (!isClient) {
    return (
      <div className="w-10 h-10 ml-4 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
    );
  }

  const handleLogin = () => {
    // Navigate to the main site's login page
    window.location.href = "/login";
  };

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