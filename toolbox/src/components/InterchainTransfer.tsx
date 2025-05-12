import { ArrowRight, Loader2, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWalletStore } from '../lib/walletStore';
import { Button } from './Button';
import { Input } from './Input';
import { evmImportTx } from "../coreViem/methods/evmImport"
import { evmExport } from "../coreViem/methods/evmExport"
import { pvmImport } from "../coreViem/methods/pvmImport"
import { pvmExport } from "../coreViem/methods/pvmExport"
import { useErrorBoundary } from "react-error-boundary"
import { pvm, Utxo, TransferOutput, evm } from '@avalabs/avalanchejs';
import { getRPCEndpoint } from '../coreViem/utils/rpc';


export default function InterchainTransfer({ glow = false }: { glow?: boolean }) {
    const [open, setOpen] = useState(false);
    const [direction, setDirection] = useState<'c-to-p' | 'p-to-c'>('c-to-p');
    const [amount, setAmount] = useState<string>("");
    const [exportLoading, setExportLoading] = useState<boolean>(false);
    const [importLoading, setImportLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [cToP_UTXOs, setC_To_P_UTXOs] = useState<Utxo<TransferOutput>[]>([]);
    const [pToC_UTXOs, setP_To_C_UTXOs] = useState<Utxo<TransferOutput>[]>([]);
    const isFetchingRef = useRef(false);

    const { showBoundary } = useErrorBoundary();
    const { pChainAddress, walletEVMAddress, coreWalletClient, isTestnet, coreEthAddress, l1Balance, updateL1Balance, pChainBalance, updatePChainBalance } = useWalletStore();

    const sourceChain = direction === 'c-to-p' ? 'c-chain' : 'p-chain';
    const destinationChain = direction === 'c-to-p' ? 'p-chain' : 'c-chain';
    const currentBalance = direction === 'c-to-p' ? l1Balance : pChainBalance;
    const importableUTXOs = direction === 'c-to-p' ? cToP_UTXOs : pToC_UTXOs;

    const onBalanceChanged = useCallback(() => {
        updateL1Balance()?.catch(showBoundary)
        updatePChainBalance()?.catch(showBoundary)
    }, [updateL1Balance, updatePChainBalance, showBoundary]);

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
                sourceChain: 'C'
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

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setAmount("");
            setExportLoading(false);
            setImportLoading(false);
            setError(null);
            setImportError(null);
        }
    }, [open]);

    const handleMaxAmount = () => {
        setAmount(currentBalance.toString());
        setError(null);
    };

    const handleAmountChange = (newAmount: string) => {
        if (/^\d*\.?\d*$/.test(newAmount) || newAmount === "") {
            setAmount(newAmount);
            setError(null);
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
    }, [fetchUTXOs]);

    const handleExport = async () => {
        if (!validateAmount()) return;

        if (typeof window === 'undefined' || !walletEVMAddress || !pChainAddress || !coreWalletClient) {
            setError("Wallet not connected or required data missing.");
            return;
        }

        setExportLoading(true);
        setError(null);

        try {
            if (sourceChain === "c-chain") {
                await evmExport(coreWalletClient, { amount, pChainAddress, walletEVMAddress });
            } else {
                await pvmExport(coreWalletClient, { amount, pChainAddress });
            }

            await pollForUTXOChanges();
            onBalanceChanged();

        } catch (e: any) {
            showBoundary(e);
            setError(`Export failed: ${e.message || 'Unknown error'}`);
        } finally {
            setExportLoading(false);
        }
    };

    //fetch UTXOs when dialog opens
    useEffect(() => {
        if (open) {
            fetchUTXOs();
        }
    }, [open, fetchUTXOs]);

    const handleImport = async () => {
        if (typeof window === 'undefined' || !walletEVMAddress || !pChainAddress || !coreWalletClient) {
            setImportError("Wallet not connected or required data missing.");
            return;
        }

        setImportLoading(true);
        setImportError(null);

        try {
            if (destinationChain === "p-chain") {
                await pvmImport(coreWalletClient, { pChainAddress });
            } else {
                await evmImportTx(coreWalletClient, { walletEVMAddress });
            }

            await pollForUTXOChanges();
            onBalanceChanged();

        } catch (e: any) {
            showBoundary(e);
            setImportError(`Import failed: ${e.message || 'Unknown error'}`);
        } finally {
            setImportLoading(false);
        }
    };

    const openDialog = (transferDirection: 'c-to-p' | 'p-to-c') => {
        setDirection(transferDirection);
        setOpen(true);
    };

    // Calculate total AVAX in UTXOs
    const totalUtxoAmount = importableUTXOs.reduce((sum, utxo) => {
        return sum + Number(utxo.output.amt.value()) / 1_000_000_000;
    }, 0);

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <div className="hidden md:flex flex-col items-center justify-center space-y-2 text-zinc-400 dark:text-zinc-600">
                <Dialog.Trigger asChild>
                    <button
                        onClick={() => openDialog('c-to-p')}
                        className={`p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600 shadow-sm ${glow ? "shimmer" : ""}`}
                        aria-label="Transfer C-Chain to P-Chain"
                    >
                        <ArrowRight className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                    </button>
                </Dialog.Trigger>
            </div>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-xl bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 focus:outline-none data-[state=open]:animate-contentShow border border-zinc-200 dark:border-zinc-800">
                    <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        Transfer {sourceChain === 'c-chain' ? 'C → P Chain' : 'P → C Chain'}
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                        Available: {currentBalance.toFixed(4)} AVAX
                    </Dialog.Description>

                    <div className="space-y-6">
                        <Input
                            label="Amount"
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={handleAmountChange}
                            error={error ?? undefined}
                            placeholder="0.0"
                            button={<Button
                                variant="secondary"
                                onClick={handleMaxAmount}
                                disabled={exportLoading || currentBalance <= 0}
                                stickLeft
                            >
                                Max
                            </Button>}
                        />

                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Exported UTXOs:
                            </h3>
                            <div className="text-sm text-zinc-600 dark:text-zinc-400 py-3 px-4 bg-zinc-50 dark:bg-zinc-800 rounded-md min-h-[80px]">
                                {importableUTXOs.length > 0 ? (
                                    <>
                                        {importableUTXOs.map((utxo, index) => (
                                            <div key={index}>
                                                {(Number(utxo.output.amt.value()) / 1_000_000_000).toFixed(6)} AVAX
                                            </div>
                                        ))}
                                        <div className="mt-2 font-medium">
                                            Total: {totalUtxoAmount.toFixed(6)} AVAX
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-4 text-center text-zinc-500">
                                        No exported UTXOs to import
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="text-xs text-red-500 mt-1">
                                    {error}
                                </div>
                            )}

                            {importError && (
                                <div className="text-xs text-red-500 mt-1">
                                    {importError}
                                </div>
                            )}
                        </div>

                        <div className="flex space-x-4">
                            <Button
                                variant="primary"
                                onClick={handleExport}
                                disabled={exportLoading || !amount || Number(amount) <= 0 || !!error}
                                className="flex-1"
                            >
                                {exportLoading ? (
                                    <span className="flex items-center justify-center">
                                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                        Exporting...
                                    </span>
                                ) : (
                                    `Export from ${sourceChain === 'c-chain' ? 'C-Chain' : 'P-Chain'}`
                                )}
                            </Button>

                            <Button
                                variant="primary"
                                onClick={handleImport}
                                disabled={importLoading || importableUTXOs.length === 0}
                                className="flex-1"
                            >
                                {importLoading ? (
                                    <span className="flex items-center justify-center">
                                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                        Importing...
                                    </span>
                                ) : (
                                    `Import to ${destinationChain === 'p-chain' ? 'P-Chain' : 'C-Chain'}`
                                )}
                            </Button>
                        </div>
                    </div>

                    <Dialog.Close asChild>
                        <button
                            className="absolute top-3 right-3 p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                            aria-label="Close"
                            disabled={exportLoading || importLoading}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
