"use client";
import { useState, useEffect, useRef } from "react";

interface SpeedGaugeProps {
  value: number;
}

// Speedometer-style gauge with the needle pinned at max and vibrating slightly
// to convey "running at the limit." Used for aggregate TPS in the overview hero.
export function SpeedGauge({ value }: SpeedGaugeProps) {
  const [vibration, setVibration] = useState(0);
  const gaugeId = useRef(
    `gauge-${Math.random().toString(36).substr(2, 9)}`
  ).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setVibration(Math.random() * 4 - 2);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative inline-flex items-baseline gap-1.5 sm:gap-3 md:gap-4">
      <div className="relative w-10 h-6 sm:w-16 sm:h-9 md:w-20 md:h-12">
        <svg
          className="w-full h-full"
          viewBox="0 0 80 48"
          overflow="visible"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id={gaugeId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          <path
            d="M 8 44 A 32 32 0 0 1 72 44"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className="text-zinc-200 dark:text-zinc-700"
          />

          <path
            d="M 8 44 A 32 32 0 0 1 72 44"
            fill="none"
            stroke={`url(#${gaugeId})`}
            strokeWidth="6"
            strokeLinecap="round"
          />

          <line
            x1="40"
            y1="44"
            x2="40"
            y2="16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-zinc-800 dark:text-zinc-100"
            style={{
              transformOrigin: "40px 44px",
              transform: `rotate(${90 + vibration}deg)`,
            }}
          />

          <circle
            cx="40"
            cy="44"
            r="4"
            fill="currentColor"
            className="text-zinc-800 dark:text-zinc-100"
          />
        </svg>
      </div>
      <div className="flex items-baseline">
        <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
          {value.toFixed(2)}
        </span>
        <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
          TPS
        </span>
      </div>
    </div>
  );
}
