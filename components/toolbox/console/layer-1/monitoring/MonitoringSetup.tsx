'use client';

import { useState } from 'react';
import { Container } from '@/components/toolbox/components/Container';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import { AVALANCHE_DEPLOY_REPO } from './monitoringConfig';
import TerraformMonitoring from './TerraformMonitoring';
import KubernetesMonitoring from './KubernetesMonitoring';
import DockerMonitoring from './DockerMonitoring';

type DeployMethod = 'terraform' | 'kubernetes' | 'docker';

const METHODS: { value: DeployMethod; label: string; details: string }[] = [
  { value: 'terraform', label: 'Terraform + Ansible', details: 'Cloud VMs via avalanche-deploy' },
  { value: 'kubernetes', label: 'Kubernetes', details: 'Helm chart via avalanche-deploy' },
  { value: 'docker', label: 'Docker', details: 'Docker Compose pointed at any node endpoint' },
];

export default function MonitoringSetup() {
  const [method, setMethod] = useState<DeployMethod>('docker');

  return (
    <Container
      title="Monitoring Setup"
      description="Stand up Prometheus + Grafana dashboards for your Avalanche nodes via Terraform, Kubernetes, or Docker."
      githubUrl="https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/layer-1/monitoring/MonitoringSetup.tsx"
    >
      <Steps>
        <Step>
          <h3 className="text-xl font-bold mb-4">Choose Your Deployment Method</h3>
          <p>
            AvalancheGo exposes Prometheus metrics out of the box — uptime, queries, per-chain block height, TPS and
            resource usage. Terraform and Kubernetes deploy the monitoring stack through the{' '}
            <a
              href={AVALANCHE_DEPLOY_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              avalanche-deploy
            </a>{' '}
            repo alongside your nodes; Docker generates a standalone Docker Compose setup you can point at any node
            endpoint.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={method === m.value}
                onClick={() => setMethod(m.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  method === m.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <div className="font-medium text-sm">{m.label}</div>
                <div className="text-xs text-zinc-500">{m.details}</div>
              </button>
            ))}
          </div>
        </Step>

        <div hidden={method !== 'terraform'}>
          <TerraformMonitoring />
        </div>
        <div hidden={method !== 'kubernetes'}>
          <KubernetesMonitoring />
        </div>
        <div hidden={method !== 'docker'}>
          <DockerMonitoring />
        </div>
      </Steps>
    </Container>
  );
}
