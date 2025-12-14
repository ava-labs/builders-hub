"use client";

import { useState } from "react";
import { Link, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface LinkableHeadingProps {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function LinkableHeading({
  as: Component = "h2",
  id,
  children,
  className,
}: LinkableHeadingProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Component
      id={id}
      className={cn(
        "flex scroll-mt-32 flex-row items-center gap-2",
        className
      )}
    >
      {children}
      <button
        onClick={handleCopyLink}
        className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors cursor-pointer"
        aria-label="Copy link to section"
        title={copied ? "Copied!" : "Copy link"}
      >
        {copied ? (
          <Check className="size-3.5 text-green-500" />
        ) : (
          <Link className="size-3.5" />
        )}
      </button>
    </Component>
  );
}
