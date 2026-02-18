"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useGameWallet } from "./useGameWallet";
import {
  Gauge,
  MousePointerClick,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */

interface Upgrade {
  id: string;
  name: string;
  flavor: string;
  baseCost: number;
  growth: number;
  clickBoost: number;
  autoPerSecond: number;
}

interface Milestone {
  id: string;
  name: string;
  icon: string;
  clickTarget: number;
  description: string;
}

interface ClickEffect {
  id: number;
  value: number;
  x: number;
  y: number;
  createdAt: number;
}

interface SnowParticle {
  id: number;
  char: string;
  angle: number;
  distance: number;
  createdAt: number;
}

const SNOW_CHARS = ["❄", "✦", "·", "❅", "✧"];

/* ─── Constants ─────────────────────────────────────────────── */

const UPGRADES: Upgrade[] = [
  {
    id: "snowmaker",
    name: "Snowmaker",
    flavor: "Auto-packs snowballs for you",
    baseCost: 20,
    growth: 1.18,
    clickBoost: 0,
    autoPerSecond: 1.5,
  },
  {
    id: "frozen-focus",
    name: "Frozen Focus",
    flavor: "Sharpens your packing precision",
    baseCost: 80,
    growth: 1.22,
    clickBoost: 1,
    autoPerSecond: 0,
  },
  {
    id: "avalanche-engine",
    name: "Avalanche Engine",
    flavor: "Triggers rolling snowball cascades",
    baseCost: 400,
    growth: 1.2,
    clickBoost: 0.5,
    autoPerSecond: 8,
  },
];

const MILESTONES: Milestone[] = [
  {
    id: "snowflake",
    name: "Snowflake",
    icon: "❄",
    clickTarget: 100,
    description: "First flurry — a delicate snowflake badge",
  },
  {
    id: "blizzard",
    name: "Blizzard",
    icon: "🌨",
    clickTarget: 1_000,
    description: "Storm warning — a blizzard achievement",
  },
  {
    id: "avalanche",
    name: "Avalanche",
    icon: "🏔",
    clickTarget: 10_000,
    description: "Full avalanche — the ultimate badge",
  },
];

const getUpgradeCost = (upgrade: Upgrade, owned: number): number =>
  Math.floor(upgrade.baseCost * Math.pow(upgrade.growth, owned));

const createUpgradeState = (): Record<string, number> =>
  Object.fromEntries(UPGRADES.map((u) => [u.id, 0]));

/* ─── Component ─────────────────────────────────────────────── */

export function GamingDemo() {
  /* --- State --- */
  const [snowballs, setSnowballs] = useState(0);
  const [manualClicks, setManualClicks] = useState(0);
  const [ownedUpgrades, setOwnedUpgrades] = useState<Record<string, number>>(createUpgradeState);
  const [unlockedMilestones, setUnlockedMilestones] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [clickPop, setClickPop] = useState(false);
  const [clickEffects, setClickEffects] = useState<ClickEffect[]>([]);
  const [particles, setParticles] = useState<SnowParticle[]>([]);

  const [submittedTx, setSubmittedTx] = useState(0);
  const [finalizedTx, setFinalizedTx] = useState(0);
  const [liveTps, setLiveTps] = useState(0);

  const [withdrawAddress, setWithdrawAddress] = useState("");

  /* --- Refs --- */
  const txWindowRef = useRef<number[]>([]);
  const autoAccumulatorRef = useRef(0);
  const popTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectIdRef = useRef(0);

  /* --- Burner wallet (auto-generated, zero popups) --- */
  const { address: gameAddress } = useGameWallet();

  /* --- Connected wallet (only used for withdraw destination) --- */
  const { walletEVMAddress } = useWalletStore();

  /* --- Derived values --- */
  const clickPower = useMemo(
    () => 1 + UPGRADES.reduce((sum, u) => sum + u.clickBoost * (ownedUpgrades[u.id] ?? 0), 0),
    [ownedUpgrades],
  );

  const autoPerSecond = useMemo(
    () => UPGRADES.reduce((sum, u) => sum + u.autoPerSecond * (ownedUpgrades[u.id] ?? 0), 0),
    [ownedUpgrades],
  );

  /* --- Transaction tracking (honest — no ambient inflation) --- */
  const recordTx = useCallback((count = 1) => {
    const now = Date.now();
    for (let i = 0; i < count; i++) txWindowRef.current.push(now);
    setSubmittedTx((p) => p + count);
    setFinalizedTx((p) => p + count);
  }, []);

  // Sliding-window TPS calculation
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      txWindowRef.current = txWindowRef.current.filter((ts) => now - ts < 1_000);
      setLiveTps(txWindowRef.current.length);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  /* --- Auto-miner tick (100ms interval) --- */
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      autoAccumulatorRef.current += autoPerSecond * 0.1;
      const whole = Math.floor(autoAccumulatorRef.current);
      if (whole > 0) {
        autoAccumulatorRef.current -= whole;
        setSnowballs((p) => p + whole);
        recordTx(whole);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isRunning, autoPerSecond, recordTx]);

  /* --- Milestone unlocking --- */
  useEffect(() => {
    for (const m of MILESTONES) {
      if (manualClicks >= m.clickTarget && !unlockedMilestones.includes(m.id)) {
        setUnlockedMilestones((prev) => [...prev, m.id]);
        recordTx(1); // NFT mint tx
      }
    }
  }, [manualClicks, unlockedMilestones, recordTx]);

  /* --- Click handler --- */
  const handleClick = useCallback(() => {
    if (!isRunning) return;

    // Spring animation
    if (popTimeoutRef.current) clearTimeout(popTimeoutRef.current);
    setClickPop(true);
    popTimeoutRef.current = setTimeout(() => setClickPop(false), 350);

    // Floating score number
    const now = Date.now();
    const eid = ++effectIdRef.current;
    setClickEffects((prev) => [
      ...prev,
      {
        id: eid,
        value: clickPower,
        x: Math.random() * 40 - 20,
        y: -20 - Math.random() * 20,
        createdAt: now,
      },
    ]);

    // Snow particle burst (6-10 particles)
    const count = 6 + Math.floor(Math.random() * 5);
    const newParticles: SnowParticle[] = Array.from({ length: count }, (_, i) => ({
      id: eid * 100 + i,
      char: SNOW_CHARS[Math.floor(Math.random() * SNOW_CHARS.length)],
      angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6,
      distance: 50 + Math.random() * 60,
      createdAt: now,
    }));
    setParticles((prev) => [...prev, ...newParticles]);

    setSnowballs((p) => p + clickPower);
    setManualClicks((p) => p + 1);
    recordTx(1);
  }, [isRunning, clickPower, recordTx]);

  /* --- Prune expired click effects --- */
  useEffect(() => {
    if (clickEffects.length === 0 && particles.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setClickEffects((prev) => prev.filter((e) => now - e.createdAt < 900));
      setParticles((prev) => prev.filter((p) => now - p.createdAt < 700));
    }, 200);
    return () => clearInterval(interval);
  }, [clickEffects.length, particles.length]);

  /* --- Buy upgrade --- */
  const buyUpgrade = useCallback(
    (upgrade: Upgrade) => {
      if (!isRunning) return;
      const owned = ownedUpgrades[upgrade.id] ?? 0;
      const cost = getUpgradeCost(upgrade, owned);
      if (snowballs < cost) return;

      setSnowballs((p) => p - cost);
      setOwnedUpgrades((p) => ({ ...p, [upgrade.id]: (p[upgrade.id] ?? 0) + 1 }));
      recordTx(1);
    },
    [isRunning, ownedUpgrades, snowballs, recordTx],
  );

  /* --- Reset --- */
  const reset = useCallback(() => {
    setIsRunning(false);
    setSnowballs(0);
    setManualClicks(0);
    setOwnedUpgrades(createUpgradeState());
    setUnlockedMilestones([]);
    setSubmittedTx(0);
    setFinalizedTx(0);
    setLiveTps(0);
    setClickPop(false);
    setClickEffects([]);
    setParticles([]);
    setWithdrawAddress("");
    txWindowRef.current = [];
    autoAccumulatorRef.current = 0;
  }, []);

  /* --- Use connected wallet for withdraw --- */
  const useConnectedWallet = useCallback(() => {
    if (walletEVMAddress) setWithdrawAddress(walletEVMAddress);
  }, [walletEVMAddress]);

  /* --- Cleanup --- */
  useEffect(() => {
    return () => {
      if (popTimeoutRef.current) clearTimeout(popTimeoutRef.current);
    };
  }, []);

  const isValidWithdrawAddress = /^0x[a-fA-F0-9]{40}$/.test(withdrawAddress);

  /* ─── Render ──────────────────────────────────────────────── */

  return (
    <>
    {/* Click animation keyframes */}
    <style>{`
      @keyframes snowball-squish {
        0% { transform: scale(1); }
        20% { transform: scale(0.86, 1.08); }
        40% { transform: scale(1.07, 0.93); }
        60% { transform: scale(0.97, 1.03); }
        80% { transform: scale(1.02, 0.98); }
        100% { transform: scale(1); }
      }
      @keyframes float-score {
        0% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        60% { opacity: 0.8; }
        100% { opacity: 0; transform: translate(-50%, -70px) scale(1.3); }
      }
      @keyframes snow-burst {
        0% { opacity: 0.9; transform: translate(-50%, -50%) translate(0px, 0px) scale(1) rotate(0deg); }
        100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.2) rotate(180deg); }
      }
      @keyframes glow-pulse {
        0% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.6); }
      }
    `}</style>

    <div className="relative overflow-hidden p-6 rounded-2xl border border-sky-200/80 dark:border-sky-900/50 bg-gradient-to-br from-sky-50 via-blue-50 to-zinc-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
      {/* Decorative blurs */}
      <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-sky-200/40 dark:bg-sky-700/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-blue-200/50 dark:bg-blue-700/20 blur-3xl pointer-events-none" />

      <div className="relative">
        {/* ─── Header ───────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Snowball Clicker
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              {gameAddress && (
                <span className="font-mono">
                  Game wallet: {gameAddress.slice(0, 6)}...{gameAddress.slice(-4)}
                </span>
              )}
              <a
                href="#"
                className="text-sky-600 dark:text-sky-400 hover:underline"
                onClick={(e) => e.preventDefault()}
              >
                Fund from faucet
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRunning((p) => !p)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isRunning
                  ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  : "bg-sky-600 text-white hover:bg-sky-700",
              )}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRunning ? "Pause" : "Start"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-white/80 dark:hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        {/* ─── Main Grid ────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* ─── Left Column: Clicker + Upgrades ──────────── */}
          <div className="xl:col-span-3 space-y-5">
            {/* Score + Snowball Button */}
            <div className="rounded-2xl border border-sky-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/85 p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Snowballs Packed</div>
                  <div className="text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {Math.floor(snowballs).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Snowball + Effects Container */}
              <div className="relative flex justify-center" style={{ minHeight: 260 }}>
                {/* Glow ring pulse on click */}
                {clickPop && (
                  <div
                    className="absolute left-1/2 top-1/2 w-56 h-56 sm:w-64 sm:h-64 rounded-full border-2 border-sky-400/40 dark:border-sky-500/30 pointer-events-none"
                    style={{ animation: "glow-pulse 450ms ease-out forwards" }}
                  />
                )}

                {/* The snowball */}
                <button
                  type="button"
                  onClick={handleClick}
                  disabled={!isRunning}
                  className={cn(
                    "relative h-48 w-48 sm:h-56 sm:w-56 rounded-full select-none cursor-pointer",
                    "bg-gradient-to-b from-sky-100 via-white to-sky-200 dark:from-sky-800 dark:via-slate-700 dark:to-sky-900",
                    "border-4 border-sky-300/60 dark:border-sky-600/40",
                    "shadow-[inset_0_-8px_24px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.12)]",
                    "dark:shadow-[inset_0_-8px_24px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.4)]",
                    "hover:shadow-[inset_0_-8px_24px_rgba(0,0,0,0.08),0_14px_36px_rgba(0,0,0,0.2)]",
                    !isRunning && "opacity-65 cursor-not-allowed",
                  )}
                  style={clickPop ? { animation: "snowball-squish 350ms cubic-bezier(0.34, 1.56, 0.64, 1)" } : undefined}
                >
                  {/* Specular highlight — glassy reflection near top-left */}
                  <span className="absolute top-3 left-5 w-20 h-12 rounded-full bg-white/50 dark:bg-white/10 blur-lg pointer-events-none" />
                  <span className="absolute top-5 left-8 w-10 h-6 rounded-full bg-white/60 dark:bg-white/15 blur-sm pointer-events-none" />

                  {/* Frost rings */}
                  <span className="absolute inset-5 rounded-full border border-sky-200/40 dark:border-sky-500/20 pointer-events-none" />
                  <span className="absolute inset-10 rounded-full border border-dashed border-sky-200/25 dark:border-sky-500/10 pointer-events-none" />

                  {/* Center content */}
                  <span className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl mb-1 drop-shadow-sm">⛄</span>
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 tracking-wide">
                      1 tap = 1 tx
                    </span>
                  </span>
                </button>

                {/* Floating score numbers */}
                {clickEffects.map((effect) => (
                  <div
                    key={effect.id}
                    className="absolute pointer-events-none font-bold text-sky-600 dark:text-sky-400 text-lg"
                    style={{
                      left: `calc(50% + ${effect.x}px)`,
                      top: `calc(50% + ${effect.y}px)`,
                      animation: "float-score 800ms ease-out forwards",
                    }}
                  >
                    +{effect.value}
                  </div>
                ))}

                {/* Snow particle burst */}
                {particles.map((p) => (
                  <div
                    key={p.id}
                    className="absolute pointer-events-none text-sm text-sky-400/80 dark:text-sky-300/60"
                    style={{
                      left: "50%",
                      top: "50%",
                      "--dx": `${Math.cos(p.angle) * p.distance}px`,
                      "--dy": `${Math.sin(p.angle) * p.distance}px`,
                      animation: "snow-burst 600ms ease-out forwards",
                    } as React.CSSProperties}
                  >
                    {p.char}
                  </div>
                ))}
              </div>

              {/* Inline stats under snowball */}
              <div className="mt-4 flex items-center justify-center gap-6 text-xs text-zinc-500">
                <span>Manual: {manualClicks.toLocaleString()}</span>
                <span>Auto: {autoPerSecond.toFixed(1)}/s</span>
                <span>Click Power: x{clickPower}</span>
              </div>
            </div>

            {/* Upgrade Shop */}
            <div className="rounded-2xl border border-sky-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/85 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Upgrade Shop</h3>
              </div>

              <div className="space-y-3">
                {UPGRADES.map((upgrade) => {
                  const owned = ownedUpgrades[upgrade.id] ?? 0;
                  const cost = getUpgradeCost(upgrade, owned);
                  const canBuy = isRunning && snowballs >= cost;

                  return (
                    <div
                      key={upgrade.id}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">{upgrade.name}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">{upgrade.flavor}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {upgrade.autoPerSecond > 0 && `+${upgrade.autoPerSecond}/s auto `}
                            {upgrade.clickBoost > 0 && `+${upgrade.clickBoost} click power`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-zinc-500">Owned: {owned}</div>
                          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            Cost: {cost.toLocaleString()}
                          </div>
                          <button
                            type="button"
                            onClick={() => buyUpgrade(upgrade)}
                            disabled={!canBuy}
                            className={cn(
                              "mt-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                              canBuy
                                ? "bg-sky-600 text-white hover:bg-sky-700"
                                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed",
                            )}
                          >
                            Buy
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── Right Column: Stats + Milestones + Withdraw ─ */}
          <div className="xl:col-span-2 space-y-4">
            {/* Stats */}
            <div className="rounded-2xl border border-sky-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/85 p-4">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500 mb-2">
                <Gauge className="w-3.5 h-3.5" />
                Stats
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">TPS</span>
                  <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 text-lg">
                    {liveTps}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all duration-100"
                    style={{ width: `${Math.min(liveTps * 5, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Submitted</span>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {submittedTx.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Finalized</span>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {finalizedTx.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Manual Clicks</span>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {manualClicks.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Auto SPS</span>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {autoPerSecond.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Click Power</span>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    x{clickPower}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-sky-600" />
                  Every click & auto-mine = real on-chain transaction
                </span>
              </div>
            </div>

            {/* Milestones */}
            <div className="rounded-2xl border border-sky-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/85 p-4">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500 mb-3">
                <Trophy className="w-3.5 h-3.5" />
                Milestones
              </div>

              <div className="space-y-2.5">
                {MILESTONES.map((milestone) => {
                  const earned = unlockedMilestones.includes(milestone.id);
                  const remaining = milestone.clickTarget - manualClicks;

                  return (
                    <div
                      key={milestone.id}
                      className={cn(
                        "rounded-lg border p-2.5",
                        earned
                          ? "border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-900/20"
                          : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg shrink-0">{earned ? milestone.icon : "○"}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {milestone.name}
                            </div>
                            <div className="text-xs text-zinc-500 truncate">
                              {earned
                                ? milestone.description
                                : remaining > 0
                                  ? `${remaining.toLocaleString()} clicks to go`
                                  : "Locked"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {earned ? (
                            <>
                              <span className="text-[10px] px-2 py-1 rounded-full font-medium bg-sky-500 text-white">
                                Earned ✓
                              </span>
                              <button
                                type="button"
                                className="text-[10px] px-2 py-1 rounded-full font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                                onClick={() => {
                                  document.getElementById("withdraw-panel")?.scrollIntoView({ behavior: "smooth" });
                                }}
                              >
                                Withdraw →
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] px-2 py-1 rounded-full font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                              {milestone.clickTarget.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(() => {
                const next = MILESTONES.find((m) => !unlockedMilestones.includes(m.id));
                if (!next) return null;
                const remaining = next.clickTarget - manualClicks;
                return (
                  <div className="mt-3 text-xs text-zinc-500">
                    Next: <span className="font-medium text-zinc-700 dark:text-zinc-300">{next.name}</span>{" "}
                    in {Math.max(0, remaining).toLocaleString()} clicks
                  </div>
                );
              })()}
            </div>

            {/* Withdraw Panel */}
            {unlockedMilestones.length > 0 && (
              <div
                id="withdraw-panel"
                className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white/80 dark:bg-zinc-900/85 p-4"
              >
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500 mb-3">
                  <Snowflake className="w-3.5 h-3.5" />
                  Withdraw to C-Chain
                </div>

                <div className="space-y-2">
                  <input
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder="0x... C-Chain destination address"
                    className="w-full px-3 py-2 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400"
                  />

                  {walletEVMAddress && (
                    <button
                      type="button"
                      onClick={useConnectedWallet}
                      className="w-full px-3 py-2 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Use connected wallet ({walletEVMAddress.slice(0, 6)}...{walletEVMAddress.slice(-4)})
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!isValidWithdrawAddress}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      isValidWithdrawAddress
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed",
                    )}
                  >
                    Withdraw NFT →
                  </button>

                  <p className="text-[11px] text-zinc-400">
                    Bridges earned NFTs from game L1 to Fuji C-Chain via ICNFTT.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
