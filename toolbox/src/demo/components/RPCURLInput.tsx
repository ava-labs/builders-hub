import { Input } from "../ui";
import { useState, useEffect } from "react";

interface RPCURLInputProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
}

export function RPCURLInput({ value, onChange, label = "RPC URL", placeholder, disabled }: RPCURLInputProps) {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (value.startsWith('http://')) {
            setError('Warning: HTTP URLs are not secure and may not work due to browser security policies. Please use HTTPS or consider the following options:');
        } else {
            setError(null);
        }
    }, [value]);

    return (
        <div className="space-y-2">
            <Input
                label={label}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
            />
            {error && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded">
                    <p className="font-medium mb-2">{error}</p>
                    <div className="space-y-2">
                        <div>
                            <h4 className="font-medium">Option 1: Use a Reverse Proxy</h4>
                            <p className="text-sm">Set up a reverse proxy (like Nginx) to forward HTTPS requests to your HTTP endpoint.</p>
                        </div>
                        <div>
                            <h4 className="font-medium">Option 2: Run the Toolbox Locally</h4>
                            <p className="text-sm">
                                Clone and run the toolbox locally to avoid browser security restrictions. 
                                <a 
                                    href="https://github.com/ava-labs/builders-hub" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 ml-1"
                                >
                                    View instructions on GitHub
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 