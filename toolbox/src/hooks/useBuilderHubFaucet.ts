import { useWalletStore } from "../stores/walletStore";
import { useL1List, type L1ListItem } from "../stores/l1ListStore";

export const useBuilderHubFaucet = () => {
  const { walletEVMAddress } = useWalletStore();
  const l1List = useL1List();

  const requestTokens = async (chainId: number): Promise<{ success: boolean; txHash?: string; message?: string }> => {
    if (!walletEVMAddress) { throw new Error("Wallet address is required") }

    const chainConfig = l1List.find((chain: L1ListItem) => chain.evmChainId === chainId && chain.hasBuilderHubFaucet);
    if (!chainConfig) { throw new Error(`Unsupported chain or faucet not available for chain ID ${chainId}`) }

    const response = await fetch(`/api/evm-chain-faucet?address=${walletEVMAddress}&chainId=${chainId}`);
    const rawText = await response.text();
    
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error(`Invalid response: ${rawText.substring(0, 100)}...`);
    }

    if (!response.ok) {
      if (response.status === 401) { throw new Error("Please login first") }
      if (response.status === 429) { throw new Error(data.message || "Rate limit exceeded. Please try again later.") }
      throw new Error(data.message || `Error ${response.status}: Failed to get tokens`);
    }

    if (!data.success) { throw new Error(data.message || "Failed to get tokens") }
    
    return data;
  };

  return { requestTokens };
};
