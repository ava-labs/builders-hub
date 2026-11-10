import React from 'react';
import { nipify, HostInput } from './HostInput';
import { HealthCheckButton } from './HealthCheckButton';
import { Choice, ChoiceGrid, CodeBlock, EYEBROW, INLINE_CODE, NOTE } from './NodeSetupUI';

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

  const isLocal = hasLocationToggle && nodeLocation === 'local';

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">Set Up Reverse Proxy</h3>

      {hasLocationToggle && (
        <ChoiceGrid label="Where does this node run?" cols={2}>
          <Choice
            selected={nodeLocation === 'remote'}
            onSelect={() => setNodeLocation('remote')}
            title="Remote server"
            description="Needs this proxy"
          />
          <Choice
            selected={nodeLocation === 'local'}
            onSelect={() => setNodeLocation('local')}
            title="This machine"
            description={<span className="font-mono">localhost</span>}
          />
        </ChoiceGrid>
      )}

      {isLocal ? (
        <p className={NOTE}>
          A node on this machine is reachable at <code className={INLINE_CODE}>http://localhost:9650</code> directly;
          browsers allow localhost from an https page, so no reverse proxy is needed. Switch to &quot;Remote
          server&quot; if the node actually runs elsewhere: your wallet and this page cannot reach a remote node&apos;s
          localhost.
        </p>
      ) : (
        <>
          <p className={NOTE}>
            {hasLocationToggle
              ? 'Your wallet and this page can only reach a remote node over https, so a reverse proxy in front of it is required. Browsers silently block plain http:// requests to remote hosts from an https page (mixed content).'
              : 'To connect your wallet you need to be able to connect to the RPC via https. For testing purposes you can set up a reverse Proxy to achieve this.'}
          </p>

          <SubStep label="Find your node's IP">
            <CodeBlock code="curl checkip.amazonaws.com" />
          </SubStep>

          <SubStep label="Paste it below">
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
          </SubStep>

          {domain && (
            <>
              <SubStep label="Open ports 80 and 443">
                <p className={NOTE}>
                  So Let&apos;s Encrypt can reach Caddy. On a cloud host, open them in your{' '}
                  <strong className="font-medium text-zinc-900 dark:text-zinc-100">Security Group</strong> too — the
                  host firewall alone is not enough.
                </p>
                <CodeBlock code={`sudo ufw allow 80,443/tcp comment 'Caddy / ACME'`} />
              </SubStep>

              <SubStep label="Run Caddy on the node's machine">
                <CodeBlock code={generateReverseProxyCommand(domain)} />
              </SubStep>
            </>
          )}
        </>
      )}

      {domain && showHealthCheck && !isLocal && (
        <SubStep label="Check connection via proxy">
          <p className={NOTE}>Run this from a machine other than the one your node runs on.</p>
          <CodeBlock code={generateHealthCheckCommand(domain, chainId)} />
          <HealthCheckButton chainId={chainId} domain={domain} onResult={onHealthCheckResult} />
        </SubStep>
      )}
    </div>
  );
};

function SubStep({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <p className={EYEBROW}>{label}</p>
      {children}
    </div>
  );
}
