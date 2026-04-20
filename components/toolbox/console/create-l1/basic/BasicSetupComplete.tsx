'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Check, ChevronDown, Copy, ExternalLink, Layers, Link2, Wallet } from 'lucide-react';
import type { Address } from 'viem';
import type { DeploymentJob } from '@/lib/quick-l1/types';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { usePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { Button } from '@/components/toolbox/components/Button';
import { cn } from '@/lib/utils';

/**
 * Success / recap screen.
 *
 * Layout principles (post-redesign):
 *   - **No truncation, ever.** Long values (RPC URLs, addresses) live on
 *     their own row with `break-all`, so you can see the entire value
 *     without hovering, copying, or scrolling the element.
 *   - **Primary vs secondary split.** The 3 most actionable rows per
 *     card (what you'd paste into a wallet / explorer / code) are
 *     visible by default. Everything else collapses behind a "Show more
 *     details" toggle using the native <details> element — zero JS.
 *   - **Humanized amounts.** Bridged tokens display as `1 MockUSDC`, not
 *     `1000000000000000000 base units`. Raw wei available on hover for
 *     developers who need it.
 *   - **"Network" replaces "Chains".** The old "Chains: 3" stat was
 *     counting how many blockchains the deploy touched internally — an
 *     implementation detail, not something the user cares about.
 */

// MockUSDC is 18-decimal ERC20 by convention in the quick-l1 service.
// If that ever becomes configurable per-deploy, move this onto the
// DeploymentResult.interop payload.
const MOCK_USDC_DECIMALS = 18;
const MOCK_USDC_SYMBOL = 'MockUSDC';

// ─── Explorer URL helpers ──────────────────────────────────────────
//
// Patterns confirmed against existing usage in the repo:
//   - C-Chain address: /c-chain/address/{addr}
//     (components/toolbox/console/icm/test-connection/DeployICMDemo.tsx)
//   - Validator NodeID: /validators/{nodeId}
//     (app/(home)/stats/validators/node, lib/mcp/tools/blockchain.ts)
// Best-effort patterns (deep links used by the subnets explorer):
//   - Subnet ID:     /p-chain/subnet/{id}
//   - Blockchain ID: /blockchains/{id}
// If either 404s in production, swap to `${base}/p-chain` as a
// fallback — users can paste the ID into the explorer's search.

type Network = 'fuji' | 'mainnet';

function explorerBase(network: Network): string {
  return network === 'fuji' ? 'https://subnets-test.avax.network' : 'https://subnets.avax.network';
}

function cChainAddressUrl(addr: string, network: Network): string {
  return `${explorerBase(network)}/c-chain/address/${addr}`;
}

function pChainSubnetUrl(id: string, network: Network): string {
  return `${explorerBase(network)}/p-chain/subnet/${id}`;
}

function pChainBlockchainUrl(id: string, network: Network): string {
  return `${explorerBase(network)}/blockchains/${id}`;
}

function validatorNodeUrl(nodeId: string, network: Network): string {
  return `${explorerBase(network)}/validators/${nodeId}`;
}

function l1AddressUrl(rpcUrl: string, addr: string): string {
  return `/console/explorer?rpc=${encodeURIComponent(rpcUrl)}&address=${addr}`;
}

// ─── Balance fetching ──────────────────────────────────────────────
//
// Minimal ERC20 `balanceOf` ABI inline — avoids pulling in a whole
// abitype module for one read. Only used by useL1Balances.

const ERC20_BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

type BalanceState = {
  native: bigint | null;
  token: bigint | null;
  loading: boolean;
  /** True while we're still waiting for the relayer to deliver the bridged MockUSDC. */
  tokenPending: boolean;
  error: string | null;
};

/** Poll interval while waiting for MockUSDC to arrive via relayer. */
const TOKEN_POLL_MS = 3000;
/** Give up polling after this long — delivery should be well under a minute. */
const TOKEN_POLL_TIMEOUT_MS = 180_000;

/**
 * Fetches the owner's native + MockUSDC balances on the deployed L1.
 *
 * Native gas lands in the very first block (genesis alloc), so one
 * read is enough. MockUSDC arrives *asynchronously* via the ICM
 * relayer — typically within 5-30s of the deployment completing, but
 * the complete screen usually mounts before delivery lands. We poll
 * the ERC20 balance until it reaches the expected bridged amount or
 * we hit a ~3 minute timeout, so the UI doesn't stay stuck showing
 * `0 MockUSDC` when the tokens are actually already on-chain.
 */
function useL1Balances(
  rpcUrl: string,
  owner: Address,
  tokenRemoteAddress: Address | undefined,
  expectedTokenAmount: bigint | undefined,
): BalanceState {
  const client = usePublicClientForChain(rpcUrl);
  const [state, setState] = useState<BalanceState>({
    native: null,
    token: null,
    loading: true,
    tokenPending: Boolean(tokenRemoteAddress),
    error: null,
  });

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + TOKEN_POLL_TIMEOUT_MS;

    const tick = async (): Promise<void> => {
      try {
        const nativeP = client.getBalance({ address: owner });
        const tokenP: Promise<bigint> | null = tokenRemoteAddress
          ? (client.readContract({
              address: tokenRemoteAddress,
              abi: ERC20_BALANCE_OF_ABI,
              functionName: 'balanceOf',
              args: [owner],
            }) as Promise<bigint>)
          : null;
        const [native, token] = await Promise.all([nativeP, tokenP ?? Promise.resolve(null)]);
        if (cancelled) return;

        // Delivered when we hit (or exceed) the bridged amount. If we
        // don't know the target, treat any positive balance as done.
        const hasToken = token != null && (expectedTokenAmount != null ? token >= expectedTokenAmount : token > 0n);
        const stillPending = Boolean(tokenRemoteAddress) && !hasToken && Date.now() < deadline;

        setState({
          native,
          token: tokenRemoteAddress ? token : null,
          loading: false,
          tokenPending: stillPending,
          error: null,
        });

        if (stillPending) {
          timer = setTimeout(tick, TOKEN_POLL_MS);
        }
      } catch (e) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to fetch balances',
        }));
        // Keep polling on read errors until the deadline — the L1 RPC
        // can briefly 5xx after it first comes up.
        if (Date.now() < deadline) {
          timer = setTimeout(tick, TOKEN_POLL_MS);
        }
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [client, owner, tokenRemoteAddress, expectedTokenAmount]);

  return state;
}

