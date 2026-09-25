"use client";

import Link from "next/link";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import { cn } from "@/lib/utils";

/* The second level under a tab: a tab that holds more than one list (the
   Transactions tab's EVM, atomic and ICM views; the Validators tab's set
   and its staking economy) switches between them here. Links, not
   buttons, so each view has a URL to share. */

interface View {
  key: string;
  label: string;
  title: string;
  href: string;
}

export function ViewSwitch({ views, current, label }: { views: View[]; current: string; label: string }) {
  if (views.length < 2) return null;
  return (
    // a div, not a nav: the global `nav a` rules would restyle the chips
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-1.5">
      {views.map((v) => (
        <Link
          key={v.key}
          href={v.href}
          title={v.title}
          aria-current={current === v.key ? "page" : undefined}
          className={cn(
            "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
            current === v.key
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-200 bg-white/80 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100",
          )}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}

/** EVM receipts on every chain; shared-memory transfers on the C-Chain
 *  alone; ICM messages where an RPC lets them be derived */
export function TxsViewSwitch({ base, slug, view }: { base: string; slug?: string; view: "evm" | "atomic" | "icm" }) {
  const catalog = (l1ChainsData as L1Chain[]).find((c) => c.slug === slug);
  const views: View[] = [{ key: "evm", label: "EVM", title: "EVM transactions: calls, transfers, deployments", href: `${base}/txs` }];
  if (slug === "c-chain") views.push({ key: "atomic", label: "Atomic", title: "Atomic imports and exports with the P-Chain and X-Chain", href: `${base}/txs/atomic` });
  if (catalog?.rpcUrl) views.push({ key: "icm", label: "ICM", title: "Interchain messages sent and received", href: `${base}/txs/icm` });
  return <ViewSwitch views={views} current={view} label="Transaction view" />;
}

/** the C-Chain's validators ARE the Primary Network's, so on mainnet the
 *  tab also carries their staking economy */
export function ValidatorsViewSwitch({ base, view }: { base: string; view: "set" | "staking" }) {
  return (
    <ViewSwitch
      label="Validator view"
      current={view}
      views={[
        { key: "set", label: "Validators", title: "The validator set: nodes, versions, health", href: `${base}/validators` },
        { key: "staking", label: "Staking", title: "Stake, APY, rewards and how the stake distributes", href: `${base}/validators/staking` },
      ]}
    />
  );
}
