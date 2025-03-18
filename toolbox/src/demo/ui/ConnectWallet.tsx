import { useState, useEffect } from "react";
import { Button } from "./Button";
import { useErrorBoundary } from "react-error-boundary";
import { Wallet } from "lucide-react";
import { useExampleStore } from "../utils/store";


export const ConnectWallet = ({ children, required }: { children: React.ReactNode, required: boolean }) => {
    const { walletChainId, setWalletChainId, walletEVMAddress, setWalletEVMAddress, setXpPublicKey } = useExampleStore();
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [hasWallet, setHasWallet] = useState<boolean>(false);
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const { showBoundary } = useErrorBoundary();
    const [isConnecting, setIsConnecting] = useState(false);


    useEffect(() => {
        setHasWallet(!!window.avalanche);
    }, []);

    async function connectWallet() {
        setIsConnecting(true);
        try {
            const accounts = await window.avalanche?.request<string[]>({
                method: "eth_requestAccounts",
            });
            if (!accounts?.[0]) {
                throw new Error("No accounts found");
            }

            // Request public keys after connecting
            const pubkeys = await window.avalanche?.request<{ xp: string, evm: string }>({
                method: "avalanche_getAccountPubKey",
            });
            if (!pubkeys) {
                throw new Error("Failed to get public keys");
            }

            setWalletEVMAddress(accounts[0]);
            setXpPublicKey(pubkeys.xp);
            setIsConnected(true);
        } catch (error) {
            showBoundary(error as Error);
        } finally {
            setIsConnecting(false);
        }
    }

    useEffect(() => {
        window.avalanche?.request<string[]>({
            method: "eth_accounts",
        }).then(async (accounts) => {
            if (accounts.length > 0) {
                console.log(`ConnectWallet:Connected to ${accounts[0]}`);
                setWalletEVMAddress(accounts[0]);

                // Get public keys for already connected account
                const pubkeys = await window.avalanche?.request<{ xp: string, evm: string }>({
                    method: "avalanche_getAccountPubKey",
                });
                if (pubkeys) {
                    setXpPublicKey(pubkeys.xp);
                }

                setIsConnected(true);
            } else {
                console.log(`ConnectWallet:Not connected`);
                setIsConnected(false);
            }
        }).catch((error) => {
            console.log(`ConnectWallet:Error connecting to wallet: ${error}`);
        }).finally(() => {
            setIsLoaded(true);
        });
    }, []);

    useEffect(() => {
        // Initial chain ID check
        window.avalanche?.request<string>({
            method: "eth_chainId",
        }).then((id) => {
            setWalletChainId(parseInt(id, 16));
        }).catch(console.error);

        // Subscribe to chain changes
        window.avalanche?.on("chainChanged", (newChainId: string) => {
            setWalletChainId(parseInt(newChainId, 16));
        });

        // Subscribe to account changes
        window.avalanche?.on("accountsChanged", async (accounts: string[]) => {
            if (accounts.length > 0) {
                setWalletEVMAddress(accounts[0]);

                // Get public keys for already connected account
                const pubkeys = await window.avalanche?.request<{ xp: string, evm: string }>({
                    method: "avalanche_getAccountPubKey",
                });
                if (pubkeys) {
                    setXpPublicKey(pubkeys.xp);
                }

                setIsConnected(true);
            } else {
                setWalletEVMAddress("");
                setIsConnected(false);
            }
        });

        return () => {
            window.avalanche?.removeListener("chainChanged", () => { });
            window.avalanche?.removeListener("accountsChanged", () => { });
        };
    }, []);

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

    if (required && !isConnected && isLoaded) {
        return (
            <div className="space-y-2">
                <Button onClick={connectWallet} icon={<Wallet className="w-4 h-4 mr-2" />} loading={isConnecting}>
                    Connect Wallet
                </Button>
            </div>
        );
    }

    if (required && !isLoaded) {
        return null;
    }

    return (
        <div className={`space-y-4 transition`}>
            {walletEVMAddress && <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-4 min-w-0">
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
                    <div className="text-sm flex-3 min-w-0">
                        Chain ID: <span className="font-mono truncate whitespace-nowrap overflow-hidden text-ellipsis block">{walletChainId}</span>
                    </div>
                )}
            </div>}
            {children}
        </div>
    );
};
