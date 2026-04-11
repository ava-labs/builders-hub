import { useWalletStore } from "./walletStore";
import { getRegisteredFlowStores } from "./createFlowStore";
import { getL1ListStore } from "./l1ListStore";
import { getToolboxStore } from "./toolboxStore";
import type { L1ListItem } from "./l1ListStore";
import { disconnect } from "@wagmi/core";
import { wagmiConfig } from "../providers/wagmi-config";

export function resetAllStores() {
    const { isTestnet } = useWalletStore.getState();

    if (typeof isTestnet !== "boolean") {
        console.warn("isTestnet is undefined during reset. Resetting both testnet and mainnet stores.");
        getL1ListStore(true).getState().reset();
        getL1ListStore(false).getState().reset();
    } else {
        getL1ListStore(isTestnet).getState().reset();
    }

    // Reset all registered flow stores (addValidator, removeValidator, changeWeight, createChain)
    for (const store of getRegisteredFlowStores()) {
        store.reset(isTestnet);
    }

    const testnetChains = getL1ListStore(true).getState().l1List.map((l1: L1ListItem) => l1.id);
    const mainnetChains = getL1ListStore(false).getState().l1List.map((l1: L1ListItem) => l1.id);
    const allChainIds = [...new Set([...testnetChains, ...mainnetChains])];

    allChainIds.forEach((chainId) => {
        getToolboxStore(chainId).getState().reset();
    });

    // Disconnect wagmi so the page reloads with a clean wallet state
    disconnect(wagmiConfig).catch(() => {});

    window?.location.reload();
}
