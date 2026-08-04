'use client';

import { Step } from 'fumadocs-ui/components/steps';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { AVALANCHE_DEPLOY_REPO } from './monitoringConfig';

export default function KubernetesMonitoring() {
  return (
    <>
      <Step>
        <h3 className="text-xl font-bold mb-4">Prerequisites</h3>
        <p>
          A Kubernetes cluster with <code>kubectl</code> connected and <code>helm</code> v3 installed, running the{' '}
          <a
            href={AVALANCHE_DEPLOY_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            avalanche-deploy
          </a>{' '}
          L1 or Primary Network charts — Prometheus discovers the AvalancheGo pods by label and scrapes{' '}
          <code>/ext/metrics</code> on port 9650 in-cluster.
        </p>
        <p className="mt-2">
          Not running your nodes on Kubernetes yet? Follow the{' '}
          <a
            href="/docs/tooling/avalanche-deploy/deploy-l1-kubernetes"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Avalanche Deploy Kubernetes guide
          </a>{' '}
          first.
        </p>
      </Step>

      <Step>
        <h3 className="text-xl font-bold mb-4">Clone Avalanche Deploy</h3>
        <p>
          The monitoring Helm chart lives in the avalanche-deploy repo. Clone it and fetch the chart's Prometheus and
          Grafana subcharts:
        </p>
        <DynamicCodeBlock
          lang="bash"
          code={`git clone ${AVALANCHE_DEPLOY_REPO} && cd avalanche-deploy\nhelm dependency build kubernetes/helm/monitoring`}
        />
      </Step>

      <Step>
        <h3 className="text-xl font-bold mb-4">Install the Monitoring Chart</h3>
        <p>Deploy Prometheus and Grafana into the cluster:</p>
        <DynamicCodeBlock lang="bash" code="make k8s-monitoring" />
        <p className="text-sm mt-2">
          This runs <code>helm upgrade --install monitoring ./helm/monitoring</code> and ships the Avalanche L1 and
          Primary Network dashboards. Note this path only scrapes AvalancheGo pod metrics — there is no{' '}
          <code>node_exporter</code>, so no system-level dashboard.
        </p>
      </Step>

      <Step>
        <h3 className="text-xl font-bold mb-4">Access Grafana</h3>
        <DynamicCodeBlock lang="bash" code="kubectl port-forward svc/monitoring-grafana 3000:3000" />
        <p className="text-sm mt-2">
          Then open <code>http://localhost:3000</code> and log in with <code>admin</code>/<code>admin</code> — the
          chart's default credentials. For anything beyond a local cluster set your own password at first install (
          <code>
            helm upgrade --install monitoring kubernetes/helm/monitoring --set grafana.adminPassword=&lt;secret&gt;
          </code>{' '}
          instead of the make target), or reset it on a running install:{' '}
          <code>kubectl exec deploy/monitoring-grafana -- grafana-cli admin reset-admin-password &lt;secret&gt;</code>.
        </p>
      </Step>
    </>
  );
}
