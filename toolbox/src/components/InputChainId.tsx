import { Input, type Suggestion } from "./Input";
import { useL1ListStore } from "../stores/l1ListStore";
import { useCreateChainStore } from "../stores/createChainStore";
import { useMemo } from "react";

// Primary network chain IDs
const PRIMARY_NETWORK_CHAIN_IDS = [
    "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5", // Mainnet
    "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp" // Fuji
];

export default function InputChainId({ 
    value, 
    onChange, 
    error, 
    label = "Avalanche Blockchain ID",
    hidePrimaryNetwork = false
}: { 
    value: string, 
    onChange: (value: string) => void, 
    error?: string | null, 
    label?: string,
    hidePrimaryNetwork?: boolean
}) {
    const createChainStorechainID = useCreateChainStore()(state => state.chainID);
    const createChainStoredChainName = useCreateChainStore()(state => state.chainName);
    const { l1List } = useL1ListStore()();

    const chainIDSuggestions: Suggestion[] = useMemo(() => {
        const result: Suggestion[] = [];

        if (createChainStorechainID && !(hidePrimaryNetwork && PRIMARY_NETWORK_CHAIN_IDS.includes(createChainStorechainID))) {
            result.push({
                title: `${createChainStoredChainName} (${createChainStorechainID})`,
                value: createChainStorechainID,
                description: "From the \"Create Chain\" tool"
            });
        }

        for (const l1 of l1List) {
            
            if (hidePrimaryNetwork && PRIMARY_NETWORK_CHAIN_IDS.includes(l1.id)) {
                continue;
            }
            
            result.push({
                title: `${l1.name} (${l1.id})`,
                value: l1.id,
                description: "From your chain list"
            });
        }

        return result;
    }, [createChainStorechainID, createChainStoredChainName, l1List, hidePrimaryNetwork]);

    return <Input
        label={label}
        value={value}
        onChange={onChange}
        suggestions={chainIDSuggestions}
        error={error}
    />
}
