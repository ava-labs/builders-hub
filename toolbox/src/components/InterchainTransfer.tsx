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
import { pvm, Utxo, TransferOutput, evm } from '@avalabs/avalanchejs';
import { getRPCEndpoint } from '../coreViem/utils/rpc';

interface InterchainTransferProps {
    onBalanceChanged?: () => void;
}

export default function InterchainTransfer({ onBalanceChanged = () => { } }: InterchainTransferProps) {
    const [open, setOpen] = useState(false);
    const [direction, setDirection] = useState<'c-to-p' | 'p-to-c'>('c-to-p');
    const [amount, setAmount] = useState<string>("");
    const [availableBalance, setAvailableBalance] = useState<number>(0);
    const [pChainAvailableBalance, setPChainAvailableBalance] = useState<number>(0);
    const [exportLoading, setExportLoading] = useState<boolean>(false);
    const [importLoading, setImportLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [cToP_UTXOs, setC_To_P_UTXOs] = useState<Utxo<TransferOutput>[]>([]);
    const [pToC_UTXOs, setP_To_C_UTXOs] = useState<Utxo<TransferOutput>[]>([]);

    const { showBoundary } = useErrorBoundary();
    const { pChainAddress, walletEVMAddress, coreWalletClient, publicClient, isTestnet, coreEthAddress } = useWalletStore();

    const sourceChain = direction === 'c-to-p' ? 'c-chain' : 'p-chain';
    const destinationChain = direction === 'c-to-p' ? 'p-chain' : 'c-chain';
    const currentBalance = direction === 'c-to-p' ? availableBalance : pChainAvailableBalance;
    const importableUTXOs = direction === 'c-to-p' ? cToP_UTXOs : pToC_UTXOs;

    // Fetch UTXOs from both chains
    const fetchUTXOs = async () => {
        if (!pChainAddress || !walletEVMAddress) return;

        try {
            const platformEndpoint = getRPCEndpoint(Boolean(isTestnet));
            const pvmApi = new pvm.PVMApi(platformEndpoint);

            const cChainUTXOs = await pvmApi.getUTXOs({
                addresses: [pChainAddress],
                sourceChain: 'C'
            });
            setC_To_P_UTXOs(cChainUTXOs.utxos as Utxo<TransferOutput>[]);
            console.log('pvmApi UTXOs', cChainUTXOs.utxos);

            const evmApi = new evm.EVMApi(platformEndpoint);

            // Get P-chain UTXOs (for P->C transfers)
            const pChainUTXOs = await evmApi.getUTXOs({
                addresses: [coreEthAddress],
                sourceChain: 'P'
            });
            setP_To_C_UTXOs(pChainUTXOs.utxos as Utxo<TransferOutput>[]);
            console.log('evmApi UTXOs', pChainUTXOs.utxos);
        } catch (e) {
            console.error("Error fetching UTXOs:", e);
        }
    };

    // Fetch balances
    const fetchBalances = async () => {
        setError(null);
        if (publicClient && walletEVMAddress) {
            try {
                const balance = await publicClient.getBalance({
                    address: walletEVMAddress as `0x${string}`,
                });
                setAvailableBalance(Number(balance) / 1e18);
            } catch (e) {
                console.error("Error fetching C-Chain balance:", e);
            }
        }

        if (coreWalletClient && pChainAddress) {
            try {
                const balance = await coreWalletClient.getPChainBalance();
                setPChainAvailableBalance(Number(balance) / 1e9);
            } catch (e) {
                console.error("Error fetching P-Chain balance:", e);
            }
        }
    };

    // Initial data load and polling setup
    useEffect(() => {
        if (open) {
            fetchBalances();
            fetchUTXOs();

            // Set up polling for UTXOs and balances
            const interval = setInterval(() => {
                fetchUTXOs();
                fetchBalances();
            }, 3000);

            return () => clearInterval(interval);
        }
    }, [open, publicClient, walletEVMAddress, pChainAddress, coreWalletClient]);

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

            // After export, update UTXOs and balances
            await fetchUTXOs();
            await fetchBalances();

            // Notify parent component of balance change
            onBalanceChanged();
        } catch (e: any) {
            showBoundary(e);
            setError(`Export failed: ${e.message || 'Unknown error'}`);
        } finally {
            setExportLoading(false);
        }
    };

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

            // After import, update UTXOs and balances
            await fetchUTXOs();
            await fetchBalances();

            // Notify parent component of balance change
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
                        className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600 shadow-sm"
                        aria-label="Transfer C-Chain to P-Chain"
                    >
                        <ArrowRight className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                    </button>
                </Dialog.Trigger>
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
                                Pending transfers:
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
                                        No pending transfers to import
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
