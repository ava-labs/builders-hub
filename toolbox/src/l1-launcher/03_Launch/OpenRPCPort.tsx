import { useL1LauncherStore } from '../L1LauncherStore';
import NextPrev from "../components/NextPrev";
import { Note } from '../../components/Note';
import { CodeHighlighter } from '../../components/CodeHighlighter';
import { Button } from '../../components/Button';
import { useState, useEffect } from 'react';
import { RadioGroup } from '../../components/RadioGroup';
import { Input } from '../../components/Input';

type LocationType = 'local' | 'remote';
type DomainType = 'has-domain' | 'no-domain' | 'manual-ssl';
type CheckStatus = 'idle' | 'loading' | 'success' | 'error';

const caddyDockerCommand = (domain: string) => `docker run -d \\
  --name caddy \\
  --network host \\
  -v caddy_data:/data \\
  caddy:2.8-alpine \\
  caddy reverse-proxy --from ${domain} --to localhost:8080`;

const isValidDomain = (domain: string): boolean => {
    const pattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return pattern.test(domain);
};

const isValidIP = (ip: string): boolean => {
    const pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return pattern.test(ip);
};

const CheckRPC = ({ endpoint, onSuccess, evmChainId }: { endpoint: string, onSuccess?: () => void, evmChainId: number }) => {
    const [status, setStatus] = useState<CheckStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string>('');

    const testRpcEndpoint = async () => {
        setStatus('loading');
        setErrorMessage('');

        const data = {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_chainId",
            params: []
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                mode: 'cors', // Ensure CORS is handled
            });

            // Check for non-OK response status first
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Network error: ${response.status} ${response.statusText} - ${errorText.slice(0, 100)}`);
            }

            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (jsonError) {
                throw new Error(`Unexpected response format: ${responseText.slice(0, 100)}`);
            }

            if (result.error) {
                throw new Error(`RPC Error: ${result.error.message}`);
            }

            if (!result.result) {
                throw new Error('Invalid RPC response: missing result field');
            }

            const chainId = parseInt(result.result, 16);
            if (chainId !== evmChainId) {
                throw new Error(`Chain ID mismatch. Expected ${evmChainId} (0x${evmChainId.toString(16)}), got ${chainId} (${result.result})`);
            }

            setStatus('success');
            onSuccess?.();
        } catch (error) {
            console.error('Error testing RPC endpoint:', error);
            let msg = error instanceof Error ? error.message : 'Failed to connect to RPC endpoint.';
            // Add more specific guidance for common errors
            if (msg.includes('Network error') || msg.includes('Failed to fetch')) {
                msg += ' Ensure the endpoint is correct, the server is running, and check CORS policy if applicable.'
            } else if (msg.includes('Chain ID mismatch')) {
                msg += ' Ensure the RPC node is tracking the correct chain.'
            }
            setErrorMessage(msg);
            setStatus('error');
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="font-medium">Verify your setup:</h3>
            <div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Test your endpoint:</label>
                    <div className="flex">
                        <div className="flex-1 px-3 py-2 border rounded-l-md bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-gray-100 font-mono text-sm truncate flex items-center">
                            {endpoint}
                        </div>
                        <Button
                            onClick={testRpcEndpoint}
                            stickLeft
                        >
                            {status === 'loading' ? 'Testing...' : 'Test'}
                        </Button>
                    </div>
                </div>
            </div>

            {
                status === 'error' && (
                    <Note variant="destructive">{errorMessage}</Note>
                )
            }

            {
                status === 'success' && (
                    <Note variant="success">Successfully connected to RPC endpoint!</Note>
                )
            }

            <p>
                A successful test means your RPC node is properly configured and accessible.
            </p>
        </div >
    );
};


export default function OpenRPCPort() {
    const {
        nodesCount,
        rpcLocationType,
        setRpcLocationType,
        rpcDomainType,
        setRpcDomainType,
        rpcAddress,
        setRpcAddress,
        rpcVerified,
        setRpcVerified,
        evmChainId,
        evmRpcURL,
        setEvmRpcURL,
        chainId
    } = useL1LauncherStore();


    const isAddressValid = () => {
        if (!rpcAddress) return false;
        if (rpcDomainType === 'no-domain') {
            return isValidIP(rpcAddress);
        }
        return isValidDomain(rpcAddress);
    };


    useEffect(() => {
        if (rpcLocationType === 'local') {
            setEvmRpcURL(`http://localhost:9650/ext/bc/${chainId}/rpc`);
        } else if (rpcDomainType === 'has-domain') {
            setEvmRpcURL(`https://${rpcAddress}/ext/bc/${chainId}/rpc`);
        } else if (rpcDomainType === 'no-domain') {
            setEvmRpcURL(`https://${rpcAddress}.nip.io/ext/bc/${chainId}/rpc`);
        } else if (rpcDomainType === 'manual-ssl') {
            setEvmRpcURL(`https://${rpcAddress}/ext/bc/${chainId}/rpc`);
        } else {
            throw new Error('An unexpected error occurred. This is not your fault: Invalid RPC domain type.');
        }
    }, [rpcLocationType, rpcDomainType, rpcAddress, chainId]);

    const locationItems = [
        { value: 'local', label: `Running locally (or port forwarding)${nodesCount !== 1 ? ' - Single node only' : ''}`, isDisabled: nodesCount !== 1 },
        { value: 'remote', label: 'Running on a remote server' }
    ];

    const domainItems = [
        { value: 'has-domain', label: 'I have a domain' },
        { value: 'no-domain', label: "I don't have a domain" },
        { value: 'manual-ssl', label: "I'll manage SSL myself" }
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-medium mb-4">Configure Access to your RPC Node</h1>
                <p>In this step we will configure the access to the RPC nodes. If necessary, we will launch a reverse proxy using Docker.</p>
            </div>

            <div className="space-y-4">
                <h3 className="font-medium">Where is your RPC node running?</h3>
                <RadioGroup
                    items={locationItems}
                    value={rpcLocationType}
                    onChange={(v) => setRpcLocationType(v as LocationType)}
                    idPrefix="location-"
                />
            </div>

            {rpcLocationType === 'local' && (
                <div>
                    <p>Your RPC endpoint will be available at: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-sm">{evmRpcURL}</code></p>
                </div>
            )}

            {rpcLocationType === 'remote' && (
                <>
                    <div className="space-y-4">
                        <h3 className="font-medium">Do you have a domain name?</h3>
                        <RadioGroup
                            items={domainItems}
                            value={rpcDomainType}
                            onChange={(v) => {
                                setRpcDomainType(v as DomainType);
                                setRpcVerified(false); // Reset verification when changing domain type
                            }}
                            idPrefix="domain-"
                        />
                    </div>

                    <div className="space-y-4">
                        <label className="block font-medium" htmlFor="rpc-address-input">
                            {rpcDomainType === 'no-domain' ? 'Server IP Address:' : 'Domain Name:'}
                        </label>
                        {rpcDomainType === 'manual-ssl' && (
                            <Note>
                                <p className="font-medium mb-1">Configure your reverse proxy:</p>
                                <p>
                                    Make sure your SSL-enabled reverse proxy forwards port 443 to <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-blue-900 dark:text-blue-200">localhost:8080</code>
                                </p>
                            </Note>
                        )}
                        {rpcDomainType === 'no-domain' && (
                            <Note>
                                <p className="font-medium mb-1">Get your server's public IP:</p>
                                <div className="my-2" >
                                    <CodeHighlighter lang="bash" code="curl checkip.amazonaws.com" />
                                </div>
                                <p>Run this command on your RPC server and paste the result below.</p>
                            </Note>
                        )}
                        <Input
                            label={rpcDomainType === 'no-domain' ? 'Server IP Address:' : 'Domain Name:'}
                            id="rpc-address-input"
                            type="text"
                            value={rpcAddress}
                            onChange={(val: string) => {
                                setRpcAddress(val);
                                setRpcVerified(false); // Reset verification on address change
                            }}
                            placeholder={rpcDomainType === 'no-domain' ? '123.45.67.89' : 'your-l1-domain.com'}
                            className={rpcAddress && !isAddressValid() ? 'border-red-500' : ''}
                        />
                        {rpcAddress && !isAddressValid() && (
                            <p className="text-red-500 text-sm">
                                {rpcDomainType === 'no-domain'
                                    ? 'Please enter a valid IP address (e.g., 123.45.67.89)'
                                    : 'Please enter a valid domain name (e.g., your-l1-domain.com)'}
                            </p>
                        )}

                        {rpcDomainType === 'no-domain' && rpcAddress && isAddressValid() && (
                            <Note>
                                We'll use nip.io service to create a domain-like address: <code className="bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-blue-900 dark:text-blue-200">{`${rpcAddress}.nip.io`}</code>
                            </Note>
                        )}

                        {rpcAddress && isAddressValid() && rpcDomainType !== 'manual-ssl' && (
                            <div className="space-y-2">
                                <h3 className="font-medium">Set up HTTPS proxy:</h3>
                                <p>Run this command on your RPC node server:</p>
                                <CodeHighlighter lang="bash" code={caddyDockerCommand(rpcDomainType === 'no-domain' ? `${rpcAddress}.nip.io` : rpcAddress)} />
                            </div>
                        )}
                    </div>

                    {rpcAddress && isAddressValid() && (
                        <>
                            <CheckRPC
                                endpoint={evmRpcURL} // Use the derived endpoint
                                onSuccess={() => setRpcVerified(true)}
                                evmChainId={evmChainId}
                            />
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="verifySetup"
                                    checked={rpcVerified}
                                    onChange={(e) => setRpcVerified(e.target.checked)}
                                    disabled={!rpcVerified} // Disable if CheckRPC didn't succeed
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="verifySetup" className="ml-2">
                                    I confirm the RPC endpoint test was successful
                                </label>
                            </div>
                        </>
                    )}
                </>
            )}

            <NextPrev
                nextEnabled={(rpcLocationType === 'local') || (rpcLocationType === 'remote' && isAddressValid() && rpcVerified)}
            />
        </div>
    );
}
