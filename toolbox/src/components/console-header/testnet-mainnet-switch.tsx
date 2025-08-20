'use client'

import { useWalletStore } from "@/stores/walletStore";
import { avalanche, avalancheFuji } from "viem/chains";
import { networkIDs } from "@avalabs/avalanchejs";

export function TestnetMainnetSwitch() {
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const setWalletChainId = useWalletStore((s) => s.setWalletChainId);
  const setIsTestnet = useWalletStore((s) => s.setIsTestnet);
  const setAvalancheNetworkID = useWalletStore((s) => s.setAvalancheNetworkID);

  const safelySwitch = async (chainId: number, testnet: boolean) => {
    try {
      await coreWalletClient.switchChain({ id: chainId });
    } catch (e) {
      // Non-fatal in header context; Connect flow handles wallet specifics
      console.debug("switchChain failed in header:", e);
    } finally {
      // Optimistically update store so UI reflects the intent immediately
      setWalletChainId(chainId);
      setIsTestnet(testnet);
      setAvalancheNetworkID(testnet ? networkIDs.FujiID : networkIDs.MainnetID);
    }
  };

  if (!walletEVMAddress) return null;

  return (
    <div className="rounded-full overflow-hidden flex bg-zinc-100 dark:bg-black p-0.5">
      <button
        onClick={() => safelySwitch(avalancheFuji.id, true)}
        className={`px-4 py-1 text-sm rounded-full transition-colors ${isTestnet
          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 font-bold'
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
      >
        Testnet
      </button>
      <button
        onClick={() => safelySwitch(avalanche.id, false)}
        className={`px-4 py-1 text-sm rounded-full transition-colors ${!isTestnet
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-bold'
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
      >
        Mainnet
      </button>
    </div>
  );
}