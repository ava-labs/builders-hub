import React, { useState, useEffect } from 'react';
import { Button } from '../Button';
import { type Chain } from 'viem';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { utils } from "@avalabs/avalanchejs";
import { Input } from '../Input';
import { Select } from '../Select';
import { getBlockchainInfo, getSubnetInfo, getChainDetails } from '../../coreViem/utils/glacier';
import { Dialog, DialogOverlay, DialogContent, DialogTitle } from '../ui/dialog';
import { fetchChainId } from '../../lib/chainId';

interface AddChainModalProps {
    // onOpen: () => void;//FIXME: consider brining back isOpen
    onClose: () => void;
    onAddChain: (chain: {
        id: string;
        name: string;
        rpcUrl: string;
        evmChainId: number;
        coinName: string;
        isTestnet: boolean;
        subnetId: string;
        wrappedTokenAddress: string;
        validatorManagerAddress: string;
        logoUrl: string;
        wellKnownTeleporterRegistryAddress?: string;
    }) => void;
    allowLookup?: boolean;
    fixedRPCUrl?: string;
}

export const AddChainModal: React.FC<AddChainModalProps> = ({
    onClose,
    onAddChain,
    allowLookup = true,
    fixedRPCUrl,
}) => {
    const [rpcUrl, setRpcUrl] = useState(fixedRPCUrl || '');
    const [chainName, setChainName] = useState('');
    const [isTestnet, setIsTestnet] = useState(false);
    const [isAddingChain, setIsAddingChain] = useState(false);
    const [chainId, setChainId] = useState("");
    const [evmChainId, setEvmChainId] = useState(0);
    const [coinName, setCoinName] = useState("COIN");
    const [subnetId, setSubnetId] = useState("");
    const [wrappedTokenAddress, setWrappedTokenAddress] = useState("");
    const [validatorManagerAddress, setValidatorManagerAddress] = useState("");
    const [localError, setLocalError] = useState("");
    const { coreWalletClient } = useWalletStore();
    const [logoUrl, setLogoUrl] = useState("");

    // Fetch chain data when RPC URL changes
    useEffect(() => {
        async function fetchChainData() {
            setEvmChainId(0);
            setChainId("");
            setChainName("");
            setLocalError("");
            setLogoUrl(""); // reset logo

            if (!rpcUrl) return;
            if (!rpcUrl.startsWith("https://") && !rpcUrl.includes("localhost") && !rpcUrl.includes("127.0.0.1")) {
                setLocalError("The RPC URL must start with https:// or include localhost or 127.0.0.1");
                return;
            }

            try {
                const { ethereumChainId, avalancheChainId } = await fetchChainId(rpcUrl);
                setEvmChainId(ethereumChainId);
                setChainId(avalancheChainId);

                const blockchainInfo = await getBlockchainInfo(avalancheChainId);
                setSubnetId(blockchainInfo.subnetId);
                setChainName(blockchainInfo.blockchainName || "");
                setIsTestnet(blockchainInfo.isTestnet);
                setWrappedTokenAddress("");
                const subnetInfo = await getSubnetInfo(blockchainInfo.subnetId);
                setValidatorManagerAddress(subnetInfo.l1ValidatorManagerDetails?.contractAddress || "");

                // Fetch logo URL
                try {
                    const chainDetails = await getChainDetails(String(ethereumChainId));
                    setLogoUrl(chainDetails.chainLogoUri || "");
                } catch (e) {
                    setLogoUrl(""); // fallback if not found
                }
            } catch (error) {
                //Fatal error, toolbox has a hard dependency on glacier
                setLocalError((error as Error)?.message || String(error));
            }
        }

        fetchChainData();
    }, [rpcUrl]);

    useEffect(() => {
        if (fixedRPCUrl) {
            setRpcUrl(fixedRPCUrl);
        }
    }, [fixedRPCUrl]);

    async function handleAddChain() {

        if (!coreWalletClient) {
            setLocalError("Core wallet not found");
            return;
        }

        try {
            setIsAddingChain(true)

            const viemChain: Chain = {
                id: evmChainId,
                name: chainName,
                rpcUrls: {
                    default: { http: [rpcUrl] },
                },
                nativeCurrency: {
                    name: coinName,
                    symbol: coinName,
                    decimals: 18,
                }
            }

            await coreWalletClient.addChain({ chain: { ...viemChain, isTestnet: isTestnet } });
            await coreWalletClient.switchChain({
                id: evmChainId,
            });

            onAddChain({
                id: chainId,
                name: chainName,
                rpcUrl: rpcUrl,
                evmChainId: evmChainId,
                coinName: coinName,
                isTestnet: isTestnet,
                subnetId: subnetId,
                wrappedTokenAddress: wrappedTokenAddress,
                validatorManagerAddress: validatorManagerAddress,
                logoUrl: logoUrl,
            });
            onClose();
        } catch (error) {
            console.error("Failed to add chain:", error);
            setLocalError((error as Error)?.message || String(error));
        } finally {
            setIsAddingChain(false);
        }
    }

    return (
        <Dialog.Root open={true} onOpenChange={() => onClose()}>
            <Dialog.Portal>
                <DialogOverlay />
                <DialogContent>
                    <DialogTitle>
                        Add an existing Avalanche L1
                    </DialogTitle>

                    {logoUrl && (
                        <div className="flex justify-center mb-4">
                            <img src={logoUrl} alt="Chain Logo" className="h-12 w-12 rounded-full" />
                        </div>
                    )}

                    <div className="space-y-4">
                        {allowLookup && (
                            <LoadFromCoreWallet onLookup={({ rpcUrl, coinName }: { rpcUrl: string, coinName: string }) => {
                                setRpcUrl(rpcUrl);
                                setCoinName(coinName);
                            }} />
                        )}

                        {localError && (
                            <div className="text-red-500 mb-4">
                                {localError}
                            </div>
                        )}

                        <Input
                            id="rpcUrl"
                            label="RPC URL"
                            value={rpcUrl}
                            onChange={setRpcUrl}
                            // placeholder={fixedRPCUrl ? fixedRPCUrl : "https://api.mychain.com"}
                            disabled={!!fixedRPCUrl}
                        />

                        <Input
                            id="name"
                            label="Coin Name (Symbol)"
                            value={coinName}
                            onChange={setCoinName}
                            placeholder="MYCOIN"
                        />

                        <Input
                            label="Chain Name"
                            value={chainName}
                            onChange={setChainName}
                            placeholder="MYCHAIN"
                        />

                        <Input
                            id="chainId"
                            label="EVM Chain ID"
                            value={evmChainId || ""}
                            disabled={true}
                            placeholder="Detected EVM chain ID"
                        />

                        <Input
                            id="avalancheChainId"
                            label="Avalanche Chain ID (base58)"
                            value={chainId}
                            disabled={true}
                        />

                        <Input
                            label="Validator Manager Address"
                            value={validatorManagerAddress}
                            disabled={true}
                            placeholder="0x1234567890123456789012345678901234567890"
                        />

                        <Input
                            label="Logo URL"
                            value={logoUrl}
                            disabled={true}
                        />

                        <Select
                            label="Is Testnet"
                            value={isTestnet ? "Yes" : "No"}
                            onChange={() => { }}
                            disabled={true}
                            options={[
                                { label: "Yes", value: "Yes" },
                                { label: "No", value: "No" },
                            ]}
                        />
                    </div>


                    <div className="flex justify-end space-x-3 mt-6">
                        <Button
                            onClick={onClose}
                            className="bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-black dark:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddChain}
                            className="bg-black hover:bg-zinc-800 text-white"
                            loading={isAddingChain}
                            disabled={!chainName || !coinName || !rpcUrl || !chainId || !evmChainId}
                        >
                            Add Chain
                        </Button>
                    </div>
                </DialogContent>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
function LoadFromCoreWallet({ onLookup }: { onLookup: ({ rpcUrl, coinName }: { rpcUrl: string, coinName: string }) => void }) {
    const [anyChainId, setAnyChainId] = useState("");
    const [localError, setLocalError] = useState("");
    const { coreWalletClient, walletChainId } = useWalletStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);

    useEffect(() => {
        setAnyChainId(walletChainId.toString());
    }, [walletChainId]);

    async function lookup() {

        if (!coreWalletClient) {
            setLocalError("Core wallet not found");
            return;
        }

        setLocalError("");
        setIsLookingUp(true);
        try {
            let evmChainId: number;

            if (/^[0-9]+$/.test(anyChainId)) {
                evmChainId = parseInt(anyChainId, 10);
            } else {
                try {
                    utils.base58check.decode(anyChainId); // Validate Avalanche Chain ID format
                    const chain = await getBlockchainInfo(anyChainId);
                    evmChainId = chain.evmChainId;
                } catch (e) {
                    console.error("Failed to lookup chain:", e);
                    setLocalError("Invalid chain ID. Please enter either a valid EVM chain ID number or an Avalanche blockchain ID in base58 format.");
                    return;
                }
            }

            await coreWalletClient.switchChain({
                id: evmChainId,
            });

            const evmInfo = await coreWalletClient.getEthereumChain();
            onLookup({ rpcUrl: evmInfo.rpcUrls[0], coinName: evmInfo.nativeCurrency.name });
            setIsOpen(false);
        } catch (e) {
            console.error("Failed to lookup chain:", e);
            setLocalError("Failed to lookup chain. Please try again.");
        } finally {
            setIsLookingUp(false);
        }
    }

    return (
        <div>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-blue-500 border-b border-dashed border-blue-500 hover:text-blue-700 focus:outline-none"
            >
                {isOpen ? "Hide lookup form" : "Lookup from Core Wallet"}
            </button>

            {isOpen && (
                <div className="mt-3">
                    <Input
                        id="anyChainId"
                        label="Chain ID (EVM number or Avalanche base58 format)"
                        value={anyChainId}
                        onChange={setAnyChainId}
                        placeholder="e.g. 43114 or 2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5"
                        error={localError}
                        button={<Button stickLeft onClick={lookup} loading={isLookingUp}>Lookup</Button>}
                    />
                </div>
            )}
        </div>
    );
}
