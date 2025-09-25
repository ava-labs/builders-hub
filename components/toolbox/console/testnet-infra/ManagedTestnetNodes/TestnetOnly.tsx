import { X } from "lucide-react";

export default function TestnetOnly() {
    return (
        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <X className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
                Testnet Only Feature
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Builder Hub Nodes are only available on testnet. Switch to Fuji testnet to create and manage nodes for your L1s.
            </p>
        </div>
    );
}
