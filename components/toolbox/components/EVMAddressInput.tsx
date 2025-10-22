import { Input, Suggestion } from "./Input";
import { useState, useEffect } from "react";
import { isAddress } from "viem";
import type React from "react";

interface EVMAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  helperText?: React.ReactNode;
  placeholder?: string;
  suggestions?: Suggestion[];
  button?: React.ReactNode;
}

export function EVMAddressInput({
  value,
  onChange,
  label = "EVM Address",
  disabled = false,
  helperText,
  placeholder,
  suggestions,
  button,
}: EVMAddressInputProps) {
  const [validationError, setValidationError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);

  const validateAddress = (address: string) => {
    if (!address) {
      setValidationError("Address is required");
      return;
    }

    if (!address.startsWith("0x")) {
      setValidationError("Address must start with 0x");
      return;
    }

    // EVM addresses are 42 characters (0x + 40 hex characters)
    if (address.length !== 42) {
      setValidationError("Address must be 42 characters long");
      return;
    }

    // Check if address contains only valid hex characters after 0x
    const hexRegex = /^0x[0-9a-fA-F]{40}$/;
    if (!hexRegex.test(address)) {
      setValidationError("Address contains invalid characters");
      return;
    }

    if (!isAddress(address)) {
      setValidationError("Invalid address");
      return;
    }

    setValidationError(undefined);
  };

  useEffect(() => {
    // Only validate if the field has been touched or if there's a value
    if (touched || value) {
      validateAddress(value);
    }
  }, [value, touched]);

  const handleChange = (newValue: string) => {
    if (!touched) {
      setTouched(true);
    }
    onChange(newValue);
  };

  return (
    <div className="space-y-1">
      <Input
        label={label}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        error={touched ? validationError : undefined}
        helperText={helperText}
        placeholder={placeholder}
        suggestions={suggestions}
        button={button}
      />
    </div>
  );
}
