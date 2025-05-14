import { useWalletStore } from "./walletStore";
import { getCreateChainStore } from "./createChainStore";
import { getL1ListStore } from "./l1ListStore";
import { getToolboxStore } from "./toolboxStore";

export function resetAllStores() {
    const { isTestnet } = useWalletStore.getState();

    if (typeof isTestnet !== "boolean") {
        console.warn("isTestnet is undefined during reset. Resetting both testnet and mainnet stores.");
        getCreateChainStore(true).getState().reset();
        getCreateChainStore(false).getState().reset();
        getL1ListStore(true).getState().reset();
        getL1ListStore(false).getState().reset();
    } else {
        getCreateChainStore(isTestnet).getState().reset();
        getL1ListStore(isTestnet).getState().reset();
    }

    const testnetChains = getL1ListStore(true).getState().l1List.map((l1) => l1.id);
    const mainnetChains = getL1ListStore(false).getState().l1List.map((l1) => l1.id);
    const allChainIds = [...new Set([...testnetChains, ...mainnetChains])];

    allChainIds.forEach((chainId) => {
        getToolboxStore(chainId).getState().reset();
    });

    window?.location.reload();
}
