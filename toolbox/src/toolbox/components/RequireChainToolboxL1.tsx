import L1Form from "./L1Form";
import { useToolboxStore, useViemChainStore } from "../toolboxStore"
import { useWalletStore } from "../../lib/walletStore"
import { avalancheFuji } from "viem/chains";
import { RequireChain } from "../../components/RequireChain";

export function RequireChainToolboxL1({ children }: { children: React.ReactNode }) {
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


export function RequireChainToolbox({ children, requireChain }: { children: React.ReactNode, requireChain: "L1" | "C-Chain" }) {
    if (requireChain === "L1") {
        return <RequireChainToolboxL1>{children}</RequireChainToolboxL1>
    }

    return <RequireChain chain={avalancheFuji}>{children}</RequireChain>
}
