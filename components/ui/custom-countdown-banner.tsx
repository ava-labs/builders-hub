"use client";
import { useEffect } from "react";
import { Banner } from "fumadocs-ui/components/banner";
import Link from "next/link";

const ACP_267_URL = "/docs/acps/267-uptime-requirement-increase";
const BANNER_ID = "acp-267-validator-uptime-banner";

export function CustomCountdownBanner() {
  // Sync actual rendered banner height to --fd-banner-height.
  // Fumadocs sets this variable to the static `height` prop (3rem), but on
  // mobile the banner uses h-auto and wraps to multiple lines, making it
  // taller. Fixed-position elements (subnav, TOC) use the variable for
  // their top offset, so a stale value causes a gap.
  useEffect(() => {
    const el = document.getElementById(BANNER_ID);
    if (!el) return;

    const sync = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) {
        document.documentElement.style.setProperty("--fd-banner-height", `${h}px`);
      }
    };

    const ro = new ResizeObserver(sync);
    ro.observe(el);
    sync();

    return () => ro.disconnect();
  }, []);

  return (
    <Banner
      id={BANNER_ID}
      variant="rainbow"
      className="z-50 max-md:!h-auto max-md:min-h-12 max-md:py-2"
      style={{ background: "linear-gradient(90deg, #0b1e30 0%, #1a3a5c 50%, #0b1e30 100%)", color: "#fff" }}
    >
      <div className="inline-flex items-center gap-2 flex-wrap justify-center text-center">
        <span className="md:hidden">
          ACP-267: Primary Network validator uptime requirement increases from{" "}
          <strong>80%</strong> to <strong>90%</strong>.
        </span>
        <span className="hidden md:inline">
          ACP-267 Update: Primary Network validators must maintain at least{" "}
          <strong>90% uptime</strong> (up from <strong>80%</strong>) to remain eligible for rewards.
        </span>
        <Link
          href={ACP_267_URL}
          className="underline underline-offset-4 hover:text-[#66acd6] transition-colors"
        >
          Read the proposal
        </Link>
      </div>
    </Banner>
  );
}
