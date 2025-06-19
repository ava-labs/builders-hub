import { Input, type Suggestion } from "./Input";
import { useCreateChainStore } from "../stores/createChainStore";
import { useL1ListStore } from "../stores/l1ListStore";
import { useMemo } from "react";

export default function InputSubnetId({ value, onChange, error, onlyNotConverted = false, hidePrimaryNetwork = false }: { value: string, onChange: (value: string) => void, error?: string | null, onlyNotConverted?: boolean, hidePrimaryNetwork?: boolean }) {
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const l1List = useL1ListStore()(state => state.l1List);

    const subnetIdSuggestions: Suggestion[] = useMemo(() => {
        const result: Suggestion[] = [];
        const seen = new Set<string>();
        const PRIMARY_NETWORK_ID = "11111111111111111111111111111111LpoYY";
    
        if (createChainStoreSubnetId) {
            result.push({
                title: createChainStoreSubnetId,
                value: createChainStoreSubnetId,
                description: 'The Subnet that you have just created in the "Create Chain" tool',
            });
            seen.add(createChainStoreSubnetId);
        }
    
        for (const l1 of l1List) {
            const { subnetId, name, validatorManagerAddress } = l1;
    
            if (!subnetId || seen.has(subnetId)) continue;
    
            const isPrimary = subnetId === PRIMARY_NETWORK_ID;
            const isConverted = !!validatorManagerAddress;
    
            if ((onlyNotConverted && (isPrimary || isConverted)) || (hidePrimaryNetwork && isPrimary)) {
                continue;
            }
    
            result.push({
                title: `${name} (${subnetId})`,
                value: subnetId,
                description: l1.description || 'A chain that was added to your L1 list.',
            });
    
            seen.add(subnetId);
        }
    
        return result;
    }, [createChainStoreSubnetId, l1List, onlyNotConverted, hidePrimaryNetwork]);
    

    return <Input
        label="Subnet ID"
        value={value}
        onChange={onChange}
        suggestions={subnetIdSuggestions}
        error={error}
    />
}
