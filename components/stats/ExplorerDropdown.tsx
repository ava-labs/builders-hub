"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
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

// Helper to check if link is internal (starts with /)
const isInternalLink = (link: string) => link.startsWith("/");

export function ExplorerDropdown({
  explorers,
  size = "sm",
  variant = "outline",
  showIcon = true,
  buttonText = "View Explorer",
}: ExplorerDropdownProps) {
  const router = useRouter();

  // Navigate to link - internal links use router, external open new tab
  const handleNavigate = (link: string) => {
    if (isInternalLink(link)) {
      router.push(link);
    } else {
      window.open(link, "_blank");
    }
  };

  // No explorers available
  if (!explorers || explorers.length === 0) {
    return null;
  }

  // Single explorer - show direct link button
  if (explorers.length === 1) {
    const explorer = explorers[0];
    const isInternal = isInternalLink(explorer.link);
    
    return (
      <Button
        variant={variant}
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          handleNavigate(explorer.link);
        }}
        className="flex items-center gap-2 whitespace-nowrap"
      >
        {buttonText}
        {showIcon && !isInternal && <ArrowUpRight className="h-4 w-4" />}
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
        {explorers.map((explorer, index) => {
          const isInternal = isInternalLink(explorer.link);
          return (
          <DropdownMenuItem
            key={index}
            onClick={(e) => {
              e.stopPropagation();
                handleNavigate(explorer.link);
            }}
            className="cursor-pointer text-xs"
          >
            {explorer.name}
              {!isInternal && <ArrowUpRight className="h-3 w-3 ml-auto" />}
          </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
