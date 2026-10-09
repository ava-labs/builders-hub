'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const CIPHER = '0123456789abcdef#%&*+/<=>?';
/** How often an unresolved letter swaps to a new glyph. */
const FLICKER_MS = 45;

const randomGlyph = () => CIPHER[Math.floor(Math.random() * CIPHER.length)];

/**
 * Text that rolls through ciphertext glyphs and then resolves into the real string, left to right. Each glyph sits
 * over its invisible real letter, so the line keeps its exact width and wrapping while it scrambles. It plays on
 * mount and again on hover; with reduced motion it is plain text.
 */
export function DecryptText({
  text,
  className,
  duration = 1100,
  replayOnHover = true,
}: {
  text: string;
  className?: string;
  /** Time until the last letter resolves, in ms. */
  duration?: number;
  replayOnHover?: boolean;
}) {
  const [glyphs, setGlyphs] = useState<string[] | null>(null);
  const frame = useRef(0);
  const running = useRef(false);

  const play = useCallback(() => {
    if (running.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    running.current = true;
    const letters = [...text];
    const start = performance.now();
    let lastFlicker = 0;
    let current = letters.map((ch) => (ch.trim() ? randomGlyph() : ch));

    const tick = (now: number) => {
      const elapsed = now - start;
      // Letters resolve in order, spread across the duration; spaces never scramble.
      const resolved = Math.floor((elapsed / duration) * letters.length);
      if (resolved >= letters.length) {
        running.current = false;
        setGlyphs(null);
        return;
      }
      if (now - lastFlicker >= FLICKER_MS) {
        lastFlicker = now;
        current = letters.map((ch, i) => (i < resolved || !ch.trim() ? ch : randomGlyph()));
        setGlyphs(current);
      }
      frame.current = requestAnimationFrame(tick);
    };
    setGlyphs(current);
    frame.current = requestAnimationFrame(tick);
  }, [text, duration]);

  useEffect(() => {
    play();
    return () => {
      cancelAnimationFrame(frame.current);
      running.current = false;
    };
  }, [play]);

  const letters = [...text];
  return (
    <span className={className} onMouseEnter={replayOnHover ? play : undefined}>
      {glyphs ? (
        <>
          <span className="sr-only">{text}</span>
          <span aria-hidden>
            {letters.map((ch, i) =>
              glyphs[i] === ch ? (
                ch
              ) : (
                <span key={i} className="relative">
                  <span className="invisible">{ch}</span>
                  <span
                    className={cn(
                      'absolute inset-0 flex items-center justify-center font-mono font-normal',
                      'text-zinc-400 dark:text-zinc-500',
                    )}
                  >
                    {glyphs[i]}
                  </span>
                </span>
              ),
            )}
          </span>
        </>
      ) : (
        text
      )}
    </span>
  );
}
