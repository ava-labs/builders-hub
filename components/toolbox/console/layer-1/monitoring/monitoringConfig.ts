export const AVALANCHE_DEPLOY_REPO = 'https://github.com/ava-labs/avalanche-deploy';

/**
 * Dashboard JSONs are fetched at `docker compose up` time, pinned to a
 * commit so upstream edits can't change what users deploy under us.
 */
export const AVALANCHE_MONITORING_COMMIT = '29b972e6e2c4c0b9467783b67830ec40e19e4b63';

const DASHBOARDS_BASE_URL = `https://raw.githubusercontent.com/ava-labs/avalanche-monitoring/${AVALANCHE_MONITORING_COMMIT}/grafana/dashboards`;

export const PROMETHEUS_IMAGE = 'prom/prometheus:v3.13.1';
export const GRAFANA_IMAGE = 'grafana/grafana:13.1.1';
export const CURL_IMAGE = 'curlimages/curl:8.21.0';

export interface DashboardOption {
  file: string;
  title: string;
  details: string;
}

/* Offered set from ava-labs/avalanche-monitoring. Deliberately excluded:
   machine.json (needs node_exporter running on the node host), logs.json
   (needs Loki), c_chain_load.json (load-testing tooling). */
export const DASHBOARD_OPTIONS: DashboardOption[] = [
  {
    file: 'main',
    title: 'Avalanche Main Dashboard',
    details: 'Uptime, peers, queries and TPS (CPU/disk panels need node_exporter)',
  },
  {
    file: 'subnets',
    title: 'Subnets',
    details: 'Per-L1 block height, processing blocks and validator connectivity',
  },
  {
    file: 'network',
    title: 'Network',
    details: 'P2P message throughput and network latency',
  },
  {
    file: 'c_chain',
    title: 'C-Chain 2',
    details: 'C-Chain block production, gas usage and EVM internals',
  },
  {
    file: 'p_chain',
    title: 'P-Chain',
    details: 'Validator set, staking and platform transactions',
  },
  {
    file: 'x_chain',
    title: 'X-Chain',
    details: 'X-Chain transactions and DAG metrics',
  },
  {
    file: 'database',
    title: 'Database',
    details: 'Database reads, writes and disk performance',
  },
];

export interface ParsedEndpoint {
  scheme: 'http' | 'https';
  /** Normalized scheme://host:port — what the user can curl themselves. */
  url: string;
  /** host:port Prometheus scrapes — host.docker.internal for local nodes. */
  scrapeTarget: string;
  isLocal: boolean;
  /** Builder Console managed testnet node — /ext/metrics is not routed. */
  isManagedNode: boolean;
}

/**
 * Accepts anything a user is likely to paste — a bare host, an API URL,
 * or a full chain RPC URL — and reduces it to the node's API origin.
 * Paths like /ext/bc/<id>/rpc are dropped: metrics live at /ext/metrics
 * on the API host, not under the chain path. Without an explicit port we
 * assume AvalancheGo's default 9650 (443 for https).
 */
export function parseNodeEndpoint(raw: string): ParsedEndpoint | null {
  let value = raw.trim();
  if (!value) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) value = `http://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname) return null;
  const scheme = parsed.protocol === 'https:' ? 'https' : 'http';
  const hostname = parsed.hostname;
  // The hostname is embedded in YAML and shell commands users copy-paste —
  // reject anything beyond DNS names, IPv4 and bracketed IPv6 literals.
  if (!/^[a-zA-Z0-9._-]+$/.test(hostname) && !/^\[[0-9a-fA-F:.]+\]$/.test(hostname)) return null;
  // URL elides scheme-default ports (:80/:443), but a user typing them means
  // the node really is there — recover the explicit port from the authority.
  const authority = value.slice(value.indexOf('://') + 3).split(/[/?#]/)[0];
  const explicitPort = parsed.port || authority.match(/:(\d+)$/)?.[1] || '';
  const port = explicitPort || (scheme === 'https' ? '443' : '9650');
  const isLocal = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname);
  // The shared multi-tenant hosts from app/api/managed-testnet-nodes/constants.ts.
  const isManagedNode = /^nodes-(prod|staging)\./.test(hostname) && hostname.endsWith('.sslip.io');
  return {
    scheme,
    url: `${scheme}://${hostname}:${port}`,
    scrapeTarget: `${isLocal ? 'host.docker.internal' : hostname}:${port}`,
    isLocal,
    isManagedNode,
  };
}

/**
 * Reachability check the user runs themselves before standing up the stack.
 * -k mirrors the insecure_skip_verify the generated Prometheus config uses —
 * a self-signed cert must not read as "unreachable" here.
 */
export function metricsCheckCommand(endpoint: ParsedEndpoint): string {
  const flags = endpoint.scheme === 'https' ? '-sk' : '-s';
  return `curl ${flags} ${endpoint.url}/ext/metrics | head`;
}

