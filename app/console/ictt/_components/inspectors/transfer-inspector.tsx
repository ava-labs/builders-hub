'use client';

import { useEffect, useState } from 'react';
import { parseUnits } from 'viem';
import ERC20TokenHomeABI from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import ERC20TokenRemoteABI from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { useSendTransfer, type TransferDirection } from '@/components/toolbox/console/ictt/hooks/useSendTransfer';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Note } from '@/components/toolbox/components/Note';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import { InspectorPanel } from '../inspector-panel';
import { SegmentControl } from '../segment-control';
import { usePreflight } from '../use-preflight';
import type { BridgeState } from '../use-bridge-state';
import type { ActivityEvent } from '../types';

const DEFAULT_GAS_LIMIT = 250_000n;

interface TransferInspectorProps {
  bridge: BridgeState;
  accent: string;
  onAdvance: () => void;
  appendActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  switchChain: (chainId: number, isTestnet: boolean) => Promise<void>;
}

/**
 * Live transfer phase: cross-chain send via the bridge.
 *
 *   home → remote: call `send(SendTokensInput, amount)` on TokenHome
 *                  (ERC-20: approve-then-send; Native: passes value)
 *   remote → home: call `send(SendTokensInput, amount)` on TokenRemote
 *                  (Native: passes value; ERC-20: burns from balance)
 *
 * On-chain mechanics (approve + send + ABI selection by direction/kind)
 * live in `useSendTransfer`. This inspector reads source-side decimals
 * and symbol for display only.
 */
