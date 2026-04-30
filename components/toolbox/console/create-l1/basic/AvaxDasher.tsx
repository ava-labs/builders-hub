'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvaxLogo } from '@/components/toolbox/console/create-l1/icons';
import { cn } from '@/lib/utils';
import { GameExitButton } from './GameExitButton';

/**
 * Three-lane top-down dodger — the Avalanche logo runs at the bottom,
 * obstacles slide down from the top, swipe or arrow-key to switch lanes,
 * tap or space to jump over the amber lows. Deliberately flat — no fake
 * perspective — because in a 280px portrait canvas the converging-lines
 * trick reads as wonky rather than depthful. A clean three-column grid
 * with distinct lane backgrounds is what makes the obstacles legible.
 *
 * Mirrors the rest of the "while you wait" minigame family:
 *   - DOM-rendered (motion.div + absolute children, no canvas)
 *   - <AvaxLogo /> as the player sprite
 *   - useState<'ready' | 'playing' | 'over'> with overlay panels
 *   - localStorage high-score, screen shake on collision
 *   - GameExitButton in the corner
 */

const WIDTH = 280;
const HEIGHT = 500;
const LANE_COUNT = 3;
const LANE_W = WIDTH / LANE_COUNT;
const PLAYER_Y = HEIGHT - 76; // top of player sprite
const PLAYER_SIZE = 30;

// Physics — units in seconds, distances in px.
const INITIAL_SPEED = 220; // px/s downward scroll of obstacles
const MAX_SPEED = 420;
const SPEED_GROWTH = 12; // px/s per second
const JUMP_V = 480; // px/s initial up-velocity
const GRAVITY = 1700; // px/s²

// Player jumpY at which a "low" obstacle is cleared. Comfortably above
// the rendered low-obstacle height (24 px) so timed jumps feel fair.
const LOW_CLEAR_Y = 30;

type ObstacleKind = 'barrier' | 'low' | 'coin';

type ObstacleSpec = {
  kind: ObstacleKind;
  height: number;
  weight: number;
};

// Spawn weights — barriers most common (the core dodge), lows roughly
// half as often (the jump moments), coins sprinkled lightly so the run
// has a "I want that" pull beyond just survival.
const SPECS: ObstacleSpec[] = [
  { kind: 'barrier', height: 38, weight: 5 },
  { kind: 'low', height: 24, weight: 3 },
  { kind: 'coin', height: 16, weight: 2 },
];

function pickSpec(): ObstacleSpec {
  const total = SPECS.reduce((acc, s) => acc + s.weight, 0);
  let r = Math.random() * total;
  for (const s of SPECS) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return SPECS[0];
}

type Obstacle = {
  id: number;
  lane: number;
  y: number;
  spec: ObstacleSpec;
  /** Coins flip to true once collected so they fade out without giving
   *  rewards twice. */
  consumed?: boolean;
};

type GameState = 'ready' | 'playing' | 'over';

const HS_KEY = 'avaxDasherHighScore';

function laneCenterX(lane: number): number {
  return lane * LANE_W + LANE_W / 2;
}

