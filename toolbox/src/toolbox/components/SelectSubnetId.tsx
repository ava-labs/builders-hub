import { Input, type Suggestion } from "../../components/Input";
import { useCreateChainStore, useL1ListStore } from "../toolboxStore";
import { useMemo } from "react";

export default function InputSubnetId({ value, onChange, error }: { value: string, onChange: (value: string) => void, error?: string | null }) {
    const createChainStoreSubnetId = useCreateChainStore(state => state.subnetId);
    const { l1List } = useL1ListStore();

    const subnetIdSuggestions: Suggestion[] = useMemo(() => {
        const result: Suggestion[] = [];

        if (createChainStoreSubnetId) {
            result.push({
                title: createChainStoreSubnetId,
                value: createChainStoreSubnetId,
                description: "From the \"Create Subnet\" tool"
            });
        }

        for (const l1 of l1List) {
            if (l1.subnetId) {
                result.push({
                    title: `${l1.name} (${l1.subnetId})`,
                    value: l1.subnetId,
                    description: "From your chain list"
                });
            }
        }

        return result;
    }, [createChainStoreSubnetId, l1List]);

    return <Input
        label="Subnet ID"
        value={value}
        onChange={onChange}
        suggestions={subnetIdSuggestions}
        error={error}
    />
}
