"use client";

import { ArrowUpRight, Twitter, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExplorerDropdown } from "@/components/stats/ExplorerDropdown";
import { cn } from "@/lib/utils";

interface MobileSocialLinksProps {
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
  explorers?: Array<{ name: string; link: string }>;
  className?: string;
}

export function MobileSocialLinks({
  website,
  socials,
  explorers,
  className,
}: MobileSocialLinksProps) {
  const hasContent = website || socials?.twitter || socials?.linkedin || (explorers && explorers.length > 0);

  if (!hasContent) {
    return null;
  }

  return (
    <div className={cn("flex sm:hidden items-center gap-2 mt-4", className)}>
      {website && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
        >
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            Website
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </Button>
      )}
      {socials && (socials.twitter || socials.linkedin) && (
        <>
          {socials.twitter && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
            >
              <a
                href={`https://x.com/${socials.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </Button>
          )}
          {socials.linkedin && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
            >
              <a
                href={`https://linkedin.com/company/${socials.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </Button>
          )}
        </>
      )}
      {explorers && explorers.length > 0 && (
        <div className="[&_button]:border-zinc-300 dark:[&_button]:border-zinc-700 [&_button]:text-zinc-600 dark:[&_button]:text-zinc-400 [&_button]:hover:border-zinc-400 dark:[&_button]:hover:border-zinc-600">
          <ExplorerDropdown explorers={explorers} variant="outline" size="sm" />
        </div>
      )}
    </div>
  );
}
