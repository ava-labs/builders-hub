'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvaxLogo } from '@/components/toolbox/console/create-l1/icons';
import { cn } from '@/lib/utils';
import { GameExitButton } from './GameExitButton';

/**
 * Super-Hexagon-style radial dodger. The player orbits at a fixed radius
 * around center; ring walls spawn at the outer edge and close inward,
 * each with a single gap. Player must rotate their angle to line up with
 * the gap before the wall reaches their orbit radius.
 *
 * Implementation notes:
 *   - Walls are rendered as a conic-gradient filled donut. The gradient
 *     paints a transparent wedge (the gap) and a colored wedge (the wall
 *     proper); a radial-gradient mask punches out the center, leaving
 *     just the ring.
 *   - Collision is purely angular: when a wall's radius is within a thin
 *     band around the player's orbit radius, we check whether the player's
 *     angle falls inside the gap (|angleDiff| < gap/2). If not, game over.
 */

const WIDTH = 600;
const HEIGHT = 180;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;

// Orbit + wall radii scaled up so the game fills the taller viewport.
// With CY=90, keeping WALL_SPAWN_R > 90 guarantees walls still spawn
// off-screen (above/below the canvas) rather than appearing mid-air.
const PLAYER_ORBIT_R = 38;
const PLAYER_SIZE = 20;
const HOME_R = PLAYER_ORBIT_R - 8; // filled central disc

const WALL_THICKNESS = 8;
const WALL_SPAWN_R = 110; // well outside the visible area
const WALL_DESPAWN_R = 16; // disappear after sweeping past the player

// Speeds scaled up to match the enlarged orbit (38) and spawn radius
// (110). The travel distance from spawn to player grew from 60px to
// 72px, so linear speeds needed the same ~20% bump to preserve the
// original reaction window (~1.15s at round start).
const INITIAL_WALL_SPEED = 65;
const MAX_WALL_SPEED = 160;
const WALL_SPEED_GROWTH = 3.0;

const INITIAL_SPAWN_INTERVAL = 0.9;
const MIN_SPAWN_INTERVAL = 0.4;
const SPAWN_INTERVAL_DECAY = 0.012;

const PLAYER_OMEGA = 3.4; // rad/s

const GAP_WIDTH = Math.PI / 2.8; // ~64° — forgiving

type Wall = {
  id: number;
  r: number;
  gapAngle: number;
  scored: boolean;
};

type GameState = 'ready' | 'playing' | 'over';

const HS_KEY = 'avaxSpinHighScore';

const TWO_PI = Math.PI * 2;

function normalizeAngle(a: number): number {
  let x = a % TWO_PI;
  if (x > Math.PI) x -= TWO_PI;
  if (x < -Math.PI) x += TWO_PI;
  return x;
}

