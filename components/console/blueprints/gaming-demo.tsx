"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import ExampleERC20 from "@/contracts/icm-contracts/compiled/ExampleERC20.json";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useL1List, type L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { createPublicClient, http, isAddress, type Address, type Chain } from "viem";
import {
  Activity,
  Coins,
  Database,
  Gauge,
  Gift,
  MousePointerClick,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";

type ThroughputMode = "builder" | "showcase" | "stress";
type ExecutionMode = "simulated" | "live";
type FeedTone = "click" | "upgrade" | "mint" | "system";
type TxFinalizationMode = "simulated" | "external";

interface ThroughputProfile {
  label: string;
  ambientTps: number;
  jitterTps: number;
  finalityMinMs: number;
  finalityMaxMs: number;
  visualCap: number;
}

interface Upgrade {
  id: string;
  name: string;
  flavor: string;
  baseCost: number;
  growth: number;
  clickBoost: number;
  autoClicksPerSecond: number;
}

interface CollectibleSpec {
  id: string;
  name: string;
  rarity: "Common" | "Rare" | "Legendary";
  clickTarget: number;
}

interface MintedCollectible extends CollectibleSpec {
  tokenId: number;
}

interface TxSample {
  ts: number;
  count: number;
}

interface PendingBatch {
  count: number;
  finalizeAt: number;
}

interface FeedItem {
  id: number;
  title: string;
  detail: string;
  tone: FeedTone;
  count: number;
  at: number;
}

const THROUGHPUT_PROFILES: Record<ThroughputMode, ThroughputProfile> = {
  builder: {
    label: "Builder",
    ambientTps: 180,
    jitterTps: 50,
    finalityMinMs: 280,
    finalityMaxMs: 520,
    visualCap: 1_400,
  },
  showcase: {
    label: "Showcase",
    ambientTps: 1_750,
    jitterTps: 320,
    finalityMinMs: 220,
    finalityMaxMs: 420,
    visualCap: 8_000,
  },
  stress: {
    label: "Stress",
    ambientTps: 9_800,
    jitterTps: 1_250,
    finalityMinMs: 180,
    finalityMaxMs: 340,
    visualCap: 20_000,
  },
};

const UPGRADES: Upgrade[] = [
  {
    id: "pack-alpha",
    name: "Pack Alpha",
    flavor: "Auto taps the triangle for baseline throughput.",
    baseCost: 24,
    growth: 1.18,
    clickBoost: 0,
    autoClicksPerSecond: 1.1,
  },
  {
    id: "tri-focus",
    name: "Tri Focus",
    flavor: "Increases manual tap reward.",
    baseCost: 90,
    growth: 1.22,
    clickBoost: 1,
    autoClicksPerSecond: 0,
  },
  {
    id: "avalanche-engine",
    name: "Avalanche Engine",
    flavor: "Heavy autonomous throughput for demo spikes.",
    baseCost: 520,
    growth: 1.2,
    clickBoost: 0.5,
    autoClicksPerSecond: 8,
  },
];

const COLLECTIBLE_DROPS: CollectibleSpec[] = [
  {
    id: "red-shard",
    name: "Red Shard",
    rarity: "Common",
    clickTarget: 25,
  },
  {
    id: "wolfie-tag",
    name: "Wolfie Tag",
    rarity: "Rare",
    clickTarget: 90,
  },
  {
    id: "summit-emblem",
    name: "Summit Emblem",
    rarity: "Legendary",
    clickTarget: 240,
  },
];

const COLLECTIBLE_MINT_REWARDS: Record<CollectibleSpec["rarity"], bigint> = {
  Common: 15n,
  Rare: 40n,
  Legendary: 120n,
};

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min);

const createUpgradeState = (): Record<string, number> => {
  const state: Record<string, number> = {};
  for (const upgrade of UPGRADES) {
    state[upgrade.id] = 0;
  }
  return state;
};

const getUpgradeCost = (upgrade: Upgrade, owned: number): number =>
  Math.floor(upgrade.baseCost * Math.pow(upgrade.growth, owned));

const createReadyFeed = (id: number): FeedItem => ({
  id,
  title: "Simulator Ready",
  detail: "Start the run to stream click transactions.",
  tone: "system",
  count: 0,
  at: Date.now(),
});

