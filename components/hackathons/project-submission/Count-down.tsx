import { useState, useEffect } from "react";

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
}

export function useCountdown(targetDate: number): string {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeRemaining(targetDate));

  useEffect(() => {
    const interval: NodeJS.Timeout = setInterval(() => {
      setTimeLeft(getTimeRemaining(targetDate));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return formatTimeLeft(timeLeft);
}

function getTimeRemaining(targetDate: number): TimeLeft {
  const now: number = new Date().getTime();
  const difference: number = targetDate - now;

  return {
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

function formatTimeLeft(timeLeft: TimeLeft): string {
  return `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`;
}
