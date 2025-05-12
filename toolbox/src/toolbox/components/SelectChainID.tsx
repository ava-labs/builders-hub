import { useState, useId } from "react";
import { useCreateChainStore, useL1ListStore } from "../toolboxStore";
import { useMemo } from "react";
import { cn } from "../../lib/utils";

interface ChainOption {
    id: string;
    name: string;
    description: string;
}

export default function SelectChainID({
    value,
    onChange,
    error,
    label = "Select Avalanche Blockchain ID"
}: {
    value: string,
    onChange: (value: string) => void,
    error?: string | null,
    label?: string
}) {
    const [isOpen, setIsOpen] = useState(false);
    const createChainStorechainID = useCreateChainStore()(state => state.chainID);
    const { l1List } = useL1ListStore()();
    const selectId = useId();

    const options: ChainOption[] = useMemo(() => {
        const result: ChainOption[] = [];

        if (createChainStorechainID) {
            result.push({
                id: createChainStorechainID,
                name: createChainStorechainID,
                description: "From the \"Create Chain\" tool"
            });
        }

        for (const l1 of l1List) {
            result.push({
                id: l1.id,
                name: `${l1.name} (${l1.id})`,
                description: "From your chain list"
            });
        }

        return result;
    }, [createChainStorechainID, l1List]);

    const selectedOption = options.find(option => option.id === value);

    return (
        <div className="space-y-2 mb-6">
            <label htmlFor={selectId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {label}
            </label>

            <div className="relative">
                <button
                    id={selectId}
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "w-full rounded-md px-3 py-2.5 text-left",
                        "bg-white dark:bg-zinc-900",
                        "border-1",
                        error
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
                            : "border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-primary/30",
                        "text-zinc-900 dark:text-zinc-100",
                        "shadow-sm",
                        "transition-colors duration-200",
                        "focus:outline-none focus:ring-2",
                    )}
                >
                    {selectedOption ? (
                        <div>
                            <div className="font-medium">{selectedOption.name}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{selectedOption.description}</div>
                        </div>
                    ) : (
                        <div className="text-zinc-400 dark:text-zinc-500">Select a chain ID</div>
                    )}
                </button>

                {isOpen && (
                    <div className="z-50 mt-1 w-full bg-white dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700 max-h-60 overflow-auto absolute">
                        <div className="py-1">
                            {options.map((option) => (
                                <div
                                    key={option.id}
                                    className="px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer transition-colors text-left"
                                    onClick={() => {
                                        onChange(option.id);
                                        setIsOpen(false);
                                    }}
                                >
                                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{option.name}</div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{option.description}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    );
}
