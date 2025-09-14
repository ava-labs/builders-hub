import { useState, useEffect } from "react";
import { Input } from "./Input";

const IPV4_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9\-\.]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

export const isValidIPv4 = (value: string): boolean => {
    return IPV4_REGEX.test(value);
};

export const isValidDomain = (value: string): boolean => {
    return DOMAIN_REGEX.test(value);
};

export const validateDomainOrIP = (value: string): string | null => {
    if (!value) return null;

    // Check if it's a valid IP address
    if (isValidIPv4(value)) return null;

    // Check if it's a valid domain name
    if (isValidDomain(value)) return null;

    return "Please enter a valid domain name (e.g. example.com) or IP address (e.g. 1.2.3.4)";
};

export const nipify = (domain: string): string => {
    if (isValidIPv4(domain)) {
        return `${domain}.sslip.io`;
    }
    return domain;
};

interface HostInputProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    helperText?: string;
}

export const HostInput = ({
    value,
    onChange,
    label = "Domain or IPv4 address",
    placeholder = "example.com or 1.2.3.4",
    helperText = "Enter your domain name or IP address (e.g. example.com or 1.2.3.4)"
}: HostInputProps) => {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (value) {
            setError(validateDomainOrIP(value));
        } else {
            setError(null);
        }
    }, [value]);

    return (
        <Input
            label={label}
            value={value}
            onChange={(newValue) => onChange(newValue.trim())}
            placeholder={placeholder}
            error={error}
            helperText={helperText}
        />
    );
}; 