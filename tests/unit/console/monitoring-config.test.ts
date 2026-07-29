import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_OPTIONS,
  AVALANCHE_MONITORING_COMMIT,
  composeSaveCommand,
  generateMonitoringCompose,
  genGrafanaPasswordCommand,
  genGrafanaUrlCommand,
  genMakeMonitoringCommand,
  metricsCheckCommand,
  parseNodeEndpoint,
} from '@/components/toolbox/console/layer-1/monitoring/monitoringConfig';

const PASSWORD = 'test-password_123';

describe('parseNodeEndpoint', () => {
  it('maps localhost to host.docker.internal with the default API port', () => {
    for (const raw of ['http://localhost:9650', 'localhost', '127.0.0.1', 'http://localhost:9650/']) {
      const parsed = parseNodeEndpoint(raw);
      expect(parsed).not.toBeNull();
      expect(parsed!.scrapeTarget).toBe('host.docker.internal:9650');
      expect(parsed!.isLocal).toBe(true);
      expect(parsed!.scheme).toBe('http');
    }
  });

  it('keeps remote hosts as the scrape target and preserves explicit ports', () => {
    const parsed = parseNodeEndpoint('http://203.0.113.7:9652');
    expect(parsed!.scrapeTarget).toBe('203.0.113.7:9652');
    expect(parsed!.url).toBe('http://203.0.113.7:9652');
    expect(parsed!.isLocal).toBe(false);
  });

  it('defaults https to port 443 and http to 9650', () => {
    expect(parseNodeEndpoint('https://node.example.com')!.scrapeTarget).toBe('node.example.com:443');
    expect(parseNodeEndpoint('http://node.example.com')!.scrapeTarget).toBe('node.example.com:9650');
  });

  it('honors explicit scheme-default ports that URL normalization elides', () => {
    expect(parseNodeEndpoint('http://node.example.com:80')!.scrapeTarget).toBe('node.example.com:80');
    expect(parseNodeEndpoint('https://node.example.com:443/ext/bc/abc/rpc')!.scrapeTarget).toBe('node.example.com:443');
  });

  it('strips chain RPC paths — metrics live on the API host', () => {
    const parsed = parseNodeEndpoint(
      'https://node.example.com:8443/ext/bc/2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5/rpc',
    );
    expect(parsed!.url).toBe('https://node.example.com:8443');
    expect(parsed!.scrapeTarget).toBe('node.example.com:8443');
  });

  it('flags Builder Console managed testnet nodes', () => {
    const prod = parseNodeEndpoint('https://nodes-prod.43.207.73.245.sslip.io/ext/bc/abc/rpc');
    expect(prod!.isManagedNode).toBe(true);
    const staging = parseNodeEndpoint('https://nodes-staging.35.74.237.34.sslip.io');
    expect(staging!.isManagedNode).toBe(true);
    // A user's own sslip.io host is not a managed node.
    expect(parseNodeEndpoint('https://mynode.198.51.100.1.sslip.io')!.isManagedNode).toBe(false);
  });

  it('rejects empty, garbage and non-http inputs', () => {
    expect(parseNodeEndpoint('')).toBeNull();
    expect(parseNodeEndpoint('   ')).toBeNull();
    expect(parseNodeEndpoint('ws://node.example.com')).toBeNull();
    expect(parseNodeEndpoint('http://')).toBeNull();
  });

  it('rejects hostnames that could break the generated YAML or shell commands', () => {
    expect(parseNodeEndpoint("http://a'b.com")).toBeNull();
    expect(parseNodeEndpoint('http://%27quote.com')).toBeNull();
    expect(parseNodeEndpoint('http://x$foo.com')).toBeNull();
    // Bracketed IPv6 literals stay valid.
    expect(parseNodeEndpoint('http://[2001:db8::1]:9650')!.scrapeTarget).toBe('[2001:db8::1]:9650');
  });
});

