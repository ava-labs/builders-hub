"use client";
import { Banner } from "fumadocs-ui/components/banner";
import Link from "next/link";

const ACP_267_URL = "/docs/acps/267-uptime-requirement-increase";

export function CustomCountdownBanner() {
  return (
    <Banner
      id="acp-267-validator-uptime-banner"
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
