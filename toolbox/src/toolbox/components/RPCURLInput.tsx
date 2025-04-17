"use client"

import { Input } from "../../components/Input"
import { useState, useEffect } from "react"
import { AlertTriangle, ExternalLink } from "lucide-react"

interface RPCURLInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
}

export function RPCURLInput({ value, onChange, label = "RPC URL", placeholder, disabled }: RPCURLInputProps) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Only show warning if:
    // 1. The current page is served over HTTPS
    // 2. The input URL starts with http://
    const isHttps = window.location.protocol === 'https:';
    const isHttpUrl = value.startsWith('http://');

    if (isHttps && isHttpUrl) {
      setError('Warning: HTTP URLs are not secure and may not work due to browser security policies. Please use HTTPS or consider the following options:');
    } else {
      setError(null);
    }
  }, [value])

  return (
    <div className="space-y-2">
      <Input label={label} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />
      {error && (
        <div className="p-3 bg-red-50/80 border border-red-200 text-red-900 rounded">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: "#B91C1C" }} />
            <div className="space-y-2 w-full">
              <p className="font-medium">Warning</p>
              <p className="text-sm text-red-800/90">
                HTTP URLs are not secure and may not work due to browser security policies. Please use HTTPS or consider
                the following options:
              </p>
              <div className="space-y-3 text-sm mt-3">
                <div className="border-l-2 border-red-300 pl-3">
                  <h4 className="font-medium">Option 1: Use a Reverse Proxy</h4>
                  <p className="text-red-800/80">
                    Set up a reverse proxy (like Nginx) to forward HTTPS requests to your HTTP endpoint.
                  </p>
                </div>
                <div className="border-l-2 border-red-300 pl-3">
                  <h4 className="font-medium">Option 2: Run the Toolbox Locally</h4>
                  <p className="text-red-800/80">
                    Clone and run the toolbox locally to avoid browser security restrictions.
                    <a
                      href="https://github.com/ava-labs/builders-hub/blob/master/toolbox/README.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-red-700 hover:text-red-900 font-medium ml-1"
                    >
                      View on GitHub
                      <ExternalLink className="h-3.5 w-3.5 ml-0.5 text-red-700" />
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
