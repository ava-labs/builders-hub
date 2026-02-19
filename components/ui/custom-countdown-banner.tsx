"use client";
import { Banner } from "fumadocs-ui/components/banner";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface TimeUnit {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function CountdownSegment({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="tabular-nums text-[13px] font-semibold tracking-tight">{value}</span>
      <span className="text-[9px] uppercase tracking-wider text-white/50">{label}</span>
    </span>
  );
}

function CountdownTimer({ targetDate, onComplete }: { targetDate: string; onComplete?: () => void }) {
  function calculateTimeLeft(): TimeUnit {
    const difference = +new Date(targetDate) - +new Date();
    if (difference <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / (1000 * 60)) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }

  const [timeLeft, setTimeLeft] = useState<TimeUnit>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isHydrated, setIsHydrated] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    setIsHydrated(true);
    const tick = () => {
      const next = calculateTimeLeft();
      setTimeLeft(next);
      if (+new Date(targetDate) - +new Date() <= 0 && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  if (!isHydrated) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono bg-white/[0.06] border border-white/[0.08] backdrop-blur-md px-3 py-1 rounded-full text-white/70">
        <span className="tabular-nums text-[13px]">--:--:--:--</span>
      </span>
    );
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span className="inline-flex items-center gap-2 font-mono bg-white/[0.06] border border-white/[0.08] backdrop-blur-md px-3 py-1.5 rounded-full">
      <CountdownSegment value={pad(timeLeft.days)} label="days" />
      <span className="text-white/25 text-xs">:</span>
      <CountdownSegment value={pad(timeLeft.hours)} label="hrs" />
      <span className="text-white/25 text-xs">:</span>
      <CountdownSegment value={pad(timeLeft.minutes)} label="min" />
      <span className="text-white/25 text-xs">:</span>
      <CountdownSegment value={pad(timeLeft.seconds)} label="sec" />
    </span>
  );
}

export function CustomCountdownBanner() {
  const deadlineDate = "2026-02-19T23:59:59-05:00";
  const [deadlinePassed, setDeadlinePassed] = useState(false);

  useEffect(() => {
    const bannerKey = "nd-banner-build-games-banner";
    localStorage.removeItem(bannerKey);
    document.documentElement.classList.remove("nd-banner-build-games-banner");
  }, []);

  useEffect(() => {
    if (+new Date() >= +new Date(deadlineDate)) setDeadlinePassed(true);
  }, []);

  if (deadlinePassed) return null;

  return (
    <div className="sticky top-0 z-50">
      <Banner
        id="build-games-banner"
        variant="normal"
        className="!bg-gradient-to-r !from-zinc-950 !via-zinc-900 !to-zinc-950 !text-white border-b border-white/[0.06]"
      >
        {/* Mobile */}
        <Link
          href="/build-games"
          className="md:hidden inline-flex items-center gap-2 text-[13px] tracking-tight"
        >
          <span className="font-medium">
            <strong className="text-red-400">Build Games</strong> — $1M Competition
          </span>
          <ArrowRight className="size-3.5 text-white/50" />
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex flex-row items-center justify-center gap-3 text-[13px] tracking-tight">
          <span className="font-medium">
            <strong className="text-red-400">Build Games</strong>
            <span className="text-white/60 mx-1.5">—</span>
            <strong className="italic text-white">$1,000,000</strong> <span className="text-white/90">Builder Competition on Avalanche</span>
          </span>

          <span className="text-white/20">|</span>

          <CountdownTimer targetDate={deadlineDate} onComplete={() => setDeadlinePassed(true)} />

          <Link
            href="/build-games"
            className="inline-flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] backdrop-blur-sm px-3 py-1 rounded-full text-[12px] font-medium transition-all duration-200"
          >
            Apply Now
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </Banner>
    </div>
  );
}
