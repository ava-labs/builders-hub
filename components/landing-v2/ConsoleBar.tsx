"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Full-bleed console CTA band closing the solutions surfaces: the
 * BrandButton grammar at section scale — brand-dark ground, brand-light
 * sweep entering from the left (the system's horizontal reveal), red
 * held for the arrow. The sweep is an aria-hidden copy of the hovered band
 * (.sweep-copy in app/global.css), so the label flips where the fill passes.
 */
export default function ConsoleBar() {
  return (
    <Link href="/console" className="relative flex items-center justify-between overflow-hidden bg-[#1F1F1F] py-5">
      <span className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-6">
        <span className="text-sm font-medium text-white">Build yours in the Console</span>
        <ArrowRight className="h-4 w-4 text-[#E6212F]" />
      </span>
      <span aria-hidden inert className="sweep-copy bg-[#EBF0FA]">
        <span className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-6">
          <span className="text-sm font-medium text-[#1F1F1F]">Build yours in the Console</span>
          <ArrowRight className="h-4 w-4 text-[#E6212F]" />
        </span>
      </span>
    </Link>
  );
}
