import { useWalletStore } from "../stores/walletStore";
import { networkIDs } from "@avalabs/avalanchejs";

export function useWalletSwitch() {
    const { coreWalletClient, setWalletChainId, setIsTestnet, setAvalancheNetworkID } = useWalletStore();

    const safelySwitch = async (chainId: number, testnet: boolean) => {
        if (!coreWalletClient) {
            console.debug("No wallet client available for switching");
            return;
        }

        try {
            await coreWalletClient.switchChain({ id: chainId });
            // Only update store if the switch was successful
            setWalletChainId(chainId);
            setIsTestnet(testnet);
            setAvalancheNetworkID(testnet ? networkIDs.FujiID : networkIDs.MainnetID);
        } catch (e) {
            // Non-fatal in header context; Connect flow handles wallet specifics
            console.debug("switchChain failed:", e);
            // Don't update state when switch fails
        }
    };

    return {
        safelySwitch
    };
}
