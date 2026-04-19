/**
 * @deprecated Use RainbowKit's `useConnectModal` instead for console flows.
 * This hook is kept only for `components/explorer/ContractWriteSection.tsx`
 * which lives outside the console WagmiProvider tree.
 */
export function useWalletConnect() {
  const connectWallet = async () => {
    if (typeof window === 'undefined') return;

    if (window.ethereum?.request) {
      try {
        await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    }
  };

  return {
    connectWallet,
  };
}
