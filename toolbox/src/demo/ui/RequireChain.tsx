import L1Form from "../examples/Wallet/L1Form";
import { useErrorBoundary } from "react-error-boundary";
import { useToolboxStore, useViemChainStore, useWalletStore } from "../utils/store";


export function RequireChainL1({ children }: { children: React.ReactNode }) {
    const { walletChainId } = useWalletStore();
    const { evmChainId } = useToolboxStore();
    const viemChain = useViemChainStore();

    if (walletChainId === evmChainId && !!viemChain) {
        return children;
    }

    return <>
        <div className="space-y-4">
            <div >
                Before you continue, please switch Core wallet to your L1 using form below:
            </div>
            <L1Form />
            <div className="opacity-50 pointer-events-none">
                {children}
            </div>
        </div>
    </>
}

import { avalancheFuji } from "viem/chains";
import { Button } from "./Button";
import { useState } from "react";

export function RequireChainFuji({ children }: { children: React.ReactNode }) {
    const { walletChainId, coreWalletClient } = useWalletStore();
    const [isSwitching, setIsSwitching] = useState(false);
    const { showBoundary } = useErrorBoundary();

    async function switchToFuji() {
        try {
            setIsSwitching(true);
            await coreWalletClient.addChain({ chain: avalancheFuji });
            await coreWalletClient.switchChain({ id: avalancheFuji.id });
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsSwitching(false);
        }
    }

    if (isSwitching) {
        return <div>Please confirm the switch in your wallet.</div>
    }

    if (walletChainId === avalancheFuji.id) {
        return children;
    }

    if (walletChainId !== avalancheFuji.id) {
        return <>
            <div className="mb-4">
                Before you continue, please switch to Fuji network using form below:
            </div>
            <div className="p-4 rounded-lg border border-gray-500">
                <Button onClick={switchToFuji}>
                    Switch to Fuji
                </Button>
            </div>
            <div className="opacity-50 pointer-events-none">
                {children}
            </div>
        </>
    }
}
