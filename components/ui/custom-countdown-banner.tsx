"use client";
import { Banner } from "fumadocs-ui/components/banner";
import Link from "next/link";

const ACP_267_URL =
  "https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/267-uptime-requirement-increase/README.md";

export function CustomCountdownBanner() {
  return (
    <Banner
      id="acp-267-validator-uptime-banner"
      variant="rainbow"
      className="z-50 max-md:!h-auto max-md:min-h-12 max-md:py-2"
    >
      <div className="inline-flex items-center gap-2 flex-wrap justify-center text-center">
        <span className="md:hidden">
          ACP-267: Primary Network validator uptime requirement increases from{" "}
          <strong>80%</strong> to <strong>90%</strong>.
        </span>
        <span className="hidden md:inline">
          ACP-267 update: Primary Network validators must maintain at least{" "}
          <strong>90% uptime</strong> (up from <strong>80%</strong>) to remain eligible for rewards.
        </span>
        <Link
          href={ACP_267_URL}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-[#66acd6] transition-colors"
        >
          Read the proposal
        </Link>
      </div>
    </Banner>
  );
}
