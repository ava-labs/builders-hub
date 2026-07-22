"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Full-bleed console CTA band closing the solutions surfaces: the
 * BrandButton grammar at section scale — brand-dark ground, brand-light
 * sweep entering from the left (the system's horizontal reveal), red
 * held for the arrow.
 */
export default function ConsoleBar() {
  return (
    <Link
      href="/console"
      className="group relative flex items-center justify-between overflow-hidden bg-[#1F1F1F] py-5"
    >
      <span
        aria-hidden
        className="absolute inset-0 origin-left scale-x-0 bg-[#EBF0FA] transition-transform duration-300 ease-out group-hover:scale-x-100"
      />
      <span className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-6">
        <span className="text-sm font-medium text-white transition-colors duration-300 group-hover:text-[#1F1F1F]">
          Build yours in the Console
        </span>
        <ArrowRight className="h-4 w-4 text-[#E6212F]" />
      </span>
    </Link>
  );
}
