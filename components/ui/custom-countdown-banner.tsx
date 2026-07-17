"use client";
import { useEffect, useState } from "react";
import { Banner } from "fumadocs-ui/components/banner";
import Link from "next/link";
import { useCountdown } from "@/components/hackathons/project-submission/hooks/Count-down";

const BLOG_URL = "/blog/helicon-upgrade";
const ACTIVATION = Date.UTC(2026, 6, 20, 0, 0, 0); // Fuji Testnet activation: Placeholder TDB

export function CustomCountdownBanner() {
  const timeLeft = useCountdown(ACTIVATION);
  // Only render the live countdown after mount. Its value depends on Date.now(),
  // so rendering it during SSR produces a server/client text mismatch (React #418)
  // on every page this banner appears on via the layout.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Banner
      id="helicon-upgrade-fuji-2026"
      variant="rainbow"
      className="z-50 max-md:!h-auto max-md:min-h-12 max-md:py-2"
      style={{ background: "linear-gradient(90deg, #0b1e30 0%, #1a3a5c 50%, #0b1e30 100%)", color: "#fff" }}
    >
      <div className="inline-flex items-center gap-2 flex-wrap justify-center text-center">
        <span className="md:hidden">
          <strong>Helicon Upgrade</strong> hits the Fuji Testnet <strong>July 20</strong>.
        </span>
        <span className="hidden md:inline">
          <strong>Avalanche Helicon Upgrade</strong> activates on the Fuji Testnet on{" "}
          <strong>DATE TBD 2026</strong>: auto-renewed staking, shorter minimum durations, and Streaming Asynchronous Execution.
        </span>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold tracking-wide">
          {mounted ? `Fuji in${timeLeft}` : "Fuji Testnet July 20"}
        </span>
        <Link
          href={BLOG_URL}
          className="underline underline-offset-4 hover:text-[#66acd6] transition-colors"
        >
          Read more
        </Link>
      </div>
    </Banner>
  );
}
