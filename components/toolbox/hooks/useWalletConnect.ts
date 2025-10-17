import { useWalletStore } from "../stores/walletStore";
import { networkIDs } from "@avalabs/avalanchejs";
import { createCoreWalletClient } from "../coreViem";

export function useWalletConnect() {
    const {
        setCoreWalletClient,
        setWalletEVMAddress,
        setPChainAddress,
        setCoreEthAddress,
        setWalletChainId,
        setIsTestnet,
        setAvalancheNetworkID,
        setEvmChainName,
        updateAllBalances
    } = useWalletStore();

    const connectWallet = async () => {
        if (typeof window === 'undefined') return;

        try {
            if (!window.avalanche?.request) {
                return;
            }

            const accounts = await window.avalanche.request<string[]>({
                method: 'eth_requestAccounts',
            });

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts returned from wallet');
            }

            const account = accounts[0] as `0x${string}`;
            const client = await createCoreWalletClient(account);
            if (!client) return;

            setCoreWalletClient(client);
            setWalletEVMAddress(account);

            try {
                const [pAddr, cAddr, chainInfo, chainId] = await Promise.all([
                    client.getPChainAddress().catch(() => ''),
                    client.getCorethAddress().catch(() => ''),
                    client.getEthereumChain().catch(() => ({ isTestnet: undefined as any, chainName: '' } as any)),
                    client.getChainId().catch(() => 0),
                ]);
                
                if (pAddr) setPChainAddress(pAddr);
                if (cAddr) setCoreEthAddress(cAddr);
                if (chainId) {
                    const numericId = typeof chainId === 'string' ? parseInt(chainId as any, 16) : chainId;
                    setWalletChainId(numericId);
                }
                if (typeof chainInfo?.isTestnet === 'boolean') {
                    setIsTestnet(chainInfo.isTestnet);
                    setAvalancheNetworkID(chainInfo.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID);
                    setEvmChainName(chainInfo.chainName);
                }
            } catch { }

            // Initial balance refresh after connecting
            try { 
                updateAllBalances();
            } catch { }
        } catch (error) {
            console.error('Error connecting wallet:', error);
        }
    };

    return {
        connectWallet
    };
}

