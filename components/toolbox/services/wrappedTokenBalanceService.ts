import { http, createPublicClient, formatEther } from "viem";
import WrappedNativeToken from "@/contracts/icm-contracts/compiled/WrappedNativeToken.json";

export interface WrappedTokenBalanceCallbacks {
  setWrappedBalance: (balance: string) => void;
  setLoading: (loading: boolean) => void;
  onError: (error: Error) => void;
}

export interface WrappedTokenBalanceState {
  walletEVMAddress: string;
  wrappedNativeTokenAddress: string;
  viemChain: any;
  walletChainId: number;
}

// Service class for managing wrapped token balance operations
export class WrappedTokenBalanceService {
  private callbacks: WrappedTokenBalanceCallbacks | null = null;

  setCallbacks(callbacks: WrappedTokenBalanceCallbacks) {
    this.callbacks = callbacks;
  }


  async fetchWrappedBalance(state: WrappedTokenBalanceState): Promise<string> {
    if (!this.callbacks || !state.walletEVMAddress || !state.wrappedNativeTokenAddress || !state.viemChain) {
      return '0';
    }

    try {
      this.callbacks.setLoading(true);
      
      const publicClient = createPublicClient({
        transport: http(state.viemChain.rpcUrls.default.http[0] || "")
      });
      
      const wrappedBalanceWei = await publicClient.readContract({
        address: state.wrappedNativeTokenAddress as `0x${string}`,
        abi: WrappedNativeToken.abi,
        functionName: 'balanceOf',
        args: [state.walletEVMAddress]
      });
      
      const balance = formatEther(wrappedBalanceWei as bigint);
      this.callbacks.setWrappedBalance(balance);
      return balance;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onError(errorObj);
      return '0';
    } finally {
      this.callbacks.setLoading(false);
    }
  }

}

// Export singleton instance
export const wrappedTokenBalanceService = new WrappedTokenBalanceService();