export function TransferInspector({
  bridge,
  accent,
  onAdvance,
  appendActivity,
  switchChain,
}: TransferInspectorProps) {
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const viemChain = useViemChainStore();
  const { run: runSend, status, isApproving, isWorking, error: hookError } = useSendTransfer();

  const [direction, setDirection] = useState<TransferDirection>('home-to-remote');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState<string>(walletEVMAddress || '');
  const [decimals, setDecimals] = useState(18);
  const [tokenSymbol, setTokenSymbol] = useState('TKN');
  const [localError, setLocalError] = useState<string | null>(null);

  const sourceChain = direction === 'home-to-remote' ? bridge.homeChain : bridge.remoteChain;
  const destChain = direction === 'home-to-remote' ? bridge.remoteChain : bridge.homeChain;
  const sourceContract = direction === 'home-to-remote' ? bridge.homeAddress : bridge.remoteAddress;
  const sourceKind = direction === 'home-to-remote' ? bridge.homeKind : bridge.remoteKind;
  const destContract = direction === 'home-to-remote' ? bridge.remoteAddress : bridge.homeAddress;

  useEffect(() => {
    if (walletEVMAddress) setRecipient(walletEVMAddress);
  }, [walletEVMAddress]);

  // Auto-fetch decimals + symbol from source for display + parsing.
  useEffect(() => {
    if (!sourceChain?.rpcUrl || !sourceContract) return;
    let cancelled = false;
    const client = makePublicClientForChain(sourceChain.rpcUrl);
    if (!client) return;
    (async () => {
      try {
        if (direction === 'home-to-remote' && bridge.homeKind === 'erc20') {
          const tokenAddr = (await client.readContract({
            address: sourceContract as `0x${string}`,
            abi: ERC20TokenHomeABI.abi,
            functionName: 'getTokenAddress',
          })) as `0x${string}`;
          const [d, s] = await Promise.all([
            client.readContract({ address: tokenAddr, abi: ExampleERC20.abi, functionName: 'decimals' }),
            client.readContract({ address: tokenAddr, abi: ExampleERC20.abi, functionName: 'symbol' }),
          ]);
          if (!cancelled) {
            setDecimals(Number(d));
            setTokenSymbol(String(s));
          }
        } else if (direction === 'remote-to-home') {
          const [d, s] = await Promise.all([
            client.readContract({
              address: sourceContract as `0x${string}`,
              abi: ERC20TokenRemoteABI.abi,
              functionName: 'decimals',
            }),
            client.readContract({
              address: sourceContract as `0x${string}`,
              abi: ERC20TokenRemoteABI.abi,
              functionName: 'symbol',
            }),
          ]);
          if (!cancelled) {
            setDecimals(Number(d));
            setTokenSymbol(String(s));
          }
        } else {
          if (!cancelled) {
            setDecimals(18);
            setTokenSymbol(sourceChain.coinName ?? 'NATIVE');
          }
        }
      } catch {
        /* leave defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceChain?.rpcUrl, sourceContract, direction, bridge.homeKind]);

  const parsedAmount = (() => {
    try {
      return amount ? parseUnits(amount, decimals) : 0n;
    } catch {
      return 0n;
    }
  })();

  const handleSend = async () => {
    setLocalError(null);
    if (!sourceChain || !destChain || !sourceContract || !destContract) {
      setLocalError('Bridge not fully set up');
      return;
    }
    if (walletChainId !== sourceChain.evmChainId) {
      setLocalError(`Switch wallet to ${sourceChain.name}`);
      return;
    }

    try {
      const result = await runSend({
        direction,
        sourceContract,
        sourceKind,
        destContract,
        destChainId: destChain.id,
        recipient: recipient || walletEVMAddress || '',
        amount: parsedAmount,
        requiredGasLimit: DEFAULT_GAS_LIMIT,
        approveBeforeSend: direction === 'home-to-remote' && bridge.homeKind === 'erc20',
      });

      appendActivity({
        kind: 'send',
        label: `Sent ${tokenSymbol} ${sourceChain.name} → ${destChain.name}`,
        amount,
        txHash: result.hash,
        chainId: viemChain?.id,
      });
      bridge.refresh();
      onAdvance();
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Send failed';
      appendActivity({ kind: 'error', label: `Send failed: ${msg}` });
    }
  };

  const { banner: preflight } = usePreflight({ expectedChain: sourceChain, switchChain });
  const error = localError || hookError;

  return (
    <InspectorPanel
      phase="transfer"
      accent={accent}
      title="Send tokens"
      description="Bridge live. Tokens move Home ↔ Remote via ICM."
      meta={`Arrival ETA ≈ 25s after origin tx confirms · gas ${DEFAULT_GAS_LIMIT.toString()}`}
      primaryAction={
        <Button
          onClick={handleSend}
          loading={isWorking}
          loadingText={isApproving ? 'Approving...' : 'Sending...'}
          disabled={!sourceContract || !destContract || parsedAmount === 0n || isWorking}
          stickLeft
        >
          Send →
        </Button>
      }
      preflight={preflight}
    >
      <div>
        <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Direction</label>
        <SegmentControl<TransferDirection>
          value={direction}
          onChange={setDirection}
          options={[
            {
              value: 'home-to-remote',
              label: `${bridge.homeChain?.name ?? 'Home'} → ${bridge.remoteChain?.name ?? 'Remote'}`,
            },
            {
              value: 'remote-to-home',
              label: `${bridge.remoteChain?.name ?? 'Remote'} → ${bridge.homeChain?.name ?? 'Home'}`,
            },
          ]}
        />
      </div>

      <Input label={`Amount (${tokenSymbol})`} value={amount} onChange={setAmount} type="number" />

      <EVMAddressInput
        label="Recipient"
        value={recipient}
        onChange={setRecipient}
        helperText="Defaults to your wallet address."
      />

      {!bridge.registered || bridge.collateralNeeded > 0n ? (
        <Note variant="warning">
          Bridge not yet collateralized. Sends will fail until you complete the <strong>Collateral</strong> phase.
        </Note>
      ) : null}

      {/* Status badge while transaction is in flight */}
      {status !== 'idle' && (
        <Note variant="default">
          {isApproving ? 'Approving spend on source contract…' : 'Submitting send transaction…'}
        </Note>
      )}

      {error && (
        <Note variant="destructive">
          <p>{error}</p>
        </Note>
      )}
    </InspectorPanel>
  );
}
