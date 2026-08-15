'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Step } from 'fumadocs-ui/components/steps';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Input } from '@/components/toolbox/components/Input';
import { Checkbox } from '@/components/toolbox/components/Checkbox';
import { Note } from '@/components/toolbox/components/Note';
import { DockerInstallation } from '@/components/toolbox/components/DockerInstallation';
import {
  DASHBOARD_OPTIONS,
  composeSaveCommand,
  generateMonitoringCompose,
  metricsCheckCommand,
  parseNodeEndpoint,
} from './monitoringConfig';

/**
 * Grafana admin password, generated client-side via Web Crypto (same
 * pattern as SelfHostedExplorer's secrets) — anything is better than
 * shipping the compose file with Grafana's default admin/admin.
 */
function generateRandomSecret(byteLength = 24): string {
  const buf = new Uint8Array(byteLength);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buf);
  } else {
    // Fallback for non-browser test environments only.
    for (let i = 0; i < byteLength; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  const b64 = btoa(String.fromCharCode(...buf));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function DockerMonitoring() {
  const [endpointInput, setEndpointInput] = useState('');
  const [selectedDashboards, setSelectedDashboards] = useState<string[]>(DASHBOARD_OPTIONS.map((d) => d.file));
  const [grafanaPassword] = useState(() => generateRandomSecret());

  const endpoint = parseNodeEndpoint(endpointInput);
  const invalidEndpoint = !!endpointInput.trim() && !endpoint;
  const usableEndpoint = endpoint && !endpoint.isManagedNode ? endpoint : null;
  // Later steps stay mounted (hidden) while the user edits the endpoint, so
  // tab/accordion state survives; the last valid parse keeps their content
  // stable through transiently unparsable input like "http://".
  const lastUsableEndpoint = useRef<typeof usableEndpoint>(null);
  if (usableEndpoint) lastUsableEndpoint.current = usableEndpoint;
  const composeEndpoint = usableEndpoint ?? lastUsableEndpoint.current;
  const ready = !!usableEndpoint && selectedDashboards.length > 0;

  const toggleDashboard = (file: string, checked: boolean) => {
    setSelectedDashboards((prev) => (checked ? [...prev, file] : prev.filter((f) => f !== file)));
  };

  return (
    <>
      <Step>
        <h3 className="text-xl font-bold mb-4">Enter Your Node Endpoint</h3>
        <p>
          AvalancheGo serves Prometheus metrics at <code>/ext/metrics</code> on its API port (enabled by default). Enter
          the endpoint of the node you want to monitor:
        </p>
        <div className="mt-4">
          <Input
            label="Node Endpoint"
            value={endpointInput}
            onChange={setEndpointInput}
            placeholder="http://localhost:9650"
            error={invalidEndpoint ? 'Enter a valid http(s) URL or host' : null}
            helperText="Without an explicit port we assume AvalancheGo's default API port 9650 (443 for https). Chain RPC paths like /ext/bc/…/rpc are stripped automatically."
          />
        </div>

        {endpoint?.isManagedNode && (
          <Note variant="warning">
            This is a Builder Console managed testnet node. Managed nodes expose only their chain RPC URL —{' '}
            <code>/ext/metrics</code> is not reachable, so Grafana monitoring can't be set up against them. To get full
            node metrics, run your own node with{' '}
            <Link href="/console/layer-1/l1-node-setup" className="text-blue-500 hover:underline">
              L1 Node Setup
            </Link>{' '}
            and monitor that instead.
          </Note>
        )}

        {usableEndpoint && (
          <>
            <p className="mt-4">Verify the metrics endpoint is reachable from your machine:</p>
            <DynamicCodeBlock lang="bash" code={metricsCheckCommand(usableEndpoint)} />
            <Note>
              A few lines of <code>avalanche_...</code> metrics means you're good. If this fails: nodes listen on{' '}
              <code>127.0.0.1</code> by default (<code>--http-host</code>), requests to a DNS hostname are rejected with
              403 unless the node's <code>--http-allowed-hosts</code> includes it (raw IPs always work), and public RPC
              providers and load-balanced endpoints don't serve <code>/ext/metrics</code> at all. Keep the metrics port
              firewalled to your own machines — never expose it publicly.
            </Note>
          </>
        )}
      </Step>

      <div hidden={!usableEndpoint}>
        <>
          <Step>
            <DockerInstallation includeCompose={true} />
            <p className="text-sm mt-2">
              The generated setup uses inline compose configs, which need{' '}
              <strong>Docker Compose 2.23.1 or newer</strong> (<code>docker compose version</code> to check).
            </p>
          </Step>

          <Step>
            <h3 className="text-xl font-bold mb-4">Choose Your Dashboards</h3>
            <p>
              Pick which of the official{' '}
              <a
                href="https://github.com/ava-labs/avalanche-monitoring"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                avalanche-monitoring
              </a>{' '}
              Grafana dashboards to install — the compose file below only downloads what you select:
            </p>
            <div className="mt-4">
              {DASHBOARD_OPTIONS.map((d) => (
                <Checkbox
                  key={d.file}
                  label={`${d.title} — ${d.details}`}
                  checked={selectedDashboards.includes(d.file)}
                  onChange={(checked) => toggleDashboard(d.file, checked)}
                />
              ))}
            </div>
            {selectedDashboards.length === 0 && (
              <Note variant="warning">Select at least one dashboard to generate the setup.</Note>
            )}
            {selectedDashboards.includes('subnets') && (
              <Note>
                The Subnets dashboard filters by the <strong>Chain</strong> dropdown at the top, auto-populated from
                your node's metrics once Prometheus has scraped it — pick your L1's blockchain ID there.
              </Note>
            )}
          </Step>

          <div hidden={!ready}>
            <>
              <Step>
                <h3 className="text-xl font-bold mb-4">Create the Compose File</h3>
                <p>
                  One file runs everything: Prometheus scraping your node, Grafana pre-wired to Prometheus, and a
                  one-shot job that downloads your selected dashboards (pinned to a fixed commit). Both UIs bind to{' '}
                  <code>127.0.0.1</code> only.
                </p>
                {composeEndpoint && (
                  <DynamicCodeBlock
                    lang="bash"
                    code={composeSaveCommand(
                      generateMonitoringCompose(composeEndpoint, selectedDashboards, grafanaPassword),
                    )}
                  />
                )}
              </Step>

              <Step>
                <h3 className="text-xl font-bold mb-4">Start the Stack</h3>
                <DynamicCodeBlock lang="bash" code="docker compose up -d" />
                <p className="mt-4">
                  Then open <code>http://localhost:3000</code> and log in as <code>admin</code> with the password baked
                  into your compose file:
                </p>
                <DynamicCodeBlock lang="text" code={grafanaPassword} />
                <p className="text-sm mt-2">
                  Your dashboards are under <strong>Dashboards</strong> in the left sidebar; Prometheus itself is at{' '}
                  <code>http://localhost:9090</code>. Running the stack on a remote server? Reach it with an SSH tunnel
                  instead of opening the ports: <code>ssh -L 3000:localhost:3000 user@server</code>.
                </p>
              </Step>

              <Step>
                <h3 className="text-xl font-bold mb-4">What You'll See</h3>
                <p>
                  The Main dashboard covers node uptime, peers, successful/failed queries and throughput; Subnets tracks
                  block height and validator connectivity per L1; the chain dashboards break down each chain's
                  internals. The Main dashboard's CPU and disk panels use machine metrics from{' '}
                  <code>node_exporter</code> — without it they show "No data"; see below to add it.
                </p>
                <div className="mt-4">
                  <Accordions type="single">
                    <Accordion title="Full machine metrics (CPU, disk, network) via node_exporter">
                      <p>
                        The Machine Metrics dashboard needs Prometheus <code>node_exporter</code> running{' '}
                        <strong>on the node's host</strong> (port 9100) — it can't be provided from this machine for a
                        remote node. If you administer the node host, follow the{' '}
                        <a
                          href="/docs/nodes/maintain/monitoring"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          node monitoring docs
                        </a>{' '}
                        to install it, add a scrape job for <code>&lt;node-host&gt;:9100</code> to the Prometheus
                        config, and import <code>machine.json</code> from avalanche-monitoring.
                      </p>
                    </Accordion>
                    <Accordion title="Troubleshooting">
                      <ul className="list-disc pl-5 space-y-2">
                        <li>
                          <strong>Prometheus target down / connection refused</strong> — the node isn't reachable from
                          Docker. Check <code>http://localhost:9090/targets</code>; for a node on this machine make sure
                          it listens on <code>--http-host=0.0.0.0</code> or <code>127.0.0.1</code> (we route via{' '}
                          <code>host.docker.internal</code>).
                        </li>
                        <li>
                          <strong>403 from the node</strong> — you're scraping a DNS hostname the node doesn't allow.
                          Add it to <code>--http-allowed-hosts</code> on the node, or scrape by IP.
                        </li>
                        <li>
                          <strong>404/405 from the endpoint</strong> — the endpoint is a load balancer or public RPC
                          that doesn't expose <code>/ext/metrics</code>. Point at the node's API port directly.
                        </li>
                        <li>
                          <strong>
                            <code>dashboards</code> service failed
                          </strong>{' '}
                          — the one-shot download from <code>raw.githubusercontent.com</code> was interrupted. Re-run{' '}
                          <code>docker compose up -d</code>.
                        </li>
                        <li>
                          <strong>Empty Subnets dashboard</strong> — select your blockchain ID from the{' '}
                          <strong>Chain</strong> dropdown at the top; it populates from your node's metrics after the
                          first Prometheus scrape.
                        </li>
                      </ul>
                    </Accordion>
                  </Accordions>
                </div>
                <p className="text-sm mt-4">
                  Deep dive:{' '}
                  <a
                    href="/docs/nodes/maintain/monitoring"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    node monitoring docs
                  </a>{' '}
                  and{' '}
                  <a
                    href="/docs/nodes/maintain/recommended-metrics"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    recommended metrics &amp; alert thresholds
                  </a>
                  .
                </p>
              </Step>
            </>
          </div>
        </>
      </div>
    </>
  );
}
