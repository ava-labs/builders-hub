import React from 'react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { nipify, HostInput } from './HostInput';
import { HealthCheckButton } from './HealthCheckButton';

interface ReverseProxySetupProps {
  domain: string;
  setDomain: (value: string) => void;
  chainId: string;
  showHealthCheck?: boolean;
  /** Where the node runs. When provided (with its setter), the step renders
   *  a location toggle: remote nodes need the proxy (label loses its
   *  "(optional)"), local nodes collapse the step to a note. Callers that
   *  omit it keep the historical rendering. */
  nodeLocation?: 'remote' | 'local';
  setNodeLocation?: (value: 'remote' | 'local') => void;
  onHealthCheckResult?: (result: { success: boolean }) => void;
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
  showHealthCheck = true,
  nodeLocation,
  setNodeLocation,
  onHealthCheckResult,
}) => {
  const hasLocationToggle = nodeLocation !== undefined && setNodeLocation !== undefined;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-4">Set Up Reverse Proxy</h3>

        {hasLocationToggle && (
          <div className="mb-4">
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Where does this node run?</div>
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setNodeLocation('remote')}
                className={`px-3 py-1.5 text-sm ${
                  nodeLocation === 'remote'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-transparent text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Remote server (needs this proxy)
              </button>
              <button
                type="button"
                onClick={() => setNodeLocation('local')}
                className={`px-3 py-1.5 text-sm border-l border-zinc-200 dark:border-zinc-700 ${
                  nodeLocation === 'local'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-transparent text-zinc-600 dark:text-zinc-400'
                }`}
              >
                This machine (localhost)
              </button>
            </div>
          </div>
        )}

        {hasLocationToggle && nodeLocation === 'local' ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            A node on this machine is reachable at <code>http://localhost:9650</code> directly; browsers allow localhost
            from an https page, so no reverse proxy is needed. Switch to &quot;Remote server&quot; if the node actually
            runs elsewhere: your wallet and this page cannot reach a remote node&apos;s localhost.
          </p>
        ) : (
          <>
            <p>
              {hasLocationToggle
                ? 'Your wallet and this page can only reach a remote node over https, so a reverse proxy in front of it is required. Browsers silently block plain http:// requests to remote hosts from an https page (mixed content).'
                : 'To connect your wallet you need to be able to connect to the RPC via https. For testing purposes you can set up a reverse Proxy to achieve this.'}
            </p>

            <p className="mt-4">You can use the following command to check your IP:</p>

            <DynamicCodeBlock lang="bash" code="curl checkip.amazonaws.com" />

            <p className="mt-4">Paste the IP of your node below:</p>

            <HostInput
              label={
                hasLocationToggle
                  ? 'Domain or IPv4 address for reverse proxy'
                  : 'Domain or IPv4 address for reverse proxy (optional)'
              }
              value={domain}
              onChange={setDomain}
              placeholder="example.com or 1.2.3.4"
            />

            {domain && (
              <>
                <p className="mt-4">
                  Open ports 80 and 443 so Let&apos;s Encrypt can reach Caddy. On a cloud host, open them in your{' '}
                  <strong>Security Group</strong> too — the host firewall alone is not enough.
                </p>
                <DynamicCodeBlock lang="bash" code={`sudo ufw allow 80,443/tcp comment 'Caddy / ACME'`} />

                <p className="mt-4">Run the following command on the machine of your node:</p>
                <DynamicCodeBlock lang="bash" code={generateReverseProxyCommand(domain)} />
              </>
            )}
          </>
        )}
      </div>

      {domain && showHealthCheck && !(hasLocationToggle && nodeLocation === 'local') && (
        <div>
          <h3 className="text-xl font-bold mb-4">Check connection via Proxy</h3>
          <p>Do a final check from a machine different than the one that your node is running on.</p>

          <div className="space-y-6 mt-4">
            <DynamicCodeBlock lang="bash" code={generateHealthCheckCommand(domain, chainId)} />

            <HealthCheckButton chainId={chainId} domain={domain} onResult={onHealthCheckResult} />
          </div>
        </div>
      )}
    </div>
  );
};
