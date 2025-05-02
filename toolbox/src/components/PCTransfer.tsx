import { ArrowRight, ArrowLeft } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export default function PCTransfer() {
    return (
        <Dialog.Root>
            <div className="hidden md:flex flex-col items-center justify-center space-y-2 text-zinc-400 dark:text-zinc-600">
                <Dialog.Trigger asChild>
                    <button className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600 shadow-sm">
                        <ArrowRight className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                    </button>
                </Dialog.Trigger>
                <button className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600 shadow-sm">
                    <ArrowLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                </button>
            </div>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 focus:outline-none data-[state=open]:animate-contentShow border border-zinc-200 dark:border-zinc-800">
                    <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                        Transfer C-Chain to P-Chain
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                        Specify the amount you want to transfer.
                    </Dialog.Description>

                    <div className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                        Transfer Form Goes Here
                    </div>

                    <div className="mt-6 flex justify-end space-x-2">
                        <Dialog.Close asChild>
                            <button className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors">
                                Cancel
                            </button>
                        </Dialog.Close>
                    </div>

                    <Dialog.Close asChild>
                        <button
                            className="absolute top-3 right-3 p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>

        </Dialog.Root>
    );
}
