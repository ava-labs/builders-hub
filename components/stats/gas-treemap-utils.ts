export interface CategoryBreakdown {
  category: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  gasCostUsd: number;
  avaxBurnedUsd: number;
  uniqueSenders: number;
  gasShare: number;
  delta: number;
}

export interface ProtocolBreakdown {
  protocol: string;
  slug: string | null;
  category: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  gasCostUsd: number;
  avaxBurnedUsd: number;
  uniqueSenders: number;
  gasShare: number;
  delta: number;
}

export const CATEGORY_LABELS: Record<string, string> = {
  dex: "DEX",
  lending: "Lending",
  bridge: "Bridge",
  derivatives: "Derivatives",
  nft: "NFT",
  yield: "Yield",
  icm: "ICM",
  infrastructure: "Infrastructure",
  gaming: "Gaming",
  token: "Token",
  mev: "MEV Bots",
  native: "Native Transfers",
  rwa: "RWA",
  other: "Other",
};

export const CATEGORY_COLORS: Record<string, { light: string; dark: string }> = {
  dex:            { light: "#2563eb", dark: "#60a5fa" },
  lending:        { light: "#7c3aed", dark: "#a78bfa" },
  bridge:         { light: "#0891b2", dark: "#22d3ee" },
  derivatives:    { light: "#c026d3", dark: "#e879f9" },
  nft:            { light: "#e11d48", dark: "#fb7185" },
  yield:          { light: "#059669", dark: "#34d399" },
  icm:            { light: "#0284c7", dark: "#38bdf8" },
  infrastructure: { light: "#64748b", dark: "#94a3b8" },
  gaming:         { light: "#ea580c", dark: "#fb923c" },
  token:          { light: "#ca8a04", dark: "#facc15" },
  mev:            { light: "#dc2626", dark: "#f87171" },
  native:         { light: "#475569", dark: "#cbd5e1" },
  rwa:            { light: "#4f46e5", dark: "#818cf8" },
  other:          { light: "#9ca3af", dark: "#6b7280" },
};

export interface DailyCategoryStat {
  date: string;
  avgGasPriceGwei: number;
  [category: string]: number | string;
}

export function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

export function formatUsd(num: number): string {
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  return `$${num.toFixed(4)}`;
}

export function formatGas(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
}

export function formatAvax(num: number): string {
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M AVAX`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K AVAX`;
  if (num >= 1) return `${num.toFixed(2)} AVAX`;
  if (num >= 0.001) return `${num.toFixed(3)} AVAX`;
  return `${num.toFixed(4)} AVAX`;
}

export function getDeltaColor(delta: number): string {
  if (delta <= -10) return "#d12727";
  if (delta <= -5) return "#c93b3b";
  if (delta <= -2) return "#a94545";
  if (delta <= -0.5) return "#7a4a4a";
  if (delta < 0.5) return "#3d3d4a";
  if (delta < 2) return "#3a6e4e";
  if (delta < 5) return "#2d8e47";
  if (delta < 10) return "#28a745";
  return "#1db954";
}

export function getDeltaTextColor(delta: number): string {
  const abs = Math.abs(delta);
  if (abs < 0.5) return "#9ca3af";
  if (delta > 0) return "#86efac";
  return "#fca5a5";
}

export function getDeltaBgClass(delta: number): string {
  if (delta >= 5) return "bg-emerald-500/20 text-emerald-400";
  if (delta >= 1) return "bg-emerald-500/10 text-emerald-400";
  if (delta <= -5) return "bg-red-500/20 text-red-400";
  if (delta <= -1) return "bg-red-500/10 text-red-400";
  return "bg-zinc-500/10 text-zinc-400";
}
