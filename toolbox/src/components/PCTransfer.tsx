import { ArrowRight, ArrowLeft, Loader2, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useState, useEffect } from 'react';
import { useWalletStore } from '../lib/walletStore';
import { Button } from './Button';
import { Input } from './Input';
import { evmImportTx } from "../coreViem/methods/evmImport"
import { evmExport } from "../coreViem/methods/evmExport"
import { pvmImport } from "../coreViem/methods/pvmImport"
import { pvmExport } from "../coreViem/methods/pvmExport"
import { useErrorBoundary } from "react-error-boundary"

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function PCTransfer() {
    const [open, setOpen] = useState(false);
    const [direction, setDirection] = useState<'c-to-p' | 'p-to-c'>('c-to-p');
    const [amount, setAmount] = useState<string>("");
    const [availableBalance, setAvailableBalance] = useState<number>(0);
    const [pChainAvailableBalance, setPChainAvailableBalance] = useState<number>(0);
    const [exportLoading, setExportLoading] = useState<boolean>(false);
    const [importLoading, setImportLoading] = useState<boolean>(false);
    const [exportTxId, setExportTxId] = useState<string>("");
    const [waitingForConfirmation, setWaitingForConfirmation] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const { showBoundary } = useErrorBoundary();
    const { pChainAddress, walletEVMAddress, coreWalletClient, publicClient } = useWalletStore();

    const sourceChain = direction === 'c-to-p' ? 'c-chain' : 'p-chain';
    const destinationChain = direction === 'c-to-p' ? 'p-chain' : 'c-chain';
    const currentBalance = direction === 'c-to-p' ? availableBalance : pChainAvailableBalance;

    // Function to fetch balances from both chains
    const fetchBalances = async () => {
        setError(null); // Clear error on fetch
        if (publicClient && walletEVMAddress) {
            publicClient.getBalance({
                address: walletEVMAddress as `0x${string}`,
            }).then((balance: bigint) => {
                setAvailableBalance(Number(balance) / 1e18);
            }).catch(e => {
                console.error("Error fetching C-Chain balance:", e);
                setError("Failed to fetch C-Chain balance.");
            });
        }

        if (coreWalletClient && pChainAddress) {
            coreWalletClient.getPChainBalance().then((balance: bigint) => {
                setPChainAvailableBalance(Number(balance) / 1e9);
            }).catch((e: any) => {
                console.error("Error fetching P-Chain balance:", e);
                setError("Failed to fetch P-Chain balance.");
            });
        }
    };

    // Fetch balances when the dialog opens or dependencies change
    useEffect(() => {
        if (open) {
            fetchBalances();
        }
    }, [open, publicClient, walletEVMAddress, pChainAddress, coreWalletClient]);

    // Effect to handle automatic import after export
    useEffect(() => {
        if (exportTxId) {
            const startImport = async () => {
                setWaitingForConfirmation(true);
                await delay(15000); // Wait for confirmation
                setWaitingForConfirmation(false);
                await handleImport();
            };
            startImport();
        }
    }, [exportTxId]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setAmount("");
            setExportLoading(false);
            setImportLoading(false);
            setExportTxId("");
            setWaitingForConfirmation(false);
            setError(null);
        }
    }, [open]);

    const handleMaxAmount = () => {
        setAmount(currentBalance.toString());
        setError(null); // Clear error when max is clicked
    };

    const handleAmountChange = (newAmount: string) => {
        // Basic validation for numeric input
        if (/^\d*\.?\d*$/.test(newAmount) || newAmount === "") {
            setAmount(newAmount);
            setError(null); // Clear error on valid input
        }
    };

    const validateAmount = (): boolean => {
        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError("Please enter a valid positive amount.");
            return false;
        }
        if (numericAmount > currentBalance) {
            setError(`Amount exceeds available balance of ${currentBalance.toFixed(4)} AVAX.`);
            return false;
        }
        setError(null);
        return true;
    };

    const handleExport = async () => {
        if (!validateAmount()) return;

        if (typeof window === 'undefined' || !walletEVMAddress || !pChainAddress || !coreWalletClient) {
            setError("Wallet not connected or required data missing.");
            console.error("Missing required data or not in client environment");
            return;
        }

        setExportLoading(true);
        setError(null);
        console.log("Export initiated with amount:", amount, "from", sourceChain, "to", destinationChain);

        try {
            let response;
            if (sourceChain === "c-chain") {
                response = await evmExport(coreWalletClient, { amount, pChainAddress, walletEVMAddress });
            } else {
                response = await pvmExport(coreWalletClient, { amount, pChainAddress });
            }
            console.log(`${sourceChain} Export transaction sent:`, response);
            setExportTxId(response.txID || String(response)); // Trigger import
        } catch (e: any) {
            showBoundary(e);
            setError(`Export failed: ${e.message || 'Unknown error'}`);
            console.error(`Error sending ${sourceChain} export transaction:`, e);
            setExportLoading(false); // Ensure loading stops on error
        }
        // Export loading is set to false implicitly when import starts or on error
    };

    const handleImport = async () => {
        if (typeof window === 'undefined' || !walletEVMAddress || !pChainAddress || !coreWalletClient) {
            setError("Wallet not connected or required data missing for import.");
            console.error("Missing required data or not in client environment for import");
            setImportLoading(false); // Stop import loading if prerequisites fail
            setExportTxId(""); // Clear export ID if import can't proceed
            return;
        }

        setImportLoading(true);
        setError(null);
        console.log("Import initiated to", destinationChain);

        try {
            let response;
            if (destinationChain === "p-chain") {
                response = await pvmImport(coreWalletClient, { pChainAddress });
            } else {
                response = await evmImportTx(coreWalletClient, { walletEVMAddress });
            }
            console.log(`${destinationChain} Import transaction sent:`, response);

            // Transfer complete, schedule balance refresh and close dialog after a delay
            await delay(2000); // Initial delay before first refresh
            fetchBalances(); // Start immediate refresh

            // Schedule further refreshes
            setTimeout(fetchBalances, 4000);
            setTimeout(fetchBalances, 8000);

            // Optionally close dialog after success and delay
            setTimeout(() => {
                setOpen(false);
                // Consider adding a success message state here if needed
            }, 1000);


        } catch (e: any) {
            showBoundary(e);
            setError(`Import failed: ${e.message || 'Unknown error'}`);
            console.error(`Error sending ${destinationChain} import transaction:`, e);
        } finally {
            setImportLoading(false);
            setExportLoading(false); // Ensure export loading is also false
            setWaitingForConfirmation(false);
            setExportTxId(""); // Clear export ID after import attempt
        }
    };


    const openDialog = (transferDirection: 'c-to-p' | 'p-to-c') => {
        setDirection(transferDirection);
        setOpen(true);
    };

    const isLoading = exportLoading || importLoading || waitingForConfirmation;

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <div className="hidden md:flex flex-col items-center justify-center space-y-2 text-zinc-400 dark:text-zinc-600">
                {/* C -> P Trigger */}
                <Dialog.Trigger asChild>
                    <button
                        onClick={() => openDialog('c-to-p')}
                        className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600 shadow-sm"
                        aria-label="Transfer C-Chain to P-Chain"
                    >
                        <ArrowRight className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                    </button>
                </Dialog.Trigger>
                {/* P -> C Trigger */}
                <Dialog.Trigger asChild>
                    <button
                        onClick={() => openDialog('p-to-c')}
                        className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600 shadow-sm"
                        aria-label="Transfer P-Chain to C-Chain"
                    >
                        <ArrowLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                    </button>
                </Dialog.Trigger>
            </div>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 focus:outline-none data-[state=open]:animate-contentShow border border-zinc-200 dark:border-zinc-800">
                    <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                        Transfer {sourceChain === 'c-chain' ? 'C → P Chain' : 'P → C Chain'}
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                        Available: {currentBalance.toFixed(4)} AVAX
                    </Dialog.Description>

                    <div className="space-y-4">
                        <Input
                            label="Amount"
                            type="text" // Use text to allow decimal input easily
                            inputMode="decimal" // Hint for mobile keyboards
                            value={amount}
                            onChange={handleAmountChange}
                            error={error ?? undefined} // Pass error message to Input
                            placeholder="0.0"
                            button={<Button
                                variant="secondary"
                                onClick={handleMaxAmount}
                                disabled={isLoading || currentBalance <= 0}
                                stickLeft
                            >
                                Max
                            </Button>}
                        />

                        {/* Loading/Status Indicators */}
                        {waitingForConfirmation && (
                            <div className="flex items-center p-2 text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-700 dark:text-yellow-300">
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Export successful, waiting for confirmation...
                            </div>
                        )}
                        {importLoading && (
                            <div className="flex items-center p-2 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-300">
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Importing to {destinationChain === "p-chain" ? "P-Chain" : "C-Chain"}...
                            </div>
                        )}
                        {/* Info Box */}
                        <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400 space-y-1">
                            <p className='font-medium text-blue-800 dark:text-blue-300'>Cross-chain transfers:</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                                <li>Require an Export tx then an Import tx.</li>
                                <li>Import starts automatically after export confirms (~5s).</li>
                                <li>Total time is typically 15-30 seconds.</li>
                            </ul>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-2">
                        <Dialog.Close asChild>
                            <Button variant="secondary" disabled={isLoading}>Cancel</Button>
                        </Dialog.Close>
                        <Button
                            variant="primary"
                            onClick={handleExport}
                            disabled={isLoading || !amount || Number(amount) <= 0 || !!error} // Disable on load, no amount, zero/neg amount, or if there's an error
                        >
                            {exportLoading ? (
                                <span className="flex items-center justify-center">
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    Exporting...
                                </span>
                            ) : (
                                `Transfer ${Number(amount) > 0 ? amount : ""} AVAX`
                            )}
                        </Button>
                    </div>

                    <Dialog.Close asChild>
                        <button
                            className="absolute top-3 right-3 p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                            aria-label="Close"
                            disabled={isLoading}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
