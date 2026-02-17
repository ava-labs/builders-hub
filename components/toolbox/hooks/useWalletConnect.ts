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
        setWalletType,
        updateAllBalances
    } = useWalletStore();

    const connectWallet = async () => {
        if (typeof window === 'undefined') return;

        // Try Core Wallet first (window.avalanche)
        if (window.avalanche?.request) {
            try {
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
                setWalletType('core');

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

                try {
                    updateAllBalances();
                } catch { }

                return;
            } catch (error) {
                console.error('Error connecting Core wallet:', error);
            }
        }

        // Fall back to generic EVM wallet (window.ethereum) — MetaMask, Rabby, etc.
        if (window.ethereum?.request) {
            try {
                const accounts = await window.ethereum.request({
                    method: 'eth_requestAccounts',
                }) as string[];

                if (!accounts || accounts.length === 0) {
                    throw new Error('No accounts returned from wallet');
                }

                const account = accounts[0] as `0x${string}`;
                setWalletEVMAddress(account);
                setCoreWalletClient(null);
                setWalletType('generic-evm');

                // Get chain ID from the generic provider
                try {
                    const chainIdHex = await window.ethereum.request({
                        method: 'eth_chainId',
                    }) as string;
                    const numericId = parseInt(chainIdHex, 16);
                    setWalletChainId(numericId);

                    // Determine testnet from well-known Avalanche chain IDs
                    const isTestnet = numericId === 43113; // Fuji
                    setIsTestnet(isTestnet);
                    setAvalancheNetworkID(isTestnet ? networkIDs.FujiID : networkIDs.MainnetID);
                } catch { }

                try {
                    updateAllBalances();
                } catch { }
            } catch (error) {
                console.error('Error connecting wallet:', error);
            }
        }
    };

    return {
        connectWallet
    };
}
