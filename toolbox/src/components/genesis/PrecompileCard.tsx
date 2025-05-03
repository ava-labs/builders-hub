import { Check } from "lucide-react";

type PrecompileCardProps = {
    title: string;
    address: string;
    enabled: boolean;
    children?: React.ReactNode;
};

export const PrecompileCard = ({ title, address, enabled, children }: PrecompileCardProps) => {
    return (
        <div className={`border rounded-md p-4 transition-colors ${enabled 
            ? "border-green-300 bg-green-50/30 dark:bg-green-900/20 dark:border-green-800/60" 
            : "dark:border-zinc-800"}`}>
            <div className="flex justify-between items-center">
                <div className="flex-1">
                    <div className="font-medium flex items-center text-zinc-800 dark:text-white">
                        {title}
                        {enabled && <Check className="ml-2 h-4 w-4 text-green-500" />}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-1 break-all">{address}</div>
                </div>
            </div>

            {children && enabled && (
                <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    {children}
                </div>
            )}
        </div>
    );
}; 