/**
 * The whole stack in a single docker-compose.yml via inline `configs.content`
 * (Docker Compose >= 2.23.1). Compose interpolates $ across the entire file,
 * so nothing generated here may contain a bare `$` — escape as `$$` if PromQL
 * or alert rules are ever added to the inline configs.
 */
export function generateMonitoringCompose(
  endpoint: ParsedEndpoint,
  dashboardFiles: string[],
  grafanaPassword: string,
): string {
  const selected = DASHBOARD_OPTIONS.filter((d) => dashboardFiles.includes(d.file));
  const withDashboards = selected.length > 0;

  const curlLines = selected
    .map((d) => `curl -fsSL -o /dashboards/${d.file}.json ${DASHBOARDS_BASE_URL}/${d.file}.json`)
    .join(' &&\n        ');

  const tlsConfig =
    endpoint.scheme === 'https'
      ? `
          tls_config:
            insecure_skip_verify: true`
      : '';

  const extraHosts = endpoint.isLocal
    ? `
    extra_hosts:
      - host.docker.internal:host-gateway`
    : '';

  const dashboardsService = withDashboards
    ? `
  dashboards:
    image: ${CURL_IMAGE}
    # The image's default user (uid 100) can't write to the root-owned volume.
    user: root
    command:
      - sh
      - -c
      - >-
        ${curlLines}
    volumes:
      - dashboards:/dashboards
`
    : '';

  const grafanaDashboardMounts = withDashboards
    ? `
    volumes:
      - dashboards:/var/lib/grafana/dashboards
    depends_on:
      dashboards:
        condition: service_completed_successfully`
    : '';

  const grafanaProviderConfig = withDashboards
    ? `
      - source: grafana_dashboard_provider
        target: /etc/grafana/provisioning/dashboards/avalanche.yaml`
    : '';

  const volumesBlock = withDashboards
    ? `
volumes:
  dashboards:
`
    : '';

  const providerConfigBlock = withDashboards
    ? `
  grafana_dashboard_provider:
    content: |
      apiVersion: 1
      providers:
        - name: avalanche
          type: file
          options:
            path: /var/lib/grafana/dashboards
`
    : '';

  return `services:
  prometheus:
    image: ${PROMETHEUS_IMAGE}
    ports:
      - '127.0.0.1:9090:9090'${extraHosts}
    configs:
      - source: prometheus_config
        target: /etc/prometheus/prometheus.yml
    restart: unless-stopped
${dashboardsService}
  grafana:
    image: ${GRAFANA_IMAGE}
    ports:
      - '127.0.0.1:3000:3000'
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${grafanaPassword}${grafanaDashboardMounts}
    configs:
      - source: grafana_datasource
        target: /etc/grafana/provisioning/datasources/prometheus.yaml${grafanaProviderConfig}
    restart: unless-stopped
${volumesBlock}
configs:
  prometheus_config:
    content: |
      global:
        scrape_interval: 15s
      scrape_configs:
        - job_name: avalanchego
          metrics_path: /ext/metrics
          scheme: ${endpoint.scheme}
          static_configs:
            - targets: ['${endpoint.scrapeTarget}']${tlsConfig}

  grafana_datasource:
    content: |
      apiVersion: 1
      datasources:
        - name: Prometheus
          type: prometheus
          access: proxy
          url: http://prometheus:9090
          isDefault: true
${providerConfigBlock}`;
}

/** Heredoc is single-quoted so the shell never interpolates the YAML. */
export function composeSaveCommand(composeYaml: string): string {
  return `mkdir -p avalanche-monitoring && cd avalanche-monitoring && cat > docker-compose.yml << 'EOF'\n${composeYaml}\nEOF`;
}

// ── Avalanche Deploy (Terraform + Ansible) ─────────────────────────────

export type DeployCloud = 'aws' | 'gcp' | 'azure';

/** `make monitoring` picks its Ansible inventory via CLOUD (defaults to aws). */
export function genMakeMonitoringCommand(cloud: DeployCloud): string {
  return cloud === 'aws' ? 'make monitoring' : `make monitoring CLOUD=${cloud}`;
}

export function genGrafanaUrlCommand(cloud: DeployCloud): string {
  return `terraform -chdir=terraform/l1/${cloud} output -raw grafana_url`;
}

/**
 * The grafana role auto-generates the admin password on first run and
 * persists it on the monitoring host (grafana_admin_password_file).
 */
export function genGrafanaPasswordCommand(cloud: DeployCloud): string {
  const sshUser = cloud === 'azure' ? 'azureuser' : 'ubuntu';
  return `ssh ${sshUser}@$(terraform -chdir=terraform/l1/${cloud} output -raw monitoring_ip) sudo cat /etc/grafana/.admin_password`;
}
