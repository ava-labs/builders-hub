"use client";

import { Link } from "lucide-react";
import { cn } from "@/lib/utils";

interface LinkableHeadingProps {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  id: string;
  children: React.ReactNode;
  className?: string;
  offset?: number;
}

export function LinkableHeading({
  as: Component = "h2",
  id,
  children,
  className,
  offset = 180,
}: LinkableHeadingProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const elementPosition =
        element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth",
      });
      // Update URL hash without triggering hashchange scroll
      window.history.pushState(null, "", `#${id}`);
    }
  };

  return (
    <Component
      id={id}
      className={cn(
        "flex scroll-mt-32 flex-row items-center gap-2",
        className
      )}
    >
      <a
        data-card=""
        href={`#${id}`}
        onClick={handleClick}
        className="peer"
      >
        {children}
      </a>
      <Link
        aria-label="Link to section"
        className="size-3.5 shrink-0 text-zinc-400 dark:text-zinc-500 opacity-0 transition-opacity peer-hover:opacity-100"
      />
    </Component>
  );
}
