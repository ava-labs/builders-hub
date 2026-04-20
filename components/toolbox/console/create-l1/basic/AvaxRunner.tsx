'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvaxLogo } from '@/components/toolbox/console/create-l1/icons';
import { cn } from '@/lib/utils';
import { GameExitButton } from './GameExitButton';

/**
 * Chrome-dino-style runner with the Avalanche logo as the player.
 * Runs inline during a Basic L1 deploy as a "play while you wait" moment.
 *
 * Game-feel polish:
 *   - Scrolling ground dashes tied to game speed (static dashes read
 *     as "broken" against moving obstacles)
 *   - Subtle run-bob on the player — 1.5px sine oscillation while
 *     grounded. Kills the "static cutout" look.
 *   - Landing squash-and-stretch — 120ms horizontal squash when vy
 *     flips from falling to grounded. Classic game-feel trick.
 *   - Beveled obstacles — top-down gradient + 1px bright top border so
 *     they read as 3D blocks instead of flat rectangles.
 *   - Screen shake on collision — 400ms motion-driven wiggle. Uses a
 *     remount-key so the animation replays each game-over cleanly.
 *   - Overlay cards (ready / over) now sit inside a bordered panel
 *     with a backdrop blur — reads as UI rather than raw text.
 */

const WIDTH = 600;
const HEIGHT = 180;
const GROUND_Y = HEIGHT - 28;
const PLAYER_X = 40;
const PLAYER_SIZE = 36;

// Physics constants — units scaled so dt is in seconds.
const GRAVITY = 1750; // px/s²
const JUMP_V = 620; // px/s (initial up-velocity)
const INITIAL_SPEED = 260; // px/s horizontal scroll
const MAX_SPEED = 640;
const SPEED_GROWTH = 18; // px/s per second

// Visual constants
const GROUND_DASH_WIDTH = 8;
const GROUND_DASH_GAP = 10;
const GROUND_PERIOD = GROUND_DASH_WIDTH + GROUND_DASH_GAP; // 18px

// Obstacle catalog — each spec has a width, height, and optional rarity
// weight (default 1). More variety = more "fresh" feel; the game loop
// doesn't care about any of this beyond the hitbox rect, so the whole
// obstacle design surface is this array.
type ObstacleSpec = {
  width: number;
  height: number;
  /** Relative spawn weight. Defaults to 1 if omitted. */
  weight?: number;
  /** May this spec appear as a paired cluster? Only safe for low/short
   * obstacles — clustering tall pillars creates unfair jumps. */
  clusterable?: boolean;
};

const OBSTACLE_SPECS: ObstacleSpec[] = [
  { width: 14, height: 22, weight: 3, clusterable: true }, // short rock — most common
  { width: 18, height: 34, weight: 2 }, // tall rock
  { width: 28, height: 20, weight: 2, clusterable: true }, // wide rock — low and broad
  { width: 8, height: 36, weight: 2 }, // narrow pillar — tall and skinny
  { width: 22, height: 28, weight: 1 }, // boulder — rare, mid-sized
];