export default function BasicSetupComplete({ job }: { job: DeploymentJob }) {
  const result = job.result;
  const { addChain } = useWallet();
  const [addingToWallet, setAddingToWallet] = useState(false);

  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current || !result) return;
    firedRef.current = true;
    const base = { spread: 60, startVelocity: 45, ticks: 200, gravity: 0.9, scalar: 1 };
    confetti({ ...base, particleCount: 80, angle: 60, origin: { x: 0, y: 0.65 } });
    confetti({ ...base, particleCount: 80, angle: 120, origin: { x: 1, y: 0.65 } });
    setTimeout(() => {
      confetti({ ...base, particleCount: 60, angle: 90, spread: 130, origin: { x: 0.5, y: 0.55 } });
    }, 220);
  }, [result]);

  const stats = useMemo(() => {
    const durationMs = Math.max(0, new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime());
    const totalTxs = job.evidence.reduce((acc, e) => acc + e.txs.length, 0);
    const totalSteps = job.completedSteps.length;
    const network = job.request.network === 'fuji' ? 'Fuji' : 'Mainnet';
    return { durationMs, totalTxs, totalSteps, network };
  }, [job]);

  // The Network typing on DeployRequest is narrower ('fuji' only in
  // MVP), but the explorer helpers accept both so this alias reads
  // clearly at call sites.
  const network: Network = job.request.network;

  // Fetch the owner's balances on the new L1. Hook is called
  // unconditionally (react rules); it no-ops gracefully when the
  // deploy has no result yet (rpcUrl empty). The expected-token
  // target lets the poll stop as soon as the relayer has delivered
  // the full bridged amount — no more "stuck on 0 MockUSDC" UI.
  const expectedBridged = useMemo(() => {
    try {
      return result?.interop?.bridgedAmount ? BigInt(result.interop.bridgedAmount) : undefined;
    } catch {
      return undefined;
    }
  }, [result?.interop?.bridgedAmount]);
  const balances = useL1Balances(
    result?.rpcUrl ?? '',
    job.request.ownerEvmAddress,
    result?.interop?.tokenRemoteAddress,
    expectedBridged,
  );

  if (!result) return null;

  const handleAddToWallet = async () => {
    setAddingToWallet(true);
    try {
      await addChain({ rpcUrl: result.rpcUrl, allowLookup: false });
    } finally {
      setAddingToWallet(false);
    }
  };

  const mm = String(Math.floor(stats.durationMs / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((stats.durationMs % 60_000) / 1000)).padStart(2, '0');
  const elapsedLabel = `${mm}:${ss}`;

  return (
    <div className="mx-auto max-w-5xl py-4 px-4">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
      >
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
            <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Deployed
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 break-words">
            {job.request.chainName} is live
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Running on {stats.network}. Add it to your wallet to start building.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="shrink-0"
        >
          <Button onClick={handleAddToWallet} loading={addingToWallet} icon={<Wallet className="h-4 w-4" />} stickLeft>
            {addingToWallet ? 'Adding…' : `Add ${job.request.chainName} to wallet`}
          </Button>
        </motion.div>
      </motion.div>

      {/* Stats strip — Network replaces the old confusing "Chains" stat. */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="mb-5 grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden divide-x divide-zinc-100 dark:divide-zinc-900"
      >
        <StatCell label="Duration" value={elapsedLabel} mono />
        <StatCell label="Transactions" value={String(stats.totalTxs)} />
        <StatCell label="Network" value={stats.network} />
        <StatCell label="Steps" value={String(stats.totalSteps)} />
      </motion.div>

      {/* Wallet balance strip — fetched live from the new L1 so the user
          sees "you already have tokens!" instant gratification before
          diving into addresses. Shows native gas token + bridged MockUSDC
          when interop is enabled. */}
      <BalanceStrip
        chainName={job.request.chainName}
        nativeSymbol={job.request.tokenSymbol}
        nativeBalance={balances.native}
        tokenSymbol={result.interop ? MOCK_USDC_SYMBOL : undefined}
        tokenDecimals={MOCK_USDC_DECIMALS}
        tokenBalance={balances.token}
        tokenPending={balances.tokenPending}
        loading={balances.loading}
        error={balances.error}
      />

      {/* Recap grid — single column on tablet, two-column only at xl+
          (≥1280px) because narrower cards force tight line-wrapping on
          address values. Single-column at 1024px keeps each value on
          one readable line. */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.05, delayChildren: 0.22 } },
        }}
        className={cn('grid gap-4', result.interop ? 'xl:grid-cols-2' : 'grid-cols-1')}
      >
        <RecapCard
          title="Chain details"
          subtitle="Everything needed to connect to your L1"
          icon={<Layers className="h-4 w-4" />}
          primaryRows={
            <>
              <DetailRow label="RPC URL" value={result.rpcUrl} />
              <DetailRow label="EVM Chain ID" value={String(result.evmChainId)} />
              <DetailRow
                label="Validator Manager"
                value={result.validatorManagerAddress}
                chain="c-chain"
                href={cChainAddressUrl(result.validatorManagerAddress, network)}
              />
            </>
          }
          secondaryRows={
            <>
              <DetailRow
                label="Blockchain ID"
                value={result.blockchainId}
                href={pChainBlockchainUrl(result.blockchainId, network)}
              />
              <DetailRow
                label="Subnet ID"
                value={result.subnetId}
                chain="p-chain"
                href={pChainSubnetUrl(result.subnetId, network)}
              />
              <DetailRow label="Validator Node" value={result.nodeId} href={validatorNodeUrl(result.nodeId, network)} />
            </>
          }
        />

        {result.interop && (
          <RecapCard
            title="Cross-chain bridge"
            subtitle="MockUSDC bridged from C-Chain to your L1 via ICM"
            icon={<Link2 className="h-4 w-4" />}
            primaryRows={
              <>
                <AmountRow
                  label="Bridged Amount"
                  rawAmount={result.interop.bridgedAmount}
                  decimals={MOCK_USDC_DECIMALS}
                  symbol={MOCK_USDC_SYMBOL}
                />
                <DetailRow
                  label="MockUSDC"
                  value={result.interop.mockUsdcAddress}
                  chain="c-chain"
                  href={cChainAddressUrl(result.interop.mockUsdcAddress, network)}
                />
                <DetailRow
                  label="TokenRemote"
                  value={result.interop.tokenRemoteAddress}
                  chain="l1"
                  href={l1AddressUrl(result.rpcUrl, result.interop.tokenRemoteAddress)}
                />
              </>
            }
            secondaryRows={
              <>
                <DetailRow
                  label="TokenHome"
                  value={result.interop.tokenHomeAddress}
                  chain="c-chain"
                  href={cChainAddressUrl(result.interop.tokenHomeAddress, network)}
                />
                <DetailRow
                  label="ICM Registry"
                  value={result.interop.icmRegistryAddress}
                  chain="l1"
                  href={l1AddressUrl(result.rpcUrl, result.interop.icmRegistryAddress)}
                />
                <DetailRow
                  label="ICM Relayer"
                  value={result.interop.relayerAddress}
                  chain="l1"
                  href={l1AddressUrl(result.rpcUrl, result.interop.relayerAddress)}
                />
              </>
            }
          />
        )}
      </motion.div>

      {/* Secondary actions — sidebar + breadcrumb already give the user
          plenty of ways back to the console, so we keep this minimal. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
      >
        <a
          href={`/console/explorer?rpc=${encodeURIComponent(result.rpcUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-primary hover:underline"
        >
          Open in Explorer
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </motion.div>
    </div>
  );
}

// ─── Stats strip cell ──────────────────────────────────────────────

function StatCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-2.5 text-center sm:text-left">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <div
        className={cn(
          'mt-0.5 text-lg font-semibold leading-none text-zinc-900 dark:text-zinc-100 tabular-nums',
          mono && 'font-mono',
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Recap card ────────────────────────────────────────────────────
//
// A card has two slots: primary rows (always visible) and optional
// secondary rows (collapsed behind a native <details>). This separation
// is the "initial glance density" fix — users see 3 actionable rows up
// front instead of 6 mixed rows where the important stuff is buried.

function RecapCard({
  title,
  subtitle,
  icon,
  primaryRows,
  secondaryRows,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  primaryRows: React.ReactNode;
  secondaryRows?: React.ReactNode;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { type: 'spring', stiffness: 260, damping: 26 },
        },
      }}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden h-fit"
    >
      <div className="flex items-start gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-900">
        {icon && (
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">{subtitle}</p>}
        </div>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-900">{primaryRows}</div>

      {secondaryRows && (
        <details className="group border-t border-zinc-100 dark:border-zinc-900">
          <summary className="flex items-center justify-between gap-2 cursor-pointer list-none px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors select-none">
            <span>More details</span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900 border-t border-zinc-100 dark:border-zinc-900">
            {secondaryRows}
          </div>
        </details>
      )}
    </motion.div>
  );
}

// ─── Balance strip ────────────────────────────────────────────────
//
// Compact pill showing the owner's live balances on the new L1.
// Loading state animates the amount placeholders; errors show a muted
// inline message rather than swallowing silently (a deployed L1 whose
// RPC hasn't propagated yet will hit this path, so the UX should
// acknowledge it).

function BalanceStrip({
  chainName,
  nativeSymbol,
  nativeBalance,
  tokenSymbol,
  tokenDecimals,
  tokenBalance,
  tokenPending,
  loading,
  error,
}: {
  chainName: string;
  nativeSymbol: string;
  nativeBalance: bigint | null;
  tokenSymbol?: string;
  tokenDecimals: number;
  tokenBalance: bigint | null;
  /** Relayer hasn't delivered the bridged MockUSDC yet. Poll still in flight. */
  tokenPending?: boolean;
  loading: boolean;
  error: string | null;
}) {
  const nativeHuman = nativeBalance !== null ? humanizeAmount(nativeBalance.toString(), 18) : null;
  const tokenHuman =
    tokenBalance !== null && tokenSymbol ? humanizeAmount(tokenBalance.toString(), tokenDecimals) : null;
  // Delivery is async — show a "waiting" state instead of a silent 0
  // so the user knows the tokens are coming, not missing.
  const tokenSubtitle =
    tokenPending && (tokenBalance === null || tokenBalance === 0n)
      ? 'Waiting for relayer delivery…'
      : 'Bridged from C-Chain';
  const tokenLoading = loading || Boolean(tokenPending && (tokenBalance === null || tokenBalance === 0n));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 flex items-center gap-3"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
        <Wallet className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Your balance on {chainName}
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-base leading-tight">
          {error ? (
            <span className="text-[13px] text-zinc-500 dark:text-zinc-400">
              Balance unavailable — the L1 RPC may still be propagating. Refresh in a moment.
            </span>
          ) : (
            <>
              <BalanceUnit amount={nativeHuman} symbol={nativeSymbol} subtitle="Native gas" loading={loading} />
              {tokenSymbol && (
                <>
                  <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">·</span>
                  <BalanceUnit
                    amount={tokenHuman}
                    symbol={tokenSymbol}
                    subtitle={tokenSubtitle}
                    loading={tokenLoading}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function BalanceUnit({
  amount,
  symbol,
  subtitle,
  loading,
}: {
  amount: string | null;
  symbol: string;
  subtitle: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      {loading || amount === null ? (
        <span className="inline-block h-4 w-10 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      ) : (
        <span className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{amount}</span>
      )}
      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{symbol}</span>
      <span className="hidden sm:inline text-[10px] text-zinc-400 dark:text-zinc-500 ml-0.5">{subtitle}</span>
    </div>
  );
}

// ─── Detail row — stacked label + full-width wrapping value ────────
//
// Old layout was a flex row with a 120px label column and a truncating
// code column. Real-world values (RPC URLs, hashes, Ethereum addresses)
// would chop mid-string at realistic column widths. Stacked with
// `break-all` on the value guarantees you always see the whole thing.

type Chain = 'p-chain' | 'c-chain' | 'l1';

function chainDotClass(chain: Chain): string {
  return chain === 'p-chain' ? 'bg-blue-500' : chain === 'c-chain' ? 'bg-purple-500' : 'bg-red-500';
}

function chainName(chain: Chain): string {
  return chain === 'p-chain' ? 'P-Chain' : chain === 'c-chain' ? 'C-Chain' : 'L1';
}

function DetailRow({
  label,
  value,
  chain,
  href,
}: {
  label: string;
  value: string;
  chain?: Chain;
  /** When set, the value renders as an external link to a block explorer. */
  href?: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  // Internal links (e.g., /console/explorer) open in the same tab by
  // default so the user stays in the console flow; external explorers
  // get target="_blank" so the recap page is preserved.
  const isExternal = href ? /^https?:\/\//.test(href) : false;

  return (
    <div className="group px-4 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {chain && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', chainDotClass(chain))} />}
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
            {chain ? `${label} · ${chainName(chain)}` : label}
          </span>
        </div>
        <div className="shrink-0 flex items-center gap-0.5">
          {href && (
            <a
              href={href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noreferrer' : undefined}
              title={isExternal ? 'Open in explorer' : 'View in console explorer'}
              aria-label={`Open ${label} in explorer`}
              className="inline-flex items-center rounded p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={onCopy}
            title="Copy"
            aria-label={`Copy ${label}`}
            className="inline-flex items-center rounded p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {href ? (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer' : undefined}
          className="block font-mono text-[12.5px] text-zinc-900 dark:text-zinc-100 break-all leading-snug hover:text-primary hover:underline underline-offset-2 decoration-primary/40"
        >
          {value}
        </a>
      ) : (
        <code className="block font-mono text-[12.5px] text-zinc-900 dark:text-zinc-100 break-all select-all leading-snug">
          {value}
        </code>
      )}
    </div>
  );
}

// ─── Amount row — humanizes on-chain integer amounts ──────────────
//
// Converts a raw base-unit string (e.g., "1000000000000000000") into a
// human-readable decimal with the token's decimals (e.g., "1 MockUSDC").
// Preserves the raw value in a hoverable tooltip so developers who need
// the exact wei-like number can still see it.

function humanizeAmount(raw: string, decimals: number): string {
  try {
    const n = BigInt(raw);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = n / divisor;
    const fraction = n % divisor;
    if (fraction === 0n) return whole.toString();
    // Up to 6 significant fractional digits, trimming trailing zeros.
    const fracStr = fraction.toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr}` : whole.toString();
  } catch {
    return raw;
  }
}

function AmountRow({
  label,
  rawAmount,
  decimals,
  symbol,
}: {
  label: string;
  rawAmount: string;
  decimals: number;
  symbol: string;
}) {
  const human = humanizeAmount(rawAmount, decimals);
  return (
    <div className="group px-4 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{human}</span>
        <span className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">{symbol}</span>
        <code
          className="ml-auto font-mono text-[10px] text-zinc-400 dark:text-zinc-500 select-all cursor-help"
          title={`${rawAmount} base units (decimals: ${decimals})`}
        >
          {rawAmount}
        </code>
      </div>
    </div>
  );
}
