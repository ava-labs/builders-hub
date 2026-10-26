"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HoverPrefetchLink } from "@/components/landing-v2/HoverPrefetchLink";

/**
 * Brand CTA per avax.network/business: square block, label left, arrow
 * right. Primary is brand red with a dark arrow; secondary is brand dark
 * with a red edge bar and red arrow. Light is white with a dark label, for
 * dark grounds; its sweep is brand dark and flips the label white. The
 * others sweep brand light in from the left and flip the label dark. The
 * sweep is an aria-hidden copy of the hovered block, revealed from the left
 * (.sweep-copy in app/global.css), so the label flips exactly where the
 * fill passes; the arrow is red in every hovered state.
 */
export function BrandButton({
  href,
  children,
  variant = "primary",
  onClick,
  className = "",
  prefetchOnIntent = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "light";
  onClick?: () => void;
  className?: string;
  /** prefetch on hover, focus or touch, not on view (see HoverPrefetchLink) */
  prefetchOnIntent?: boolean;
}) {
  const isPrimary = variant === "primary";
  const isLight = variant === "light";
  const LinkTag = prefetchOnIntent ? HoverPrefetchLink : Link;
  return (
    // the whole block presses in under the finger, the secondary's edge bar
    // with it (no press under Reduce Motion). Hovering the block
    // (group/brand-cta, a name no other control uses) starts the sweep and
    // the edge bar's fade together (global.css); keyboard focus on the link
    // does both too
    <span
      className={`group/brand-cta inline-flex items-stretch transition-[scale] duration-160 ease-out active:scale-[0.97] motion-reduce:active:scale-100 ${className}`}
    >
      {/* the red edge bar yields to the sweep: once the light fill takes
          over, the accent has moved to the arrow */}
      {variant === "secondary" && (
        <span
          aria-hidden
          className="w-1 shrink-0 bg-[#E6212F] transition-opacity duration-300 group-hover/brand-cta:opacity-0 group-has-focus-visible/brand-cta:opacity-0"
        />
      )}
      <LinkTag
        href={href}
        onClick={onClick}
        // a keyboard focus ring in the brand red, offset clear of the block
        className={`relative inline-flex w-full min-w-[220px] items-center justify-between gap-8 overflow-hidden px-6 py-4 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-[#E6212F] ${
          isLight ? "bg-white text-[#1F1F1F]" : `text-white ${isPrimary ? "bg-[#E6212F]" : "bg-[#1F1F1F]"}`
        }`}
      >
        <span>{children}</span>
        <ArrowRight className={`h-4 w-4 shrink-0 ${isPrimary ? "text-[#1F1F1F]" : "text-[#E6212F]"}`} />
        <span
          aria-hidden
          inert
          className={`sweep-copy ${isLight ? "bg-[#1F1F1F] text-white" : "bg-[#EBF0FA] text-[#1F1F1F]"}`}
        >
          <span>{children}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-[#E6212F]" />
        </span>
      </LinkTag>
    </span>
  );
}
