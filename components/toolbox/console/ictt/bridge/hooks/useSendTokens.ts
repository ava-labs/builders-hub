'use client';

import { useState } from 'react';
import { useTokenHome } from '@/components/toolbox/hooks/contracts/bridge/useTokenHome';
import { useContractActions } from '@/components/toolbox/hooks/contracts';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { parseContractError } from '@/components/toolbox/hooks/contracts/parseContractError';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import ERC20TokenHomeAbi from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHomeAbi from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { BaseError, ContractFunctionRevertedError } from 'viem';
import type { Address, Bridge, Remote } from '../types';

interface SendParams {
  amount: bigint;
  recipient: Address;
  /** Optional ICM fee; defaults to zero. */
  primaryFee?: bigint;
  secondaryFee?: bigint;
  /** Optional gas limit on the destination chain (default: 250_000). */
  requiredGasLimit?: bigint;
}

interface UseSendTokensOptions {
  bridge: Bridge | null;
  remote: Remote | null;
}

function decodeSimulateRevert(err: unknown): string | null {
  if (!(err instanceof BaseError)) return null;
  const revertError = err.walk((e) => e instanceof ContractFunctionRevertedError) as
    | ContractFunctionRevertedError
    | undefined;
  if (revertError) {
    const reason = revertError.data?.errorName ?? revertError.reason ?? revertError.shortMessage;
    if (reason) return parseContractError(new Error(reason));
  }
  return err.shortMessage ?? null;
}

export function useSendTokens({ bridge, remote }: UseSendTokensOptions) {
  const tokenHome = useTokenHome(bridge?.homeAddress ?? null, bridge?.kind === 'native-home' ? 'native' : 'erc20');
  const erc20 = useContractActions(bridge?.underlyingTokenAddress ?? null, ExampleERC20.abi);
  const pushActivity = useIcttBridgeStore((s) => s.pushActivity);
  const updateActivity = useIcttBridgeStore((s) => s.updateActivity);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const [stage, setStage] = useState<'idle' | 'approving' | 'sending' | 'submitted' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);

  const send = async (params: SendParams): Promise<{ approveTx?: Address; sendTx: Address } | null> => {
    if (!bridge || !remote) return null;
    setError(null);
    const activityId = pushActivity({
      bridgeId: bridge.id,
      remoteId: remote.id,
      kind: 'send',
      label: 'Send tokens cross-chain',
      sublabel: bridge.kind === 'native-home' ? 'Sending native via Home' : 'Approve + send',
      chainId: walletChainId,
      status: 'pending',
    });
    try {
      const decimals = bridge.decimals ?? 18;
      const blockchainIDHex = cb58ToHex(remote.l1Id) as Address;

      // Balance preflight — surface "insufficient balance" with a readable
      // message before triggering the wallet popup. Reads from the Home L1's
      // RPC regardless of the wallet's current chain.
      if (bridge.kind === 'erc20-home' && bridge.underlyingTokenAddress && walletEVMAddress && homeL1?.rpcUrl) {
        try {
          const client = makePublicClientForChain(homeL1.rpcUrl);
          if (client) {
            const balance = (await client.readContract({
              address: bridge.underlyingTokenAddress,
              abi: ExampleERC20.abi,
              functionName: 'balanceOf',
              args: [walletEVMAddress],
            })) as bigint;
            if (balance < params.amount) {
              throw new Error(
                `Insufficient ${bridge.symbol ?? 'token'} balance. Have ${formatAmount(balance, decimals)} ${
                  bridge.symbol ?? ''
                }, need ${formatAmount(params.amount, decimals)} ${bridge.symbol ?? ''}.`,
              );
            }
          }
        } catch (preflightErr) {
          // Re-throw if it's our "Insufficient balance" — otherwise it's an RPC
          // read failure, in which case continue (the contract revert will tell us).
          if (preflightErr instanceof Error && preflightErr.message.startsWith('Insufficient ')) {
            throw preflightErr;
          }
        }
      } else if (bridge.kind === 'native-home' && walletEVMAddress && homeL1?.rpcUrl) {
        try {
          const client = makePublicClientForChain(homeL1.rpcUrl);
          if (client) {
            const balance = (await client.getBalance({ address: walletEVMAddress as Address })) as bigint;
            if (balance < params.amount) {
              throw new Error(
                `Insufficient native balance. Have ${formatAmount(balance, decimals)} ${bridge.symbol ?? ''}, need ${formatAmount(params.amount, decimals)} ${bridge.symbol ?? ''}.`,
              );
            }
          }
        } catch (preflightErr) {
          if (preflightErr instanceof Error && preflightErr.message.startsWith('Insufficient ')) {
            throw preflightErr;
          }
        }
      }

      let approveTx: Address | undefined;
      if (bridge.kind === 'erc20-home') {
        setStage('approving');
        approveTx = (await erc20.write(
          'approve',
          [bridge.homeAddress, params.amount],
          'Approve TokenHome to spend send amount',
        )) as Address;
      }

      const input = {
        destinationBlockchainID: blockchainIDHex,
        destinationTokenTransferrerAddress: remote.address,
        recipient: params.recipient,
        primaryFeeTokenAddress: bridge.underlyingTokenAddress ?? bridge.homeAddress,
        primaryFee: params.primaryFee ?? 0n,
        secondaryFee: params.secondaryFee ?? 0n,
        requiredGasLimit: params.requiredGasLimit ?? 250_000n,
        multiHopFallback: '0x0000000000000000000000000000000000000000' as Address,
      };

      // Explicit simulate to surface the contract's decoded revert reason.
      // Without this the user often sees viem's "Unable to get transaction hash"
      // fallback when the underlying tx reverts after the wallet popup.
      if (homeL1?.rpcUrl && walletEVMAddress && bridge.homeAddress) {
        try {
          const client = makePublicClientForChain(homeL1.rpcUrl);
          if (client) {
            const homeAbi = bridge.kind === 'native-home' ? NativeTokenHomeAbi.abi : ERC20TokenHomeAbi.abi;
            await client.simulateContract({
              address: bridge.homeAddress,
              abi: homeAbi,
              functionName: 'send',
              args: [input, params.amount],
              account: walletEVMAddress as Address,
              ...(bridge.kind === 'native-home' ? { value: params.amount } : {}),
            });
          }
        } catch (simErr) {
          const decoded = decodeSimulateRevert(simErr);
          throw new Error(decoded ?? 'Send simulation reverted with no decoded reason.');
        }
      }

      setStage('sending');
      const sendTx = (await tokenHome.send(input, params.amount)) as Address;

      updateActivity(activityId, {
        status: 'confirmed',
        txHash: sendTx,
        sublabel: 'Send tx confirmed on Home',
      });
      setStage('submitted');
      return { approveTx, sendTx };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      updateActivity(activityId, { status: 'failed', sublabel: e.message });
      setStage('error');
      return null;
    }
  };

  const resetError = () => {
    setError(null);
    if (stage === 'error') setStage('idle');
  };

  return {
    send,
    resetError,
    stage,
    isBusy: stage === 'approving' || stage === 'sending',
    error,
  };
}

function formatAmount(amount: bigint, decimals: number): string {
  const factor = 10n ** BigInt(decimals);
  const whole = amount / factor;
  const fraction = amount % factor;
  if (fraction === 0n) return whole.toString();
  const padded = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}.${padded}`;
}
