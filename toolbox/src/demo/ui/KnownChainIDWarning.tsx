
export const knownNetworks: Record<number, string> = {
    43114: "Avalanche Mainnet",
    43113: "Avalanche Fuji Testnet",
    43117: "Avalanche Devnet",
};


export default function KnownChainIDWarning({ walletChainId }: { walletChainId: number }) {
    return knownNetworks[walletChainId] && (
        <div className="mb-4">
            ⚠️ Warning: You are connected to {knownNetworks[walletChainId]}, not to your L1.
        </div>
    )

}
