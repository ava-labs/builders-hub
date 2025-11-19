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
      const timeout = setTimeout(() => {
        setDisplayValue(value);
      }, 500);
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

    // initial tick ensures immediate evaluation on mount
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  return (
    <span className="font-semibold font-mono bg-white/20 px-3 py-1 rounded-md backdrop-blur-sm inline-flex items-center gap-0.5">
      <TimeDisplay label="d" value={timeLeft.days} />
      <span className="text-white/50">:</span>
      <TimeDisplay label="h" value={timeLeft.hours} />
      <span className="text-white/50">:</span>
      <TimeDisplay label="m" value={timeLeft.minutes} />
      <span className="text-white/50">:</span>
      <TimeDisplay label="s" value={timeLeft.seconds} />
    </span>
  );
}

export function GraniteBanner() {
  const activationDate = "2025-11-19T11:00:00-05:00";
  const [activated, setActivated] = useState(false);

  // Clear localStorage on mount so banner always shows on refresh
  useEffect(() => {
    const bannerKey = "nd-banner-granite-banner";
    localStorage.removeItem(bannerKey);
    // Also remove the class that hides the banner
    document.documentElement.classList.remove("nd-banner-granite-banner");
  }, []);

  // Determine if activation has already passed on initial mount
  useEffect(() => {
    const isActivated = +new Date() >= +new Date(activationDate);
    if (isActivated) {
      setActivated(true);
    }
  }, []);

  return (
    <Banner id="granite-banner" variant="rainbow" changeLayout={false} data-granite-banner style={{ background: "linear-gradient(90deg, #FFB3F0 0%, #8FC5E6 100%)" }}>
      {activated ? (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-center px-2">
          <span className="text-sm sm:text-base">
            Avalanche Network <strong>Granite upgrade</strong> activated.
          </span>
          <span className="hidden sm:inline">•</span>
          <Link href="/blog/granite-upgrade" className="text-sm sm:text-base underline underline-offset-4 hover:text-fd-primary transition-colors">
            Learn more
          </Link>
        </div>
      ) : (
        <>
          <div className="lg:hidden flex flex-col items-center justify-center gap-1.5 text-center px-2 py-1">
            <span className="text-sm">Granite Upgrade Activates in</span>
            <CountdownTimer targetDate={activationDate} onComplete={() => setActivated(true)} />
            <Link href="/blog/granite-upgrade" className="text-xs underline underline-offset-4 hover:text-fd-primary transition-colors">
              Learn more
            </Link>
          </div>

          <div className="hidden lg:flex flex-row items-center justify-center gap-2 text-center">
            <span>
              Avalanche Network <strong>Granite upgrade</strong> released. All Mainnet
              nodes must upgrade by <strong>11 AM ET, November 19, 2025</strong>
            </span>
            <span className="flex items-center gap-2">
              <span>•</span>
              <CountdownTimer targetDate={activationDate} onComplete={() => setActivated(true)} />
              <span>•</span>
              <Link href="/blog/granite-upgrade" className="underline underline-offset-4 hover:text-fd-primary transition-colors">
                Learn more
              </Link>
            </span>
          </div>
        </>
      )}
    </Banner>
  );
}
