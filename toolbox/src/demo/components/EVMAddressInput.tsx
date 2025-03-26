import { Input } from "../../components/input";
import { useState, useEffect } from "react";

interface EVMAddressInputProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    disabled?: boolean;
}

export function EVMAddressInput({ value, onChange, label = "EVM Address", disabled = false }: EVMAddressInputProps) {
    const [error, setError] = useState<string | undefined>();

    const validateAddress = (address: string) => {
        if (!address) {
            setError("Address is required");
            return;
        }

        if (!address.startsWith("0x")) {
            setError("Address must start with 0x");
            return;
        }

        // EVM addresses are 42 characters (0x + 40 hex characters)
        if (address.length !== 42) {
            setError("Address must be 42 characters long");
            return;
        }

        // Check if address contains only valid hex characters after 0x
        const hexRegex = /^0x[0-9a-fA-F]{40}$/;
        if (!hexRegex.test(address)) {
            setError("Address contains invalid characters");
            return;
        }

        setError(undefined);
    };

    useEffect(() => {
        validateAddress(value);
    }, [value]);

    return (
        <div className="space-y-1">
            <Input
                label={label}
                value={value}
                onChange={onChange}
                disabled={disabled}
                helperText={error}
            />
        </div>
    );
} 