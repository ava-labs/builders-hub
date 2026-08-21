'use client';

import { useState } from 'react';
import { Step } from 'fumadocs-ui/components/steps';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import {
  AVALANCHE_DEPLOY_REPO,
  genGrafanaPasswordCommand,
  genGrafanaUrlCommand,
  genMakeMonitoringCommand,
  type DeployCloud,
} from './monitoringConfig';

const CLOUDS: { value: DeployCloud; label: string }[] = [
  { value: 'aws', label: 'AWS' },
  { value: 'gcp', label: 'GCP' },
  { value: 'azure', label: 'Azure' },
];

const DASHBOARDS: { name: string; metrics: string }[] = [
  { name: 'Avalanche L1', metrics: 'Block height, transaction throughput, validator status' },
  { name: 'L1 EVM', metrics: 'Gas usage, contract calls, pending transactions' },
  { name: 'P-Chain', metrics: 'Staking metrics, validator set changes' },
  { name: 'System Health', metrics: 'CPU, memory, disk and network for every node' },
];

export default function TerraformMonitoring() {
  const [cloud, setCloud] = useState<DeployCloud>('aws');

  return (
    <>
      <Step>
        <h3 className="text-xl font-bold mb-4">Avalanche Deploy Stack</h3>
        <p>
          This path adds a dedicated monitoring server — Prometheus, Grafana and pre-built dashboards — to the cloud
          infrastructure provisioned by{' '}
          <a
            href={AVALANCHE_DEPLOY_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            avalanche-deploy
          </a>{' '}
          (Terraform + Ansible on AWS, GCP, or Azure). It requires an L1 stack deployed by that repo.
        </p>
        <p className="mt-2">
          Don't have one yet? Follow the{' '}
          <a
            href="/docs/tooling/avalanche-deploy/deploy-l1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Avalanche Deploy L1 guide
          </a>{' '}
          first, then come back here to add monitoring.
        </p>
      </Step>

      <Step>
        <h3 className="text-xl font-bold mb-4">Open Your Deployment Checkout</h3>
        <p>
          Run the playbook from the same avalanche-deploy checkout that deployed your stack —{' '}
          <code>terraform apply</code> writes the Ansible inventory (<code>ansible/inventory/&lt;cloud&gt;_hosts</code>)
          into that working tree, and the Terraform state lives there too.
        </p>
        <DynamicCodeBlock lang="bash" code="cd avalanche-deploy" />
      </Step>

      <Step>
        <h3 className="text-xl font-bold mb-4">Deploy the Monitoring Stack</h3>
        <p>Select the cloud provider your stack runs on:</p>
        <div className="grid grid-cols-3 gap-2 mt-4 mb-4">
          {CLOUDS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={cloud === c.value}
              onClick={() => setCloud(c.value)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                cloud === c.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
            >
              <div className="font-medium text-sm">{c.label}</div>
            </button>
          ))}
        </div>
        <DynamicCodeBlock lang="bash" code={genMakeMonitoringCommand(cloud)} />
        <p className="text-sm mt-2">
          This installs <code>node_exporter</code> on every node and stands up Prometheus (port 9090) and Grafana (port
          3000) on the dedicated monitoring host, pre-configured to scrape AvalancheGo metrics and system metrics from
          all of them.
        </p>
      </Step>

      <Step>
        <h3 className="text-xl font-bold mb-4">Access Grafana</h3>
        <DynamicCodeBlock lang="bash" code={genGrafanaUrlCommand(cloud)} />
        <p className="mt-4">
          Log in as <code>admin</code>. The password is auto-generated on first deploy and stored on the monitoring
          host:
        </p>
        <DynamicCodeBlock lang="bash" code={genGrafanaPasswordCommand(cloud)} />
      </Step>

      <Step>
        <h3 className="text-xl font-bold mb-4">Pre-Built Dashboards</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left">
                <th className="py-2 pr-4 font-medium">Dashboard</th>
                <th className="py-2 font-medium">Metrics</th>
              </tr>
            </thead>
            <tbody>
              {DASHBOARDS.map((d) => (
                <tr key={d.name} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-4">{d.name}</td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-400">{d.metrics}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm mt-4">
          More operational commands — logs, health checks, upgrades — are covered in the{' '}
          <a
            href="/docs/tooling/avalanche-deploy/operations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Avalanche Deploy operations guide
          </a>
          .
        </p>
      </Step>
    </>
  );
}
