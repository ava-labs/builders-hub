"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ConfigViewer, IntegrationsSection } from "@/components/console/blueprints/config-viewer";
import { gamingConfig } from "@/components/console/blueprints/blueprint-configs";

interface Transaction {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

interface GameTarget {
  id: number;
  x: number;
  y: number;
  createdAt: number;
}

export default function GamingBlueprintPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [targets, setTargets] = useState<GameTarget[]>([]);
  const [score, setScore] = useState(0);
  const [tps, setTps] = useState(0);
  const [gameTime, setGameTime] = useState(30);
  const [highScore, setHighScore] = useState(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const tpsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    tpsIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const recentTxns = transactions.filter(tx => now - tx.timestamp < 1000);
      setTps(recentTxns.length);
    }, 100);
    return () => {
      if (tpsIntervalRef.current) clearInterval(tpsIntervalRef.current);
    };
  }, [isPlaying, transactions]);

  useEffect(() => {
    if (!isPlaying || gameTime <= 0) return;
    const timer = setTimeout(() => setGameTime(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [isPlaying, gameTime]);

  useEffect(() => {
    if (gameTime <= 0 && isPlaying) endGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameTime, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    gameLoopRef.current = setInterval(() => {
      if (gameAreaRef.current) {
        const rect = gameAreaRef.current.getBoundingClientRect();
        const padding = 40;
        setTargets(prev => [...prev.slice(-8), {
          id: Date.now() + Math.random(),
          x: padding + Math.random() * (rect.width - padding * 2 - 48),
          y: padding + Math.random() * (rect.height - padding * 2 - 48),
          createdAt: Date.now(),
        }]);
      }
    }, 400);
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const cleanup = setInterval(() => {
      setTargets(prev => prev.filter(t => Date.now() - t.createdAt < 2000));
    }, 100);
    return () => clearInterval(cleanup);
  }, [isPlaying]);

  const startGame = useCallback(() => {
    setIsPlaying(true);
    setTransactions([]);
    setTargets([]);
    setScore(0);
    setGameTime(30);
    setTps(0);
  }, []);

  const endGame = useCallback(() => {
    setIsPlaying(false);
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    if (tpsIntervalRef.current) clearInterval(tpsIntervalRef.current);
    setTargets([]);
    if (score > highScore) setHighScore(score);
  }, [score, highScore]);

  const hitTarget = useCallback((target: GameTarget, e: React.MouseEvent) => {
    e.stopPropagation();
    setTransactions(prev => [...prev.slice(-50), {
      id: Date.now() + Math.random(),
      x: target.x + 24,
      y: target.y + 24,
      timestamp: Date.now(),
    }]);
    setTargets(prev => prev.filter(t => t.id !== target.id));
    setScore(prev => prev + 100);
  }, []);

  return (
    <div className="relative -m-8 p-8 min-h-full">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.12]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(148 163 184 / 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(148 163 184 / 0.4) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative max-w-5xl mx-auto">
        {/* Back link */}
        <Link
          href="/console/blueprints"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-8 transition-colors"
        >
          ← Back to Blueprints
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-100">
              Gaming
            </h1>
            {highScore > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                High: {highScore.toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-zinc-500 dark:text-zinc-400">
            10,000 TPS · Sub-second finality · Every click is an on-chain transaction
          </p>
        </div>

        {/* Game + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
          {/* Game Area */}
          <div className="lg:col-span-3">
            <div
              ref={gameAreaRef}
              className="relative h-[400px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden cursor-crosshair"
            >
              {/* Subtle grid */}
              <div
                className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(rgb(161 161 170 / 0.2) 1px, transparent 1px), linear-gradient(90deg, rgb(161 161 170 / 0.2) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />

              {/* Transaction ripples */}
              {transactions.slice(-20).map(tx => (
                <div
                  key={tx.id}
                  className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: tx.x, top: tx.y }}
                >
                  <div className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
                  <div className="absolute inset-1 rounded-full bg-emerald-500" />
                </div>
              ))}

              {/* Targets */}
              {targets.map(target => (
                <button
                  key={target.id}
                  onClick={(e) => hitTarget(target, e)}
                  className="absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 group"
                  style={{ left: target.x + 24, top: target.y + 24 }}
                >
                  <div className="absolute inset-0 rounded-full bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors" />
                  <div className="absolute inset-1.5 rounded-full bg-red-500" />
                  <div className="absolute inset-3 rounded-full bg-red-300" />
                </button>
              ))}

              {/* Start/End overlay */}
              {!isPlaying && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
                  <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                    {gameTime === 30 ? "Target Practice" : "Game Over"}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1 text-center max-w-xs">
                    {gameTime === 30
                      ? "Click targets as fast as you can. Each hit sends a transaction."
                      : `Final Score: ${score.toLocaleString()}`
                    }
                  </p>
                  {gameTime !== 30 && (
                    <p className="text-sm text-zinc-400 mb-4">
                      Peak TPS: {Math.max(...transactions.map((_, i, arr) =>
                        arr.filter(t => t.timestamp > arr[i].timestamp - 1000 && t.timestamp <= arr[i].timestamp).length
                      ), 0)}
                    </p>
                  )}
                  <button
                    onClick={startGame}
                    className="px-6 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                  >
                    {gameTime === 30 ? "Start Game" : "Play Again"}
                  </button>
                </div>
              )}

              {/* Timer */}
              {isPlaying && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-zinc-900/80 dark:bg-zinc-100/90 backdrop-blur">
                  <span className={`font-mono text-lg ${gameTime <= 10 ? 'text-red-400 dark:text-red-500' : 'text-white dark:text-zinc-900'}`}>
                    {gameTime}s
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Live TPS</div>
              <div className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{tps}</div>
              <div className="mt-2 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-100"
                  style={{ width: `${Math.min(tps * 10, 100)}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Score</div>
              <div className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {score.toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Transactions</div>
              <div className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {transactions.length}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Chain Config</div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Block Time</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">1s</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Gas/Txn</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">~1 gwei</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Max TPS</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">10,000+</span>
              </div>
            </div>
          </div>
        </div>

        {/* Why Gaming L1 */}
        <div className="mb-12">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Why a Gaming L1?</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">1s Blocks</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Fast block production means game actions confirm quickly.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">Near-Zero Fees</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                At ~$0.00001 per tx, players can make thousands of moves.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">High Throughput</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                20M gas limit handles many concurrent players on-chain.
              </p>
            </div>
          </div>
        </div>

        {/* Config */}
        <div className="mb-12">
          <ConfigViewer
            genesis={gamingConfig.genesis}
            chainConfig={gamingConfig.chainConfig}
            blueprintType="gaming"
          />
        </div>

        {/* Integrations */}
        <IntegrationsSection
          title="Recommended Integrations"
          description="Third-party services for gaming on Avalanche."
          integrations={gamingConfig.integrations}
        />
      </div>
    </div>
  );
}
