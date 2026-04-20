'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvaxLogo } from '@/components/toolbox/console/create-l1/icons';
import { cn } from '@/lib/utils';
import { GameExitButton } from './GameExitButton';

/**
 * Winter-dodge style game: ski down a slope dodging trees.
 *
 * The player sits near the bottom and moves left/right; trees scroll
 * downward (simulating the slope), at increasing speed. A/D or ←/→ to
 * steer via keyboard; touch uses finger x-position to steer directly.
 * Clustered tree spawns force commit decisions.
 */

const WIDTH = 520;
const HEIGHT = 140;
const PLAYER_SIZE = 26;
const PLAYER_Y = HEIGHT - PLAYER_SIZE - 14;
const MIN_X = 6;
const MAX_X = WIDTH - PLAYER_SIZE - 6;

const INITIAL_SPEED = 180; // vertical scroll speed (trees falling)
const MAX_SPEED = 420;
const SPEED_GROWTH = 12;
const PLAYER_H_SPEED = 320;

const TREE_SIZE = 26;

type Tree = { id: number; x: number; y: number };

type GameState = 'ready' | 'playing' | 'over';

const HS_KEY = 'avaxSlopeHighScore';

export function AvaxSlope({ className, onExit }: { className?: string; onExit?: () => void }) {
  const [gameState, setGameState] = useState<GameState>('ready');
  const [highScore, setHighScore] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);

  const playerX = useRef((WIDTH - PLAYER_SIZE) / 2);
  const trees = useRef<Tree[]>([]);
  const speed = useRef(INITIAL_SPEED);
  const score = useRef(0);
  const treeId = useRef(0);
  const nextSpawnIn = useRef(0.6);
  const snowOffset = useRef(0);
  const frameRef = useRef<number | null>(null);

  const stateRef = useRef<GameState>('ready');
  stateRef.current = gameState;

  const keys = useRef({ left: false, right: false });
  const touchX = useRef<number | null>(null);

  const [, forceTick] = useState(0);

  const startRound = useCallback(() => {
    playerX.current = (WIDTH - PLAYER_SIZE) / 2;
    trees.current = [];
    speed.current = INITIAL_SPEED;
    score.current = 0;
    treeId.current = 0;
    nextSpawnIn.current = 0.6;
    snowOffset.current = 0;
    setGameState('playing');
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HS_KEY);
      if (saved) setHighScore(parseInt(saved, 10) || 0);
    } catch {
      /* localStorage blocked */
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

      // Player movement — keyboard takes precedence; touch overrides when active
      let dx = 0;
      if (keys.current.left) dx -= PLAYER_H_SPEED * dt;
      if (keys.current.right) dx += PLAYER_H_SPEED * dt;
      if (touchX.current !== null) {
        const target = Math.max(MIN_X, Math.min(MAX_X, touchX.current - PLAYER_SIZE / 2));
        const diff = target - playerX.current;
        const maxStep = PLAYER_H_SPEED * dt * 1.8;
        dx = Math.max(-maxStep, Math.min(maxStep, diff));
      }
      playerX.current = Math.max(MIN_X, Math.min(MAX_X, playerX.current + dx));

      // Scroll trees + snow
      const move = speed.current * dt;
      for (const t of trees.current) t.y += move;
      trees.current = trees.current.filter((t) => t.y < HEIGHT + 10);
      snowOffset.current = (snowOffset.current + move) % 14;

      // Spawn — occasional clusters of 2 at varied x for challenge
      nextSpawnIn.current -= dt;
      if (nextSpawnIn.current <= 0) {
        const clusterCount = Math.random() < 0.25 ? 2 : 1;
        for (let i = 0; i < clusterCount; i++) {
          trees.current.push({
            id: treeId.current++,
            x: 6 + Math.random() * (WIDTH - 12 - TREE_SIZE),
            y: -TREE_SIZE - i * (TREE_SIZE + 30),
          });
        }
        nextSpawnIn.current = Math.max(0.3, 0.7 - speed.current / 900) + Math.random() * 0.3;
      }

      speed.current = Math.min(MAX_SPEED, speed.current + SPEED_GROWTH * dt);
      score.current += (speed.current / 180) * 30 * dt;

      // Collision — shrunken hitbox so visual grazes don't count
      const pxL = playerX.current + 4;
      const pxR = playerX.current + PLAYER_SIZE - 4;
      const pyT = PLAYER_Y + 4;
      const pyB = PLAYER_Y + PLAYER_SIZE - 4;
      for (const t of trees.current) {
        const txL = t.x + 4;
        const txR = t.x + TREE_SIZE - 4;
        const tyT = t.y + 4;
        const tyB = t.y + TREE_SIZE - 4;
        if (pxR > txL && pxL < txR && pyB > tyT && pyT < tyB) {
          endGame();
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

  const handleTap = () => {
    if (stateRef.current === 'ready' || stateRef.current === 'over') {
      startRound();
    }
  };

  const displayedScore = Math.floor(score.current);

  return (
    <motion.div
      key={shakeKey}
      animate={shakeKey > 0 ? { x: [0, -5, 5, -3, 3, 0], y: [0, 2, -2, 1, 0] } : {}}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={cn(
        'relative cursor-pointer select-none overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-sky-50 to-zinc-100/80 dark:from-zinc-900 dark:to-slate-950',
        className,
      )}
      style={{ width: WIDTH, height: HEIGHT, touchAction: 'none' }}
      onClick={handleTap}
      onTouchStart={(e) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        touchX.current = e.touches[0].clientX - rect.left;
        handleTap();
      }}
      onTouchMove={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        touchX.current = e.touches[0].clientX - rect.left;
      }}
      onTouchEnd={() => {
        touchX.current = null;
      }}
    >
      {/* Snow streaks — vertical speed lines tied to game speed */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-zinc-500 dark:text-zinc-400 opacity-20"
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, currentColor 0, currentColor 1px, transparent 1px, transparent 14px)`,
          backgroundPositionY: `${snowOffset.current}px`,
          backgroundSize: '100% 14px',
        }}
      />

      {/* Trees */}
      {trees.current.map((t) => (
        <div
          key={t.id}
          aria-hidden
          className="pointer-events-none absolute text-green-700 dark:text-green-500"
          style={{ left: t.x, top: t.y, width: TREE_SIZE, height: TREE_SIZE }}
        >
          <TreeShape />
        </div>
      ))}

      {/* Player */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: playerX.current,
          top: PLAYER_Y,
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
        }}
      >
        <AvaxLogo className="h-full w-full text-zinc-900 dark:text-zinc-100 drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)]" />
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
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Dodge the trees</p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Click to start —{' '}
                    <kbd className="mx-0.5 rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">
                      A
                    </kbd>
                    /
                    <kbd className="mx-0.5 rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">
                      D
                    </kbd>{' '}
                    to steer
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Wiped out — <span className="font-mono tabular-nums">{displayedScore}</span> pts
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

/** Evergreen pine with a trunk. Simple enough to read at 26px. */
function TreeShape() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor" aria-hidden>
      <path d="M12 2 L18 10 L15 10 L20 18 L14 18 L14 22 L10 22 L10 18 L4 18 L9 10 L6 10 Z" />
    </svg>
  );
}
