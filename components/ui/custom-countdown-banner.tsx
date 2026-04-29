"use client";
import { Banner } from "fumadocs-ui/components/banner";
import Link from "next/link";
import { useEffect, useState } from "react";

const FORM_URL = "/grants/avalanche-research-proposals";
const DEADLINE = Date.UTC(2026, 5, 1, 23, 59, 59); // June 1, 2026 (month is 0-indexed)

function getDaysRemaining(): number {
  const diff = DEADLINE - Date.now();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
}

export function CustomCountdownBanner() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    setDaysLeft(getDaysRemaining());
    const interval = setInterval(() => setDaysLeft(getDaysRemaining()), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const countdownLabel =
    daysLeft === null
      ? null
      : daysLeft === 0
        ? "Closes today"
        : daysLeft === 1
          ? "1 day left"
          : `${daysLeft} days left`;

  return (
    <Banner
      id="call-for-research-proposals-2026"
      variant="rainbow"
      className="z-50 max-md:!h-auto max-md:min-h-12 max-md:py-2"
      style={{ background: "linear-gradient(90deg, #0b1e30 0%, #1a3a5c 50%, #0b1e30 100%)", color: "#fff" }}
    >
      <div className="inline-flex items-center gap-2 flex-wrap justify-center text-center">
        <span className="md:hidden">
          <strong>Call for Research Proposals</strong> — up to <strong>$50,000</strong>. Deadline June 1, 2026.
        </span>
        <span className="hidden md:inline">
          <strong>Avalanche Foundation Call for Research Proposals</strong> — grants up to{" "}
          <strong>$50,000 USD</strong> for academic research on the economics of decentralized networks. Deadline June 1, 2026.
        </span>
        {countdownLabel && (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold tracking-wide">
            {countdownLabel}
          </span>
        )}
        <Link
          href={FORM_URL}
          className="underline underline-offset-4 hover:text-[#66acd6] transition-colors"
        >
          Apply now
        </Link>
      </div>
    </Banner>
  );
}
