import InputSubnetId from "./InputSubnetId";
import { Input, type Suggestion } from "./Input";
import { useCreateChainStore } from "../stores/createChainStore";
import { useL1ListStore } from "../stores/l1ListStore";
import type { L1ListItem } from "../stores/l1ListStore";
import { useMemo } from "react";

export default function SelectSubnetId({
    value,
    onChange,
    error,
    onlyNotConverted = false,
    hidePrimaryNetwork = false,
    label = "Subnet ID",
    helperText,
    id
}: {
    value: string,
    onChange: (value: string) => void,
    error?: string | null,
    onlyNotConverted?: boolean,
    hidePrimaryNetwork?: boolean,
    label?: string,
    helperText?: string | null,
    id?: string
}) {
    // This component adds filtering logic on top of InputSubnetId
    // If onlyNotConverted is true, it filters out converted subnets

    const createChainStoreSubnetId = useCreateChainStore()(({ subnetId }: { subnetId: string }) => subnetId);
    const l1List = useL1ListStore()(({ l1List }: { l1List: L1ListItem[] }) => l1List);

    // Create filtered suggestions if onlyNotConverted is true
    const filteredSuggestions: Suggestion[] | undefined = useMemo(() => {
        if (!onlyNotConverted) {
            // If no filtering needed, let InputSubnetId handle suggestions
            return undefined;
        }

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

            // Filter out converted subnets when onlyNotConverted is true
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

    // If we need custom filtering, use Input directly with filtered suggestions
    // Otherwise, use InputSubnetId which has its own suggestions and validation
    if (onlyNotConverted && filteredSuggestions) {
        return (
            <Input
                id={id}
                label={label}
                value={value}
                onChange={onChange}
                suggestions={filteredSuggestions}
                error={error}
                helperText={helperText}
            />
        );
    }

    return (
        <InputSubnetId
            id={id}
            label={label}
            value={value}
            onChange={onChange}
            error={error}
            hidePrimaryNetwork={hidePrimaryNetwork}
            helperText={helperText}
        />
    );
}
