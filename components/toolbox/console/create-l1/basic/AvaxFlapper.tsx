'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvaxLogo } from '@/components/toolbox/console/create-l1/icons';
import { cn } from '@/lib/utils';
import { GameExitButton } from './GameExitButton';

/**
 * Flappy-style game with the Avalanche logo as the player. Companion to
 * AvaxRunner, sharing canvas dimensions, theming, and overlay patterns so
 * the two games feel like siblings.
 *
 * Classic Flappy loop: gravity pulls you down, each tap / Space gives you
 * a fixed upward velocity, you thread the gaps between scrolling pipes.
 * Collision with top, bottom, or a pipe ends the round.
 *
 * Player rotation maps to vertical velocity — nose up while rising, nose
 * down while plummeting. Clamped so it never looks broken at extreme vy.
 */

const WIDTH = 600;
const HEIGHT = 180;
const PLAYER_X = 58;
const PLAYER_SIZE = 30;

// Physics — units in px/s².
const GRAVITY = 1350;
const FLAP_V = -360;
const INITIAL_SPEED = 170;
const MAX_SPEED = 260;
const SPEED_GROWTH = 5; // px/s per second

// Pipe geometry — gap constants scale with HEIGHT so the playable
// vertical band grows with the viewport instead of staying pinned
// to a 38–102 range that would leave dead space at the top/bottom.
const PIPE_WIDTH = 36;
const PIPE_GAP = 68;
const PIPE_MIN_CENTER = 48;
const PIPE_MAX_CENTER = 132;
const INITIAL_SPAWN_DELAY = 0.75; // grace period before first pipe

type Pipe = {
  id: number;
  x: number;
  gapCenter: number;
  scored: boolean;
};

type GameState = 'ready' | 'playing' | 'over';

const HS_KEY = 'avaxFlapperHighScore';

