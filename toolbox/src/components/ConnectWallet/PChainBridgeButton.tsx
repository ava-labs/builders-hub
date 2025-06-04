import * as Dialog from '@radix-ui/react-dialog';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWalletStore } from '../../stores/walletStore';
import { Button } from '../Button';
import { Input } from '../Input';
import { evmExport } from "../../coreViem/methods/evmExport"
import { pvmImport } from "../../coreViem/methods/pvmImport"
import { pvmExport } from "../../coreViem/methods/pvmExport"
import { useErrorBoundary } from "react-error-boundary"
import { pvm, Utxo, TransferOutput, evm } from '@avalabs/avalanchejs';
import { getRPCEndpoint } from '../../coreViem/utils/rpc';
import { Loader2, X } from 'lucide-react';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Success } from '../Success';


export function PChainBridgeButton() {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState<string>("");
    const [exportLoading, setExportLoading] = useState<boolean>(false);
    const [importLoading, setImportLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [cToP_UTXOs, setC_To_P_UTXOs] = useState<Utxo<TransferOutput>[]>([]);
    const [pToC_UTXOs, setP_To_C_UTXOs] = useState<Utxo<TransferOutput>[]>([]);
    const isFetchingRef = useRef(false);
    const [importTxId, setImportTxId] = useState<string | null>(null);

    const { showBoundary } = useErrorBoundary();
    const { cChainBalance, pChainAddress, walletEVMAddress, coreWalletClient, isTestnet, coreEthAddress, updateCChainBalance, pChainBalance, updatePChainBalance } = useWalletStore();

    const sourceChain = 'c-chain'
    const destinationChain = 'p-chain';
    const currentBalance = cChainBalance;
    const importableUTXOs = cToP_UTXOs;

    const LOW_BALANCE_THRESHOLD = 0.5;

    const onBalanceChanged = useCallback(() => {
        updateCChainBalance()?.catch(showBoundary)
        updatePChainBalance()?.catch(showBoundary)
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
            setAmount("");
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
            const txId = await pvmImport(coreWalletClient, { pChainAddress });

            await pollForUTXOChanges();
            onBalanceChanged();

            setImportTxId(txId);
        } catch (e: any) {
            showBoundary(e);
            setImportError(`Import failed: ${e.message || 'Unknown error'}`);
        } finally {
            setImportLoading(false);
        }
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
                        onClick={() => setOpen(true)}
                        className={`px-2 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors ${pChainBalance < LOW_BALANCE_THRESHOLD && cChainBalance > LOW_BALANCE_THRESHOLD ? "bg-blue-500 hover:bg-blue-600 shimmer" : "bg-zinc-600 hover:bg-zinc-700"
                            } ${open ? "opacity-50 cursor-not-allowed" : ""}`}
                        aria-label="Transfer AVAX C-Chain to P-Chain"
                    >
                        Bridge
                    </button>
                </Dialog.Trigger>
            </div>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow" />
                <Dialog.Content className="flex flex-col gap-6 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] max-w-2xl bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 focus:outline-none data-[state=open]:animate-contentShow border border-zinc-200 dark:border-zinc-800">
                    <Dialog.Title className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                        Bridge AVAX from the C-Chain to the P-Chain
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                        To bridge AVAX from the C-Chain to the P-Chain you need to export it with a ExportTx from the C-Chain and then import it to the P-Chain with an ImportTx.
                    </Dialog.Description>
                    <Steps>
                        <Step>
                            <h3 className="text-xl font-bold mb-4">Export AVAX from the C-Chain</h3>
                            <p className="mb-4">Available: {currentBalance.toFixed(4)} AVAX</p>
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

                            {error && (
                                <div className="text-xs text-red-500 mt-1">
                                    {error}
                                </div>
                            )}

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

                        </Step>
                        <Step>
                            <h3 className="text-xl font-bold my-4">Import AVAX to the P-Chain</h3>

                            <h2 className="text-md font-medium text-zinc-700 dark:text-zinc-300">
                                Exported UTXOs:
                            </h2>
                            <p>Below you can see a list of your UTXOs exported from the C-Chain. You can import them all at once to the P-Chain.</p>
                            <div className="text-sm text-zinc-600 dark:text-zinc-400 py-3 px-4 bg-zinc-50 dark:bg-zinc-800 rounded-md min-h-[80px] my-4">
                                {importableUTXOs.length > 0 ? (
                                    <>
                                        {importableUTXOs.map((utxo, index) => (
                                            <div key={index}>
                                                {(Number(utxo.output.amt.value()) / 1_000_000_000).toFixed(6)} AVAX
                                            </div>
                                        ))}
                                        <div className="mt-2 font-medium text-bold">
                                            Total: {totalUtxoAmount.toFixed(6)} AVAX
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-4 text-center text-zinc-500">
                                        No exported UTXOs to import
                                    </div>
                                )}
                            </div>
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

                            {importError && (
                                <div className="text-xs text-red-500 mt-1">
                                    {importError}
                                </div>
                            )}
                        </Step>
                    </Steps>

                    {importTxId && <Success
                        label="Successfully Bridged from C-Chain to P-Chain"
                        value={importTxId}
                    />}

                    <Dialog.Close asChild>
                        <button
                            className="absolute top-3 right-3 p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                            aria-label="Close"
                            disabled={exportLoading || importLoading}
                            onClick={() => setImportTxId(null)}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
