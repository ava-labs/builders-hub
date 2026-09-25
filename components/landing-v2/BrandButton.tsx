"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Brand CTA per avax.network/business: square block, label left, arrow
 * right. Primary is brand red with a dark arrow; secondary is brand dark
 * with a red edge bar and red arrow. Light is white with a dark label, for
 * dark grounds; its sweep is brand dark and flips the label white. The
 * others sweep brand light in from the left and flip the label dark.
 */
export function BrandButton({
  href,
  children,
  variant = "primary",
  onClick,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "light";
  onClick?: () => void;
  className?: string;
}) {
  const isPrimary = variant === "primary";
  const isLight = variant === "light";
  return (
    <span className={`group inline-flex items-stretch ${className}`}>
      {/* the red edge bar yields to the sweep: once the light fill takes
          over, the accent has moved to the arrow */}
      {variant === "secondary" && (
        <span
          aria-hidden
          className="w-1 shrink-0 bg-[#E6212F] transition-opacity duration-300 group-hover:opacity-0"
        />
      )}
      <Link
        href={href}
        onClick={onClick}
        className={`relative inline-flex w-full min-w-[220px] items-center justify-between gap-8 overflow-hidden px-6 py-4 text-sm font-semibold transition-colors duration-300 ${
          isLight
            ? "bg-white text-[#1F1F1F] group-hover:text-white"
            : `text-white group-hover:text-[#1F1F1F] ${isPrimary ? "bg-[#E6212F]" : "bg-[#1F1F1F]"}`
        }`}
      >
        <span
          aria-hidden
          className={`absolute inset-0 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100 ${
            isLight ? "bg-[#1F1F1F]" : "bg-[#EBF0FA]"
          }`}
        />
        <span className="relative z-10">{children}</span>
        <ArrowRight
          className={`relative z-10 h-4 w-4 shrink-0 transition-colors duration-300 ${
            isPrimary ? "text-[#1F1F1F] group-hover:text-[#E6212F]" : "text-[#E6212F]"
          }`}
        />
      </Link>
    </span>
  );
}
