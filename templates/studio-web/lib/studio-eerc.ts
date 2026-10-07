import { createPublicClient, defineChain, getAddress, http, toHex, type PublicClient } from 'viem';
import { parseEERCRequest, runEERC, type EERCResult, type EERCStage } from '@/lib/eerc/client';
import { setCircuitBase } from '@/lib/eerc/proof';
import type { StudioConfig } from './studio-types';

/*
 * `studio.eerc` in the exported app: the Encrypted ERC operations the `useEERC` hook asks for. The key is derived
 * from the user's wallet signature and the proofs are generated in this browser, as they were in Studio. The circuit
 * files are large and the same for every app, so they load from Builder Hub unless NEXT_PUBLIC_EERC_CIRCUITS points
 * at your own copy (https://github.com/ava-labs/EncryptedERC, circom/build).
 */

setCircuitBase(process.env.NEXT_PUBLIC_EERC_CIRCUITS || 'https://build.avax.network/eerc/circuits');

type Eip1193 = { request: (args: { method: string; params?: unknown }) => Promise<unknown> };

export function createEERC({
  provider,
  contracts,
  chains,
}: {
  provider: Eip1193;
  contracts: StudioConfig['contracts'];
  chains: StudioConfig['chains'];
}) {
  return async (
    raw: Record<string, string | undefined>,
    options: { onStage?: (stage: EERCStage) => void } = {},
  ): Promise<EERCResult> => {
    const request = parseEERCRequest(raw);
    const token = 'token' in request && request.token ? getAddress(request.token) : null;
    const contract = Object.values(contracts).find((c) => c.chainId && token && getAddress(c.address) === token);
    if (!contract?.chainId) throw new Error("eERC operations only run on this app's own deployed tokens");
    const chainId = contract.chainId;
    const info = chains[chainId];
    if (!info?.rpcUrl) throw new Error(`No RPC is configured for chain ${chainId} in studio.config.ts`);

    const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
    const address = getAddress(accounts[0]) as `0x${string}`;
    const chain = defineChain({
      id: chainId,
      name: info.name,
      nativeCurrency: info.nativeCurrency,
      rpcUrls: { default: { http: [info.rpcUrl] } },
    });
    const client = createPublicClient({ chain, transport: http(info.rpcUrl) }) as PublicClient;

    const ensureChain = async () => {
      if (Number(await provider.request({ method: 'eth_chainId' })) === chainId) return;
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toHex(chainId) }] });
      } catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error;
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: toHex(chainId),
              chainName: info.name,
              rpcUrls: [info.rpcUrl],
              nativeCurrency: info.nativeCurrency,
            },
          ],
        });
      }
    };

    return runEERC(request, {
      client,
      chainId,
      onStage: options.onStage,
      signer: {
        address,
        signMessage: async (message) =>
          (await provider.request({ method: 'personal_sign', params: [toHex(message), address] })) as `0x${string}`,
        send: async (tx) => {
          await ensureChain();
          return (await provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: address, to: tx.to, data: tx.data }],
          })) as `0x${string}`;
        },
      },
    });
  };
}
