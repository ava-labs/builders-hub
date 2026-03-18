"use client"
import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { Loader2, ArrowDownUp, Clock } from "lucide-react"
import { Button } from "@/components/toolbox/components/Button"
import { useWalletStore } from "@/components/toolbox/stores/walletStore"
import { pvm, Utxo, TransferOutput, evm } from '@avalabs/avalanchejs'
import { getRPCEndpoint } from '@/components/toolbox/coreViem/utils/rpc'
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements"
import { Success } from "@/components/toolbox/components/Success"
import { AmountInput } from "@/components/toolbox/components/AmountInput"
import { StepCard, StepIndicator } from "@/components/toolbox/components/StepCard"
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext"
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata"
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

// Extended props for this specific tool
interface CrossChainTransferProps extends BaseConsoleToolProps {
    /** Suggested amount to pre-fill in the transfer form */
    suggestedAmount?: string;
}

const metadata: ConsoleToolMetadata = {
    title: "Cross-Chain Transfer",
    description: "Transfer AVAX between Platform (P) and Contract (C) chains.",
    toolRequirements: [
        WalletRequirementsConfigKey.CoreWalletConnected
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function CrossChainTransfer({
    suggestedAmount = "0.0",
    onSuccess
}: CrossChainTransferProps) {

    const [amount, setAmount] = useState<string>(suggestedAmount)
    const [sourceChain, setSourceChain] = useState<string>("c-chain")
    const [destinationChain, setDestinationChain] = useState<string>("p-chain")
    const [exportLoading, setExportLoading] = useState<boolean>(false)
    const [importLoading, setImportLoading] = useState<boolean>(false)
    const [exportTxId, setExportTxId] = useState<string>("")
    const [completedExportTxId, setCompletedExportTxId] = useState<string>("")
    const [completedExportXPChain, setCompletedExportXPChain] = useState<"P" | "C">("P")
    const [completedImportXPChain, setCompletedImportXPChain] = useState<"P" | "C">("P")
    const [importTxId, setImportTxId] = useState<string | null>(null)
    const [_currentStep, setCurrentStep] = useState<number>(1)
    const [step1Expanded, setStep1Expanded] = useState<boolean>(true)
    const [step2Expanded, setStep2Expanded] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [importError, setImportError] = useState<string | null>(null)
    const [cToP_UTXOs, setC_To_P_UTXOs] = useState<Utxo<TransferOutput>[]>([])
    const [pToC_UTXOs, setP_To_C_UTXOs] = useState<Utxo<TransferOutput>[]>([])
    const isFetchingRef = useRef(false)
    const [criticalError, setCriticalError] = useState<Error | null>(null)

    // Add states for step collapse timing
    const [step1AutoCollapse, setStep1AutoCollapse] = useState(false)
    const [step2AutoCollapse, setStep2AutoCollapse] = useState(false)

    // Throw critical errors during render to crash the component
    // This pattern is necessary for Next.js because:
    // 1. Error boundaries only catch errors during synchronous render
    // 2. Async errors (in callbacks, promises) need to be captured in state
    // 3. On next render, we throw synchronously so the error boundary catches it
    // This ensures blockchain-critical errors properly crash the component
    if (criticalError) {
        throw criticalError;
    }

    const { coreWalletClient } = useConnectedWallet();
    const { updateCChainBalance, updatePChainBalance } = useWalletStore();

    const isTestnet = useWalletStore((s) => s.isTestnet);
    const cChainBalance = useWalletStore((s) => s.balances.cChain);
    const pChainBalance = useWalletStore((s) => s.balances.pChain);
    const pChainAddress = useWalletStore((s) => s.pChainAddress);
    const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
    const coreEthAddress = useWalletStore((s) => s.coreEthAddress);

    // Calculate total AVAX in UTXOs
    const totalCToPUtxoAmount = cToP_UTXOs.reduce((sum, utxo) => {
        return sum + Number(utxo.output.amt.value()) / 1_000_000_000;
    }, 0);

    const totalPToCUtxoAmount = pToC_UTXOs.reduce((sum, utxo) => {
        return sum + Number(utxo.output.amt.value()) / 1_000_000_000;
    }, 0);

    const onBalanceChanged = useCallback(async () => {
        try {
            await Promise.all([
                updateCChainBalance(),
                updatePChainBalance(),
            ]);
        } catch (e) {
            // Critical balance update failure - set error state to crash on next render
            setCriticalError(new Error(`Failed to update balances: ${e instanceof Error ? e.message : String(e)}`));
        }
    }, [updateCChainBalance, updatePChainBalance]);

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
            // Critical UTXO fetch failure - blockchain state unknown
            setCriticalError(new Error(`Failed to fetch UTXOs: ${e instanceof Error ? e.message : String(e)}`));
        }
    }, [fetchUTXOs]);

    // Initial fetch of UTXOs and balances
    useEffect(() => {
        fetchUTXOs();
        onBalanceChanged();
    }, [coreWalletClient, walletEVMAddress, pChainAddress, fetchUTXOs, onBalanceChanged])

    // Persistent polling for pending export UTXOs
    useEffect(() => {
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
        const maxAmount = sourceChain === "c-chain" ? cChainBalance.toString() : pChainBalance.toString();
        setAmount(maxAmount);
    }

    // Handler to swap source and destination chains
    const handleSwapChains = () => {
        const tempChain = sourceChain
        setSourceChain(destinationChain)
        setDestinationChain(tempChain)
        setError(null);
        setImportError(null);
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

        setCurrentStep(3); // Move to step 3 when export is initiated
        setExportLoading(true);
        setError(null);

        try {
            if (sourceChain === "c-chain") {
                // C-Chain to P-Chain export using the evmExport function
                const txnRequest = await coreWalletClient.cChain.prepareExportTxn({
                    destinationChain: "P",
                    exportedOutput: {
                        addresses: [pChainAddress],
                        amount: Number(amount),
                    },
                    fromAddress: walletEVMAddress as `0x${string}`
                });
                const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
                await coreWalletClient.waitForTxn(txnResponse);

                console.log("P-Chain Export transaction sent:", txnResponse);
                // Store the export transaction ID to trigger import
                const txId = txnResponse.txHash;
                setExportTxId(txId);
                setCompletedExportTxId(txId);
                setCompletedExportXPChain("C");
            } else {
                // P-Chain to C-Chain export using the pvmExport function
                console.log("Preparing P-Chain Export transaction", pChainAddress, amount);
                const txnRequest = await coreWalletClient.pChain.prepareExportTxn({
                    exportedOutputs: [{
                        addresses: [coreEthAddress],
                        amount: Number(amount),
                    }],
                    destinationChain: "C"
                });
                const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
                await coreWalletClient.waitForTxn(txnResponse);

                console.log("P-Chain Export transaction sent:", txnResponse,);
                const txId = txnResponse.txHash;
                setExportTxId(txId);
                setCompletedExportTxId(txId);
                setCompletedExportXPChain("P");
            }

            await pollForUTXOChanges();
            onBalanceChanged();

        } catch (error) {
            console.error('Export error:', error);
            let msg = 'Unknown error';
            if (error instanceof Error) msg = error.message;
            setError(`Export failed: ${msg}`);
            console.error("Error sending export transaction:", error);
        } finally {
            setExportLoading(false);
        }
    }

    const handleImport = async () => {
        setImportLoading(true);
        setImportError(null);

        try {
            if (destinationChain === "p-chain") {
                // Import to P-Chain using pvmImport function
                const txnRequest = await coreWalletClient.pChain.prepareImportTxn({
                    sourceChain: "C",
                    importedOutput: {
                        addresses: [pChainAddress],
                    }
                });
                const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
                await coreWalletClient.waitForTxn(txnResponse);
                console.log("P-Chain Import transaction sent:", txnResponse.txHash);
                setImportTxId(String(txnResponse.txHash));
                setCompletedImportXPChain("P");
            } else {
                // Import to C-Chain using evmImportTx function
                const txnRequest = await coreWalletClient.cChain.prepareImportTxn({
                    sourceChain: "P",
                    toAddress: walletEVMAddress as `0x${string}`,
                });
                const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
                await coreWalletClient.waitForTxn(txnResponse);
                console.log("C-Chain Import transaction sent:", txnResponse.txHash);
                setImportTxId(String(txnResponse.txHash));
                setCompletedImportXPChain("C");
            }

            await pollForUTXOChanges();
            onBalanceChanged();

            onSuccess?.();
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

    // Get the available UTXOs based on current direction
    const availableUTXOs = destinationChain === "p-chain" ? cToP_UTXOs : pToC_UTXOs;
    const totalUtxoAmount = destinationChain === "p-chain" ? totalCToPUtxoAmount : totalPToCUtxoAmount;

    // Step status logic with auto-collapse flow
    const getStep1Status = (): 'pending' | 'active' | 'waiting' | 'completed' | 'error' => {
        if (error) return 'error';
        if (step1AutoCollapse) return 'completed';
        if (completedExportTxId) return 'waiting'; // Show as waiting after success, before auto-collapse
        if (exportLoading) return 'active';
        return 'active';
    };

    const getStep2Status = (): 'pending' | 'active' | 'waiting' | 'completed' | 'error' => {
        if (importError) return 'error';
        if (step2AutoCollapse) return 'completed';
        if (importTxId) return 'waiting'; // Show as waiting after success, before auto-collapse
        if (importLoading || (completedExportTxId && availableUTXOs.length > 0)) return 'active';
        return 'pending';
    };

    // Auto-collapse logic after success message
    useEffect(() => {
        if (completedExportTxId && !step1AutoCollapse) {
            const timer = setTimeout(() => {
                setStep1AutoCollapse(true);
            }, 2000); // 2 seconds after success message
            return () => clearTimeout(timer);
        }
    }, [completedExportTxId, step1AutoCollapse]);

    useEffect(() => {
        if (importTxId && !step2AutoCollapse) {
            const timer = setTimeout(() => {
                setStep2AutoCollapse(true);
            }, 2000); // 2 seconds after success message
            return () => clearTimeout(timer);
        }
    }, [importTxId, step2AutoCollapse]);

    // Auto-skip to step 2 if UTXOs are already available
    useEffect(() => {
        if (availableUTXOs.length > 0 && !completedExportTxId && !exportTxId && !importTxId) {
            // Skip step 1 and mark it as completed (simulate export was done previously)
            setCompletedExportTxId("utxo-available");
            setStep1AutoCollapse(true);
        }
    }, [availableUTXOs.length, completedExportTxId, exportTxId, importTxId]);

    // Auto-expand step management - don't allow collapsing incomplete steps
    useEffect(() => {
        const step1Status = getStep1Status();
        const step2Status = getStep2Status();

        // Step 1 should be expanded when it's not completed yet, or when step 2 is pending
        setStep1Expanded(step1Status !== 'completed' || step2Status === 'pending');

        // Step 2 should be expanded when it's active, has errors, or is completed
        setStep2Expanded(step2Status === 'active' || step2Status === 'error' || step2Status === 'completed');
    }, [exportLoading, completedExportTxId, importLoading, importTxId, error, importError, availableUTXOs.length, step1AutoCollapse, step2AutoCollapse]);

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
        <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto">
                {/* Progress Overview */}
                <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center justify-center gap-4 mb-3">
                        <StepIndicator stepNumber={1} title="Export" status={getStep1Status()} />
                        <StepIndicator stepNumber={2} title="Import" status={getStep2Status()} isLast />
                    </div>
                    <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                        Complete both transactions to transfer AVAX between chains
                    </div>
                </div>

                {/* Step 1: Export Transaction */}
                <StepCard
                    stepNumber={1}
                    title="Export from Source Chain"
                    description={completedExportTxId === "utxo-available"
                        ? `UTXOs already available for import (previous export detected)`
                        : `Export ${amount} AVAX from ${sourceChain === "c-chain" ? "C-Chain" : "P-Chain"} to ${destinationChain === "p-chain" ? "P-Chain" : "C-Chain"}`}
                    status={getStep1Status()}
                    isExpanded={step1Expanded}
                    onToggle={() => setStep1Expanded(!step1Expanded)}
                    error={error ?? undefined}
                >
                    {/* From Chain Selection */}
                    <div className="space-y-2 mb-6">
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Source Chain
                        </label>
                        <div className="relative">
                            <div className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-full w-8 h-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                        {sourceChain === "c-chain" ? (
                                            <img
                                                src="https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
                                                alt="C-Chain Logo"
                                                className="h-5 w-5"
                                            />
                                        ) : (
                                            <img
                                                src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
                                                alt="P-Chain Logo"
                                                className="h-5 w-5"
                                            />
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <div className="font-medium">Avalanche {sourceChain === "c-chain" ? "C-Chain" : "P-Chain"}</div>
                                        <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                            {sourceChain === "c-chain" ? "EVM-compatible chain for smart contracts" : "Native chain for staking & validators"}
                                        </div>
                                    </div>
                                </div>

                                {/* Switch Button */}
                                <button
                                    type="button"
                                    onClick={handleSwapChains}
                                    className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                                    aria-label="Switch source and destination chains"
                                >
                                    <ArrowDownUp className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Transfer Amount Input */}
                    <AmountInput
                        label="Amount to Transfer"
                        value={amount}
                        onChange={setAmount}
                        type="number"
                        min="0"
                        max={(sourceChain === "c-chain" ? cChainBalance : pChainBalance).toString()}
                        step="0.000001"
                        required
                        disabled={exportLoading || importLoading}
                        error={error ?? undefined}
                        button={
                            <Button
                                onClick={handleMaxAmount}
                                disabled={exportLoading || (sourceChain === "c-chain" ? cChainBalance <= 0 : pChainBalance <= 0)}
                                stickLeft
                            >
                                MAX
                            </Button>
                        }
                    />

                    {/* To Chain Selection - Disabled */}
                    <div className="space-y-2 mb-6">
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Destination Chain
                        </label>
                        <div className="relative">
                            <div className="w-full flex items-center justify-between px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-600 dark:text-zinc-400 cursor-not-allowed opacity-75">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-full w-8 h-8 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600">
                                        {destinationChain === "c-chain" ? (
                                            <img
                                                src="https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
                                                alt="C-Chain Logo"
                                                className="h-5 w-5 opacity-60"
                                            />
                                        ) : (
                                            <img
                                                src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
                                                alt="P-Chain Logo"
                                                className="h-5 w-5 opacity-60"
                                            />
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <div className="font-medium">Avalanche {destinationChain === "c-chain" ? "C-Chain" : "P-Chain"}</div>
                                        <div className="text-sm text-zinc-500 dark:text-zinc-500">
                                            {destinationChain === "c-chain" ? "EVM-compatible chain for smart contracts" : "Native chain for staking & validators"}
                                        </div>
                                    </div>
                                </div>
                                {/* No ChevronDown - indicating it's not clickable */}
                            </div>
                        </div>
                    </div>

                    {/* Export Button */}
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
                            ) : `Export ${amount} AVAX`}
                        </Button>
                    )}

                    {/* Export Transaction Result */}
                    {completedExportTxId && completedExportTxId !== "utxo-available" && (
                        <div className="mt-4">
                            <Success
                                label="Export Transaction Completed"
                                value={completedExportTxId}
                                isTestnet={isTestnet}
                                xpChain={completedExportXPChain}
                            />
                        </div>
                    )}
                </StepCard>

                {/* Step 2: Import Transaction */}
                <StepCard
                    stepNumber={2}
                    title="Import to Destination Chain"
                    description={`Import the exported AVAX to ${destinationChain === "p-chain" ? "P-Chain" : "C-Chain"} to complete the transfer`}
                    status={getStep2Status()}
                    isExpanded={step2Expanded}
                    onToggle={() => setStep2Expanded(!step2Expanded)}
                    error={importError ?? undefined}
                >
                    {/* UTXOs Available for Import */}
                    {availableUTXOs.length > 0 && !importTxId && (
                        <>
                            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                                {totalUtxoAmount.toFixed(6)} AVAX available to import to {destinationChain === "p-chain" ? "P-Chain" : "C-Chain"}
                            </div>

                            <div className="space-y-2 mb-4">
                                {availableUTXOs.map((utxo, index) => (
                                    <div key={index} className="text-sm font-mono text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 p-3 rounded border border-zinc-200 dark:border-zinc-700">
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

                    {/* Import Transaction Result */}
                    {importTxId && (
                        <div className="mt-4">
                            <Success
                                label="Import Transaction Completed"
                                value={importTxId}
                                isTestnet={isTestnet}
                                xpChain={completedImportXPChain}
                            />
                        </div>
                    )}

                    {/* Waiting for Export */}
                    {!completedExportTxId && !availableUTXOs.length && (
                        <div className="text-center py-8">
                            <Clock className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Waiting for export transaction to complete...
                            </p>
                        </div>
                    )}
                </StepCard>

                {/* Estimated Fees */}
                <div className="flex justify-between items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <div className="font-medium text-zinc-900 dark:text-white">Estimated total fees</div>
                    <div className="font-medium text-zinc-900 dark:text-white">~0.001 AVAX</div>
                </div>

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
                            setStep1AutoCollapse(false);
                            setStep2AutoCollapse(false);
                            // After reset, check if UTXOs are available again to auto-skip
                            setTimeout(() => {
                                if (availableUTXOs.length > 0) {
                                    setCompletedExportTxId("utxo-available");
                                    setStep1AutoCollapse(true);
                                }
                            }, 100);
                        }}
                        className="w-full py-3 px-4 text-base font-medium rounded-lg transition-all duration-200"
                    >
                        Start New Transfer
                    </Button>
                )}
        </div>
    );
}

export default withConsoleToolMetadata(CrossChainTransfer, metadata);
