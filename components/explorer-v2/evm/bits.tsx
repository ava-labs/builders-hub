import { useVerifiedContracts, functionNameFromAbi } from "@/lib/sourcify-client";
import { getFunctionBySelector } from "@/abi/event-signatures.generated";
import { useSignatures } from "@/lib/token-list";

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

export interface MethodName {
  label: string;
  /** false when the label is the bare selector */
  named: boolean;
}

/** One resolver for every transaction table, so a selector reads the
 *  same on the home board, the block page, the address page and the
 *  list: the called contract's verified ABI first, then the generated
 *  registry and the classics table, then the signature database for
 *  whatever is left, then the selector itself. */
export function useMethodNames(chainId: string | number, rows: { methodId?: string; to: string | null | undefined }[]): (t: { methodId?: string; to: string | null | undefined }) => MethodName {
  const contracts = useVerifiedContracts(chainId, rows.map((t) => t.to));
  const local = (t: { methodId?: string; to: string | null | undefined }): string | null => {
    const sel = t.methodId?.toLowerCase() ?? "";
    if (!sel) return null;
    return functionNameFromAbi(t.to ? contracts.get(t.to.toLowerCase())?.abi : null, sel) ?? getFunctionBySelector(sel)?.name ?? SELECTOR_NAMES[sel] ?? null;
  };
  const unknown = rows.filter((t) => t.methodId && !local(t)).map((t) => t.methodId!.toLowerCase());
  const sigs = useSignatures(unknown, []);
  return (t) => {
    const sel = t.methodId?.toLowerCase() ?? "";
    if (!sel) return { label: t.to ? "transfer" : "create", named: true };
    const name = local(t) ?? sigs.fn.get(sel)?.name.split("(")[0] ?? null;
    return name ? { label: name, named: true } : { label: sel, named: false };
  };
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
