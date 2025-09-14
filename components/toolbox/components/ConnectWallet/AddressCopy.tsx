import { Copy } from "lucide-react";
import { useEffect, useState } from "react";


export const AddressCopy = ({
    address
}: {
    address: string;
}) => {
    const [isClient, setIsClient] = useState<boolean>(false)

    // Set isClient to true once component mounts (client-side only)
    useEffect(() => {
        setIsClient(true)
    }, [])
    

    const copyToClipboard = (text: string) => {
        if (isClient) {
            navigator.clipboard.writeText(text)
        }
    }

    return (<div className="mt-1 flex items-center justify-between">
        <div className="font-mono text-xs text-zinc-700 dark:text-black bg-zinc-100 dark:bg-zinc-300 px-3 py-1.5 rounded-md overflow-x-auto shadow-sm border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-200 transition-colors flex-1 mr-2 truncate">
            {address ? address : "Loading..."}
        </div>
        {address && (
            <button
                onClick={() => copyToClipboard(address)}
                className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-600 shadow-sm"
                title="Copy address"
            >
                <Copy className="w-3.5 h-3.5 text-zinc-600 dark:text-black" />
            </button>
        )}
    </div>);

    };