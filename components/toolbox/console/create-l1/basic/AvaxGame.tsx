'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bird, Footprints, Orbit, Shuffle, Trees } from 'lucide-react';
import { AvaxFlapper } from './AvaxFlapper';
import { AvaxRunner } from './AvaxRunner';
import { AvaxSlope } from './AvaxSlope';
import { AvaxSpin } from './AvaxSpin';
import { cn } from '@/lib/utils';

/**
 * Shell that picks one of the four "play while you wait" games on mount
 * and lets the user swap via a small exit button in each game. Clicking
 * "Swap" brings up the selection screen, which offers direct picks plus
 * a "Random" button.
 *
 * SSR safety: we initialize to a fixed kind, then randomize on first
 * client effect. Initializing `useState(() => Math.random() > ...)` would
 * produce different server vs. client HTML and trigger hydration warnings.
 */

const WIDTH = 600;
const HEIGHT = 180;

type GameKind = 'runner' | 'flappy' | 'slope' | 'spin';
type ShellState = GameKind | 'select';

const GAME_KINDS: GameKind[] = ['runner', 'flappy', 'slope', 'spin'];

type GameMeta = {
  label: string;
  blurb: string;
  Icon: typeof Footprints;
};

const GAME_META: Record<GameKind, GameMeta> = {
  runner: { label: 'Runner', blurb: 'Jump obstacles', Icon: Footprints },
  flappy: { label: 'Flap', blurb: 'Thread the pipes', Icon: Bird },
  slope: { label: 'Ski', blurb: 'Dodge trees', Icon: Trees },
  spin: { label: 'Orbit', blurb: 'Spin to the gap', Icon: Orbit },
};

function pickRandomKind(exclude?: GameKind): GameKind {
  const pool = exclude ? GAME_KINDS.filter((k) => k !== exclude) : GAME_KINDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function AvaxGame({ className }: { className?: string }) {
  // Stable initial value so SSR + first client render match. Real pick
  // happens in the useEffect below.
  const [kind, setKind] = useState<ShellState>('runner');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setKind(pickRandomKind());
    setHydrated(true);
  }, []);

  const back = useCallback(() => setKind('select'), []);

  // Until client-side randomization runs, render the fixed initial game
  // (no flash — it's the same HTML the server sent).
  return (
    <div className={cn('relative', className)} style={{ width: WIDTH, height: HEIGHT }}>
      {kind === 'select' && hydrated && <GameSelect onPick={setKind} />}
      {kind === 'runner' && <AvaxRunner onExit={back} />}
      {kind === 'flappy' && <AvaxFlapper onExit={back} />}
      {kind === 'slope' && <AvaxSlope onExit={back} />}
      {kind === 'spin' && <AvaxSpin onExit={back} />}
    </div>
  );
}

function GameSelect({ onPick }: { onPick: (kind: GameKind) => void }) {
  const pickRandom = () => onPick(pickRandomKind());

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-2.5 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-zinc-50 to-zinc-100/60 dark:from-zinc-900 dark:to-zinc-950 p-3"
      style={{ width: WIDTH, height: HEIGHT }}
    >
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-500">
          Pick a game
        </span>
        <button
          type="button"
          onClick={pickRandom}
          className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          aria-label="Pick a random game"
        >
          <Shuffle className="h-3 w-3" />
          <span>Random</span>
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {GAME_KINDS.map((k) => {
          const meta = GAME_META[k];
          return (
            <motion.button
              key={k}
              type="button"
              onClick={() => onPick(k)}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.96 }}
              className="group flex w-[100px] flex-col items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 px-2 py-2 transition-colors hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-white dark:hover:bg-zinc-900"
            >
              <meta.Icon className="h-4 w-4 text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
              <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{meta.label}</span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{meta.blurb}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
