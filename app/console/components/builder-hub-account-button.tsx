'use client';

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CircleUserRound, Globe, LogOut, Plus, RefreshCw, RotateCcw, Telescope, User, Wallet } from "lucide-react";
import { useState } from "react";

export function BuilderHubAccountButton() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (isLoggedIn ? <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">    
              <CircleUserRound className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium leading-none">
              Martin
            </span>
          </div>
        </div>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-56">
      <DropdownMenuItem >
          martin.eckardt@avalabs.org
      </DropdownMenuItem>
      <DropdownMenuItem >
          Martin Eckardt
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem >
        <User className="mr-2 h-3 w-3" />
        Profile
      </DropdownMenuItem>
      <DropdownMenuItem >
        <LogOut className="mr-2 h-3 w-3" />
        Sign Out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu> : <Button size="sm" onClick={() => setIsLoggedIn(true)}>Log In</Button>);
}

const formatBalance = (balance: number | string) => {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance
  if (isNaN(num)) return "0"
  return num.toFixed(2)
}