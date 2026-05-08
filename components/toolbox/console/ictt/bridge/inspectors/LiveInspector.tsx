'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Note } from '@/components/toolbox/components/Note';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { InspectorShell } from './InspectorShell';
import { useSendTokens } from '../hooks/useSendTokens';
import { buildTxUrl, truncateAddress } from '../utils/explorer-url';
import type { Address, Bridge, BridgePhase, BridgeStatus, Remote } from '../types';

interface LiveInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  status: BridgeStatus;
  bridge: Bridge | null;
  remote: Remote | null;
}

export function LiveInspector({ onPhaseChange, status, bridge, remote }: LiveInspectorProps) {
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const remoteL1 = useL1ByChainId(remote?.l1Id ?? '');
  const viemChain = useViemChainStore();
  const { walletEVMAddress } = useWalletStore();
  const { send, stage, isBusy, error } = useSendTokens({ bridge, remote });
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<string>(walletEVMAddress);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [lastTx, setLastTx] = useState<Address | null>(null);

  useEffect(() => {
    if (!recipient && walletEVMAddress) setRecipient(walletEVMAddress);
  }, [walletEVMAddress, recipient]);

  useEffect(() => {
    if (!bridge?.underlyingTokenAddress || !viemChain || !walletEVMAddress) return;
    let cancelled = false;
    const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
    if (!client) return;
    client
      .readContract({
        address: bridge.underlyingTokenAddress,
        abi: ExampleERC20.abi,
        functionName: 'balanceOf',
        args: [walletEVMAddress],
      })
      .then((b) => {
        if (!cancelled) setBalance(b as bigint);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bridge?.underlyingTokenAddress, viemChain, walletEVMAddress]);

  const decimals = bridge?.decimals ?? 18;
  const parsed = parseAmount(amount, decimals);
  const validRecipient = /^0x[a-fA-F0-9]{40}$/.test(recipient);

  const handleSend = async () => {
    if (!parsed || parsed <= 0n) return;
    if (!validRecipient) return;
    const result = await send({ amount: parsed, recipient: recipient as Address });
    if (result) setLastTx(result.sendTx);
  };

  const sendTxUrl = buildTxUrl(homeL1, lastTx);

  return (
    <InspectorShell
      phase="live"
      status={status}
      onPhaseChange={onPhaseChange}
      description={`Send ${bridge?.symbol ?? 'tokens'} from ${homeL1?.name ?? 'Home'} → ${remoteL1?.name ?? 'Remote'}. The relayer delivers; the wrapped tokens land in the recipient's wallet on the destination.`}
      banner={
        !remote?.collateralizedAt && bridge?.kind !== 'native-home' ? (
          <Note variant="warning">
            <span className="text-xs">Add collateral in Phase 5 first — sends fail without it.</span>
          </Note>
        ) : null
      }
      footer={
        <button
          type="button"
          onClick={handleSend}
          disabled={isBusy || !bridge?.homeAddress || !remote?.address || !parsed || parsed <= 0n || !validRecipient}
          className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden />
          )}
          {stageLabel(stage, bridge?.kind === 'native-home')}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Amount {bridge?.symbol ? `(${bridge.symbol})` : ''}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              {balance !== null && (
                <button
                  type="button"
                  onClick={() => setAmount(formatAmount(balance, decimals))}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                >
                  Max
                </button>
              )}
            </div>
            {balance !== null && (
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Balance · {formatAmount(balance, decimals)} {bridge?.symbol ?? ''}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Recipient on {remoteL1?.name ?? 'Remote'}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                placeholder="0x…"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              {walletEVMAddress && (
                <button
                  type="button"
                  onClick={() => setRecipient(walletEVMAddress)}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                >
                  Self
                </button>
              )}
            </div>
            {!validRecipient && recipient && (
              <span className="text-[10px] text-red-600 dark:text-red-400">Invalid EVM address.</span>
            )}
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
          <span>Direction</span>
          <span className="font-medium">
            {homeL1?.name ?? 'Home'} → {remoteL1?.name ?? 'Remote'}
          </span>
        </div>

        {error && (
          <Note variant="destructive">
            <span className="text-xs">{error.message}</span>
          </Note>
        )}

        {lastTx && sendTxUrl && (
          <Note variant="success">
            <span className="text-xs">
              Send tx submitted on {homeL1?.name}. <code className="font-mono">{truncateAddress(lastTx)}</code> ·{' '}
              <a href={sendTxUrl} target="_blank" rel="noreferrer" className="underline">
                explorer
              </a>
            </span>
          </Note>
        )}
      </div>
    </InspectorShell>
  );
}

function stageLabel(stage: ReturnType<typeof useSendTokens>['stage'], isNative: boolean): string {
  if (stage === 'approving') return 'Approving…';
  if (stage === 'sending') return 'Submitting…';
  if (stage === 'submitted') return 'Send another';
  return isNative ? 'Send native cross-chain' : 'Send tokens';
}

function parseAmount(input: string, decimals: number): bigint | null {
  const value = input.trim();
  if (!value) return null;
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) return null;
  const padded = fraction.padEnd(decimals, '0');
  try {
    return BigInt(whole + padded);
  } catch {
    return null;
  }
}

function formatAmount(amount: bigint, decimals: number): string {
  const factor = 10n ** BigInt(decimals);
  const whole = amount / factor;
  const fraction = amount % factor;
  if (fraction === 0n) return whole.toString();
  const padded = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}.${padded}`;
}
