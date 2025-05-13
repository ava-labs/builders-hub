import { useEffect } from "react";
import { useState } from "react";
import { Suggestion } from "../../components/Input"
import { useSelectedL1, useToolboxStore } from "../toolboxStore";
import { EVMAddressInput } from "./EVMAddressInput"

export default function TeleporterRegistryAddressInput({ value, onChange, disabled }: { value: string, onChange: (value: string) => void, disabled: boolean }) {
    const {
        teleporterRegistryAddress,
    } = useToolboxStore();
    const selectedL1 = useSelectedL1()();

    const teleporterRegistryAddressSuggestions: Suggestion[] = []

    const [initRan, setInitRan] = useState(false);
    useEffect(() => {
        if (initRan) return;
        setInitRan(true);

        if (value) return
        if (teleporterRegistryAddress) {
            onChange(teleporterRegistryAddress);
            return;
        }
        if (selectedL1?.wellKnownTeleporterRegistryAddress) {
            onChange(selectedL1.wellKnownTeleporterRegistryAddress);
            return;
        }
    }, [value, teleporterRegistryAddress, selectedL1?.wellKnownTeleporterRegistryAddress]);

    if (teleporterRegistryAddress) {
        teleporterRegistryAddressSuggestions.push({
            title: teleporterRegistryAddress,
            value: teleporterRegistryAddress,
            description: "The contract you deployed yourself"
        })
    }
    if (selectedL1?.wellKnownTeleporterRegistryAddress) {
        teleporterRegistryAddressSuggestions.push({
            title: selectedL1.wellKnownTeleporterRegistryAddress,
            value: selectedL1.wellKnownTeleporterRegistryAddress,
            description: "The well known teleporter registry address for this chain"
        })
    }

    return (
        <EVMAddressInput
            label="Teleporter Registry Address"
            value={value}
            onChange={onChange}
            disabled={disabled}
            suggestions={teleporterRegistryAddressSuggestions}
        />
    )
}
