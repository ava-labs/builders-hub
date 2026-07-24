import { cn } from "@/lib/utils";

/* Row-level garnish shared by the EVM home and list pages: what a tx DID
   (the 4-byte selector, named when it's a classic) and how full a block
   ran (gas used as a vessel bar). */

/* canonical selectors — enough to name the classics; app-specific ones
   stay as short hex and still scan. Same table the gas page's demand
   panel uses. */
const SELECTOR_NAMES: Record<string, string> = {
  "0xa9059cbb": "transfer",
  "0x23b872dd": "transferFrom",
  "0x095ea7b3": "approve",
  "0xa22cb465": "setApprovalForAll",
  "0x42842e0e": "safeTransferFrom",
  "0xb88d4fde": "safeTransferFrom",
  "0xd0e30db0": "deposit",
  "0x2e1a7d4d": "withdraw",
  "0x1249c58b": "mint",
  "0x40c10f19": "mint",
  "0xa0712d68": "mint",
  "0x38ed1739": "swapExactTokensForTokens",
  "0x18cbafe5": "swapExactTokensForETH",
  "0x7ff36ab5": "swapExactETHForTokens",
  "0x04e45aaf": "exactInputSingle",
  "0xc04b8d59": "exactInput",
  "0x414bf389": "exactInputSingle",
  "0x5ae401dc": "multicall",
  "0xac9650d8": "multicall",
  "0x1cff79cd": "execute",
  "0x3593564c": "execute",
  "0x022c0d9f": "swap",
  "0x128acb08": "swap",
  "0x627dd56a": "claim",
  "0x4e71d92d": "claim",
  "0x2ebe3fbb": "stake",
  "0xa694fc3a": "stake",
};

/** what to print for a tx row: named method, short selector, or the
 *  native-transfer / contract-creation identity when there's no calldata */
export function methodLabel(t: { methodId?: string; to: string }): string {
  const sel = t.methodId ?? "";
  if (!sel) return t.to ? "transfer" : "create";
  return SELECTOR_NAMES[sel] ?? sel;
}

/** bordered mono chip — the tx row's "what happened" cell */
export function MethodChip({ t, className }: { t: { methodId?: string; to: string }; className?: string }) {
  const label = methodLabel(t);
  const named = !label.startsWith("0x");
  return (
    <span
      title={t.methodId || undefined}
      className={cn(
        "inline-block max-w-full truncate border border-zinc-200 px-1.5 py-0.5 text-left font-mono text-[10px] leading-4 dark:border-zinc-800",
        named ? "text-zinc-600 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-500",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** how full the block ran — the tape's gas vessel, flattened into a row */
export function GasFill({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(1, used / limit) * 100 : 0;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-12 shrink-0 bg-zinc-100 dark:bg-zinc-900">
        <span
          className={cn("block h-full", pct >= 90 ? "bg-[#E6212F]" : "bg-[#A2AFB2] dark:bg-zinc-600")}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </span>
      {/* fixed slot up to "100%", right-aligned — the bars stay registered
          whether the number is one digit or three */}
      <span className="w-9 text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
        {pct.toFixed(0)}%
      </span>
    </span>
  );
}

/* The honest failure plate: the feed didn't 404, it died (indexer outage,
   gateway timeout). Shown wherever a list or detail would otherwise sit on
   "Loading…" forever or claim emptiness it can't know. `compact` renders
   as a row inside an existing Board; the default is a standalone plate. */
export function FeedDown({
  onRetry,
  compact = false,
  label = "The indexer isn't answering right now",
}: {
  onRetry: () => void;
  compact?: boolean;
  label?: string;
}) {
  const retryBtn = (
    <button
      onClick={onRetry}
      className="inline-flex items-center border border-zinc-200 bg-white/80 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-900 transition-colors hover:border-zinc-900 hover:bg-zinc-900 hover:text-white dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:hover:border-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
    >
      Retry
    </button>
  );
  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#E6212F]">
          {label}
        </span>
        {retryBtn}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-5 border-b border-zinc-200 bg-white/80 px-6 py-16 text-center backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#E6212F]">{label}</p>
      <p className="max-w-md text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        The data service behind this page timed out. It usually recovers quickly; the page keeps
        whatever it already loaded.
      </p>
      {retryBtn}
    </div>
  );
}
