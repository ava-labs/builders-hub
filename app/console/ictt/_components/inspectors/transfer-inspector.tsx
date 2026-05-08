'use client';

import { useEffect, useState } from 'react';
import { formatUnits, parseUnits, zeroAddress } from 'viem';
import ERC20TokenHomeABI from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHomeABI from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import ERC20TokenRemoteABI from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import NativeTokenRemoteABI from '@/contracts/icm-contracts/compiled/NativeTokenRemote.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Note } from '@/components/toolbox/components/Note';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import { InspectorPanel } from '../inspector-panel';
import { SegmentControl } from '../segment-control';
import { ChainMismatchBanner } from './preflight-banner';
import type { BridgeState } from '../use-bridge-state';
import type { ActivityEvent } from '../types';

const DEFAULT_GAS_LIMIT = 250_000n;

type Direction = 'home-to-remote' | 'remote-to-home';

interface TransferInspectorProps {
  bridge: BridgeState;
  accent: string;
  onClose: () => void;
  onAdvance: () => void;
  appendActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  switchChain: (chainId: number, isTestnet: boolean) => Promise<void>;
}

/**
 * Live transfer phase: cross-chain send via the bridge.
 *
 *   home → remote: call `send(SendTokensInput, amount)` on TokenHome
 *                  (ERC-20: needs approve first; Native: passes value)
 *   remote → home: call `send(SendTokensInput, amount)` on TokenRemote
 *                  (Native: passes value; ERC-20: burns from balance)
 */
