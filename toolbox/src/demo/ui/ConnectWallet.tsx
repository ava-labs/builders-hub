import { useState, useEffect } from "react";
import { Button } from "./Button";
import { useErrorBoundary } from "react-error-boundary";
import { Wallet } from "lucide-react";
import { useWalletStore } from "../utils/store";
import { createCoreWalletClient } from "../../coreViem";
import { networkIDs } from "@avalabs/avalanchejs";

export const ConnectWallet = ({ children, required }: { children: React.ReactNode, required: boolean }) => {
    const { setWalletChainId, walletEVMAddress, setWalletEVMAddress, setCoreWalletClient, coreWalletClient, setAvalancheNetworkID, setPChainAddress, walletChainId, /*avalancheNetworkID*/ } = useWalletStore();
    const [hasWallet, setHasWallet] = useState<boolean>(false);
    const { showBoundary } = useErrorBoundary();

    function handleAccountsChanged(accounts: string[]) {
        if (accounts.length === 0) {
            setWalletEVMAddress("");
            return
        } else if (accounts.length > 1) {
            showBoundary(new Error("Multiple accounts found, we don't support that yet"));
            return
        }

        //re-create wallet with new account
        setCoreWalletClient(createCoreWalletClient(accounts[0] as `0x${string}`));
        setWalletEVMAddress(accounts[0] as `0x${string}`);

        coreWalletClient.getPChainAddress().then(setPChainAddress).catch(showBoundary);

        if (walletChainId === 0) {
            coreWalletClient.getChainId().then(onChainChanged).catch(showBoundary);
        }
    }

    const onChainChanged = (chainId: string | number) => {
        if (typeof chainId === "string") {
            chainId = parseInt(chainId, 16);
        }

        setWalletChainId(chainId);
        coreWalletClient.getPChainAddress().then(setPChainAddress).catch(showBoundary);

        coreWalletClient.isTestnet().then((isTestnet) => {
            setAvalancheNetworkID(isTestnet ? networkIDs.FujiID : networkIDs.MainnetID);
        }).catch(showBoundary);
    }

    useEffect(() => {
        async function init() {
            try {
                //first, let's check if there is a wallet at all
                if (window.avalanche) {
                    setHasWallet(true);
                } else {
                    setHasWallet(false);
                    return
                }

                window.avalanche?.on("accountsChanged", handleAccountsChanged);
                window.avalanche.on("chainChanged", onChainChanged);

                try {
                    const accounts = await window.avalanche?.request<string[]>({ method: "eth_accounts" });
                    if (accounts) {
                        handleAccountsChanged(accounts);
                    }
                } catch (error) {
                    //Ignore error, it's expected if the user has not connected their wallet yet
                }
            } catch (error) {
                showBoundary(error);
            }
        }
        init();
    }, []);

    async function connectWallet() {
        console.log("Connecting wallet");
        window.avalanche?.request<string[]>({ method: "eth_requestAccounts" }).catch((error) => {
            showBoundary(error);
        }).then((accounts?: string[] | void) => {
            if (accounts) {
                handleAccountsChanged(accounts);
            }
        });
    }

    if (required && !hasWallet) {
        return (
            <div className="space-y-2">
                <p>Core wallet is required for most of these tools.</p>
                <a
                    href="https://chromewebstore.google.com/detail/core-crypto-wallet-nft-ex/agoakfejjabomempkjlepdflaleeobhb"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Button>Download Core Wallet</Button>
                </a>
            </div>
        );
    }

    if (required && !walletEVMAddress) {
        return (
            <div className="space-y-2">
                <Button onClick={connectWallet} icon={<Wallet className="w-4 h-4 mr-2" />}>
                    Connect Wallet
                </Button>
            </div>
        );
    }

    return (
        <div className={`space-y-4 transition`}>
            {walletEVMAddress && <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="p-2 rounded-full">
                        <Wallet className="w-6 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm">Connected to</div>
                        <div className="font-mono truncate whitespace-nowrap overflow-hidden text-ellipsis block">
                            {walletEVMAddress}
                        </div>
                    </div>
                </div>
                {walletChainId && (
                    <div className="text-sm flex items-center gap-2 ml-auto">
                        <span className="dark:text-zinc-300 whitespace-nowrap">Chain ID: {walletChainId}</span>

                        {/*<span className={`px-2 py-0.5 rounded-full text-xs font-medium ${avalancheNetworkID === networkIDs.FujiID ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-100' : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'}`}>
                            {avalancheNetworkID === networkIDs.FujiID ? "Testnet" : "Mainnet"}
                        </span>*/}{/* TODO: restore after wallet_getEthereumChain is restored in Core */}
                    </div>
                )}
            </div>}
            {children}
        </div>
    );
};
