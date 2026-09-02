import { useState, useEffect } from 'react';
import { Input } from './Input';
import { isValidIPv4, nipify } from '../lib/rpcUrl';

// Canonical implementations moved to lib/rpcUrl.ts (pure, vitest-covered);
// re-exported here so existing importers keep working.
export { nipify };

const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9\-\.]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

const isValidDomain = (value: string): boolean => {
  return DOMAIN_REGEX.test(value);
};

const validateDomainOrIP = (value: string): string | null => {
  if (!value) return null;

  // Check if it's a valid IP address
  if (isValidIPv4(value)) return null;

  // Check if it's a valid domain name
  if (isValidDomain(value)) return null;

  return 'Please enter a valid domain name (e.g. example.com) or IP address (e.g. 1.2.3.4)';
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
  label = 'Domain or IPv4 address',
  placeholder = 'example.com or 1.2.3.4',
  helperText = 'Enter your domain name or IP address (e.g. example.com or 1.2.3.4)',
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
