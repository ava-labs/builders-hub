'use client';

import { useState } from 'react';
import { zeroAddress } from 'viem';
import ERC20TokenHomeABI from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHomeABI from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import ERC20TokenRemoteABI from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import NativeTokenRemoteABI from '@/contracts/icm-contracts/compiled/NativeTokenRemote.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import type { TokenKind } from '@/app/console/ictt/_components/types';

const DEFAULT_GAS_LIMIT = 250_000n;

export type TransferDirection = 'home-to-remote' | 'remote-to-home';

export interface SendTransferArgs {
  direction: TransferDirection;
  /** Source-side TokenHome or TokenRemote contract address */
  sourceContract: string;
  /** Source-side kind (matters for ERC-20 vs Native ABI selection) */
  sourceKind: TokenKind;
  /** Destination-side TokenRemote or TokenHome contract address */
  destContract: string;
  /** Destination chain blockchain ID (cb58); cb58→hex'd for the call */
  destChainId: string;
  /** Recipient on the destination chain */
  recipient: string;
  /** Amount in the source token's smallest unit */
  amount: bigint;
  /** Optional gas limit override; defaults to 250000 */
  requiredGasLimit?: bigint;
  /**
   * Whether to attempt a pre-send approve(source, amount) on the
   * underlying token. Only used for `home-to-remote` ERC-20 sends.
   * The inspector decides this based on the live allowance read.
   */
  approveBeforeSend?: boolean;
}

/**
 * Hook that owns the cross-chain `send(...)` flow.
 *
 *   home → remote: calls `send(SendTokensInput, amount)` on TokenHome.
 *                  ERC-20 needs an approve first; Native passes value.
 *   remote → home: calls `send(SendTokensInput, amount)` on TokenRemote.
 *                  Native passes value; ERC-20 burns from balance.
 *
 * The Teleporter relayer delivers the message to the destination
 * contract, where tokens are minted (or unlocked, depending on direction).
 */
export function useSendTransfer() {
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const [status, setStatus] = useState<'idle' | 'approving' | 'sending'>('idle');
  const [error, setError] = useState<string | null>(null);

  const run = async (args: SendTransferArgs): Promise<{ hash: string }> => {
    setError(null);
    if (!walletClient?.account || !viemChain) {
      const msg = 'Wallet not connected';
      setError(msg);
      throw new Error(msg);
    }
    if (args.amount === 0n) {
      const msg = 'Amount must be greater than zero';
      setError(msg);
      throw new Error(msg);
    }

    let destBlockchainIDHex: string;
    try {
      destBlockchainIDHex = cb58ToHex(args.destChainId);
    } catch {
      const msg = 'Could not encode destination blockchain ID';
      setError(msg);
      throw new Error(msg);
    }

    const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
    if (!client) {
      const msg = 'Could not create RPC client';
      setError(msg);
      throw new Error(msg);
    }

    // Pre-send approve for ERC-20 home → remote sends.
    if (args.approveBeforeSend && args.direction === 'home-to-remote' && args.sourceKind === 'erc20') {
      setStatus('approving');
      try {
        const tokenAddr = (await client.readContract({
          address: args.sourceContract as `0x${string}`,
          abi: ERC20TokenHomeABI.abi,
          functionName: 'getTokenAddress',
        })) as `0x${string}`;
        const allowance = (await client.readContract({
          address: tokenAddr,
          abi: ExampleERC20.abi,
          functionName: 'allowance',
          args: [walletClient.account.address, args.sourceContract as `0x${string}`],
        })) as bigint;

        if (allowance < args.amount) {
          const { request } = await client.simulateContract({
            address: tokenAddr,
            abi: ExampleERC20.abi,
            functionName: 'approve',
            args: [args.sourceContract as `0x${string}`, args.amount],
            chain: viemChain,
            account: walletClient.account,
          });
          const approvePromise = walletClient.writeContract(request);
          notify({ type: 'call', name: 'Approve for Send' }, approvePromise, viemChain);
          const approveHash = await approvePromise;
          await client.waitForTransactionReceipt({ hash: approveHash });
        }
      } catch (e: any) {
        const msg = e?.shortMessage ?? e?.message ?? 'Approve failed';
        setError(msg);
        setStatus('idle');
        throw e;
      }
    }

    setStatus('sending');
    try {
      const sendInput = {
        destinationBlockchainID: destBlockchainIDHex as `0x${string}`,
        destinationTokenTransferrerAddress: args.destContract as `0x${string}`,
        recipient: args.recipient as `0x${string}`,
        primaryFeeTokenAddress: zeroAddress,
        primaryFee: 0n,
        secondaryFee: 0n,
        requiredGasLimit: args.requiredGasLimit ?? DEFAULT_GAS_LIMIT,
        multiHopFallback: zeroAddress,
      };

      // home-to-remote uses TokenHome ABI; remote-to-home uses TokenRemote
      // ABI. Native variants pass `value`; ERC-20 variants pass amount as
      // a second positional arg.
      const isHomeToRemote = args.direction === 'home-to-remote';
      const isNativeValue =
        (isHomeToRemote && args.sourceKind === 'native') || (!isHomeToRemote && args.sourceKind === 'native');

      const abi = isHomeToRemote
        ? ((args.sourceKind === 'erc20' ? ERC20TokenHomeABI.abi : NativeTokenHomeABI.abi) as any)
        : ((args.sourceKind === 'erc20' ? ERC20TokenRemoteABI.abi : NativeTokenRemoteABI.abi) as any);

      const { request } = await client.simulateContract({
        address: args.sourceContract as `0x${string}`,
        abi,
        functionName: 'send',
        args: isNativeValue ? [sendInput] : [sendInput, args.amount],
        chain: viemChain,
        account: walletClient.account,
        ...(isNativeValue ? { value: args.amount } : {}),
      });
      const writePromise = walletClient.writeContract(request);
      notify({ type: 'call', name: 'Send Tokens' }, writePromise, viemChain);
      const hash = await writePromise;
      await client.waitForTransactionReceipt({ hash });
      return { hash };
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Send failed';
      setError(msg);
      throw e;
    } finally {
      setStatus('idle');
    }
  };

  return {
    run,
    status,
    isApproving: status === 'approving',
    isSending: status === 'sending',
    isWorking: status !== 'idle',
    error,
    reset: () => setError(null),
  };
}
