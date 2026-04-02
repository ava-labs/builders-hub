"use client";
import { useEffect } from "react";
import { Banner } from "fumadocs-ui/components/banner";
import Link from "next/link";

const ACP_267_URL = "/docs/acps/267-uptime-requirement-increase";
const BANNER_ID = "acp-267-validator-uptime-banner";

export function CustomCountdownBanner() {
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    const sync = () => {
      const el = document.getElementById(BANNER_ID);
      // Banner hidden or dismissed → clear override so variable falls back to 0
      if (!el || el.offsetHeight === 0) {
        document.documentElement.style.removeProperty("--fd-banner-height");
        return;
      }
      const h = el.getBoundingClientRect().height;
      if (h > 0) {
        document.documentElement.style.setProperty("--fd-banner-height", `${h}px`);
      }
    };

    // Wait one frame for fumadocs to render the banner element
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(BANNER_ID);
      if (!el) return;

      ro = new ResizeObserver(sync);
      ro.observe(el);

      // Detect banner dismiss — fumadocs adds a class to <html>
      mo = new MutationObserver(sync);
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });

      sync();
    });

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      mo?.disconnect();
      document.documentElement.style.removeProperty("--fd-banner-height");
    };
  }, []);

  return (
    <Banner
      id={BANNER_ID}
      variant="rainbow"
      className="z-50 max-md:!h-auto max-md:min-h-12 max-md:py-2"
      style={{
        background:
          "linear-gradient(90deg, #0b1e30 0%, #1a3a5c 50%, #0b1e30 100%)",
        color: "#fff",
      }}
    >
      <div className="inline-flex items-center gap-2 flex-wrap justify-center text-center">
        <span className="md:hidden">
          ACP-267: Primary Network validator uptime requirement increases from{" "}
          <strong>80%</strong> to <strong>90%</strong>.
        </span>
        <span className="hidden md:inline">
          ACP-267 Update: Primary Network validators must maintain at least{" "}
          <strong>90% uptime</strong> (up from <strong>80%</strong>) to remain
          eligible for rewards.
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