export function AvaxSpin({ className, onExit }: { className?: string; onExit?: () => void }) {
  const [gameState, setGameState] = useState<GameState>('ready');
  const [highScore, setHighScore] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);

  const playerAngle = useRef(-Math.PI / 2); // start at 12 o'clock
  const walls = useRef<Wall[]>([]);
  const wallSpeed = useRef(INITIAL_WALL_SPEED);
  const spawnInterval = useRef(INITIAL_SPAWN_INTERVAL);
  const nextSpawnIn = useRef(0.5);
  const score = useRef(0);
  const wallId = useRef(0);
  const frameRef = useRef<number | null>(null);

  const stateRef = useRef<GameState>('ready');
  stateRef.current = gameState;

  const keys = useRef({ left: false, right: false });

  const [, forceTick] = useState(0);

  const startRound = useCallback(() => {
    playerAngle.current = -Math.PI / 2;
    walls.current = [];
    wallSpeed.current = INITIAL_WALL_SPEED;
    spawnInterval.current = INITIAL_SPAWN_INTERVAL;
    nextSpawnIn.current = 0.5;
    score.current = 0;
    wallId.current = 0;
    setGameState('playing');
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HS_KEY);
      if (saved) setHighScore(parseInt(saved, 10) || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        keys.current.left = true;
        if (stateRef.current === 'playing') e.preventDefault();
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        keys.current.right = true;
        if (stateRef.current === 'playing') e.preventDefault();
      }
      if ((e.code === 'Space' || e.code === 'Enter') && stateRef.current === 'over') {
        e.preventDefault();
        startRound();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.current.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.current.right = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [startRound]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    let last = 0;

    const endGame = () => {
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
    };

    const loop = (ts: number) => {
      if (stateRef.current !== 'playing') {
        frameRef.current = null;
        return;
      }
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;

      // Player rotation
      if (keys.current.left) playerAngle.current -= PLAYER_OMEGA * dt;
      if (keys.current.right) playerAngle.current += PLAYER_OMEGA * dt;
      playerAngle.current = normalizeAngle(playerAngle.current);

      // Shrink walls
      for (const w of walls.current) w.r -= wallSpeed.current * dt;
      walls.current = walls.current.filter((w) => w.r > WALL_DESPAWN_R);

      // Spawn
      nextSpawnIn.current -= dt;
      if (nextSpawnIn.current <= 0) {
        walls.current.push({
          id: wallId.current++,
          r: WALL_SPAWN_R,
          gapAngle: (Math.random() * 2 - 1) * Math.PI,
          scored: false,
        });
        nextSpawnIn.current = spawnInterval.current + Math.random() * 0.2;
      }

      // Difficulty ramp
      wallSpeed.current = Math.min(MAX_WALL_SPEED, wallSpeed.current + WALL_SPEED_GROWTH * dt);
      spawnInterval.current = Math.max(MIN_SPAWN_INTERVAL, spawnInterval.current - SPAWN_INTERVAL_DECAY * dt);

      score.current += 12 * dt;

      // Collision — walls whose radius is within a thin band around player orbit
      for (const w of walls.current) {
        const inBand =
          w.r <= PLAYER_ORBIT_R + WALL_THICKNESS / 2 && w.r + WALL_THICKNESS >= PLAYER_ORBIT_R - WALL_THICKNESS / 2;
        if (inBand) {
          const diff = Math.abs(normalizeAngle(playerAngle.current - w.gapAngle));
          if (diff > GAP_WIDTH / 2) {
            endGame();
            return;
          }
        }
        // Award a point when the wall passes inside the orbit (player survived it)
        if (!w.scored && w.r + WALL_THICKNESS < PLAYER_ORBIT_R - WALL_THICKNESS / 2) {
          w.scored = true;
          score.current += 3; // bonus per survived wall
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

  const handleTap = () => {
    if (stateRef.current === 'ready' || stateRef.current === 'over') {
      startRound();
    }
  };

  const displayedScore = Math.floor(score.current);

  const playerPos = {
    x: CX + PLAYER_ORBIT_R * Math.cos(playerAngle.current) - PLAYER_SIZE / 2,
    y: CY + PLAYER_ORBIT_R * Math.sin(playerAngle.current) - PLAYER_SIZE / 2,
  };

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
      onClick={handleTap}
      onTouchStart={(e) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        if (x < WIDTH / 2) keys.current.left = true;
        else keys.current.right = true;
        handleTap();
      }}
      onTouchEnd={() => {
        keys.current.left = false;
        keys.current.right = false;
      }}
    >
      {/* Central home disc — the "safe" center the player orbits around */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full bg-zinc-300/60 dark:bg-zinc-700/40 border border-zinc-300/60 dark:border-zinc-700/40"
        style={{
          left: CX - HOME_R,
          top: CY - HOME_R,
          width: HOME_R * 2,
          height: HOME_R * 2,
        }}
      />

      {/* Walls — conic-gradient donuts with a radial mask */}
      {walls.current.map((w) => (
        <WallRing key={w.id} wall={w} />
      ))}

      {/* Player */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: playerPos.x,
          top: playerPos.y,
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
        }}
      >
        <AvaxLogo className="h-full w-full text-zinc-900 dark:text-zinc-100 drop-shadow-[0_0_4px_rgba(0,0,0,0.4)] dark:drop-shadow-[0_0_4px_rgba(255,255,255,0.45)]" />
      </div>

      {onExit && <GameExitButton onExit={onExit} />}

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
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Spin to the gap</p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Click to start —{' '}
                    <kbd className="mx-0.5 rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">
                      A
                    </kbd>
                    /
                    <kbd className="mx-0.5 rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">
                      D
                    </kbd>{' '}
                    to rotate
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Crushed — <span className="font-mono tabular-nums">{displayedScore}</span> pts
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

/**
 * Ring wall renderer: conic-gradient paints the wall+gap in one go; a
 * radial-gradient mask hollows the middle so only the donut band shows.
 * The math: CSS conic-gradient's `from` angle is measured from 12 o'clock
 * clockwise, while our math angles are from 3 o'clock counterclockwise.
 * Conversion: `conicAngle = mathAngle * 180/π + 90`.
 */
function WallRing({ wall }: { wall: Wall }) {
  const rOut = wall.r + WALL_THICKNESS;
  const rIn = wall.r;
  const gapDeg = (GAP_WIDTH * 180) / Math.PI;
  const gapStartConicDeg = ((wall.gapAngle - GAP_WIDTH / 2) * 180) / Math.PI + 90;
  // Normalize into [0, 360)
  const from = ((gapStartConicDeg % 360) + 360) % 360;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute text-zinc-500 dark:text-zinc-400"
      style={{
        left: CX - rOut,
        top: CY - rOut,
        width: rOut * 2,
        height: rOut * 2,
        borderRadius: '50%',
        background: `conic-gradient(from ${from}deg, transparent 0deg, transparent ${gapDeg}deg, currentColor ${gapDeg}deg, currentColor 360deg)`,
        WebkitMaskImage: `radial-gradient(circle, transparent ${rIn}px, black ${rIn + 0.5}px)`,
        maskImage: `radial-gradient(circle, transparent ${rIn}px, black ${rIn + 0.5}px)`,
        opacity: 0.88,
      }}
    />
  );
}
