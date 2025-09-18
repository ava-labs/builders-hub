import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import CrossChainTransfer from '../../console/primary-network/CrossChainTransfer';
import { X } from 'lucide-react';

export function BridgeButton() {
    const [open, setOpen] = useState(false);
    const { pChainBalance, cChainBalance } = useWalletStore();

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <button
                    className={`hidden md:block px-2 py-1 text-xs font-medium text-white rounded transition-colors ${pChainBalance < 0.5 && cChainBalance > 0.5
                        ? "bg-blue-500 hover:bg-blue-600 shimmer"
                        : "bg-zinc-600 hover:bg-zinc-700"
                        }`}
                    aria-label="Transfer AVAX between chains"
                >
                    Bridge
                </button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-5xl h-[90vh] bg-white dark:bg-zinc-900 rounded-lg shadow-lg focus:outline-none border border-zinc-200 dark:border-zinc-800 flex flex-col">
                    <Dialog.Close asChild>
                        <button
                            className="absolute top-4 right-4 p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors z-10"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </Dialog.Close>

                    <div className="overflow-y-auto flex-1 p-6">
                        <CrossChainTransfer />
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
