import { Globe } from "lucide-react";
import TokenBalance from "./TokenBalance";
import { AddressCopy } from "./AddressCopy";

export const ChainCard = ({
    name,
    logoUrl,
    badgeText,
    tokenBalance,
    tokenSymbol,
    onTokenRefreshClick,
    address,
    buttons
}: {
    name: string;
    logoUrl: string;
    badgeText: string
    tokenBalance: number;
    tokenSymbol: string;
    onTokenRefreshClick: () => Promise<void> | undefined;
    address: string,
    buttons: React.ReactNode[]
}) => {
    return <div className="flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 h-full">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden flex items-center justify-center">
                    {logoUrl ? (
                        <img src={logoUrl} alt={`${name} logo`} className="w-full h-full object-cover" />
                    ) : (
                        <Globe className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
                    )}
                </div>
                <span className="text-zinc-600 dark:text-zinc-400 text-xl font-medium">
                    {name}
                </span>

            </div>
            
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">{badgeText}</span>

        </div>

        <TokenBalance
            balance={tokenBalance}
            symbol={tokenSymbol}
            onClick={onTokenRefreshClick}
        />

        <div className="flex gap-2">
            {buttons}
        </div>

        <AddressCopy address={address} />
    </div>
}