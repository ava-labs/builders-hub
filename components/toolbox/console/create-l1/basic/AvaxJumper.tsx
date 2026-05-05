'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvaxLogo } from '@/components/toolbox/console/create-l1/icons';
import { cn } from '@/lib/utils';
import { GameExitButton } from './GameExitButton';

/**
 * Doodle-Jump-style vertical platformer with the Avalanche logo as the
 * player. Auto-jumps when landing on a platform; the player tilts left
 * and right to control horizontal motion and aim for the next platform
 * as the camera scrolls upward. Mirrors the rest of the "while you wait"
 * minigame family conventions: DOM-rendered, AvaxLogo sprite,
 * ready/playing/over states, localStorage high score, screen shake on
 * game over, and the shared overlay panel chrome.
 */

const WIDTH = 280;
const HEIGHT = 500;
const PLAYER_SIZE = 30;

// Physics — units in seconds, distances in px.
const GRAVITY = 1500; // px/s²
const JUMP_V = 620; // px/s — initial up velocity each bounce
const MAX_HORIZ = 300; // px/s — top horizontal speed
const HORIZ_ACCEL = 1500; // px/s² toward the desired direction
const HORIZ_FRICTION = 4.2; // damping multiplier per second when no input

// Camera scroll threshold. The player can never rise above this Y on
// screen — once they cross it, the world scrolls down underneath them.
const CAMERA_LOCK_Y = HEIGHT * 0.38;

// Platform constants
const PLATFORM_W_MIN = 54;
const PLATFORM_W_MAX = 80;
const PLATFORM_H = 9;
const PLATFORM_TARGET_COUNT = 11;
const PLATFORM_VERTICAL_GAP_MIN = 48;
const PLATFORM_VERTICAL_GAP_MAX = 78;

// Player landing tolerance — the contact band on top of a platform.
const LANDING_BAND = 12;

type Platform = {
  id: number;
  x: number;
  y: number;
  w: number;
  /** Moving platforms shuttle horizontally. The base platforms are
   *  static. Moving platforms appear once score crosses ~120 to keep
   *  the early game gentle. */
  vx: number;
};

type GameState = 'ready' | 'playing' | 'over';

const HS_KEY = 'avaxJumperHighScore';

function makePlatform(id: number, y: number, allowMoving: boolean): Platform {
  const w = PLATFORM_W_MIN + Math.random() * (PLATFORM_W_MAX - PLATFORM_W_MIN);
  const x = 18 + Math.random() * (WIDTH - 36 - w);
  const moving = allowMoving && Math.random() > 0.62;
  const vx = moving ? (Math.random() > 0.5 ? 85 : -85) : 0;
  return { id, x, y, w, vx };
}

