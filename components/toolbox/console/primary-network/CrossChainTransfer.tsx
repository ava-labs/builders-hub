"use client"
import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { ArrowDownUp, Clock, BookOpen, ExternalLink } from "lucide-react"
import { Button } from "@/components/toolbox/components/Button"
import { useWalletStore } from "@/components/toolbox/stores/walletStore"
import { pvm, Utxo, TransferOutput, evm } from '@avalabs/avalanchejs'
import { getRPCEndpoint } from '@/components/toolbox/coreViem/utils/rpc'
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements"
import { Success } from "@/components/toolbox/components/Success"
import { AmountInput } from "@/components/toolbox/components/AmountInput"
import { StepIndicator } from "@/components/toolbox/components/StepCard"
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext"
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata"
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { SDKCodeViewer, type SDKCodeSource } from "@/components/console/sdk-code-viewer";
import { CliAlternative } from "@/components/console/cli-alternative";
import Link from "next/link";

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

                // Store the export transaction ID to trigger import
                const txId = txnResponse.txHash;
                setExportTxId(txId);
                setCompletedExportTxId(txId);
                setCompletedExportXPChain("C");
            } else {
                // P-Chain to C-Chain export using the pvmExport function
                const txnRequest = await coreWalletClient.pChain.prepareExportTxn({
                    exportedOutputs: [{
                        addresses: [coreEthAddress],
                        amount: Number(amount),
                    }],
                    destinationChain: "C"
                });
                const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
                await coreWalletClient.waitForTxn(txnResponse);

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

    const sdkSources: SDKCodeSource[] = useMemo(() => {
        const isCtoP = sourceChain === "c-chain";
        return [
            {
                name: "Export",
                filename: isCtoP ? "exportCtoP.ts" : "exportPtoC.ts",
                code: isCtoP
                    ? `import { CoreWalletClient } from "@core-wallet/sdk";

// Export AVAX from C-Chain to P-Chain
const txnRequest = await coreWalletClient.cChain.prepareExportTxn({
  destinationChain: "P",
  exportedOutput: {
    addresses: ["${pChainAddress || "<your-p-chain-address>"}"],
    amount: ${amount || "0"},
  },
  fromAddress: "${walletEVMAddress || "<your-evm-address>"}",
});

const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
await coreWalletClient.waitForTxn(txnResponse);
console.log("Export tx:", txnResponse.txHash);`
                    : `import { CoreWalletClient } from "@core-wallet/sdk";

// Export AVAX from P-Chain to C-Chain
const txnRequest = await coreWalletClient.pChain.prepareExportTxn({
  exportedOutputs: [{
    addresses: ["${coreEthAddress || "<your-core-eth-address>"}"],
    amount: ${amount || "0"},
  }],
  destinationChain: "C",
});

const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
await coreWalletClient.waitForTxn(txnResponse);
console.log("Export tx:", txnResponse.txHash);`,
                description: isCtoP
                    ? "Export AVAX from C-Chain to P-Chain using Core Wallet SDK"
                    : "Export AVAX from P-Chain to C-Chain using Core Wallet SDK",
            },
            {
                name: "Import",
                filename: isCtoP ? "importToP.ts" : "importToC.ts",
                code: isCtoP
                    ? `import { CoreWalletClient } from "@core-wallet/sdk";

// Import AVAX to P-Chain from C-Chain
const txnRequest = await coreWalletClient.pChain.prepareImportTxn({
  sourceChain: "C",
  importedOutput: {
    addresses: ["${pChainAddress || "<your-p-chain-address>"}"],
  },
});

const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
await coreWalletClient.waitForTxn(txnResponse);
console.log("Import tx:", txnResponse.txHash);`
                    : `import { CoreWalletClient } from "@core-wallet/sdk";

// Import AVAX to C-Chain from P-Chain
const txnRequest = await coreWalletClient.cChain.prepareImportTxn({
  sourceChain: "P",
  toAddress: "${walletEVMAddress || "<your-evm-address>"}",
});

const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
await coreWalletClient.waitForTxn(txnResponse);
console.log("Import tx:", txnResponse.txHash);`,
                description: isCtoP
                    ? "Import the exported AVAX to P-Chain"
                    : "Import the exported AVAX to C-Chain",
            },
        ];
    }, [sourceChain, amount, pChainAddress, walletEVMAddress, coreEthAddress]);

    const cliCommand = sourceChain === "c-chain"
        ? `platform transfer c-to-p --amount ${amount || "<amount>"} --network ${isTestnet ? "fuji" : "mainnet"}`
        : `platform transfer p-to-c --amount ${amount || "<amount>"} --network ${isTestnet ? "fuji" : "mainnet"}`;

    const sourceChainName = sourceChain === "c-chain" ? "C-Chain" : "P-Chain";
    const destChainName = destinationChain === "c-chain" ? "C-Chain" : "P-Chain";
    const sourceBalance = sourceChain === "c-chain" ? cChainBalance : pChainBalance;
    const destBalance = destinationChain === "c-chain" ? cChainBalance : pChainBalance;

    const chainLogo = (chain: string) =>
        chain === "c-chain"
            ? "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
            : "https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg";

    return (
        <SDKCodeViewer sources={sdkSources} height="350px" className="lg:grid-cols-1">
        <div className="space-y-4">
                {/* Context */}
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                    <p className="mb-2">
                        Transfer AVAX between the C-Chain and P-Chain.
                        Requires two transactions: export from the source, then import to the destination.
                    </p>
                    <Link
                        href="/docs/rpcs/p-chain/txn-format"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                        <BookOpen className="h-3 w-3" />
                        P-Chain Transaction Format
                        <ExternalLink className="h-3 w-3" />
                    </Link>
                </div>

                {/* Transfer Widget */}
                <div className="rounded-lg border border-border overflow-hidden">
                    {/* From */}
                    <div className="p-4 bg-card">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <img src={chainLogo(sourceChain)} alt="" className="h-5 w-5" />
                                <span className="text-sm font-medium text-foreground">From {sourceChainName}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                                Balance: {sourceBalance.toFixed(4)} AVAX
                            </span>
                        </div>
                        <AmountInput
                            label=""
                            value={amount}
                            onChange={setAmount}
                            type="number"
                            min="0"
                            max={sourceBalance.toString()}
                            step="0.000001"
                            required
                            disabled={exportLoading || importLoading}
                            error={error ?? undefined}
                            button={
                                <Button
                                    onClick={handleMaxAmount}
                                    disabled={exportLoading || sourceBalance <= 0}
                                    stickLeft
                                >
                                    MAX
                                </Button>
                            }
                        />
                    </div>

                    {/* Swap Divider */}
                    <div className="relative flex justify-center">
                        <div className="absolute inset-x-0 top-1/2 border-t border-border" />
                        <button
                            type="button"
                            onClick={handleSwapChains}
                            disabled={exportLoading || importLoading}
                            className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-muted border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Swap chains"
                        >
                            <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* To */}
                    <div className="p-4 bg-card">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <img src={chainLogo(destinationChain)} alt="" className="h-5 w-5" />
                                <span className="text-sm font-medium text-foreground">To {destChainName}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                                Balance: {destBalance.toFixed(4)} AVAX
                            </span>
                        </div>
                    </div>
                </div>

                {/* Step Progress */}
                <div className="flex items-center justify-center gap-3">
                    <StepIndicator stepNumber={1} title="Export" status={getStep1Status()} />
                    <StepIndicator stepNumber={2} title="Import" status={getStep2Status()} isLast />
                </div>

                {/* Action Area */}
                <div className="space-y-3">
                    {/* Export phase */}
                    {!completedExportTxId && !exportLoading && availableUTXOs.length === 0 && (
                        <Button
                            variant="primary"
                            onClick={handleExport}
                            disabled={Number(amount) <= 0 || !!error}
                            icon={<img src="/images/core.svg" alt="" className="w-4 h-4" />}
                            className="w-full"
                        >
                            Export {amount || "0"} AVAX from {sourceChainName}
                        </Button>
                    )}

                    {/* Export loading */}
                    {exportLoading && (
                        <Button
                            variant="primary"
                            disabled
                            loading
                            loadingText={`Exporting from ${sourceChainName}...`}
                            className="w-full"
                        >
                            Exporting...
                        </Button>
                    )}

                    {/* Export error */}
                    {error && (
                        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {/* Export success */}
                    {completedExportTxId && completedExportTxId !== "utxo-available" && (
                        <Success
                            label="Export Completed"
                            value={completedExportTxId}
                            isTestnet={isTestnet}
                            xpChain={completedExportXPChain}
                        />
                    )}

                    {/* Waiting for UTXOs after export */}
                    {completedExportTxId && availableUTXOs.length === 0 && !exportLoading && (
                        <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4 animate-pulse" />
                            Waiting for UTXOs to arrive...
                        </div>
                    )}

                    {/* Import phase */}
                    {availableUTXOs.length > 0 && !importTxId && (
                        <>
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm">
                                <span className="text-muted-foreground">Ready to import</span>
                                <span className="font-mono font-medium text-foreground">{totalUtxoAmount.toFixed(6)} AVAX</span>
                            </div>

                            {importError && (
                                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                                    <p className="text-sm text-destructive">{importError}</p>
                                </div>
                            )}

                            <Button
                                variant="primary"
                                onClick={handleImport}
                                disabled={importLoading}
                                loading={importLoading}
                                loadingText="Importing..."
                                icon={<img src="/images/core.svg" alt="" className="w-4 h-4" />}
                                className="w-full"
                            >
                                Import to {destChainName}
                            </Button>
                        </>
                    )}

                    {/* Transfer complete */}
                    {importTxId && (
                        <>
                            <Success
                                label="Transfer Complete"
                                value={importTxId}
                                isTestnet={isTestnet}
                                xpChain={completedImportXPChain}
                            />
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
                                    setTimeout(() => {
                                        if (availableUTXOs.length > 0) {
                                            setCompletedExportTxId("utxo-available");
                                            setStep1AutoCollapse(true);
                                        }
                                    }, 100);
                                }}
                                className="w-full"
                            >
                                Start New Transfer
                            </Button>
                        </>
                    )}
                </div>

                {/* Fee */}
                <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
                    <span>Estimated fee</span>
                    <span>~0.001 AVAX</span>
                </div>

                <CliAlternative command={cliCommand} />
        </div>
        </SDKCodeViewer>
    );
}

export default withConsoleToolMetadata(CrossChainTransfer, metadata);
