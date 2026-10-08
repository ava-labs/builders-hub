'use client';

import { Input } from './Input';
import { useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface RPCURLInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  helperText?: string;
}

export function RPCURLInput({
  value,
  onChange,
  label = 'RPC URL',
  placeholder,
  disabled,
  helperText,
}: RPCURLInputProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only show warning if:
    // 1. The current page is served over HTTPS
    // 2. The input URL starts with http://
    const isHttps = window.location.protocol === 'https:';
    const isHttpUrl = value.startsWith('http://');

    if (isHttps && isHttpUrl) {
      setError(
        'Warning: HTTP URLs are not secure and may not work due to browser security policies. Please use HTTPS or consider the following options:',
      );
    } else {
      setError(null);
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <Input label={label} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />
      {helperText && !error && <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{helperText}</p>}
      {error && (
        <div className="border border-red-200 bg-red-50/60 p-3 text-[13px] text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
            <div className="space-y-2 w-full">
              <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]">Warning</p>
              <p className="text-[13px]">
                HTTP URLs are not secure and may not work due to browser security policies. Please use HTTPS or consider
                the following options:
              </p>
              <div className="mt-3 space-y-3 text-[13px]">
                <div className="border-l-2 border-red-300 pl-3 dark:border-red-800">
                  <h4 className="font-medium">Option 1: Use a Reverse Proxy</h4>
                  <p className="text-[12px] opacity-80">
                    Set up a reverse proxy (like Nginx) to forward HTTPS requests to your HTTP endpoint.
                  </p>
                </div>
                <div className="border-l-2 border-red-300 pl-3 dark:border-red-800">
                  <h4 className="font-medium">Option 2: Run the Toolbox Locally</h4>
                  <p className="text-[12px] opacity-80">
                    Clone and run the toolbox locally to avoid browser security restrictions.
                    <a
                      href="https://github.com/ava-labs/builders-hub/blob/master/toolbox/README.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/link ml-1 inline-flex items-center font-medium underline-offset-4 hover:underline"
                    >
                      View on GitHub
                      <ExternalLink className="ml-0.5 h-3 w-3 transition-colors group-hover/link:text-[#E6212F]" />
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
