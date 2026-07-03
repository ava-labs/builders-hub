'use client';

import { useState } from 'react';
import { useTokenHome } from '@/components/toolbox/hooks/contracts/bridge/useTokenHome';
import { useContractActions } from '@/components/toolbox/hooks/contracts';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { parseContractError } from '@/components/toolbox/hooks/contracts/parseContractError';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import ERC20TokenHomeAbi from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHomeAbi from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import { CB58ToHex } from '@avalanche-sdk/client/utils';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { BaseError, ContractFunctionRevertedError, encodeFunctionData, parseEventLogs } from 'viem';
import TeleporterMessengerAbi from '@/contracts/icm-contracts/compiled/TeleporterMessenger.json';
import { truncateAddress } from '../utils/explorer-url';
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
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const [stage, setStage] = useState<'idle' | 'approving' | 'confirming' | 'sending' | 'submitted' | 'error'>('idle');
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
      const blockchainIDHex = CB58ToHex(remote.l1Id) as Address;

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

        // Wait for the approve to mine before simulating send. `erc20.write`
        // returns on broadcast — without this wait, the simulate below races
        // against pre-approve state on `homeL1.rpcUrl` and the token's
        // `transferFrom` reverts (allowance still 0). Viem can't decode the
        // underlying `ERC20InsufficientAllowance` selector against TokenHome's
        // ABI, so it surfaces as the generic "FailedInnerCall" — accurate but
        // useless to the user.
        setStage('confirming');
        if (homeL1?.rpcUrl) {
          try {
            const client = makePublicClientForChain(homeL1.rpcUrl);
            if (client) await client.waitForTransactionReceipt({ hash: approveTx, timeout: 60_000 });
          } catch {
            // Best-effort: if the receipt wait fails (RPC blip or > 60s), fall
            // through — the simulate below will catch any actual allowance
            // problem and surface the real reason instead of silently stalling.
          }
        }
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
          // On Fuji, fall back to `debug_traceCall` for richer revert context.
          // `decodeSimulateRevert` only knows the errors in TokenHome's ABI, so
          // bubbled-up errors like `ERC20InsufficientAllowance` from the
          // underlying token can't be named here. The trace returns the actual
          // revert reason from any depth in the call stack.
          if (isTestnet) {
            try {
              const homeAbi = bridge.kind === 'native-home' ? NativeTokenHomeAbi.abi : ERC20TokenHomeAbi.abi;
              const callData = encodeFunctionData({
                abi: homeAbi,
                functionName: 'send',
                args: [input, params.amount],
              });
              const traceResp = await fetch('/api/debug-rpc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  method: 'debug_traceCall',
                  params: [
                    {
                      from: walletEVMAddress,
                      to: bridge.homeAddress,
                      data: callData,
                      ...(bridge.kind === 'native-home' ? { value: `0x${params.amount.toString(16)}` } : {}),
                    },
                    'latest',
                    { tracer: 'callTracer' },
                  ],
                }),
              });
              if (traceResp.ok) {
                const traceData = await traceResp.json();
                const reason: string | undefined = traceData?.result?.revertReason || traceData?.result?.error;
                if (reason && (!decoded || !decoded.includes(reason))) {
                  throw new Error(decoded ? `${decoded} (trace: ${reason})` : `Send simulation reverted: ${reason}`);
                }
              }
            } catch (traceErr) {
              // Re-throw if the trace produced our enhanced error; otherwise
              // fall through and surface the plain decoded message below.
              if (traceErr instanceof Error && traceErr.message.startsWith('Send simulation')) {
                throw traceErr;
              }
            }
          }
          throw new Error(decoded ?? 'Send simulation reverted with no decoded reason.');
        }
      }

      setStage('sending');
      const sendTx = (await tokenHome.send(input, params.amount)) as Address;

      // Best-effort: parse the Teleporter `SendCrossChainMessage` event out of
      // the receipt so the activity log can link directly to the ICM message.
      // The send itself is already confirmed at this point; failure to read
      // the receipt just means the row falls back to the generic sublabel.
      let icmMessageId: string | undefined;
      if (homeL1?.rpcUrl) {
        try {
          const client = makePublicClientForChain(homeL1.rpcUrl);
          if (client) {
            const receipt = await client.waitForTransactionReceipt({ hash: sendTx, timeout: 60_000 });
            const logs = parseEventLogs({
              abi: TeleporterMessengerAbi.abi,
              eventName: 'SendCrossChainMessage',
              logs: receipt.logs,
            }) as Array<{ args?: { messageID?: string } }>;
            icmMessageId = logs[0]?.args?.messageID;
          }
        } catch {
          // Best-effort — activity row still gets the txHash even on failure.
        }
      }

      updateActivity(activityId, {
        status: 'confirmed',
        txHash: sendTx,
        icmMessageId,
        sublabel: icmMessageId ? `ICM msg ${truncateAddress(icmMessageId, 8, 4)}` : 'Send tx confirmed on Home',
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
    isBusy: stage === 'approving' || stage === 'confirming' || stage === 'sending',
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
