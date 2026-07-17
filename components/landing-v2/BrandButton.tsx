"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Brand CTA per avax.network/business: square block, label left, arrow
 * right. Primary is brand red with a dark arrow; secondary is brand dark
 * with a red edge bar and red arrow. Hover sweeps brand light in from the
 * left and flips the label dark (the reference's fade-in effect).
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
  variant?: "primary" | "secondary";
  onClick?: () => void;
  className?: string;
}) {
  const isPrimary = variant === "primary";
  return (
    <span className={`group inline-flex items-stretch ${className}`}>
      {/* the red edge bar yields to the sweep: once the light fill takes
          over, the accent has moved to the arrow */}
      {!isPrimary && (
        <span
          aria-hidden
          className="w-1 shrink-0 bg-[#E6212F] transition-opacity duration-300 group-hover:opacity-0"
        />
      )}
      <Link
        href={href}
        onClick={onClick}
        className={`relative inline-flex w-full min-w-[220px] items-center justify-between gap-8 overflow-hidden px-6 py-4 text-sm font-semibold text-white transition-colors duration-300 group-hover:text-[#1F1F1F] ${
          isPrimary ? "bg-[#E6212F]" : "bg-[#1F1F1F]"
        }`}
      >
        <span
          aria-hidden
          className="absolute inset-0 origin-left scale-x-0 bg-[#EBF0FA] transition-transform duration-300 ease-out group-hover:scale-x-100"
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