export function TransferInspector({
  bridge,
  accent,
  onClose,
  onAdvance,
  appendActivity,
  switchChain,
}: TransferInspectorProps) {
  const walletClient = useResolvedWalletClient();
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  const [direction, setDirection] = useState<Direction>('home-to-remote');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState<string>(walletEVMAddress || '');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<'idle' | 'approving' | 'sending'>('idle');
  const [decimals, setDecimals] = useState(18);
  const [tokenSymbol, setTokenSymbol] = useState('TKN');

  // Determine source/destination based on direction.
  const sourceChain = direction === 'home-to-remote' ? bridge.homeChain : bridge.remoteChain;
  const destChain = direction === 'home-to-remote' ? bridge.remoteChain : bridge.homeChain;
  const sourceContract = direction === 'home-to-remote' ? bridge.homeAddress : bridge.remoteAddress;
  const sourceKind = direction === 'home-to-remote' ? bridge.homeKind : bridge.remoteKind;
  const destContract = direction === 'home-to-remote' ? bridge.remoteAddress : bridge.homeAddress;

  useEffect(() => {
    if (walletEVMAddress) setRecipient(walletEVMAddress);
  }, [walletEVMAddress]);

  // Auto-fetch decimals + symbol from source.
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
    setError(null);
    if (!walletClient?.account || !viemChain) {
      setError('Wallet not connected');
      return;
    }
    if (!sourceChain || !destChain || !sourceContract || !destContract) {
      setError('Bridge not fully set up');
      return;
    }
    if (walletChainId !== sourceChain.evmChainId) {
      setError(`Switch wallet to ${sourceChain.name}`);
      return;
    }
    if (parsedAmount === 0n) {
      setError('Enter an amount');
      return;
    }

    let destBlockchainIDHex: string;
    try {
      destBlockchainIDHex = cb58ToHex(destChain.id);
    } catch {
      setError('Could not encode destination blockchain ID');
      return;
    }

    setWorking('sending');
    try {
      const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!client) throw new Error('Could not create RPC client');

      // ERC20 home: needs approve before send.
      if (direction === 'home-to-remote' && bridge.homeKind === 'erc20') {
        setWorking('approving');
        const tokenAddr = (await client.readContract({
          address: sourceContract as `0x${string}`,
          abi: ERC20TokenHomeABI.abi,
          functionName: 'getTokenAddress',
        })) as `0x${string}`;
        const allowance = (await client.readContract({
          address: tokenAddr,
          abi: ExampleERC20.abi,
          functionName: 'allowance',
          args: [walletClient.account.address, sourceContract as `0x${string}`],
        })) as bigint;
        if (allowance < parsedAmount) {
          const { request: approveRequest } = await client.simulateContract({
            address: tokenAddr,
            abi: ExampleERC20.abi,
            functionName: 'approve',
            args: [sourceContract as `0x${string}`, parsedAmount],
            chain: viemChain,
            account: walletClient.account,
          });
          const approvePromise = walletClient.writeContract(approveRequest);
          notify({ type: 'call', name: 'Approve for Send' }, approvePromise, viemChain);
          const approveHash = await approvePromise;
          await client.waitForTransactionReceipt({ hash: approveHash });
          appendActivity({
            kind: 'collateral',
            label: 'Approved tokens for send',
            txHash: approveHash,
            chainId: viemChain.id,
          });
        }
        setWorking('sending');
      }

      const sendInput = {
        destinationBlockchainID: destBlockchainIDHex as `0x${string}`,
        destinationTokenTransferrerAddress: destContract as `0x${string}`,
        recipient: (recipient || walletEVMAddress) as `0x${string}`,
        primaryFeeTokenAddress: zeroAddress,
        primaryFee: 0n,
        secondaryFee: 0n,
        requiredGasLimit: DEFAULT_GAS_LIMIT,
        multiHopFallback: zeroAddress,
      };

      const isHomeNative = direction === 'home-to-remote' && bridge.homeKind === 'native';
      const isRemoteNative = direction === 'remote-to-home' && bridge.remoteKind === 'native';
      const isNativeValue = isHomeNative || isRemoteNative;

      const homeAbi = direction === 'home-to-remote' ? (bridge.homeKind === 'erc20' ? ERC20TokenHomeABI.abi : NativeTokenHomeABI.abi) : null;
      const remoteAbi =
        direction === 'remote-to-home'
          ? bridge.remoteKind === 'erc20'
            ? ERC20TokenRemoteABI.abi
            : NativeTokenRemoteABI.abi
          : null;

      const { request } = await client.simulateContract({
        address: sourceContract as `0x${string}`,
        abi: (homeAbi ?? remoteAbi) as any,
        functionName: 'send',
        args: isNativeValue ? [sendInput] : [sendInput, parsedAmount],
        chain: viemChain,
        account: walletClient.account,
        ...(isNativeValue ? { value: parsedAmount } : {}),
      });

      const writePromise = walletClient.writeContract(request);
      notify({ type: 'call', name: 'Send Tokens' }, writePromise, viemChain);
      const hash = await writePromise;
      await client.waitForTransactionReceipt({ hash });

      appendActivity({
        kind: 'send',
        label: `Sent ${tokenSymbol} ${sourceChain.name} → ${destChain.name}`,
        amount: amount,
        txHash: hash,
        chainId: viemChain.id,
      });
      bridge.refresh();
      onAdvance();
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Send failed';
      setError(msg);
      appendActivity({ kind: 'error', label: `Send failed: ${msg}` });
    } finally {
      setWorking('idle');
    }
  };

  const onSwitchToSource = sourceChain
    ? () => switchChain(sourceChain.evmChainId, !!sourceChain.isTestnet)
    : undefined;

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
          loading={working !== 'idle'}
          loadingText={working === 'approving' ? 'Approving...' : 'Sending...'}
          disabled={!sourceContract || !destContract || parsedAmount === 0n || working !== 'idle'}
          stickLeft
        >
          Send →
        </Button>
      }
      onClose={onClose}
      preflight={
        sourceChain ? (
          <ChainMismatchBanner expectedChain={sourceChain} walletChainId={walletChainId} onSwitch={onSwitchToSource} />
        ) : null
      }
    >
      <div>
        <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Direction</label>
        <SegmentControl<Direction>
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

      {error && (
        <Note variant="destructive">
          <p>{error}</p>
        </Note>
      )}
    </InspectorPanel>
  );
}
