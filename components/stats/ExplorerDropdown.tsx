"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BlockExplorer } from "@/types/stats";

interface ExplorerDropdownProps {
  explorers?: BlockExplorer[];
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
  showIcon?: boolean;
  buttonText?: string;
}

export function ExplorerDropdown({
  explorers,
  size = "sm",
  variant = "outline",
  showIcon = true,
  buttonText = "View Explorer",
}: ExplorerDropdownProps) {
  // No explorers available
  if (!explorers || explorers.length === 0) {
    return null;
  }

  // Single explorer - show direct link button
  if (explorers.length === 1) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          window.open(explorers[0].link, "_blank");
        }}
        className="flex items-center gap-2 whitespace-nowrap"
      >
        {buttonText}
        {showIcon && <ArrowUpRight className="h-4 w-4" />}
      </Button>
    );
  }

  // Multiple explorers - show dropdown menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 whitespace-nowrap"
        >
          {buttonText}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {explorers.map((explorer, index) => (
          <DropdownMenuItem
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              window.open(explorer.link, "_blank");
            }}
            className="cursor-pointer text-xs"
          >
            {explorer.name}
            <ArrowUpRight className="h-3 w-3 ml-auto" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
