'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUp, Bird, Footprints, Loader2, Orbit, Shuffle, Train, Trees } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GameAudioProvider } from './useGameAudio';

// The mini-games are entertainment shown during the 3-minute Quick L1
// deploy wait — no point shipping their ~1.8k lines of canvas-game logic in
// the initial bundle that every visitor of /console/create-l1/basic loads.
// `next/dynamic` defers the chunk until the user actually renders the game,
// and `ssr: false` keeps the canvas code off the server (it'd error anyway —
// games rely on `window` and `requestAnimationFrame`). Each game has a tiny
// loading shell so the layout doesn't shift while the chunk fetches.
const GameLoading = () => (
  <div
    className="flex items-center justify-center gap-2 border border-zinc-200 bg-zinc-50 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500"
    style={{ width: 280, height: 500 }}
  >
    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
    Loading game…
  </div>
);

const AvaxFlapper = dynamic(() => import('./AvaxFlapper').then((m) => m.AvaxFlapper), {
  ssr: false,
  loading: GameLoading,
});
const AvaxRunner = dynamic(() => import('./AvaxRunner').then((m) => m.AvaxRunner), {
  ssr: false,
  loading: GameLoading,
});
const AvaxSlope = dynamic(() => import('./AvaxSlope').then((m) => m.AvaxSlope), {
  ssr: false,
  loading: GameLoading,
});
const AvaxSpin = dynamic(() => import('./AvaxSpin').then((m) => m.AvaxSpin), {
  ssr: false,
  loading: GameLoading,
});
const AvaxJumper = dynamic(() => import('./AvaxJumper').then((m) => m.AvaxJumper), {
  ssr: false,
  loading: GameLoading,
});
const AvaxDasher = dynamic(() => import('./AvaxDasher').then((m) => m.AvaxDasher), {
  ssr: false,
  loading: GameLoading,
});

/**
 * Shell that picks one of the "play while you wait" games on mount
 * and lets the user swap via a small exit button in each game. Clicking
 * "Swap" brings up the selection screen, which offers direct picks plus
 * a "Random" button.
 *
 * SSR safety: we initialize to a fixed kind, then randomize on first
 * client effect. Initializing `useState(() => Math.random() > ...)` would
 * produce different server vs. client HTML and trigger hydration warnings.
 */

const WIDTH = 280;
const HEIGHT = 500;

type GameKind = 'runner' | 'flappy' | 'slope' | 'spin' | 'jumper' | 'dasher';
type ShellState = GameKind | 'select';

const GAME_KINDS: GameKind[] = ['runner', 'flappy', 'slope', 'spin', 'jumper', 'dasher'];

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
  jumper: { label: 'Jump', blurb: 'Climb platforms', Icon: ArrowUp },
  dasher: { label: 'Dash', blurb: 'Switch lanes', Icon: Train },
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
  // GameAudioProvider owns a single AudioContext that survives the inner
  // game-component remounts on swap — keeps the loop click-free.
  return (
    <GameAudioProvider>
      <div className={cn('relative', className)} style={{ width: WIDTH, height: HEIGHT }}>
        {kind === 'select' && hydrated && <GameSelect onPick={setKind} />}
        {kind === 'runner' && <AvaxRunner onExit={back} />}
        {kind === 'flappy' && <AvaxFlapper onExit={back} />}
        {kind === 'slope' && <AvaxSlope onExit={back} />}
        {kind === 'spin' && <AvaxSpin onExit={back} />}
        {kind === 'jumper' && <AvaxJumper onExit={back} />}
        {kind === 'dasher' && <AvaxDasher onExit={back} />}
      </div>
    </GameAudioProvider>
  );
}

function GameSelect({ onPick }: { onPick: (kind: GameKind) => void }) {
  const pickRandom = () => onPick(pickRandomKind());

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-2.5 overflow-hidden border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 p-3"
      style={{ width: WIDTH, height: HEIGHT }}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Pick a game
        </span>
        <button
          type="button"
          onClick={pickRandom}
          className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          aria-label="Pick a random game"
        >
          <Shuffle className="h-3 w-3" />
          <span>Random</span>
        </button>
      </div>
      {/* 2-column grid sized for the portrait canvas — 4 side-by-side
          cards would overflow 280px width, and a single-column list
          would waste the vertical room. Cards deliberately roomier
          (p-3, w-[118px]) than the old 100px versions since we now
          have space to make them readable. */}
      <div className="grid grid-cols-2 gap-2">
        {GAME_KINDS.map((k) => {
          const meta = GAME_META[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(k)}
              className="group flex w-[118px] flex-col items-center gap-1 border border-zinc-200 bg-white px-3 py-3 transition-colors hover:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-100"
            >
              <meta.Icon className="h-5 w-5 text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100" />
              <span className="text-[13px] font-semibold text-zinc-900 underline-offset-4 group-hover:underline dark:text-zinc-100">
                {meta.label}
              </span>
              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{meta.blurb}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