describe('generateMonitoringCompose', () => {
  const local = parseNodeEndpoint('http://localhost:9650')!;
  const remoteHttps = parseNodeEndpoint('https://node.example.com')!;
  const allFiles = DASHBOARD_OPTIONS.map((d) => d.file);

  it('scrapes the local node via host.docker.internal with the host-gateway mapping', () => {
    const yaml = generateMonitoringCompose(local, allFiles, PASSWORD);
    expect(yaml).toContain("targets: ['host.docker.internal:9650']");
    expect(yaml).toContain('host.docker.internal:host-gateway');
    expect(yaml).toContain('scheme: http');
    expect(yaml).not.toContain('tls_config');
  });

  it('adds the https scheme and tls_config for remote https nodes, without extra_hosts', () => {
    const yaml = generateMonitoringCompose(remoteHttps, allFiles, PASSWORD);
    expect(yaml).toContain('scheme: https');
    expect(yaml).toContain('insecure_skip_verify: true');
    expect(yaml).toContain("targets: ['node.example.com:443']");
    expect(yaml).not.toContain('extra_hosts');
  });

  it('downloads exactly the selected dashboards, pinned to the vetted commit', () => {
    const yaml = generateMonitoringCompose(local, ['main', 'subnets'], PASSWORD);
    expect(yaml).toContain(`avalanche-monitoring/${AVALANCHE_MONITORING_COMMIT}/grafana/dashboards/main.json`);
    expect(yaml).toContain('/dashboards/subnets.json');
    expect(yaml).not.toContain('c_chain.json');
    expect(yaml).not.toContain('/main/grafana/dashboards');
  });

  it('omits the dashboards machinery entirely when nothing is selected', () => {
    const yaml = generateMonitoringCompose(local, [], PASSWORD);
    expect(yaml).not.toContain('dashboards:');
    expect(yaml).not.toContain('grafana_dashboard_provider');
    expect(yaml).not.toContain('depends_on');
    expect(yaml).toContain('grafana_datasource');
  });

  it('binds both UIs to localhost only and sets the admin password', () => {
    const yaml = generateMonitoringCompose(local, allFiles, PASSWORD);
    expect(yaml).toContain("'127.0.0.1:9090:9090'");
    expect(yaml).toContain("'127.0.0.1:3000:3000'");
    expect(yaml).toContain(`GF_SECURITY_ADMIN_PASSWORD=${PASSWORD}`);
  });

  it('contains no bare $ anywhere — compose interpolates the whole file', () => {
    const yaml = generateMonitoringCompose(remoteHttps, allFiles, PASSWORD);
    expect(yaml).not.toContain('$');
  });
});

describe('command helpers', () => {
  it('wraps the compose file in a quoted heredoc', () => {
    const cmd = composeSaveCommand('services: {}');
    expect(cmd).toContain("cat > docker-compose.yml << 'EOF'");
    expect(cmd.endsWith('\nEOF')).toBe(true);
  });

  it('renders the metrics reachability check, with -k mirroring insecure_skip_verify on https', () => {
    const https = parseNodeEndpoint('https://node.example.com/ext/bc/abc/rpc')!;
    expect(metricsCheckCommand(https)).toBe('curl -sk https://node.example.com:443/ext/metrics | head');
    const http = parseNodeEndpoint('http://203.0.113.7')!;
    expect(metricsCheckCommand(http)).toBe('curl -s http://203.0.113.7:9650/ext/metrics | head');
  });

  it('omits CLOUD for aws and includes it otherwise', () => {
    expect(genMakeMonitoringCommand('aws')).toBe('make monitoring');
    expect(genMakeMonitoringCommand('gcp')).toBe('make monitoring CLOUD=gcp');
  });

  it('targets the selected cloud in the terraform output commands', () => {
    expect(genGrafanaUrlCommand('azure')).toBe('terraform -chdir=terraform/l1/azure output -raw grafana_url');
    expect(genGrafanaPasswordCommand('aws')).toContain('output -raw monitoring_ip');
    expect(genGrafanaPasswordCommand('aws')).toContain('sudo cat /etc/grafana/.admin_password');
  });

  it('uses the per-cloud default ssh user for the password retrieval command', () => {
    expect(genGrafanaPasswordCommand('aws')).toMatch(/^ssh ubuntu@/);
    expect(genGrafanaPasswordCommand('gcp')).toMatch(/^ssh ubuntu@/);
    expect(genGrafanaPasswordCommand('azure')).toMatch(/^ssh azureuser@/);
  });
});
