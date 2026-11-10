'use client';

import { useState } from 'react';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { formatUnits, parseUnits } from 'viem';
import { MUTED } from '@/components/explorer-v2/ui';
import { useActiveWalletProvider } from '@/components/toolbox/hooks/useLiveWalletChainId';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { ensureChain, sendPrepared, walletErrorText } from '@/lib/console-wallets/signer';
import { cn } from '@/lib/utils';
import { Button, INPUT, Notice, Pill } from '@/components/studio/ui';
import { useChainFunds, type ChainFunds, type FundChain, type FundsState } from './useChainFunds';

export type { FundChain } from './useChainFunds';

const show = (wei: bigint, decimals: number) => {
  const n = Number(formatUnits(wei, decimals));
  return n === 0 ? '0' : n < 0.0001 ? '<0.0001' : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

function ChainRow({
  address,
  chain,
  funds,
  reload,
}: {
  address: `0x${string}`;
  chain: FundChain;
  funds: ChainFunds;
  reload: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const browser = useWalletStore((s) => s.walletEVMAddress);
  const provider = useActiveWalletProvider({ enabled: Boolean(browser), refreshKey: browser });
  const { symbol, decimals } = chain.nativeCurrency;
  // Builder Hub's own faucet opens in this console, whichever host serves it.
  const faucet = chain.faucets?.[symbol]?.replace(/^https:\/\/build\.avax\.network(?=\/)/, '');
  const mainnet = chain.testnet === false;
  const { balance, estimate, failed, low } = funds;
  const load = reload;

  const send = async () => {
    if (!provider || !browser) return;
    setSending(true);
    setResult(null);
    try {
      const value = parseUnits(amount.trim(), decimals);
      if (value <= 0n) throw new Error('Enter an amount above zero');
      await ensureChain(provider, chain.chainId, chain);
      const hash = await sendPrepared(provider, browser, { to: address, data: '0x', value: value.toString() });
      setResult({ ok: true, text: `Sent ${hash.slice(0, 10)}…; the balance updates once it's mined.` });
      setAmount('');
      setTimeout(load, 4_000);
    } catch (e) {
      setResult({ ok: false, text: walletErrorText(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-900 dark:text-zinc-50">{chain.name}</span>
        {mainnet && <Pill tone="bad">mainnet</Pill>}
        <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-50">
          {!chain.rpcUrl
            ? '—'
            : failed
              ? "couldn't read"
              : balance === null
                ? '…'
                : `${show(balance, decimals)} ${symbol}`}
        </span>
        {chain.rpcUrl && (
          <button
            type="button"
            onClick={load}
            aria-label="Refresh balance"
            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>
      {estimate !== null && (
        <span className={cn(MUTED, 'text-[11px]', low && 'text-amber-700 dark:text-amber-300')}>
          About {show(estimate, decimals)} {symbol} needed for this plan at today&apos;s gas price (an estimate)
          {low ? ', so add more before you plan' : ''}.
        </span>
      )}
      {chain.note && <span className={cn(MUTED, 'text-[11px]')}>{chain.note}</span>}
      <div className="flex flex-wrap items-center gap-2">
        {faucet && !mainnet && (
          <a
            href={faucet}
            target={faucet.startsWith('/') ? undefined : '_blank'}
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1.5 border border-zinc-300 px-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-700 hover:border-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100"
          >
            Get test {symbol} <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {browser && chain.rpcUrl && (
          <span className="flex items-center gap-1.5">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder={`0.5 ${symbol}`}
              aria-label={`Amount of ${symbol} to send`}
              className={cn(INPUT, 'h-7 w-28')}
            />
            <Button
              variant="secondary"
              className="h-7"
              busy={sending}
              disabled={!amount.trim()}
              onClick={() => void send()}
            >
              Send from my browser wallet
            </Button>
          </span>
        )}
      </div>
      {result && <Notice tone={result.ok ? 'good' : 'bad'}>{result.text}</Notice>}
    </div>
  );
}

/** How to put gas in a Console wallet: its address, a balance per chain, faucets, or a transfer from the browser wallet. */
export function FundWallet({
  address,
  chains,
  funds,
}: {
  address: `0x${string}`;
  chains: FundChain[];
  /** Balances the caller already reads, so a gate and this panel agree; read here otherwise. */
  funds?: FundsState;
}) {
  const own = useChainFunds(funds ? null : address, funds ? [] : chains);
  const state = funds ?? own;
  const [copied, setCopied] = useState(false);
  const mainnet = chains.some((c) => c.testnet === false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[12px] text-zinc-900 dark:text-zinc-50">{address}</span>
        <Button
          variant="ghost"
          className="h-7 px-1.5"
          onClick={() => void navigator.clipboard.writeText(address).then(() => setCopied(true))}
        >
          <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy address'}
        </Button>
      </div>
      <p className="text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        Send the native gas token of each chain to this address: use a faucet on testnets, or transfer from your browser
        wallet. Keep only what the tools need in it.
      </p>
      {mainnet ? (
        <Notice tone="bad">
          This includes mainnet, where the funds are real. A Console wallet lives only in this browser: if you lose its
          key or this browser&apos;s data, the funds are gone. Save the key first and send small amounts.
        </Notice>
      ) : (
        <Notice tone="warn">
          Save the private key before you fund it. This wallet lives only in this browser, and its funds are lost with
          it.
        </Notice>
      )}
      {chains.length > 0 && (
        <div className="flex flex-col divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {chains.map((c) => (
            <ChainRow
              key={c.chainId}
              address={address}
              chain={c}
              funds={state.of(c.chainId)}
              reload={() => state.reload(c.chainId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
