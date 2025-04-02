import { useState, useEffect } from "react";

interface TimeLeft {

  days: number;
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
  const now: number = Date.now();
  let difference: number = targetDate - now;

  if (difference < 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }


  const dayInMs = 1000 * 60 * 60 * 24;
  const days = Math.floor(difference / dayInMs);
  difference %= dayInMs;

  const hours = Math.floor(difference / (1000 * 60 * 60));
  difference %= 1000 * 60 * 60;

  const minutes = Math.floor(difference / (1000 * 60));
  difference %= 1000 * 60;

  const seconds = Math.floor(difference / 1000);

  return {  days, hours, minutes, seconds };
}

function formatTimeLeft(timeLeft: TimeLeft): string {
  return ` ${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}min ${timeLeft.seconds}s`;
}
