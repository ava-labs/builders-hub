"use client"
import { useEffect, useState, useCallback, useRef } from "react"
import { Loader2, ChevronDown, Info } from "lucide-react"
import { Button } from "./Button"
import { Input } from "./Input"
import { Container } from "./Container"
import { useWalletStore } from "../stores/walletStore"
import { evmImportTx } from "../coreViem/methods/evmImport"
import { evmExport } from "../coreViem/methods/evmExport"
import { pvmImport } from "../coreViem/methods/pvmImport"
import { pvmExport } from "../coreViem/methods/pvmExport"
import { pvm, Utxo, TransferOutput, evm } from '@avalabs/avalanchejs'
import { getRPCEndpoint } from '../coreViem/utils/rpc'
import { useErrorBoundary } from "react-error-boundary"
import { CheckWalletRequirements } from "./CheckWalletRequirements"
import { WalletRequirementsConfigKey } from "../hooks/useWalletRequirements"

export default function CrossChainTransfer({
    suggestedAmount = "0.0",
    onAmountChange,
    onTransferComplete
}: {
    suggestedAmount?: string;
    onAmountChange?: (amount: string) => void;
    onTransferComplete?: () => void;
} = {}) {

    const [amount, setAmount] = useState<string>(suggestedAmount)
    const [sourceChain, setSourceChain] = useState<string>("c-chain")
    const [destinationChain, setDestinationChain] = useState<string>("p-chain")
    const [exportLoading, setExportLoading] = useState<boolean>(false)
    const [importLoading, setImportLoading] = useState<boolean>(false)
    const [exportTxId, setExportTxId] = useState<string>("")
    const [completedExportTxId, setCompletedExportTxId] = useState<string>("")
    const [importTxId, setImportTxId] = useState<string | null>(null)
    const [_, setCurrentStep] = useState<number>(1)
    const [showSourceDropdown, setShowSourceDropdown] = useState<boolean>(false)
    const [showDestinationDropdown, setShowDestinationDropdown] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [importError, setImportError] = useState<string | null>(null)
    const [cToP_UTXOs, setC_To_P_UTXOs] = useState<Utxo<TransferOutput>[]>([])
    const [pToC_UTXOs, setP_To_C_UTXOs] = useState<Utxo<TransferOutput>[]>([])
    const isFetchingRef = useRef(false)
    
    const { showBoundary } = useErrorBoundary()

    const { 
        pChainAddress, 
        walletEVMAddress, 
        coreWalletClient, 
        publicClient, 
        isTestnet, 
        coreEthAddress,
        cChainBalance,
        pChainBalance,
        updateCChainBalance,
        updatePChainBalance
    } = useWalletStore()

    // Calculate total AVAX in UTXOs
    const totalCToPUtxoAmount = cToP_UTXOs.reduce((sum, utxo) => {
        return sum + Number(utxo.output.amt.value()) / 1_000_000_000;
    }, 0);

    const totalPToCUtxoAmount = pToC_UTXOs.reduce((sum, utxo) => {
        return sum + Number(utxo.output.amt.value()) / 1_000_000_000;
    }, 0);

    const onBalanceChanged = useCallback(() => {
        updateCChainBalance()?.catch(showBoundary)
        updatePChainBalance()?.catch(showBoundary);
    }, [updateCChainBalance, updatePChainBalance, showBoundary]);

    // Fetch UTXOs from both chains
    const fetchUTXOs = useCallback(async () => {
        if (!pChainAddress || !walletEVMAddress || isFetchingRef.current) return false;

        isFetchingRef.current = true;

        // Store previous counts for comparison
        const prevCToPCount = cToP_UTXOs.length;
        const prevPToCCount = pToC_UTXOs.length;

        try {
            const platformEndpoint = getRPCEndpoint(Boolean(isTestnet));
            const pvmApi = new pvm.PVMApi(platformEndpoint);

            const cChainUTXOs = await pvmApi.getUTXOs({
                addresses: [pChainAddress],
                sourceChain: 'C'
            });
            setC_To_P_UTXOs(cChainUTXOs.utxos as Utxo<TransferOutput>[]);

            const evmApi = new evm.EVMApi(platformEndpoint);

            // Get P-chain UTXOs (for P->C transfers)
            const pChainUTXOs = await evmApi.getUTXOs({
                addresses: [coreEthAddress],
                sourceChain: 'P'
            });
            setP_To_C_UTXOs(pChainUTXOs.utxos as Utxo<TransferOutput>[]);

            // Check if the number of UTXOs has changed
            const newCToPCount = cChainUTXOs.utxos.length;
            const newPToCCount = pChainUTXOs.utxos.length;

            // Return true if UTXOs count changed
            return prevCToPCount !== newCToPCount || prevPToCCount !== newPToCCount;
        } catch (e) {
            console.error("Error fetching UTXOs:", e);
            return false;
        } finally {
            isFetchingRef.current = false;
        }
    }, [pChainAddress, walletEVMAddress, coreEthAddress, isTestnet, cToP_UTXOs.length, pToC_UTXOs.length]);

    const pollForUTXOChanges = useCallback(async () => {
        try {
            for (let i = 0; i < 10; i++) {
                await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
                const utxosChanged = await fetchUTXOs();

                // Break the loop if UTXOs changed
                if (utxosChanged) {
                    break;
                }
            }
        } catch (e) {
            showBoundary(`Error fetching UTXOs: ${e}`);
        }
    }, [fetchUTXOs, showBoundary]);

    // Initial fetch of UTXOs and balances
    useEffect(() => {
        if (publicClient && walletEVMAddress) {
            fetchUTXOs();
            onBalanceChanged();
        }
    }, [publicClient, walletEVMAddress, pChainAddress, fetchUTXOs, onBalanceChanged])

    // Persistent polling for pending export UTXOs
    useEffect(() => {
        if (!walletEVMAddress || !pChainAddress) return;
        let interval: NodeJS.Timeout | undefined;
        let stopped = false;
        const poll = async () => {
            if (stopped) return;
            await fetchUTXOs();
        };
        // Poll every 5 seconds
        interval = setInterval(poll, 5000);
        // Initial fetch
        poll();
        return () => {
            stopped = true;
            if (interval) clearInterval(interval);
        };
    }, [walletEVMAddress, pChainAddress, fetchUTXOs]);

    const handleMaxAmount = () => {
        if (sourceChain === "c-chain") {
            setAmount(cChainBalance.toString())
        } else {
            setAmount(pChainBalance.toString())
        }
        setError(null);
        setCurrentStep(2);
    }

    // Handler to swap source and destination chains
    const handleSwapChains = () => {
        const tempChain = sourceChain
        setSourceChain(destinationChain)
        setDestinationChain(tempChain)
        setError(null);
        setImportError(null);
    }

    // Handle amount change with step update
    const handleAmountChange = (newAmount: string) => {
        if (/^\d*\.?\d*$/.test(newAmount) || newAmount === "") {
            setAmount(newAmount);
            onAmountChange?.(newAmount);
            setError(null);

            // If amount is valid, move to step 2
            if (Number(newAmount) > 0) {
                setCurrentStep(2);
            } else {
                setCurrentStep(1);
            }
        }
    }

    const validateAmount = (): boolean => {
        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError("Please enter a valid positive amount.");
            return false;
        }
        
        const currentBalance = sourceChain === "c-chain" ? cChainBalance : pChainBalance;
        if (numericAmount > currentBalance) {
            setError(`Amount exceeds available balance of ${currentBalance.toFixed(4)} AVAX.`);
            return false;
        }
        
        setError(null);
        return true;
    };

    // Add handlers for buttons
    const handleExport = async () => {
        if (!validateAmount()) return;
        
        if (typeof window === 'undefined' || !walletEVMAddress || !pChainAddress || !coreWalletClient) {
            setError("Wallet not connected or required data missing.");
            return;
        }

        setCurrentStep(3); // Move to step 3 when export is initiated
        setExportLoading(true);
        setError(null);

        try {
            if (sourceChain === "c-chain") {
                // C-Chain to P-Chain export using the evmExport function
                const response = await evmExport(coreWalletClient, {
                    amount,
                    pChainAddress,
                    walletEVMAddress
                });

                console.log("Export transaction sent:", response);
                // Store the export transaction ID to trigger import
                const txId = response.txID || String(response);
                setExportTxId(txId);
                setCompletedExportTxId(txId);
            } else {
                // P-Chain to C-Chain export using the pvmExport function
                const response = await pvmExport(coreWalletClient, {
                    amount,
                    pChainAddress
                });

                console.log("P-Chain Export transaction sent:", response);
                const txId = response.txID || String(response);
                setExportTxId(txId);
                setCompletedExportTxId(txId);
            }

            await pollForUTXOChanges();
            onBalanceChanged();
            
        } catch (error) {
            showBoundary(error);
            let msg = 'Unknown error';
            if (error instanceof Error) msg = error.message;
            setError(`Export failed: ${msg}`);
            console.error("Error sending export transaction:", error);
        } finally {
            setExportLoading(false);
        }
    }

    const handleImport = async () => {
        if (typeof window === 'undefined' || !walletEVMAddress || !pChainAddress || !coreWalletClient) {
            setImportError("Wallet not connected or required data missing.");
            return;
        }

        setImportLoading(true);
        setImportError(null);

        try {
            if (destinationChain === "p-chain") {
                // Import to P-Chain using pvmImport function
                const response = await pvmImport(coreWalletClient, {
                    pChainAddress
                });
                console.log("Import transaction sent:", response);
                if (typeof response === 'object' && response !== null && 'txID' in response) {
                    setImportTxId((response as any).txID);
                } else {
                    setImportTxId(String(response));
                }
            } else {
                // Import to C-Chain using evmImportTx function
                const response = await evmImportTx(coreWalletClient, {
                    walletEVMAddress
                });
                console.log("C-Chain Import transaction sent:", response);
                if (typeof response === 'object' && response !== null && 'txID' in response) {
                    setImportTxId((response as any).txID);
                } else {
                    setImportTxId(String(response));
                }
            }

            await pollForUTXOChanges();
            onBalanceChanged();

            onTransferComplete?.();
        } catch (error) {
            console.error("Error sending import transaction:", error);
            let msg = 'Unknown error';
            if (error instanceof Error) msg = error.message;
            setImportError(`Import failed: ${msg}`);
        } finally {
            setImportLoading(false);
            // Clear export transaction ID after import is done
            setExportTxId("");
        }
    }

    // Chain option components
    const ChainOption = ({ chain, label, description }: { chain: string, label: string, description: string }) => (
        <div className="flex items-center p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer rounded-md">
            <div className="rounded-full w-8 h-8 flex items-center justify-center mr-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                {chain === "c-chain" ? (
                    <img
                        src="https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
                        alt="C-Chain Logo"
                        className="h-6 w-6"
                    />
                ) : (
                    <img
                        src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
                        alt="P-Chain Logo"
                        className="h-6 w-6"
                    />
                )}
            </div>
            <div>
                <div className="font-medium text-zinc-900 dark:text-white">{label}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{description}</div>
            </div>
        </div>
    );

    // Get the available UTXOs based on current direction
    const availableUTXOs = destinationChain === "p-chain" ? cToP_UTXOs : pToC_UTXOs;
    const totalUtxoAmount = destinationChain === "p-chain" ? totalCToPUtxoAmount : totalPToCUtxoAmount;

    // Auto-switch to direction with pending UTXOs
    useEffect(() => {
        if (!exportTxId && !completedExportTxId && !importTxId) {
            // Only auto-switch when no active transfer
            if (cToP_UTXOs.length > 0 && pToC_UTXOs.length === 0) {
                // Only C→P UTXOs, switch to C→P direction
                setSourceChain("c-chain");
                setDestinationChain("p-chain");
            } else if (pToC_UTXOs.length > 0 && cToP_UTXOs.length === 0) {
                // Only P→C UTXOs, switch to P→C direction
                setSourceChain("p-chain");
                setDestinationChain("c-chain");
            }
            // If both directions have UTXOs, keep current selection
        }
    }, [cToP_UTXOs.length, pToC_UTXOs.length, exportTxId, completedExportTxId, importTxId]);

    return (
        <CheckWalletRequirements configKey={[
            WalletRequirementsConfigKey.CoreWalletConnected
        ]}>
            <Container
                title="Cross-chain transfer"
                description="Transfer AVAX between Platform (P) and Contract (C) chains."
            >
                <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto">
                    {/* Alert Banner */}
                    <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white p-4 rounded-lg flex items-start gap-3 border border-zinc-200 dark:border-zinc-700">
                        <Info className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <div className="text-red-500 font-medium">This transfer requires 2 transactions</div>
                            <div className="text-sm text-zinc-700 dark:text-zinc-300">You will be prompted to sign 2 separate transactions: one export, and one import</div>
                        </div>
                    </div>

                    {/* From Chain Selection */}
                    <div className="relative">
                        <div className="flex justify-between items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <div className="font-medium text-zinc-900 dark:text-white">From</div>
                            <div 
                                className="flex items-center gap-2 cursor-pointer" 
                                onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                            >
                                <div className="rounded-full w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                    {sourceChain === "c-chain" ? (
                                        <img
                                            src="https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
                                            alt="C-Chain Logo"
                                            className="h-6 w-6"
                                        />
                                    ) : (
                                        <img
                                            src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
                                            alt="P-Chain Logo"
                                            className="h-6 w-6"
                                        />
                                    )}
                                </div>
                                <span className="text-zinc-900 dark:text-white font-medium">Avalanche ({sourceChain === "c-chain" ? "C-Chain" : "P-Chain"})</span>
                                <ChevronDown className="h-4 w-4 text-zinc-900 dark:text-white" />
                            </div>
                        </div>
                        
                        {/* Source Chain Dropdown */}
                        {showSourceDropdown && (
                            <div className="absolute right-0 mt-2 w-full md:w-96 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-10">
                                <div className="p-2">
                                    <div onClick={() => {
                                        setSourceChain("c-chain");
                                        setShowSourceDropdown(false);
                                    }}>
                                        <ChainOption 
                                            chain="c-chain" 
                                            label="Avalanche (C-Chain)" 
                                            description="EVM-compatible chain for smart contracts" 
                                        />
                                    </div>
                                    <div onClick={() => {
                                        setSourceChain("p-chain");
                                        setShowSourceDropdown(false);
                                    }}>
                                        <ChainOption 
                                            chain="p-chain" 
                                            label="Avalanche (P-Chain)" 
                                            description="Native chain for staking & validators" 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Transfer Amount Input */}
                    <div className="flex items-center">
                        <div className="flex-1">
                            <Input
                                type="text"
                                value={amount}
                                onChange={handleAmountChange}
                                className="w-full px-4 py-3 h-14 text-xl bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg text-zinc-900 dark:text-white"
                                placeholder="Enter amount to transfer"
                                label=""
                                error={error ?? undefined}
                                button={
                                    <Button
                                        variant="secondary"
                                        onClick={handleMaxAmount}
                                        disabled={exportLoading || (sourceChain === "c-chain" ? cChainBalance <= 0 : pChainBalance <= 0)}
                                        stickLeft
                                    >
                                        MAX
                                    </Button>
                                }
                            />
                        </div>
                        
                        {/* Swap Button */}
                        <div className="mx-4">
                            <button
                                onClick={handleSwapChains}
                                className="w-12 h-12 rounded-full flex items-center justify-center bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-all border border-zinc-300 dark:border-zinc-700"
                                aria-label="Swap source and destination chains"
                            >
                                <svg
                                    className="w-6 h-6 text-zinc-700 dark:text-white"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M7 16L12 21L17 16"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        d="M17 8L12 3L7 8"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        d="M12 3V21"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* To Chain Selection */}
                    <div className="relative">
                        <div className="flex justify-between items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <div className="font-medium text-zinc-900 dark:text-white">To</div>
                            <div 
                                className="flex items-center gap-2 cursor-pointer" 
                                onClick={() => setShowDestinationDropdown(!showDestinationDropdown)}
                            >
                                <div className="rounded-full w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                    {destinationChain === "c-chain" ? (
                                        <img
                                            src="https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
                                            alt="C-Chain Logo"
                                            className="h-6 w-6"
                                        />
                                    ) : (
                                        <img
                                            src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
                                            alt="P-Chain Logo"
                                            className="h-6 w-6"
                                        />
                                    )}
                                </div>
                                <span className="text-zinc-900 dark:text-white font-medium">Avalanche ({destinationChain === "c-chain" ? "C-Chain" : "P-Chain"})</span>
                                <ChevronDown className="h-4 w-4 text-zinc-900 dark:text-white" />
                            </div>
                        </div>
                        
                        {/* Destination Chain Dropdown */}
                        {showDestinationDropdown && (
                            <div className="absolute right-0 mt-2 w-full md:w-96 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-10">
                                <div className="p-2">
                                    <div onClick={() => {
                                        setDestinationChain("c-chain");
                                        setShowDestinationDropdown(false);
                                    }}>
                                        <ChainOption 
                                            chain="c-chain" 
                                            label="Avalanche (C-Chain)" 
                                            description="EVM-compatible chain for smart contracts" 
                                        />
                                    </div>
                                    <div onClick={() => {
                                        setDestinationChain("p-chain");
                                        setShowDestinationDropdown(false);
                                    }}>
                                        <ChainOption 
                                            chain="p-chain" 
                                            label="Avalanche (P-Chain)" 
                                            description="Native chain for staking & validators" 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Combined Export & Import Card */}
                    {(exportTxId || availableUTXOs.length > 0 || importTxId) && (
                        <div className="bg-muted/50 p-4 rounded-xl border border-border">
                            {/* Export Transaction Section */}
                            {completedExportTxId && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <h3 className="text-md font-medium text-foreground">
                                            Export Transaction Completed
                                        </h3>
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-3">
                                        Successfully exported from {sourceChain === "c-chain" ? "C-Chain" : "P-Chain"}
                                    </div>
                                    <div className="p-3 bg-background rounded border border-border font-mono text-xs break-all text-foreground">
                                        {completedExportTxId}
                                    </div>
                                </div>
                            )}

                            {/* UTXOs Display with Import Button */}
                            {availableUTXOs.length > 0 && !importTxId && (
                                <>
                                    {completedExportTxId && <div className="border-t border-border my-4"></div>}
                                    <div className="text-sm text-muted-foreground mb-4">
                                        {totalUtxoAmount.toFixed(6)} AVAX available to import to {destinationChain === "p-chain" ? "P-Chain" : "C-Chain"}
                                    </div>
                                    <div className="space-y-2 mb-4">
                                        {availableUTXOs.map((utxo, index) => (
                                            <div key={index} className="text-sm font-mono text-foreground bg-background p-3 rounded border border-border">
                                                {(Number(utxo.output.amt.value()) / 1_000_000_000).toFixed(6)} AVAX
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        variant="primary"
                                        onClick={handleImport}
                                        disabled={importLoading}
                                        className="w-full"
                                    >
                                        {importLoading ? (
                                            <span className="flex items-center justify-center">
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Importing...
                                            </span>
                                        ) : `Import to ${destinationChain === "p-chain" ? "P-Chain" : "C-Chain"}`}
                                    </Button>
                                </>
                            )}

                            {/* Import Transaction Receipt */}
                            {importTxId && (
                                <>
                                    {completedExportTxId && <div className="border-t border-border my-4"></div>}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <h3 className="text-md font-medium text-foreground">
                                            Import Transaction Completed
                                        </h3>
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-3">
                                        Successfully imported to {destinationChain === "p-chain" ? "P-Chain" : "C-Chain"}
                                    </div>
                                    <div className="p-3 bg-background rounded border border-border font-mono text-xs break-all text-foreground">
                                        {importTxId}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Estimated Fees */}
                    <div className="flex justify-between items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div className="font-medium text-zinc-900 dark:text-white">Estimated total fees</div>
                        <div className="font-medium text-zinc-900 dark:text-white">~0.001 AVAX</div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        {/* Export Button - Show when no export has been done yet */}
                        {!exportTxId && (
                            <Button
                                variant="primary"
                                onClick={handleExport}
                                disabled={exportLoading || importLoading || Number(amount) <= 0 || !!error}
                                className="w-full py-3 px-4 text-base font-medium text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {exportLoading ? (
                                    <span className="flex items-center justify-center">
                                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                        Exporting from {sourceChain === "c-chain" ? "C-Chain" : "P-Chain"}...
                                    </span>
                                ) : `Transfer ${Number(amount) > 0 ? amount : "0"} AVAX ${sourceChain === "c-chain" ? "C→P" : "P→C"}`}
                            </Button>
                        )}

                        {/* Import Error Display */}
                        {importError && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <div className="text-red-700 dark:text-red-300 text-sm">
                                    {importError}
                                </div>
                            </div>
                        )}

                        {/* Reset Button - Show after successful transfer */}
                        {importTxId && (
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setExportTxId("");
                                    setCompletedExportTxId("");
                                    setImportTxId(null);
                                    setAmount("");
                                    setError(null);
                                    setImportError(null);
                                }}
                                className="w-full py-3 px-4 text-base font-medium rounded-lg transition-all duration-200"
                            >
                                Start New Transfer
                            </Button>
                        )}
                    </div>
                </div>
            </Container>
        </CheckWalletRequirements>
    )
}