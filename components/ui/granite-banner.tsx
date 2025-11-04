"use client";
import { Banner } from "fumadocs-ui/components/banner";
import { useEffect, useState } from "react";
import Link from "next/link";

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function calculateTimeLeft() {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft = { days: 0, hours: 0 };
    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      };
    }
    return timeLeft;
  }

  const hasTimeLeft = timeLeft.days > 0 || timeLeft.hours > 0;
  
  if (!hasTimeLeft) {
    return (
      <span className="font-semibold text-red-600 animate-pulse">Update Now!</span>
    );
  }

  return (
    <span className="font-semibold font-mono">
      {timeLeft.days}d {timeLeft.hours}h
    </span>
  );
}

export function GraniteBanner() {
  const activationDate = "2025-11-19T11:00:00-05:00";

  return (
    <Banner id="granite-banner" variant="rainbow" style={{background: "linear-gradient(90deg, #FFB3F0 0%, #8FC5E6 100%)"}}>
      <div className="flex flex-col md:flex-row items-center justify-center gap-2 text-center">
        <span>
          Avalanche Network <strong>Granite upgrade</strong> released. All Mainnet nodes must upgrade by{" "}
          <strong>11 AM ET, November 19, 2025</strong>, or face operational failure.
        </span>
        <span className="flex items-center gap-2">
          <span className="hidden md:inline">•</span>
          <CountdownTimer targetDate={activationDate} />
          <span className="hidden md:inline">•</span>
          <Link href="/blog/granite-upgrade" className="underline underline-offset-4 hover:text-fd-primary transition-colors">
            Learn more
          </Link>
        </span>
      </div>
    </Banner>
  );
}
