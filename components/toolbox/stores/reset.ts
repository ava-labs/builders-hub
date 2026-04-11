import { useWalletStore } from "./walletStore";
import { getCreateChainStore } from "./createChainStore";
import { getL1ListStore } from "./l1ListStore";
import { getToolboxStore } from "./toolboxStore";
import { getAddValidatorStore } from "./addValidatorStore";
import { getChangeWeightStore } from "./changeWeightStore";
import { getRemoveValidatorStore } from "./removeValidatorStore";
import type { L1ListItem } from "./l1ListStore";
import { disconnect } from "@wagmi/core";
import { wagmiConfig } from "../providers/wagmi-config";

export function resetAllStores() {
    const { isTestnet } = useWalletStore.getState();

    if (typeof isTestnet !== "boolean") {
        console.warn("isTestnet is undefined during reset. Resetting both testnet and mainnet stores.");
        getCreateChainStore(true).getState().reset();
        getCreateChainStore(false).getState().reset();
        getL1ListStore(true).getState().reset();
        getL1ListStore(false).getState().reset();
        getAddValidatorStore(true).getState().reset();
        getAddValidatorStore(false).getState().reset();
        getChangeWeightStore(true).getState().reset();
        getChangeWeightStore(false).getState().reset();
        getRemoveValidatorStore(true).getState().reset();
        getRemoveValidatorStore(false).getState().reset();
    } else {
        getCreateChainStore(isTestnet).getState().reset();
        getL1ListStore(isTestnet).getState().reset();
        getAddValidatorStore(isTestnet).getState().reset();
        getChangeWeightStore(isTestnet).getState().reset();
        getRemoveValidatorStore(isTestnet).getState().reset();
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
