"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { trustWalletLogo, type TokenInfo } from "@/lib/token-list";

/* A token, as the ledger names it: its logo in a hairline circle and its
   symbol. The logo comes from the Token List, then Trust Wallet's repo
   by address; if neither draws, the circle carries the first letter so
   the mark keeps its width and the row never shifts. */

export function TokenLogo({
  address,
  chainId,
  token,
  size = 16,
  className,
}: {
  address: string;
  chainId: string | number;
  token?: TokenInfo | null;
  size?: number;
  className?: string;
}) {
  const [step, setStep] = useState(0);
  const sources = [token?.logoURI ?? null, trustWalletLogo(address, chainId)].filter((s): s is string => !!s);
  const src = sources[step];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" onError={() => setStep((s) => s + 1)} />
      ) : (
        <span className="font-mono text-[8px] font-bold uppercase text-zinc-400 dark:text-zinc-500">
          {(token?.symbol ?? "?").slice(0, 1)}
        </span>
      )}
    </span>
  );
}

/** logo + symbol, name on hover */
export function TokenMark({
  address,
  chainId,
  token,
  className,
  size = 16,
}: {
  address: string;
  chainId: string | number;
  token: TokenInfo;
  className?: string;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)} title={`${token.name} · ${address}`}>
      <TokenLogo address={address} chainId={chainId} token={token} size={size} />
      <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">{token.symbol}</span>
    </span>
  );
}

/** the chain's own coin, as a mark: the Avalanche logo in the same
 *  hairline circle tokens use, so native and token rows set alike */
export function NativeMark({ symbol = "AVAX", size = 16, className }: { symbol?: string; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)} title={`${symbol} (native)`}>
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {/* the mark as vector, framed on its own bounds and centred with
            meet: the raster had unequal margins and a 220x190 frame, so
            cover-cropping it in a square set the triangle off centre */}
        <svg viewBox="23 23 175 149" preserveAspectRatio="xMidYMid meet" aria-hidden className="relative -top-[3%] h-[62%] w-[62%]">
          <path fill="#E6212F" d="M109.139252,23.041748 C111.741776,24.518684 114.786873,25.521351 116.039948,27.602837 C123.769547,40.442513 131.114777,53.514198 138.545532,66.532860 C141.523560,71.750351 141.392197,76.930382 138.378067,82.178566 C122.784348,109.330147 107.212326,136.494400 91.727638,163.708237 C88.432472,169.499405 83.770172,172.296158 77.077980,172.237946 C62.580860,172.111847 48.081749,172.237732 33.583733,172.183975 C25.895014,172.155457 23.042721,167.395203 26.880989,160.673264 C49.344860,121.332367 71.899803,82.043488 94.420807,42.735210 C97.235901,37.821735 99.810646,32.750118 102.939713,28.046438 C104.299789,26.001934 106.781303,24.703455 109.139252,23.041748 z" />
          <path fill="#E6212F" d="M190.145935,151.838699 C192.156281,155.320618 194.133530,158.409164 195.809311,161.653442 C198.644424,167.142075 196.006195,172.076218 189.921402,172.129471 C171.131317,172.293900 152.337845,172.294647 133.547867,172.121841 C127.530586,172.066513 124.725456,166.870987 127.775551,161.592056 C136.920776,145.764069 146.170135,129.994598 155.552734,114.306282 C159.019684,108.509308 164.857819,108.843597 168.514145,114.968781 C175.755188,127.099236 182.832336,139.327515 190.145935,151.838699 z" />
        </svg>
      </span>
      <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">{symbol}</span>
    </span>
  );
}
