import { Input, type Suggestion } from "../../components/Input";
import { useCreateChainStore, useL1ListStore } from "../toolboxStore";
import { useMemo } from "react";

export default function InputChainId({ value, onChange, error, label = "Avalanche Blockchain ID" }: { value: string, onChange: (value: string) => void, error?: string | null, label?: string }) {
    const createChainStorechainID = useCreateChainStore()(state => state.chainID);
    const { l1List } = useL1ListStore()();

    const chainIDSuggestions: Suggestion[] = useMemo(() => {
        const result: Suggestion[] = [];

        if (createChainStorechainID) {
            result.push({
                title: createChainStorechainID,
                value: createChainStorechainID,
                description: "From the \"Create Chain\" tool"
            });
        }

        for (const l1 of l1List) {
            result.push({
                title: `${l1.name} (${l1.id})`,
                value: l1.id,
                description: "From your chain list"
            });
        }

        return result;
    }, [createChainStorechainID, l1List]);

    return <Input
        label={label}
        value={value}
        onChange={onChange}
        suggestions={chainIDSuggestions}
        error={error}
    />
}