export function AvaxDasher({ className, onExit }: { className?: string; onExit?: () => void }) {
  const [gameState, setGameState] = useState<GameState>('ready');
  const [highScore, setHighScore] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);

  // Mutable game state — refs keep the loop free of per-frame React renders.
  const lane = useRef(1);
  const jumpY = useRef(0);
  const jumpV = useRef(0);
  const jumpHeld = useRef(false);
  const obstacles = useRef<Obstacle[]>([]);
  const speed = useRef(INITIAL_SPEED);
  const score = useRef(0);
  const coinFlashUntil = useRef(0);
  const obstacleId = useRef(0);
  const nextSpawnIn = useRef(0.7);
  // Independent tracker so the spawned-line "stripes" scroll at the
  // game speed even while the player is stationary in their lane.
  const trackOffset = useRef(0);
  const frameRef = useRef<number | null>(null);

  const stateRef = useRef<GameState>('ready');
  stateRef.current = gameState;

  // Force a re-render each frame so DOM positions reflect ref state.
  const [, forceTick] = useState(0);

  const startRound = useCallback(() => {
    lane.current = 1;
    jumpY.current = 0;
    jumpV.current = 0;
    jumpHeld.current = false;
    obstacles.current = [];
    speed.current = INITIAL_SPEED;
    score.current = 0;
    coinFlashUntil.current = 0;
    obstacleId.current = 0;
    nextSpawnIn.current = 0.7;
    trackOffset.current = 0;
    setGameState('playing');
  }, []);

  const switchLane = useCallback((dir: -1 | 1) => {
    if (stateRef.current !== 'playing') return;
    lane.current = Math.max(0, Math.min(LANE_COUNT - 1, lane.current + dir));
  }, []);

  const jump = useCallback(() => {
    if (stateRef.current === 'ready' || stateRef.current === 'over') {
      startRound();
      return;
    }
    if (jumpY.current === 0) {
      jumpV.current = JUMP_V;
      jumpHeld.current = true;
    }
  }, [startRound]);

  const releaseJump = useCallback(() => {
    jumpHeld.current = false;
    if (jumpV.current > 0) jumpV.current *= 0.45;
  }, []);

  // Persisted high score on first mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HS_KEY);
      if (saved) setHighScore(parseInt(saved, 10) || 0);
    } catch {
      /* localStorage blocked */
    }
  }, []);

  // Keyboard input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key;
      const lower = k.toLowerCase();
      if (k === 'ArrowLeft' || lower === 'a') {
        e.preventDefault();
        switchLane(-1);
      } else if (k === 'ArrowRight' || lower === 'd') {
        e.preventDefault();
        switchLane(1);
      } else if (k === 'ArrowUp' || lower === 'w' || k === ' ' || k === 'Enter') {
        if (stateRef.current === 'ready' && k !== ' ' && k !== 'Enter') return;
        e.preventDefault();
        jump();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'ArrowUp' && e.key.toLowerCase() !== 'w') return;
      if (stateRef.current !== 'playing') return;
      releaseJump();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [switchLane, jump, releaseJump]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    let last = 0;
    const loop = (ts: number) => {
      if (stateRef.current !== 'playing') {
        frameRef.current = null;
        return;
      }
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;

      // Jump physics. Held space gives a small float boost on the way
      // up; release truncates the arc (Mario-style variable jump).
      if (jumpY.current > 0 || jumpV.current > 0) {
        const g = jumpHeld.current && jumpV.current > 0 ? GRAVITY * 0.78 : GRAVITY;
        jumpV.current -= g * dt;
        jumpY.current += jumpV.current * dt;
        if (jumpY.current <= 0) {
          jumpY.current = 0;
          jumpV.current = 0;
          jumpHeld.current = false;
        }
      }

      // Move obstacles toward the player. We then prune anything that
      // scrolled past the bottom edge.
      const move = speed.current * dt;
      for (const o of obstacles.current) o.y += move;
      obstacles.current = obstacles.current.filter((o) => o.y < HEIGHT + 60);

      // Track stripes scroll at the same rate so the lane background
      // reads as moving even when the player is still.
      trackOffset.current = (trackOffset.current + move) % 60;

      // Spawn — pick a single obstacle in a random lane. Bias against
      // repeating the most recent lane so the user always has a fair
      // option to dodge.
      nextSpawnIn.current -= dt;
      if (nextSpawnIn.current <= 0) {
        const spec = pickSpec();
        const last = obstacles.current[obstacles.current.length - 1];
        let pickedLane = Math.floor(Math.random() * LANE_COUNT);
        if (last && pickedLane === last.lane && Math.random() > 0.4) {
          pickedLane = (pickedLane + 1 + Math.floor(Math.random() * 2)) % LANE_COUNT;
        }
        obstacles.current.push({
          id: obstacleId.current++,
          lane: pickedLane,
          y: -spec.height,
          spec,
        });
        // Spawn cadence shrinks with speed so difficulty rises.
        const baseGap = Math.max(0.36, 0.95 - speed.current / 720);
        nextSpawnIn.current = baseGap + Math.random() * 0.35;
      }

      // Ramp speed and score.
      speed.current = Math.min(MAX_SPEED, speed.current + SPEED_GROWTH * dt);
      score.current += (speed.current / 220) * 30 * dt;

      // Collision + coin pickup. Hit-band is a small Y window centered
      // on the player. Same lane as player + within band = either game
      // over (barrier) or score bonus (coin) or jump-clearable check
      // (low). Jumping is checked against the LIVE jumpY, so the user
      // gets credit for being airborne at the moment of contact.
      const playerCenterY = PLAYER_Y + PLAYER_SIZE / 2;
      const hitBandTop = playerCenterY - 22;
      const hitBandBottom = playerCenterY + 8;
      for (const o of obstacles.current) {
        if (o.consumed) continue;
        const inBand = o.y + o.spec.height > hitBandTop && o.y < hitBandBottom;
        if (!inBand) continue;
        const sameLane = o.lane === lane.current;
        if (!sameLane) continue;

        if (o.spec.kind === 'coin') {
          o.consumed = true;
          score.current += 25;
          coinFlashUntil.current = ts + 320;
          continue;
        }
        const cleared = o.spec.kind === 'low' && jumpY.current > LOW_CLEAR_Y;
        if (cleared) continue;
        // Game over — record + flash + shake.
        const final = Math.floor(score.current);
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
        return;
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

  // Touch — swipe horizontal to switch lane, tap to jump.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) {
      jump();
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 22 && Math.abs(dx) > Math.abs(dy)) {
      switchLane(dx < 0 ? -1 : 1);
    } else {
      jump();
    }
  };

  // Frame-visible derived values.
  const playerX = laneCenterX(lane.current);
  const playerYRender = PLAYER_Y - jumpY.current;
  const displayedScore = Math.floor(score.current);
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const coinFlashT = Math.max(0, (coinFlashUntil.current - now) / 320);

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
      onClick={jump}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseUp={releaseJump}
    >
      {/* Three flat lanes — alternating subtle wash so the player can
          see exactly which lane they're in without depending on the
          AvaxLogo's silhouette. */}
      {Array.from({ length: LANE_COUNT }).map((_, i) => {
        const isMid = i === 1;
        return (
          <div
            key={`lane-${i}`}
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-0 bottom-0',
              isMid ? 'bg-zinc-100/40 dark:bg-zinc-800/20' : 'bg-transparent',
            )}
            style={{ left: i * LANE_W, width: LANE_W }}
          />
        );
      })}

      {/* Lane separators — simple vertical hairlines. */}
      {Array.from({ length: LANE_COUNT - 1 }).map((_, i) => (
        <div
          key={`sep-${i}`}
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-zinc-300/60 dark:bg-zinc-700/50"
          style={{ left: (i + 1) * LANE_W }}
        />
      ))}

      {/* Scrolling track stripes — short horizontal dashes per lane,
          tied to game speed. Reads as forward motion without needing
          fake perspective. */}
      {Array.from({ length: LANE_COUNT }).map((_, laneIdx) => {
        const cx = laneCenterX(laneIdx);
        return Array.from({ length: 9 }).map((__, i) => {
          const y = ((trackOffset.current + i * 60) % (HEIGHT + 60)) - 30;
          return (
            <div
              key={`stripe-${laneIdx}-${i}`}
              aria-hidden
              className="pointer-events-none absolute rounded-sm bg-zinc-300/40 dark:bg-zinc-700/40"
              style={{
                left: cx - 1,
                top: y,
                width: 2,
                height: 14,
              }}
            />
          );
        });
      })}

      {/* Obstacles — color-coded so the player can decide at a glance
          whether to dodge (red) or jump (amber) or chase (red dot). */}
      {obstacles.current.map((o) => {
        const cx = laneCenterX(o.lane);
        const w = o.spec.kind === 'coin' ? 16 : LANE_W * 0.72;
        const h = o.spec.height;
        if (o.spec.kind === 'coin') {
          return (
            <div
              key={o.id}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: cx - w / 2,
                top: o.y,
                width: w,
                height: w,
                background: 'radial-gradient(circle at 35% 35%, #fff 0%, #fde68a 35%, #f59e0b 75%, #b45309 100%)',
                boxShadow: '0 0 8px rgba(251, 191, 36, 0.35)',
                opacity: o.consumed ? 0 : 1,
                transform: o.consumed ? 'scale(1.5)' : 'scale(1)',
                transition: 'opacity 220ms ease-out, transform 220ms ease-out',
              }}
            />
          );
        }
        const isLow = o.spec.kind === 'low';
        return (
          <div
            key={o.id}
            className={cn(
              'pointer-events-none absolute rounded-md',
              isLow
                ? 'bg-gradient-to-b from-amber-400 to-amber-600 dark:from-amber-400 dark:to-amber-700'
                : 'bg-gradient-to-b from-rose-500 to-rose-700 dark:from-rose-500 dark:to-rose-800',
            )}
            style={{
              left: cx - w / 2,
              top: o.y,
              width: w,
              height: h,
              boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.25), inset 1px 0 0 rgba(255,255,255,0.18)',
            }}
          />
        );
      })}

      {/* Player shadow — shrinks while airborne for altitude cue. */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[50%] bg-black/35 dark:bg-black/55 blur-[1.5px]"
        style={{
          left: playerX - PLAYER_SIZE / 2 + 3,
          top: PLAYER_Y + PLAYER_SIZE - 4,
          width: PLAYER_SIZE - 6,
          height: 5,
          transform: `scaleX(${Math.max(0.45, 1 - jumpY.current / 90)})`,
          opacity: Math.max(0.3, 1 - jumpY.current / 80),
        }}
      />

      {/* Player — Avalanche logo. Tilts opposite to the lane-switch
          velocity for a snappy "lean into the slide" feel. */}
      <motion.div
        className="pointer-events-none absolute"
        animate={{ left: playerX - PLAYER_SIZE / 2, top: playerYRender }}
        transition={{ left: { type: 'spring', stiffness: 700, damping: 28 }, top: { duration: 0 } }}
        style={{
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
        }}
      >
        <AvaxLogo className="h-full w-full text-zinc-900 dark:text-zinc-100 drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)] dark:drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" />
      </motion.div>

      {onExit && <GameExitButton onExit={onExit} />}

      {/* Score HUD — same layout as the other family members. */}
      <div className="pointer-events-none absolute right-3 top-2.5 flex items-center gap-3">
        {highScore > 0 && (
          <span className="text-[10px] font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
            HI {highScore.toString().padStart(5, '0')}
          </span>
        )}
        <span
          className="text-xs font-mono tabular-nums text-zinc-700 dark:text-zinc-200 transition-colors"
          style={{
            color: coinFlashT > 0 ? 'rgb(245, 158, 11)' : undefined,
            transform: coinFlashT > 0 ? `scale(${1 + coinFlashT * 0.35})` : undefined,
            transformOrigin: 'right center',
          }}
        >
          {displayedScore.toString().padStart(5, '0')}
        </span>
      </div>

      {/* Ready / over overlays — shared chrome with the other games. */}
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
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Switch lanes, dodge, jump</p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <kbd className="mx-0.5 rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">
                      ← →
                    </kbd>{' '}
                    switch ·{' '}
                    <kbd className="mx-0.5 rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">
                      Space
                    </kbd>{' '}
                    jump
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Crashed — <span className="font-mono tabular-nums">{displayedScore}</span> pts
                    {displayedScore === highScore && displayedScore > 0 && <span className="ml-1">🏆 new best</span>}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Tap or press space to try again</p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
