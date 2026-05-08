'use client';

import { useState } from 'react';
import { zeroAddress } from 'viem';
import ERC20TokenRemoteABI from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

export interface RegisterRemoteArgs {
  /** TokenRemote contract address on the destination chain */
  remoteAddress: string;
}

export interface RegisterRemoteResult {
  hash: string;
}

/**
 * Hook that owns the registerWithHome ICM message send. The wallet must
 * be connected to the destination (remote) chain since the call is on
 * the remote contract; the message is delivered to the home contract by
 * Teleporter relayers within ~30s.
 *
 * Both the ERC20TokenRemote and NativeTokenRemote ABIs expose
 * `registerWithHome(feeInfo)`, so we use the ERC20 ABI for both.
 */
export function useRegisterRemote() {
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (args: RegisterRemoteArgs): Promise<RegisterRemoteResult> => {
    setError(null);
    if (!walletClient?.account || !viemChain) {
      const msg = 'Wallet not connected';
      setError(msg);
      throw new Error(msg);
    }
    if (!args.remoteAddress) {
      const msg = 'Remote contract address required';
      setError(msg);
      throw new Error(msg);
    }

    setIsRegistering(true);
    try {
      const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!client) throw new Error('Could not create RPC client for destination');

      // feeInfo = (feeTokenAddress, amount). Zero-address + 0 means no
      // primary fee token; the caller pays gas in the chain's native
      // currency. Matches the existing wizard's behavior in
      // RegisterWithHome.tsx.
      const feeInfo: readonly [`0x${string}`, bigint] = [zeroAddress, 0n];
      const { request } = await client.simulateContract({
        address: args.remoteAddress as `0x${string}`,
        abi: ERC20TokenRemoteABI.abi,
        functionName: 'registerWithHome',
        args: [feeInfo],
        chain: viemChain,
        account: walletClient.account,
      });

      const writePromise = walletClient.writeContract(request);
      notify({ type: 'call', name: 'Register With Home' }, writePromise, viemChain);
      const hash = await writePromise;
      await client.waitForTransactionReceipt({ hash });
      return { hash };
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Register failed';
      setError(msg);
      throw e;
    } finally {
      setIsRegistering(false);
    }
  };

  return { run, isRegistering, error, reset: () => setError(null) };
}
