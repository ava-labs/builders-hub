import { Input } from "../../components/Input";
import { useState } from "react";

interface PrecompileAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  precompileName: string;
  defaultAddress: string;
  disabled?: boolean;
}

export function PrecompileAddressInput({
  value,
  onChange,
  precompileName,
  defaultAddress,
  disabled = false,
}: PrecompileAddressInputProps) {
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

  return (
    <div className="space-y-2">
      <Input
        label={`${precompileName} Address`}
        value={value}
        onChange={onChange}
        disabled={disabled}
        helperText={error}
      />
      <p className="text-sm text-gray-500">
        This is the commonly used address for {precompileName}. The address can
        be modified in the genesis configuration.
      </p>
    </div>
  );
}
