import { useWalletStore } from "../lib/walletStore";
import { Chain } from "viem/chains";
import { Button } from "./Button";
import { useState } from "react";
import { useErrorBoundary } from "react-error-boundary";

export function RequireChain({ children, chain }: { children: React.ReactNode, chain: Chain }) {
    const { walletChainId, coreWalletClient } = useWalletStore();
    const [isSwitching, setIsSwitching] = useState(false);
    const { showBoundary } = useErrorBoundary();

    async function switchToChain() {
        try {
            setIsSwitching(true);
            await coreWalletClient.addChain({ chain: chain });
            await coreWalletClient.switchChain({ id: chain.id });
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsSwitching(false);
        }
    }

    if (isSwitching) {
        return <div className="text-center py-4">Please confirm the switch in your wallet.</div>
    }

    if (walletChainId === chain.id) {
        return children;
    }

    return (
        <div className="space-y-8 my-16">
            <div className="max-w-md mx-auto space-y-6">
                <div className="space-y-2">
                    <h3 className="text-lg font-medium">Chain Switch Required</h3>
                    <p className="text-sm text-gray-600">
                        This action requires the {chain.name} network
                    </p>
                </div>

                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Chain ID:</span>
                        <span className="font-mono">{chain.id}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Currency:</span>
                        <span>{chain.nativeCurrency.symbol}</span>
                    </div>
                </div>

                <Button onClick={switchToChain} className="w-full">
                    Switch to {chain.name}
                </Button>
            </div>

            <div className="opacity-50 pointer-events-none">
                {children}
            </div>
        </div>
    );
}