export function AvaxFlapper({ className, onExit }: { className?: string; onExit?: () => void }) {
  const [gameState, setGameState] = useState<GameState>('ready');
  const [highScore, setHighScore] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);

  const playerY = useRef(HEIGHT / 2 - PLAYER_SIZE / 2);
  const playerVy = useRef(0);
  const pipes = useRef<Pipe[]>([]);
  const speed = useRef(INITIAL_SPEED);
  const score = useRef(0);
  const pipeId = useRef(0);
  const nextSpawnIn = useRef(INITIAL_SPAWN_DELAY);
  const frameRef = useRef<number | null>(null);

  const stateRef = useRef<GameState>('ready');
  stateRef.current = gameState;

  const [, forceTick] = useState(0);

  const startRound = useCallback(() => {
    playerY.current = HEIGHT / 2 - PLAYER_SIZE / 2;
    playerVy.current = FLAP_V; // kick off with an initial flap so the
    // player doesn't plummet on round start
    pipes.current = [];
    speed.current = INITIAL_SPEED;
    score.current = 0;
    pipeId.current = 0;
    nextSpawnIn.current = INITIAL_SPAWN_DELAY;
    setGameState('playing');
  }, []);

  const flap = useCallback(() => {
    if (stateRef.current === 'ready' || stateRef.current === 'over') {
      startRound();
      return;
    }
    playerVy.current = FLAP_V;
  }, [startRound]);

  // Persisted high score
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HS_KEY);
      if (saved) setHighScore(parseInt(saved, 10) || 0);
    } catch {
      /* localStorage blocked */
    }
  }, []);

  // Keyboard input — only active once the user has engaged (avoid
  // hijacking Space when navigating elsewhere on the page).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
      if (stateRef.current === 'ready') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      flap();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flap]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    let last = 0;

    const endGame = () => {
      const final = score.current;
      setHighScore((prev) => {
        if (final > prev) {
          try {
            window.localStorage.setItem(HS_KEY, String(final));
          } catch {
            /* ignore */
          }
          return final;
        }
        return prev;
      });
      setShakeKey((k) => k + 1);
      setGameState('over');
    };

    const loop = (ts: number) => {
      if (stateRef.current !== 'playing') {
        frameRef.current = null;
        return;
      }
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;

      // Player physics
      playerVy.current += GRAVITY * dt;
      playerY.current += playerVy.current * dt;

      // Floor / ceiling collision
      if (playerY.current < 0 || playerY.current + PLAYER_SIZE > HEIGHT) {
        endGame();
        return;
      }

      // Scroll pipes
      const move = speed.current * dt;
      for (const p of pipes.current) p.x -= move;
      pipes.current = pipes.current.filter((p) => p.x + PIPE_WIDTH > -10);

      // Spawn
      nextSpawnIn.current -= dt;
      if (nextSpawnIn.current <= 0) {
        const gapCenter = PIPE_MIN_CENTER + Math.random() * (PIPE_MAX_CENTER - PIPE_MIN_CENTER);
        pipes.current.push({
          id: pipeId.current++,
          x: WIDTH + 10,
          gapCenter,
          scored: false,
        });
        // Spawn interval tightens with speed. Floor keeps things survivable.
        nextSpawnIn.current = Math.max(1.1, 1.7 - speed.current / 500);
      }

      // Ramp speed
      speed.current = Math.min(MAX_SPEED, speed.current + SPEED_GROWTH * dt);

      // Pipe collision + scoring. Hitbox shrunk by a few px each side so
      // the visual barely-grazed case doesn't count as collision —
      // forgiving feels better than technically accurate.
      const hx = PLAYER_X + 4;
      const hw = PLAYER_SIZE - 8;
      const hy = playerY.current + 4;
      const hh = PLAYER_SIZE - 8;

      for (const p of pipes.current) {
        if (!p.scored && p.x + PIPE_WIDTH < PLAYER_X) {
          p.scored = true;
          score.current += 1;
        }

        if (hx + hw > p.x && hx < p.x + PIPE_WIDTH) {
          const gapTop = p.gapCenter - PIPE_GAP / 2;
          const gapBottom = p.gapCenter + PIPE_GAP / 2;
          if (hy < gapTop || hy + hh > gapBottom) {
            endGame();
            return;
          }
        }
      }

      forceTick((n) => n + 1);
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [gameState]);

  // Derived visuals
  const tilt = Math.max(-25, Math.min(70, playerVy.current / 11));
  const displayedScore = score.current;

  return (
    <motion.div
      key={shakeKey}
      animate={shakeKey > 0 ? { x: [0, -5, 5, -3, 3, 0], y: [0, 2, -2, 1, 0] } : {}}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={cn(
        'relative cursor-pointer select-none overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-zinc-50 to-zinc-100/60 dark:from-zinc-900 dark:to-zinc-950',
        className,
      )}
      style={{ width: WIDTH, height: HEIGHT, touchAction: 'manipulation' }}
      onClick={flap}
      onTouchStart={(e) => {
        e.preventDefault();
        flap();
      }}
    >
      {/* Pipes — top + bottom halves per pipe, gap between */}
      {pipes.current.map((p) => {
        const gapTop = p.gapCenter - PIPE_GAP / 2;
        const gapBottom = p.gapCenter + PIPE_GAP / 2;
        return (
          <div
            key={p.id}
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{ left: p.x, width: PIPE_WIDTH }}
          >
            {/* Top pipe */}
            <div
              className="absolute left-0 right-0 top-0 rounded-b-[2px] border-b border-zinc-400 dark:border-zinc-500 bg-gradient-to-b from-zinc-500 to-zinc-700 dark:from-zinc-600 dark:to-zinc-800"
              style={{
                height: gapTop,
                boxShadow: 'inset 0 2px 0 rgba(0,0,0,0.22), inset 1px 0 0 rgba(255,255,255,0.12)',
              }}
            />
            {/* Bottom pipe */}
            <div
              className="absolute left-0 right-0 bottom-0 rounded-t-[2px] border-t border-zinc-400 dark:border-zinc-500 bg-gradient-to-t from-zinc-500 to-zinc-700 dark:from-zinc-600 dark:to-zinc-800"
              style={{
                top: gapBottom,
                boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.22), inset 1px 0 0 rgba(255,255,255,0.12)',
              }}
            />
          </div>
        );
      })}

      {/* Player — Avalanche logo with velocity-driven tilt */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: PLAYER_X,
          top: playerY.current,
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
          transform: `rotate(${tilt}deg)`,
          transformOrigin: '50% 50%',
        }}
      >
        <AvaxLogo className="h-full w-full text-zinc-900 dark:text-zinc-100 drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)]" />
      </div>

      {/* Score HUD */}
      <div className="pointer-events-none absolute right-3 top-2.5 flex items-center gap-3">
        {highScore > 0 && (
          <span className="text-[10px] font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
            HI {highScore.toString().padStart(3, '0')}
          </span>
        )}
        <span className="text-xs font-mono tabular-nums text-zinc-700 dark:text-zinc-200">
          {displayedScore.toString().padStart(3, '0')}
        </span>
      </div>

      {onExit && <GameExitButton onExit={onExit} />}

      {/* Ready / over overlays */}
      <AnimatePresence>
        {gameState !== 'playing' && (
          <motion.div
            key={gameState}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px] dark:bg-black/30"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/80 px-4 py-2.5 text-center shadow-lg"
            >
              {gameState === 'ready' ? (
                <>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Flap between the pipes</p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Click to start —{' '}
                    <kbd className="mx-0.5 rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">
                      Space
                    </kbd>{' '}
                    to flap
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Crashed — <span className="font-mono tabular-nums">{displayedScore}</span>{' '}
                    {displayedScore === 1 ? 'pipe' : 'pipes'}
                    {displayedScore === highScore && displayedScore > 0 && <span className="ml-1">🏆 new best</span>}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Tap or press space to fly again</p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
