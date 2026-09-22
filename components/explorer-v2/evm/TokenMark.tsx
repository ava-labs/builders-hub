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
