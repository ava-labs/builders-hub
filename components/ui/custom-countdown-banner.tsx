"use client";
import { Banner } from "fumadocs-ui/components/banner";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface TimeUnit {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function RollingDigit({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (value !== displayValue) {
      const timeout = setTimeout(() => {setDisplayValue(value)}, 500);
      return () => clearTimeout(timeout);
    }
  }, [value, displayValue]);

  return (
    <span className="relative inline-block w-[0.6em] h-[1.2em] overflow-hidden">
      <span key={displayValue} className="absolute inset-0 flex items-center justify-center animate-[slideUp_0.5s_ease-out]">{displayValue}</span>
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </span>
  );
}

function TimeDisplay({ label, value }: { label: string; value: number }) {
  const digits = String(value).padStart(2, "0").split("");

  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="inline-flex">
        {digits.map((digit, index) => (
          <RollingDigit key={`${label}-${index}`} value={parseInt(digit)} />
        ))}
      </span>
      <span className="text-xs ml-0.5">{label}</span>
    </span>
  );
}

function CountdownTimer({ targetDate, onComplete }: { targetDate: string; onComplete?: () => void }) {
  function calculateTimeLeft(): TimeUnit {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft: TimeUnit = { days: 0, hours: 0, minutes: 0, seconds: 0 };
    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
    return timeLeft;
  }

  const [timeLeft, setTimeLeft] = useState<TimeUnit>(calculateTimeLeft());
  const completedRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const next = calculateTimeLeft();
      setTimeLeft(next);
      const remainingMs = +new Date(targetDate) - +new Date();
      if (remainingMs <= 0 && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  return (
    <span className="font-semibold font-mono bg-black/10 px-3 py-1 rounded-md backdrop-blur-sm inline-flex items-center gap-0.5">
      <TimeDisplay label="d" value={timeLeft.days} />
      <span className="opacity-50">:</span>
      <TimeDisplay label="h" value={timeLeft.hours} />
      <span className="opacity-50">:</span>
      <TimeDisplay label="m" value={timeLeft.minutes} />
      <span className="opacity-50">:</span>
      <TimeDisplay label="s" value={timeLeft.seconds} />
    </span>
  );
}

export function CustomCountdownBanner() {
  const deadlineDate = "2026-01-17T23:59:59-05:00";
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  useEffect(() => {
    const bannerKey = "nd-banner-hardware-banner";
    localStorage.removeItem(bannerKey);
    document.documentElement.classList.remove("nd-banner-hardware-banner");
  }, []);

  // check if deadline has already passed
  useEffect(() => {
    const isPassed = +new Date() >= +new Date(deadlineDate);
    if (isPassed) { setDeadlinePassed(true) }
  }, []);

  // don't show banner after deadline
  if (deadlinePassed) { return null }

  return (
    <Banner
      id="hardware-banner"
      variant="rainbow"
      style={{background: "linear-gradient(90deg, #E53935 0%, #FF6B35 50%, #F4511E 100%)", color: "#000",}}
    >
      <Link href="/docs/acps/256-hardware-recommendations" className="md:hidden inline-flex items-center gap-1 flex-wrap justify-center">
        <span><strong className="underline">Hardware Update:</strong> Use NVMe SSD by Jan 17</span>
      </Link>

      <div className="hidden md:flex flex-row items-center justify-center gap-2 text-center">
        <span><strong>Primary Network Node Hardware Requirement Update:</strong> Use a locally-mounted NVMe SSD by Jan 17</span>
        <span className="flex items-center gap-2">
          <span>•</span>
          <CountdownTimer targetDate={deadlineDate} onComplete={() => setDeadlinePassed(true)} />
          <span className="hidden md:inline">•</span>
          <Link href="/docs/acps/256-hardware-recommendations" className="underline underline-offset-4 hover:opacity-80 transition-opacity">Read More</Link>
        </span>
      </div>
    </Banner>
  );
}