export function GamingDemo() {
  const [mode, setMode] = useState<ThroughputMode>("showcase");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("simulated");
  const [isRunning, setIsRunning] = useState(false);
  const [cookies, setCookies] = useState(0);
  const [manualClicks, setManualClicks] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [ownedUpgrades, setOwnedUpgrades] = useState<Record<string, number>>(() => createUpgradeState());
  const [liveTps, setLiveTps] = useState(0);
  const [peakTps, setPeakTps] = useState(0);
  const [submittedTx, setSubmittedTx] = useState(0);
  const [finalizedTx, setFinalizedTx] = useState(0);
  const [pendingTx, setPendingTx] = useState(0);
  const [collectibles, setCollectibles] = useState<MintedCollectible[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>(() => [createReadyFeed(1)]);
  const [cookiePop, setCookiePop] = useState(false);
  const [contractInput, setContractInput] = useState("");
  const [liveContractAddress, setLiveContractAddress] = useState<Address | "">("");
  const [onchainCookieBalance, setOnchainCookieBalance] = useState<bigint>(0n);
  const [isDeployingContract, setIsDeployingContract] = useState(false);
  const [isLiveActionPending, setIsLiveActionPending] = useState(false);

  const { coreWalletClient, walletEVMAddress, walletChainId } = useWalletStore();
  const viemChain = useViemChainStore();
  const l1List = useL1List();
  const { notify } = useConsoleNotifications();

  const txWindowRef = useRef<TxSample[]>([]);
  const pendingBatchesRef = useRef<PendingBatch[]>([]);
  const autoAccumulatorRef = useRef(0);
  const ambientAccumulatorRef = useRef(0);
  const feedIdRef = useRef(1);
  const liveActionPendingRef = useRef(false);
  const popTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrafficLogRef = useRef(Date.now());
  const trafficSinceLogRef = useRef(0);

  const selectedNetwork = useMemo(
    () => l1List.find((network: L1ListItem) => network.evmChainId === walletChainId),
    [l1List, walletChainId],
  );

  const liveChain = useMemo<Chain | null>(() => {
    if (!viemChain || !selectedNetwork) {
      return null;
    }

    return {
      id: viemChain.id,
      name: viemChain.name,
      rpcUrls: viemChain.rpcUrls,
      nativeCurrency: viemChain.nativeCurrency,
      blockExplorers: selectedNetwork.explorerUrl
        ? {
            default: {
              name: `${selectedNetwork.name} Explorer`,
              url: selectedNetwork.explorerUrl,
            },
          }
        : undefined,
    } as Chain;
  }, [selectedNetwork, viemChain]);

  const walletReadyForLive = Boolean(coreWalletClient && walletEVMAddress && liveChain);

  const clickPower = useMemo(() => {
    return 1 + UPGRADES.reduce((sum, upgrade) => {
      return sum + upgrade.clickBoost * (ownedUpgrades[upgrade.id] ?? 0);
    }, 0);
  }, [ownedUpgrades]);

  const autoClicksPerSecond = useMemo(() => {
    return UPGRADES.reduce((sum, upgrade) => {
      return sum + upgrade.autoClicksPerSecond * (ownedUpgrades[upgrade.id] ?? 0);
    }, 0);
  }, [ownedUpgrades]);

  const runtimeSeconds = Math.floor(elapsedMs / 1_000);
  const runtimeLabel = `${Math.floor(runtimeSeconds / 60)}:${String(runtimeSeconds % 60).padStart(2, "0")}`;
  const tpsProgress = Math.min(
    (liveTps / THROUGHPUT_PROFILES[mode].visualCap) * 100,
    100,
  );

  const nextCollectible = COLLECTIBLE_DROPS.find((drop) =>
    !collectibles.some((minted) => minted.id === drop.id),
  );
  const collectibleToUnlock = useMemo(
    () =>
      COLLECTIBLE_DROPS.find((drop) =>
        manualClicks >= drop.clickTarget && !collectibles.some((minted) => minted.id === drop.id),
      ),
    [collectibles, manualClicks],
  );
  const normalizedContractInput = contractInput.trim();
  const isContractInputValid = isAddress(normalizedContractInput);

  const getErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === "string" && error.length > 0) {
      return error;
    }
    return "Unexpected wallet error.";
  }, []);

  const pushFeed = useCallback((title: string, detail: string, tone: FeedTone, count = 1) => {
    const nextId = feedIdRef.current + 1;
    feedIdRef.current = nextId;
    setFeed((previous) => [
      {
        id: nextId,
        title,
        detail,
        tone,
        count,
        at: Date.now(),
      },
      ...previous,
    ].slice(0, 8));
  }, []);

  const calculateLiveTps = useCallback((now: number): number => {
    const samples = txWindowRef.current;
    while (samples.length > 0 && now - samples[0].ts > 1_000) {
      samples.shift();
    }
    return samples.reduce((sum, sample) => sum + sample.count, 0);
  }, []);

  const recordTransactions = useCallback((
    count: number,
    options?: {
      title?: string;
      detail?: string;
      tone?: FeedTone;
      finalization?: TxFinalizationMode;
    },
  ) => {
    if (count <= 0) {
      return;
    }

    const now = Date.now();
    const shouldSimulateFinality = (options?.finalization ?? "simulated") === "simulated";
    if (shouldSimulateFinality) {
      const profile = THROUGHPUT_PROFILES[mode];
      const finalizeAt = now + randomBetween(profile.finalityMinMs, profile.finalityMaxMs);
      pendingBatchesRef.current.push({ count, finalizeAt });
    }

    txWindowRef.current.push({ ts: now, count });
    setSubmittedTx((previous) => previous + count);
    setPendingTx((previous) => previous + count);

    if (options?.title && options.detail) {
      pushFeed(options.title, options.detail, options.tone ?? "system", count);
    }
  }, [mode, pushFeed]);

  const finalizeRecordedTransactions = useCallback((count: number) => {
    if (count <= 0) {
      return;
    }
    setFinalizedTx((previous) => previous + count);
    setPendingTx((previous) => Math.max(0, previous - count));
  }, []);

  const fetchOnchainCookieBalance = useCallback(async () => {
    if (!liveChain || !walletEVMAddress || !liveContractAddress) {
      return;
    }

    try {
      const publicClient = createPublicClient({
        chain: liveChain,
        transport: http(liveChain.rpcUrls.default.http[0]),
      });

      const balance = await publicClient.readContract({
        address: liveContractAddress,
        abi: ExampleERC20.abi as any,
        functionName: "balanceOf",
        args: [walletEVMAddress as Address],
      });

      setOnchainCookieBalance(balance as bigint);
    } catch (error) {
      pushFeed("Read Failed", getErrorMessage(error), "system", 0);
    }
  }, [getErrorMessage, liveChain, liveContractAddress, pushFeed, walletEVMAddress]);

  const applyLiveContractAddress = useCallback(() => {
    const normalizedAddress = contractInput.trim();
    if (!isAddress(normalizedAddress)) {
      pushFeed("Invalid Address", "Enter a valid EVM contract address.", "system", 0);
      return;
    }

    const nextAddress = normalizedAddress as Address;
    setLiveContractAddress(nextAddress);
    setContractInput(nextAddress);
    pushFeed(
      "Contract Bound",
      `Live actions now target ${nextAddress.slice(0, 10)}...`,
      "system",
      0,
    );
  }, [contractInput, pushFeed]);

  const deployLiveCookieContract = useCallback(async () => {
    if (!walletReadyForLive || !coreWalletClient || !walletEVMAddress || !liveChain) {
      pushFeed("Wallet Required", "Connect wallet on a supported chain first.", "system", 0);
      return;
    }

    setIsDeployingContract(true);
    try {
      const publicClient = createPublicClient({
        chain: liveChain,
        transport: http(liveChain.rpcUrls.default.http[0]),
      });

      const deployPromise = coreWalletClient.deployContract({
        abi: ExampleERC20.abi as any,
        bytecode: ExampleERC20.bytecode.object as `0x${string}`,
        args: [],
        chain: liveChain,
        account: walletEVMAddress as Address,
      });

      notify(
        { type: "deploy", name: "Triangle Ledger ERC20" },
        deployPromise,
        liveChain,
      );

      const hash = await deployPromise;
      recordTransactions(1, {
        title: "Contract Deploy Submitted",
        detail: "Deploying live triangle ledger contract.",
        tone: "system",
        finalization: "external",
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      finalizeRecordedTransactions(1);

      if (!receipt.contractAddress) {
        throw new Error("Missing contract address in deployment receipt.");
      }

      setLiveContractAddress(receipt.contractAddress);
      setContractInput(receipt.contractAddress);
      setOnchainCookieBalance(0n);
      pushFeed(
        "Contract Ready",
        `Live triangle ledger ${receipt.contractAddress.slice(0, 10)}... deployed.`,
        "system",
        1,
      );
    } catch (error) {
      pushFeed("Deploy Failed", getErrorMessage(error), "system", 0);
    } finally {
      setIsDeployingContract(false);
    }
  }, [
    coreWalletClient,
    finalizeRecordedTransactions,
    getErrorMessage,
    liveChain,
    notify,
    pushFeed,
    recordTransactions,
    walletEVMAddress,
    walletReadyForLive,
  ]);

  const submitLiveContractAction = useCallback(async (payload: {
    actionName: string;
    mintAmount: bigint;
    feedTitle: string;
    feedDetail: string;
    tone: FeedTone;
  }) => {
    if (!walletReadyForLive || !coreWalletClient || !walletEVMAddress || !liveChain) {
      pushFeed("Wallet Required", "Connect wallet on a supported chain first.", "system", 0);
      return false;
    }

    if (!liveContractAddress) {
      pushFeed("Contract Required", "Deploy or set a live contract address first.", "system", 0);
      return false;
    }

    if (liveActionPendingRef.current) {
      pushFeed("Transaction Pending", "Confirm the current wallet prompt first.", "system", 0);
      return false;
    }

    liveActionPendingRef.current = true;
    setIsLiveActionPending(true);
    try {
      const publicClient = createPublicClient({
        chain: liveChain,
        transport: http(liveChain.rpcUrls.default.http[0]),
      });

      const writePromise = coreWalletClient.writeContract({
        address: liveContractAddress,
        abi: ExampleERC20.abi as any,
        functionName: "mint",
        args: [walletEVMAddress as Address, payload.mintAmount],
        chain: liveChain,
        account: walletEVMAddress as Address,
      });

      notify({ type: "call", name: payload.actionName }, writePromise, liveChain);

      const hash = await writePromise;
      recordTransactions(1, {
        title: payload.feedTitle,
        detail: payload.feedDetail,
        tone: payload.tone,
        finalization: "external",
      });

      await publicClient.waitForTransactionReceipt({ hash });
      finalizeRecordedTransactions(1);
      await fetchOnchainCookieBalance();
      return true;
    } catch (error) {
      pushFeed(`${payload.actionName} Failed`, getErrorMessage(error), "system", 0);
      return false;
    } finally {
      liveActionPendingRef.current = false;
      setIsLiveActionPending(false);
    }
  }, [
    coreWalletClient,
    fetchOnchainCookieBalance,
    finalizeRecordedTransactions,
    getErrorMessage,
    liveChain,
    liveContractAddress,
    notify,
    pushFeed,
    recordTransactions,
    walletEVMAddress,
    walletReadyForLive,
  ]);

  const resetDemo = useCallback(() => {
    setIsRunning(false);
    setCookies(0);
    setManualClicks(0);
    setTotalClicks(0);
    setElapsedMs(0);
    setOwnedUpgrades(createUpgradeState());
    setLiveTps(0);
    setPeakTps(0);
    setSubmittedTx(0);
    setFinalizedTx(0);
    setPendingTx(0);
    setCollectibles([]);
    liveActionPendingRef.current = false;
    setIsLiveActionPending(false);

    txWindowRef.current = [];
    pendingBatchesRef.current = [];
    autoAccumulatorRef.current = 0;
    ambientAccumulatorRef.current = 0;
    trafficSinceLogRef.current = 0;
    lastTrafficLogRef.current = Date.now();

    const newFeedId = feedIdRef.current + 1;
    feedIdRef.current = newFeedId;
    setFeed([createReadyFeed(newFeedId)]);
  }, []);

  const toggleSimulation = useCallback(() => {
    setIsRunning((previous) => {
      const nextState = !previous;
      pushFeed(
        nextState ? "Simulation Started" : "Simulation Paused",
        nextState
          ? executionMode === "live"
            ? "Live mode active: clicks/upgrades prompt real contract transactions."
            : "Manual clicks and bot actors are now submitting txs."
          : "Throughput generation paused. Pending txs still settle.",
        "system",
        0,
      );
      return nextState;
    });
  }, [executionMode, pushFeed]);

  const handleCookieClick = useCallback(async () => {
    if (!isRunning) {
      return;
    }

    if (popTimeoutRef.current) {
      clearTimeout(popTimeoutRef.current);
    }
    setCookiePop(true);
    popTimeoutRef.current = setTimeout(() => {
      setCookiePop(false);
    }, 130);

    const criticalHit = Math.random() < 0.08;
    const yieldMultiplier = criticalHit ? 2 : 1;
    const gainedCookies = clickPower * yieldMultiplier;
    const nextManualClicks = manualClicks + 1;

    if (executionMode === "live") {
      const clickWasRecorded = await submitLiveContractAction({
        actionName: "Triangle Tap",
        mintAmount: BigInt(Math.max(1, gainedCookies)),
        feedTitle: "Live Click Tx",
        feedDetail: `Minted ${gainedCookies.toLocaleString()} triangle units on-chain.`,
        tone: "click",
      });

      if (!clickWasRecorded) {
        return;
      }
    } else {
      recordTransactions(1);
    }

    setCookies((previous) => previous + gainedCookies);
    setManualClicks(nextManualClicks);
    setTotalClicks((previous) => previous + 1);

    if (nextManualClicks % 5 === 0) {
      pushFeed(
        "Player Click Confirmed",
        `${nextManualClicks.toLocaleString()} manual click txs submitted.`,
        "click",
        1,
      );
    }

    if (criticalHit) {
      pushFeed(
        "Sugar Rush",
        `Critical tap doubled output to ${gainedCookies.toLocaleString()} triangles.`,
        "click",
        1,
      );
    }
  }, [
    clickPower,
    executionMode,
    isRunning,
    manualClicks,
    pushFeed,
    recordTransactions,
    submitLiveContractAction,
  ]);

  const buyUpgrade = useCallback(async (upgrade: Upgrade) => {
    if (!isRunning) {
      return;
    }

    const currentlyOwned = ownedUpgrades[upgrade.id] ?? 0;
    const cost = getUpgradeCost(upgrade, currentlyOwned);
    if (cookies < cost) {
      return;
    }

    if (executionMode === "live") {
      const upgradeWasRecorded = await submitLiveContractAction({
        actionName: `Upgrade ${upgrade.name}`,
        mintAmount: BigInt(Math.max(1, cost)),
        feedTitle: `Live Upgrade Tx: ${upgrade.name}`,
        feedDetail: `Recorded upgrade state with ${cost.toLocaleString()} units.`,
        tone: "upgrade",
      });

      if (!upgradeWasRecorded) {
        return;
      }
    } else {
      recordTransactions(1, {
        title: `Upgrade Purchased: ${upgrade.name}`,
        detail: `Spent ${cost.toLocaleString()} triangles for more throughput.`,
        tone: "upgrade",
      });
    }

    setCookies((previous) => previous - cost);
    setOwnedUpgrades((previous) => ({
      ...previous,
      [upgrade.id]: (previous[upgrade.id] ?? 0) + 1,
    }));
  }, [
    cookies,
    executionMode,
    isRunning,
    ownedUpgrades,
    recordTransactions,
    submitLiveContractAction,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining: PendingBatch[] = [];
      let finalizedNow = 0;

      for (const batch of pendingBatchesRef.current) {
        if (batch.finalizeAt <= now) {
          finalizedNow += batch.count;
        } else {
          remaining.push(batch);
        }
      }

      pendingBatchesRef.current = remaining;

      if (finalizedNow > 0) {
        finalizeRecordedTransactions(finalizedNow);
      }

      const tps = calculateLiveTps(now);
      setLiveTps(tps);
      setPeakTps((previous) => Math.max(previous, tps));
    }, 120);

    return () => clearInterval(interval);
  }, [calculateLiveTps, finalizeRecordedTransactions]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const tickMs = 100;
    const interval = setInterval(() => {
      const profile = THROUGHPUT_PROFILES[mode];
      const deltaSeconds = tickMs / 1_000;
      const now = Date.now();

      setElapsedMs((previous) => previous + tickMs);

      autoAccumulatorRef.current += autoClicksPerSecond * deltaSeconds;
      const autoClickCount = Math.floor(autoAccumulatorRef.current);
      if (autoClickCount > 0) {
        autoAccumulatorRef.current -= autoClickCount;
        setCookies((previous) => previous + autoClickCount);
        setTotalClicks((previous) => previous + autoClickCount);
        if (executionMode === "simulated") {
          recordTransactions(autoClickCount);
          trafficSinceLogRef.current += autoClickCount;
        }
      }

      if (executionMode === "simulated") {
        const ambientRate = profile.ambientTps + randomBetween(-profile.jitterTps, profile.jitterTps);
        ambientAccumulatorRef.current += ambientRate * deltaSeconds;
        const ambientTransactions = Math.max(0, Math.floor(ambientAccumulatorRef.current));
        if (ambientTransactions > 0) {
          ambientAccumulatorRef.current -= ambientTransactions;
          recordTransactions(ambientTransactions);
          trafficSinceLogRef.current += ambientTransactions;
        }
      }

      if (
        executionMode === "simulated" &&
        now - lastTrafficLogRef.current >= 4_000 &&
        trafficSinceLogRef.current > 0
      ) {
        const traffic = trafficSinceLogRef.current;
        trafficSinceLogRef.current = 0;
        lastTrafficLogRef.current = now;
        pushFeed(
          "Throughput Pulse",
          `${traffic.toLocaleString()} transactions streamed in the last 4s window.`,
          "system",
          traffic,
        );
      }
    }, tickMs);

    return () => clearInterval(interval);
  }, [autoClicksPerSecond, executionMode, isRunning, mode, pushFeed, recordTransactions]);

  useEffect(() => {
    if (!collectibleToUnlock) {
      return;
    }

    if (executionMode === "simulated") {
      setCollectibles((previous) => {
        if (previous.some((item) => item.id === collectibleToUnlock.id)) {
          return previous;
        }
        return [
          ...previous,
          {
            ...collectibleToUnlock,
            tokenId: previous.length + 1,
          },
        ];
      });

      recordTransactions(1, {
        title: `Collectible Unlocked: ${collectibleToUnlock.name}`,
        detail: `${collectibleToUnlock.rarity} drop prepared for NFT mint bridging.`,
        tone: "mint",
      });
      return;
    }

    let cancelled = false;

    const mintCollectible = async () => {
      const minted = await submitLiveContractAction({
        actionName: `Collectible ${collectibleToUnlock.name}`,
        mintAmount: COLLECTIBLE_MINT_REWARDS[collectibleToUnlock.rarity],
        feedTitle: `Live Collectible Tx: ${collectibleToUnlock.name}`,
        feedDetail: `${collectibleToUnlock.rarity} collectible checkpoint recorded on-chain.`,
        tone: "mint",
      });

      if (!minted || cancelled) {
        return;
      }

      setCollectibles((previous) => {
        if (previous.some((item) => item.id === collectibleToUnlock.id)) {
          return previous;
        }
        return [
          ...previous,
          {
            ...collectibleToUnlock,
            tokenId: previous.length + 1,
          },
        ];
      });
    };

    void mintCollectible();

    return () => {
      cancelled = true;
    };
  }, [collectibleToUnlock, executionMode, recordTransactions, submitLiveContractAction]);

  useEffect(() => {
    if (executionMode !== "live") {
      return;
    }
    void fetchOnchainCookieBalance();
  }, [executionMode, fetchOnchainCookieBalance]);

  useEffect(() => {
    return () => {
      if (popTimeoutRef.current) {
        clearTimeout(popTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative overflow-hidden p-6 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-gradient-to-br from-rose-50 via-red-50 to-zinc-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
      <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-red-200/40 dark:bg-red-700/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-rose-200/50 dark:bg-rose-700/20 blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="text-center mb-6">
          <h2
            className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight"
            style={{ fontFamily: "\"Comic Sans MS\", \"Chalkboard SE\", cursive" }}
          >
            Avalanche Triangle Clicker
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 max-w-3xl mx-auto">
            Simplified gaming blueprint demo with 3 modes, 3 upgrades, and 3 collectible milestones.
            Clicks, upgrades, and collectible checkpoints can still be written on-chain.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="inline-flex items-center gap-1 rounded-xl bg-white/70 dark:bg-zinc-900/80 p-1 border border-rose-200 dark:border-zinc-700">
            {(Object.entries(THROUGHPUT_PROFILES) as Array<[ThroughputMode, ThroughputProfile]>).map(([id, profile]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors",
                  mode === id
                    ? "bg-red-600 text-white"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-red-100 dark:hover:bg-zinc-800",
                )}
              >
                {profile.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl bg-white/70 dark:bg-zinc-900/80 p-1 border border-rose-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setExecutionMode("simulated")}
              className={cn(
                "px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors",
                executionMode === "simulated"
                  ? "bg-red-600 text-white"
                  : "text-zinc-600 dark:text-zinc-300 hover:bg-red-100 dark:hover:bg-zinc-800",
              )}
            >
              Simulated
            </button>
            <button
              type="button"
              onClick={() => setExecutionMode("live")}
              className={cn(
                "px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors",
                executionMode === "live"
                  ? "bg-red-600 text-white"
                  : "text-zinc-600 dark:text-zinc-300 hover:bg-red-100 dark:hover:bg-zinc-800",
              )}
            >
              Live Wallet
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSimulation}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isRunning
                  ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  : "bg-red-600 text-white hover:bg-red-700",
              )}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRunning ? "Pause" : "Start"}
            </button>
            <button
              type="button"
              onClick={resetDemo}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-white/80 dark:hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-rose-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 p-3 mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="uppercase tracking-wide text-zinc-500">
              Execution Path: {executionMode === "live" ? "Live Contract Writes" : "Fully Simulated"}
            </span>
            <span className="text-zinc-500">
              {executionMode === "live"
                ? walletReadyForLive
                  ? `Wallet ready on ${selectedNetwork?.name ?? `Chain ${walletChainId}`}`
                  : "Connect wallet on a supported EVM chain to enable live txs"
                : "Bot traffic + auto-click throughput are synthetic for load demonstration"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          <div className="xl:col-span-3 space-y-5">
            <div className="rounded-2xl border border-rose-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/85 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Triangle Treasury</div>
                  <div className="text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {Math.floor(cookies).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Run Time</div>
                  <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {runtimeLabel}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">Mode: {THROUGHPUT_PROFILES[mode].label}</div>
                </div>
              </div>

              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    void handleCookieClick();
                  }}
                  disabled={
                    !isRunning
                    || (executionMode === "live" && (!liveContractAddress || !walletReadyForLive))
                    || isLiveActionPending
                  }
                  className={cn(
                    "relative h-48 w-48 sm:h-56 sm:w-56 border-[6px] border-red-900/70 shadow-[0_16px_24px_rgba(0,0,0,0.24)] transition-transform active:scale-95 bg-gradient-to-b from-red-400 via-red-500 to-red-700",
                    (!isRunning || isLiveActionPending) && "opacity-65 cursor-not-allowed",
                    cookiePop && "scale-95",
                  )}
                  style={{ clipPath: "polygon(50% 6%, 94% 92%, 6% 92%)" }}
                >
                  <span
                    className="absolute inset-[14%] border border-red-950/35"
                    style={{ clipPath: "polygon(50% 7%, 92% 91%, 8% 91%)" }}
                  />
                  <span className="absolute left-1/2 top-[40%] -translate-x-1/2 text-white text-sm font-semibold tracking-[0.18em]">
                    AVAX
                  </span>
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-zinc-900 text-white text-xs tracking-wide">
                    1 tap = 1 tx
                  </span>
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-rose-200 dark:border-zinc-700 bg-rose-50/70 dark:bg-zinc-800/60 p-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wide mb-1">
                    <MousePointerClick className="w-3.5 h-3.5" />
                    Manual Clicks
                  </div>
                  <div className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {manualClicks.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-200 dark:border-zinc-700 bg-rose-50/70 dark:bg-zinc-800/60 p-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wide mb-1">
                    <Rocket className="w-3.5 h-3.5" />
                    Auto CPS
                  </div>
                  <div className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {autoClicksPerSecond.toFixed(autoClicksPerSecond >= 10 ? 0 : 1)}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-200 dark:border-zinc-700 bg-rose-50/70 dark:bg-zinc-800/60 p-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wide mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Click Power
                  </div>
                  <div className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    x{clickPower}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/85 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Coins className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Upgrade Shop
                </h3>
              </div>

              <div className="space-y-3">
                {UPGRADES.map((upgrade) => {
                  const owned = ownedUpgrades[upgrade.id] ?? 0;
                  const cost = getUpgradeCost(upgrade, owned);
                  const canBuy = isRunning && cookies >= cost;

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
                            {upgrade.autoClicksPerSecond > 0 && `+${upgrade.autoClicksPerSecond}/s auto clicks `}
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
                            onClick={() => {
                              void buyUpgrade(upgrade);
                            }}
                            disabled={!canBuy || isLiveActionPending}
                            className={cn(
                              "mt-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                              canBuy && !isLiveActionPending
                                ? "bg-red-600 text-white hover:bg-red-700"
                                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed",
                            )}
                          >
                            Buy Upgrade
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 space-y-4">
            <div className="rounded-2xl border border-rose-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/85 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
                  <Database className="w-3.5 h-3.5" />
                  Live Contract
                </div>
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide",
                    executionMode === "live"
                      ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
                  )}
                >
                  {executionMode === "live" ? "active" : "inactive"}
                </span>
              </div>

              <div className="space-y-2 text-xs text-zinc-500">
                <div>
                  Wallet: {walletEVMAddress ? `${walletEVMAddress.slice(0, 6)}...${walletEVMAddress.slice(-4)}` : "not connected"}
                </div>
                <div>
                  Network: {selectedNetwork?.name ?? "unsupported network"}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={contractInput}
                    onChange={(event) => setContractInput(event.target.value)}
                    placeholder="0x... contract address"
                    className="flex-1 px-2.5 py-2 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={applyLiveContractAddress}
                    disabled={!isContractInputValid}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      isContractInputValid
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed",
                    )}
                  >
                    Use
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void deployLiveCookieContract();
                  }}
                  disabled={!walletReadyForLive || isDeployingContract || isLiveActionPending}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    !walletReadyForLive || isDeployingContract || isLiveActionPending
                      ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      : "bg-emerald-500 text-white hover:bg-emerald-600",
                  )}
                >
                  {isDeployingContract ? "Deploying..." : "Deploy Demo Contract"}
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 space-y-1">
                <div>
                  Active contract: {liveContractAddress ? `${liveContractAddress.slice(0, 8)}...${liveContractAddress.slice(-4)}` : "none"}
                </div>
                <div>
                  On-chain triangle balance: <span className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">{onchainCookieBalance.toString()}</span>
                </div>
                <div className="text-[11px]">
                  In live mode, clicks/upgrades/collectible checkpoints are real contract calls.
                  Auto-click and ambient load stay simulated to avoid wallet prompt spam.
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/85 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
                  <Gauge className="w-3.5 h-3.5" />
                  Live TPS
                </div>
                <span className="text-xs text-zinc-500">{THROUGHPUT_PROFILES[mode].label}</span>
              </div>
              <div className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {liveTps.toLocaleString()}
              </div>
              <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 mt-2 overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all duration-100"
                  style={{ width: `${tpsProgress}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Peak: {peakTps.toLocaleString()} TPS
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/85 p-4">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500 mb-2">
                <Database className="w-3.5 h-3.5" />
                Transaction Ledger
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Submitted</span>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {submittedTx.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Finalized</span>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {finalizedTx.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Pending</span>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {pendingTx.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Total Click Events</span>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {totalClicks.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-red-600" />
                  {executionMode === "live"
                    ? "Player actions submit real wallet transactions."
                    : "Each player click enters finality queue immediately."}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/85 p-4">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500 mb-3">
                <Gift className="w-3.5 h-3.5" />
                Collectible Drops
              </div>
              <div className="space-y-2.5">
                {COLLECTIBLE_DROPS.map((drop) => {
                  const minted = collectibles.find((item) => item.id === drop.id);
                  const unlocked = Boolean(minted);

                  return (
                    <div
                      key={drop.id}
                      className={cn(
                        "rounded-lg border p-2.5",
                        unlocked
                          ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-900/20"
                          : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {drop.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {drop.rarity} · unlock at {drop.clickTarget.toLocaleString()} manual clicks
                          </div>
                        </div>
                        <div
                          className={cn(
                            "text-[10px] px-2 py-1 rounded-full font-medium",
                            unlocked
                              ? "bg-emerald-500 text-white"
                              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300",
                          )}
                        >
                          {unlocked ? `Token #${minted?.tokenId}` : "Locked"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {nextCollectible && (
                <div className="mt-3 text-xs text-zinc-500">
                  Next drop: <span className="font-medium text-zinc-700 dark:text-zinc-300">{nextCollectible.name}</span>{" "}
                  in {(nextCollectible.clickTarget - manualClicks).toLocaleString()} manual clicks.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-rose-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/85 p-4">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500 mb-3">
                <Activity className="w-3.5 h-3.5" />
                Transaction Feed
              </div>
              <div className="space-y-2">
                {feed.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</div>
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide",
                          item.tone === "click" && "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
                          item.tone === "upgrade" && "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300",
                          item.tone === "mint" && "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
                          item.tone === "system" && "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
                        )}
                      >
                        {item.tone}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">{item.detail}</div>
                    {item.count > 0 && (
                      <div className="mt-1 text-[11px] text-zinc-400 tabular-nums">
                        {compactFormatter.format(item.count)} tx
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