/** Weighted random pick from OBSTACLE_SPECS. */
function pickObstacleSpec(): ObstacleSpec {
  const total = OBSTACLE_SPECS.reduce((sum, s) => sum + (s.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const spec of OBSTACLE_SPECS) {
    r -= spec.weight ?? 1;
    if (r <= 0) return spec;
  }
  return OBSTACLE_SPECS[0];
}

/** Low/wide obstacle specs eligible for the second slot in a cluster. */
const CLUSTER_SECOND_SPECS = OBSTACLE_SPECS.filter((s) => s.clusterable);

// Run bob / land squash
const BOB_FREQ = 14; // rad/s
const BOB_AMPLITUDE = 1.5; // px
const LAND_SQUASH_MS = 130;
const LAND_SQUASH_X = 1.12;
const LAND_SQUASH_Y = 0.82;

type Obstacle = {
  id: number;
  x: number;
  width: number;
  height: number;
};

type GameState = 'ready' | 'playing' | 'over';

const HS_KEY = 'avaxRunnerHighScore';

export function AvaxRunner({ className, onExit }: { className?: string; onExit?: () => void }) {
  const [gameState, setGameState] = useState<GameState>('ready');
  const [highScore, setHighScore] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);

  // Mutable game state — refs so the loop doesn't re-render per frame.
  const playerY = useRef(GROUND_Y - PLAYER_SIZE);
  const playerVy = useRef(0);
  const obstacles = useRef<Obstacle[]>([]);
  const speed = useRef(INITIAL_SPEED);
  const score = useRef(0);
  const obstacleId = useRef(0);
  const nextSpawnIn = useRef(1.2);
  const frameRef = useRef<number | null>(null);

  // Polish state
  const groundOffset = useRef(0);
  const bobPhase = useRef(0);
  const landSquashUntil = useRef(0); // performance.now() timestamp

  const stateRef = useRef<GameState>('ready');
  stateRef.current = gameState;

  // Force a re-render each frame so the DOM reflects the ref positions.
  const [, forceTick] = useState(0);

  const startRound = useCallback(() => {
    playerY.current = GROUND_Y - PLAYER_SIZE;
    playerVy.current = 0;
    obstacles.current = [];
    speed.current = INITIAL_SPEED;
    score.current = 0;
    obstacleId.current = 0;
    nextSpawnIn.current = 1.2;
    groundOffset.current = 0;
    bobPhase.current = 0;
    landSquashUntil.current = 0;
    setGameState('playing');
  }, []);

  const jump = useCallback(() => {
    if (stateRef.current === 'ready' || stateRef.current === 'over') {
      startRound();
      return;
    }
    if (playerY.current >= GROUND_Y - PLAYER_SIZE - 0.5) {
      playerVy.current = -JUMP_V;
    }
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
  // hijacking Space when they're navigating elsewhere on the page).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
      if (stateRef.current === 'ready') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      jump();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump]);

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

      // Player physics — detect landing for squash FX.
      const wasAirborne = playerVy.current !== 0 || playerY.current < GROUND_Y - PLAYER_SIZE - 0.5;
      playerVy.current += GRAVITY * dt;
      playerY.current += playerVy.current * dt;
      if (playerY.current > GROUND_Y - PLAYER_SIZE) {
        playerY.current = GROUND_Y - PLAYER_SIZE;
        if (wasAirborne && playerVy.current > 100) {
          // Trigger squash only when actually landing from a fall of
          // meaningful speed — prevents jitter on ground contact.
          landSquashUntil.current = ts + LAND_SQUASH_MS;
        }
        playerVy.current = 0;
      }

      // Bob cycles only while grounded — looks like the logo is running.
      const grounded = playerY.current >= GROUND_Y - PLAYER_SIZE - 0.5;
      if (grounded) {
        bobPhase.current += BOB_FREQ * dt;
      }

      // Scroll obstacles + ground
      const move = speed.current * dt;
      for (const o of obstacles.current) o.x -= move;
      obstacles.current = obstacles.current.filter((o) => o.x + o.width > -10);
      groundOffset.current = (groundOffset.current + move) % GROUND_PERIOD;

      // Spawn — pick a weighted obstacle, and with small chance spawn a
      // paired cluster (two low obstacles close together) so the player
      // has to commit to a longer hop instead of two back-to-back jumps.
      nextSpawnIn.current -= dt;
      if (nextSpawnIn.current <= 0) {
        const first = pickObstacleSpec();
        obstacles.current.push({
          id: obstacleId.current++,
          x: WIDTH + 20,
          width: first.width,
          height: first.height,
        });

        // Cluster: only when the leading obstacle is clusterable. 22%
        // base chance, scaling up slightly with speed so the late game
        // feels more demanding.
        const clusterChance = first.clusterable ? 0.22 + Math.min(0.15, (speed.current - INITIAL_SPEED) / 2400) : 0;
        if (Math.random() < clusterChance) {
          const second = CLUSTER_SECOND_SPECS[Math.floor(Math.random() * CLUSTER_SECOND_SPECS.length)];
          obstacles.current.push({
            id: obstacleId.current++,
            x: WIDTH + 20 + first.width + 28, // 28px in-cluster gap
            width: second.width,
            height: second.height,
          });
        }

        const gap = Math.max(0.5, 1.1 - speed.current / 780);
        nextSpawnIn.current = gap + Math.random() * 0.55;
      }

      // Ramp speed
      speed.current = Math.min(MAX_SPEED, speed.current + SPEED_GROWTH * dt);

      // Score
      score.current += (speed.current / 260) * 40 * dt;

      // Collision
      const px = PLAYER_X + 5;
      const pw = PLAYER_SIZE - 10;
      const py = playerY.current + 4;
      const ph = PLAYER_SIZE - 8;
      for (const o of obstacles.current) {
        const oy = GROUND_Y - o.height;
        if (px + pw > o.x && px < o.x + o.width && py + ph > oy && py < oy + o.height) {
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

  // Derived frame-visible values
  const airborne = playerY.current < GROUND_Y - PLAYER_SIZE - 0.5;
  const tilt = airborne ? Math.max(-18, Math.min(18, playerVy.current / 35)) : 0;

  const runBob = airborne ? 0 : Math.sin(bobPhase.current) * BOB_AMPLITUDE;

  // Landing squash — interpolate from squashed to normal over LAND_SQUASH_MS
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const squashRemaining = Math.max(0, landSquashUntil.current - now);
  const squashT = squashRemaining / LAND_SQUASH_MS; // 1 at peak squash, 0 at rest
  const scaleX = 1 + (LAND_SQUASH_X - 1) * squashT;
  const scaleY = 1 + (LAND_SQUASH_Y - 1) * squashT;

  const displayedScore = Math.floor(score.current);

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
      onTouchStart={(e) => {
        e.preventDefault();
        jump();
      }}
    >
      {/* Ground line */}
      <div
        className="pointer-events-none absolute left-0 right-0 border-t border-zinc-300 dark:border-zinc-700"
        style={{ top: GROUND_Y }}
      />

      {/* Scrolling ground dashes — tied to game speed via groundOffset */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 text-zinc-500 dark:text-zinc-500 opacity-35"
        style={{
          top: GROUND_Y + 5,
          height: 1,
          backgroundImage: `repeating-linear-gradient(to right, currentColor 0, currentColor ${GROUND_DASH_WIDTH}px, transparent ${GROUND_DASH_WIDTH}px, transparent ${GROUND_PERIOD}px)`,
          backgroundSize: `${GROUND_PERIOD}px 1px`,
          backgroundPositionX: `-${groundOffset.current}px`,
        }}
      />

      {/* Player — Avalanche logo with tilt + run-bob + land squash */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: PLAYER_X,
          top: playerY.current + runBob,
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
          transform: `rotate(${tilt}deg) scale(${scaleX}, ${scaleY})`,
          transformOrigin: '50% 85%',
        }}
      >
        <AvaxLogo className="h-full w-full text-zinc-900 dark:text-zinc-100 drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)]" />
      </div>

      {/* Player soft shadow on the ground */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[50%] bg-black/20 dark:bg-black/40 blur-[1.5px]"
        style={{
          left: PLAYER_X + 2,
          top: GROUND_Y - 3,
          width: PLAYER_SIZE - 4,
          height: 4,
          // Shrink shadow as player rises so it reads as altitude
          transform: `scaleX(${Math.max(0.4, 1 - (GROUND_Y - PLAYER_SIZE - playerY.current) / 80)})`,
          opacity: Math.max(0.2, 1 - (GROUND_Y - PLAYER_SIZE - playerY.current) / 60),
        }}
      />

      {/* Obstacles — beveled gradient blocks */}
      {obstacles.current.map((o) => (
        <div
          key={o.id}
          className="pointer-events-none absolute rounded-t-[2px] bg-gradient-to-b from-zinc-500 to-zinc-700 dark:from-zinc-600 dark:to-zinc-800 border-t border-zinc-400 dark:border-zinc-500"
          style={{
            left: o.x,
            top: GROUND_Y - o.height,
            width: o.width,
            height: o.height,
            boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.25), inset 1px 0 0 rgba(255,255,255,0.12)',
          }}
        />
      ))}

      {onExit && <GameExitButton onExit={onExit} />}

      {/* Score HUD */}
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

      {/* Ready / over overlays — subtle bordered card with backdrop blur */}
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
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Bored while we build?</p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Click to start —{' '}
                    <kbd className="mx-0.5 rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">
                      Space
                    </kbd>{' '}
                    to jump
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Game over — <span className="font-mono tabular-nums">{displayedScore}</span> pts
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
