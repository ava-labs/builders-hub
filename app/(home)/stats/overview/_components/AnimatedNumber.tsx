"use client";
import { useState, useEffect, useRef } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
}

// Animates display from 0 to `value` over `duration`, then continuously
// increments at the daily-rate implied by `value` (used for "txns since"-style
// counters where the absolute number keeps ticking up after the initial fill).
export function AnimatedNumber({ value, duration = 2000 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const lastIncrementTime = useRef<number | null>(null);
  const baseValue = useRef(0);
  const animationRef = useRef<number | null>(null);
  const hasReachedTarget = useRef(false);

  useEffect(() => {
    startTime.current = null;
    lastIncrementTime.current = null;
    baseValue.current = 0;
    hasReachedTarget.current = false;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;

      if (!hasReachedTarget.current) {
        const progress = Math.min(
          (timestamp - startTime.current) / duration,
          1
        );
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(easeOut * value);
        setDisplayValue(currentValue);

        if (progress >= 1) {
          hasReachedTarget.current = true;
          baseValue.current = value;
          setDisplayValue(value);
          lastIncrementTime.current = timestamp;
        }
      } else {
        if (!lastIncrementTime.current) lastIncrementTime.current = timestamp;

        const deltaMs = timestamp - lastIncrementTime.current;
        lastIncrementTime.current = timestamp;

        // Daily count → per-millisecond rate.
        const txnsPerMs = value / (24 * 60 * 60 * 1000);
        const increment = txnsPerMs * deltaMs;
        baseValue.current += increment;
        setDisplayValue(Math.floor(baseValue.current));
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
}