export function AvaxJumper({ className, onExit }: { className?: string; onExit?: () => void }) {
  const [gameState, setGameState] = useState<GameState>('ready');
  const [highScore, setHighScore] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);

  // Mutable game state — refs to keep the loop free of per-frame React renders.
  const playerX = useRef(WIDTH / 2 - PLAYER_SIZE / 2);
  const playerY = useRef(HEIGHT - 96);
  const playerVx = useRef(0);
  const playerVy = useRef(-JUMP_V);
  const platforms = useRef<Platform[]>([]);
  const platformId = useRef(0);
  const score = useRef(0);
  const liftTotal = useRef(0); // total camera-scroll distance, drives score
  const inputDir = useRef<-1 | 0 | 1>(0);
  const frameRef = useRef<number | null>(null);

  const stateRef = useRef<GameState>('ready');
  stateRef.current = gameState;

  // Force re-render each frame so DOM positions reflect ref state.
  const [, forceTick] = useState(0);

  const seedPlatforms = useCallback(() => {
    const list: Platform[] = [];
    list.push({
      id: platformId.current++,
      x: WIDTH / 2 - 36,
      y: HEIGHT - 42,
      w: 72,
      vx: 0,
    });
    let y = HEIGHT - 42 - PLATFORM_VERTICAL_GAP_MIN;
    while (list.length < PLATFORM_TARGET_COUNT) {
      list.push(makePlatform(platformId.current++, y, false));
      y -= PLATFORM_VERTICAL_GAP_MIN + Math.random() * (PLATFORM_VERTICAL_GAP_MAX - PLATFORM_VERTICAL_GAP_MIN);
    }
    return list;
  }, []);

  const startRound = useCallback(() => {
    playerX.current = WIDTH / 2 - PLAYER_SIZE / 2;
    playerY.current = HEIGHT - 96;
    playerVx.current = 0;
    playerVy.current = -JUMP_V;
    platforms.current = seedPlatforms();
    score.current = 0;
    liftTotal.current = 0;
    inputDir.current = 0;
    setGameState('playing');
  }, [seedPlatforms]);

  // Persisted high score on first mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HS_KEY);
      if (saved) setHighScore(parseInt(saved, 10) || 0);
    } catch {
      /* localStorage blocked */
    }
  }, []);

  // Keyboard input — left/right arrows or A/D for tilt; space/enter to
  // start or restart from the ready/over states.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key;
      const lower = k.toLowerCase();
      if (k === 'ArrowLeft' || lower === 'a') {
        e.preventDefault();
        inputDir.current = -1;
      } else if (k === 'ArrowRight' || lower === 'd') {
        e.preventDefault();
        inputDir.current = 1;
      } else if (k === ' ' || k === 'Enter') {
        if (stateRef.current === 'ready' || stateRef.current === 'over') {
          e.preventDefault();
          startRound();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key;
      const lower = k.toLowerCase();
      if (k === 'ArrowLeft' || lower === 'a') {
        if (inputDir.current === -1) inputDir.current = 0;
      } else if (k === 'ArrowRight' || lower === 'd') {
        if (inputDir.current === 1) inputDir.current = 0;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [startRound]);

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

      // Horizontal physics. Apply acceleration toward the desired
      // direction, plus friction when there's no input.
      const dir = inputDir.current;
      if (dir !== 0) {
        playerVx.current += dir * HORIZ_ACCEL * dt;
      } else {
        // Frame-rate-aware exponential damping.
        playerVx.current *= Math.pow(1 / Math.E, HORIZ_FRICTION * dt);
      }
      playerVx.current = Math.max(-MAX_HORIZ, Math.min(MAX_HORIZ, playerVx.current));
      playerX.current += playerVx.current * dt;
      // Wrap at the edges so the player can shortcut across the canvas
      // (classic Doodle Jump behaviour, prevents being cornered).
      if (playerX.current < -PLAYER_SIZE) playerX.current = WIDTH;
      if (playerX.current > WIDTH) playerX.current = -PLAYER_SIZE;

      // Vertical physics. Gravity always pulls down. Jumps are auto on
      // landing — no jump input required.
      playerVy.current += GRAVITY * dt;
      playerY.current += playerVy.current * dt;

      // Move platforms (only the moving ones) and bounce them at the
      // edges of the canvas.
      for (const p of platforms.current) {
        if (p.vx === 0) continue;
        p.x += p.vx * dt;
        if (p.x < 8 || p.x + p.w > WIDTH - 8) {
          p.vx = -p.vx;
          p.x = Math.max(8, Math.min(WIDTH - 8 - p.w, p.x));
        }
      }

      // Collision — only when falling. The landing band is the top
      // PLATFORM_H + LANDING_BAND px of the platform; if the player's
      // feet are inside that band AND falling AND horizontally
      // overlapping the platform, bounce.
      if (playerVy.current > 0) {
        const playerBottom = playerY.current + PLAYER_SIZE;
        for (const p of platforms.current) {
          const overlapsX = playerX.current + PLAYER_SIZE > p.x && playerX.current < p.x + p.w;
          if (!overlapsX) continue;
          const inBand = playerBottom >= p.y && playerBottom <= p.y + LANDING_BAND;
          if (inBand) {
            playerVy.current = -JUMP_V;
            // Subtle position fix to anchor the bounce on the platform.
            playerY.current = p.y - PLAYER_SIZE;
            break;
          }
        }
      }

      // Camera scroll — when the player rises above CAMERA_LOCK_Y, push
      // everything down (the player AND every platform) by the same
      // delta so the player visually stays at the lock line. Score is
      // the cumulative lift, normalised to a friendly scale.
      if (playerY.current < CAMERA_LOCK_Y) {
        const lift = CAMERA_LOCK_Y - playerY.current;
        playerY.current += lift;
        liftTotal.current += lift;
        for (const p of platforms.current) p.y += lift;
        const newScore = Math.max(score.current, Math.floor(liftTotal.current / 8));
        score.current = newScore;
      }

      // Despawn off-screen platforms, then refill from the top so the
      // density stays roughly constant. New platforms can move once
      // score is above 120 (rough difficulty gate).
      platforms.current = platforms.current.filter((p) => p.y < HEIGHT + 30);
      if (platforms.current.length === 0) {
        // Fail-safe — should never happen during play but a single
        // empty frame would otherwise spin into infinity below.
        platforms.current.push(makePlatform(platformId.current++, HEIGHT / 2, false));
      }
      while (platforms.current.length < PLATFORM_TARGET_COUNT) {
        const highest = Math.min(...platforms.current.map((p) => p.y));
        const gap = PLATFORM_VERTICAL_GAP_MIN + Math.random() * (PLATFORM_VERTICAL_GAP_MAX - PLATFORM_VERTICAL_GAP_MIN);
        platforms.current.push(makePlatform(platformId.current++, highest - gap, score.current > 60));
      }

      // Game over when the player falls past the bottom of the canvas.
      if (playerY.current > HEIGHT + 40) {
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

  // Touch input — tilt by where the user holds inside the canvas.
  // Touching the left half steers left, right half steers right.
  // Releasing returns to neutral.
  const handleTouch = (clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const localX = clientX - rect.left;
    inputDir.current = localX < rect.width / 2 ? -1 : 1;
  };

  // Frame-visible derived values.
  const tilt = Math.max(-12, Math.min(12, playerVx.current / 18));
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
      style={{ width: WIDTH, height: HEIGHT, touchAction: 'none' }}
      onClick={() => {
        if (stateRef.current === 'ready' || stateRef.current === 'over') {
          startRound();
        }
      }}
      onTouchStart={(e) => {
        if (stateRef.current === 'ready' || stateRef.current === 'over') {
          startRound();
          return;
        }
        if (e.touches.length === 0) return;
        handleTouch(e.touches[0].clientX, e.currentTarget);
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 0) return;
        handleTouch(e.touches[0].clientX, e.currentTarget);
      }}
      onTouchEnd={() => {
        inputDir.current = 0;
      }}
    >
      {/* Soft horizontal guide lines — give a sense of vertical scroll
          when the camera lifts. They wrap back to the top via modular
          arithmetic on the cumulative lift. */}
      {Array.from({ length: 11 }).map((_, i) => {
        const yBase = i * 50;
        const yScroll = (yBase + (liftTotal.current % 50)) % HEIGHT;
        return (
          <div
            key={`grid-${i}`}
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 border-t border-zinc-200/40 dark:border-zinc-800/40"
            style={{ top: yScroll }}
          />
        );
      })}

      {/* Platforms — moving ones in Avalanche red so they read as
          "watch out, this one drifts" while keeping the brand palette. */}
      {platforms.current.map((p) => (
        <div
          key={p.id}
          className={cn(
            'pointer-events-none absolute rounded-md',
            p.vx === 0
              ? 'bg-gradient-to-b from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800'
              : 'bg-gradient-to-b from-rose-500 to-rose-700 dark:from-rose-500 dark:to-rose-700',
          )}
          style={{
            left: p.x,
            top: p.y,
            width: p.w,
            height: PLATFORM_H,
            boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.3), inset 1px 0 0 rgba(255,255,255,0.2)',
          }}
        />
      ))}

      {/* Player — Avalanche logo. Tilts in the direction of motion. */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: playerX.current,
          top: playerY.current,
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
          transform: `rotate(${tilt}deg)`,
          transformOrigin: '50% 60%',
        }}
      >
        <AvaxLogo className="h-full w-full text-zinc-900 dark:text-zinc-100 drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)] dark:drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" />
      </div>

      {/* Wrap-around ghost — render a second copy of the player when
          they're crossing an edge so the wrap doesn't look like a
          teleport. Shows on the opposite side. */}
      {playerX.current < 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: playerX.current + WIDTH,
            top: playerY.current,
            width: PLAYER_SIZE,
            height: PLAYER_SIZE,
            transform: `rotate(${tilt}deg)`,
            transformOrigin: '50% 60%',
            opacity: 0.6,
          }}
        >
          <AvaxLogo className="h-full w-full text-zinc-900 dark:text-zinc-100" />
        </div>
      )}
      {playerX.current + PLAYER_SIZE > WIDTH && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: playerX.current - WIDTH,
            top: playerY.current,
            width: PLAYER_SIZE,
            height: PLAYER_SIZE,
            transform: `rotate(${tilt}deg)`,
            transformOrigin: '50% 60%',
            opacity: 0.6,
          }}
        >
          <AvaxLogo className="h-full w-full text-zinc-900 dark:text-zinc-100" />
        </div>
      )}

      {onExit && <GameExitButton onExit={onExit} />}

      {/* Score HUD — same layout as the rest of the family. */}
      <div className="pointer-events-none absolute right-3 top-2.5 flex items-center gap-3">
        {highScore > 0 && (
          <span className="text-[10px] font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
            HI {highScore.toString().padStart(5, '0')}
          </span>
        )}
        <span className="text-xs font-mono tabular-nums text-zinc-700 dark:text-zinc-200">
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
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Bounce up the platforms</p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <kbd className="mx-0.5 rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">
                      ← →
                    </kbd>{' '}
                    tilt to steer
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Fell off — <span className="font-mono tabular-nums">{displayedScore}</span> pts
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
