import React from 'react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { nipify, HostInput } from './HostInput';
import { HealthCheckButton } from './HealthCheckButton';

interface ReverseProxySetupProps {
    domain: string;
    setDomain: (value: string) => void;
    chainId: string;
    showHealthCheck?: boolean;
}

const generateReverseProxyCommand = (domain: string) => {
    domain = nipify(domain);

    const caddyfile = `${domain} {
    # Always add CORS headers to response
    header /* {
        Access-Control-Allow-Origin "*"
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With"
        Access-Control-Max-Age "86400"
        defer
    }
    
    # Handle preflight OPTIONS requests
    @options method OPTIONS
    respond @options 204
    
    # Proxy to AvalancheGo with CORS disabled
    reverse_proxy localhost:9650 {
        header_down -Access-Control-Allow-Origin
        header_down -Access-Control-Allow-Methods
        header_down -Access-Control-Allow-Headers
        header_down -Access-Control-Allow-Credentials
    }
}`;

    const base64Config = btoa(caddyfile);

    return `docker run -d \\
  --name caddy \\
  --network host \\
  -v caddy_data:/data \\
  caddy:2.8-alpine \\
  sh -c "echo '${base64Config}' | base64 -d > /etc/caddy/Caddyfile && caddy run --config /etc/caddy/Caddyfile"`;
};

const generateHealthCheckCommand = (domain: string, chainId: string) => {
    const processedDomain = nipify(domain);

    return `curl -X POST --data '{ 
  "jsonrpc":"2.0", "method":"eth_blockNumber", "params":[], "id":1 
}' -H 'content-type:application/json;' \\
https://${processedDomain}/ext/bc/${chainId}/rpc`;
};

export const ReverseProxySetup: React.FC<ReverseProxySetupProps> = ({
    domain,
    setDomain,
    chainId,
    showHealthCheck = true
}) => {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-bold mb-4">Set Up Reverse Proxy</h3>
                <p>To connect your wallet you need to be able to connect to the RPC via https. For testing purposes you can set up a reverse Proxy to achieve this.</p>

                <p className="mt-4">You can use the following command to check your IP:</p>

                <DynamicCodeBlock lang="bash" code="curl checkip.amazonaws.com" />

                <p className="mt-4">Paste the IP of your node below:</p>

                <HostInput
                    label="Domain or IPv4 address for reverse proxy (optional)"
                    value={domain}
                    onChange={setDomain}
                    placeholder="example.com or 1.2.3.4"
                />

                {domain && (
                    <>
                        <p className="mt-4">Run the following command on the machine of your node:</p>
                        <DynamicCodeBlock lang="bash" code={generateReverseProxyCommand(domain)} />
                    </>
                )}
            </div>

            {domain && showHealthCheck && (
                <div>
                    <h3 className="text-xl font-bold mb-4">Check connection via Proxy</h3>
                    <p>Do a final check from a machine different than the one that your node is running on.</p>

                    <div className="space-y-6 mt-4">
                        <DynamicCodeBlock lang="bash" code={generateHealthCheckCommand(domain, chainId)} />

                        <HealthCheckButton
                            chainId={chainId}
                            domain={domain}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}; 