export type DeployCloud = 'aws' | 'gcp' | 'azure';

export interface AvalancheDeployBlockscoutConfig {
  blockchainId: string;
  evmChainId: number;
  chainName: string;
  cloud?: DeployCloud;
  rpcUrl?: string;
  wsUrl?: string;
}

export const AVALANCHE_DEPLOY_REPO = 'https://github.com/ava-labs/avalanche-deploy';

/** Escape double quotes so a value can sit inside a double-quoted shell string. */
function escapeDoubleQuotes(value: string): string {
  return value.replace(/"/g, '\\"');
}

/**
 * `make deploy-blockscout` against an existing avalanche-deploy stack.
 * Must run from the checkout that deployed the stack — terraform apply
 * writes ansible/inventory/<cloud>_hosts into that working tree.
 */
export function genTerraformBlockscoutCommand(config: AvalancheDeployBlockscoutConfig): string {
  const { blockchainId, evmChainId, chainName, cloud = 'aws' } = config;
  const lines = ['make deploy-blockscout \\'];
  if (cloud !== 'aws') {
    lines.push(`  CLOUD=${cloud} \\`);
  }
  lines.push(
    `  CHAIN_ID=${blockchainId} \\`,
    `  EVM_CHAIN_ID=${evmChainId} \\`,
    `  CHAIN_NAME="${escapeDoubleQuotes(chainName)}"`,
  );
  return lines.join('\n');
}

/**
 * Direct playbook run for L1s not deployed by avalanche-deploy: a
 * hand-written inventory plus an external RPC.
 *
 * Quoting matters here: ansible's -e key=value parser splits on unquoted
 * whitespace, so l1_name is inner-double-quoted to survive multi-word
 * names. ws_url is ALWAYS emitted — an explicitly empty override is the
 * only way to defeat the playbook's ws://host.docker.internal default,
 * which points at a node that doesn't exist on a BYO host.
 */
export function genAnsibleByoCommand(config: AvalancheDeployBlockscoutConfig): string {
  const { blockchainId, evmChainId, chainName, rpcUrl, wsUrl } = config;
  return [
    'cd ansible && ansible-playbook -i inventory/my_hosts playbooks/l1/deploy-blockscout.yml \\',
    `  -e "l1_chain_id=${blockchainId}" \\`,
    `  -e "l1_evm_chain_id=${evmChainId}" \\`,
    `  -e 'l1_name="${chainName.replace(/"/g, '')}"' \\`,
    `  -e "rpc_url=${rpcUrl}" \\`,
    `  -e 'ws_url="${wsUrl ?? ''}"'`,
  ].join('\n');
}

export const BYO_INVENTORY_EXAMPLE = `[rpc]
<server-ip> ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/your-key`;

/** In-cluster endpoints exposed by the avalanche-deploy `l1-rpc` Helm release. */
export function genInClusterRpcUrls(blockchainId: string): { rpcUrl: string; wsUrl: string } {
  return {
    rpcUrl: `http://l1-rpc:9650/ext/bc/${blockchainId}/rpc`,
    wsUrl: `ws://l1-rpc:9650/ext/bc/${blockchainId}/ws`,
  };
}

/**
 * Derive the websocket endpoint from an HTTP RPC URL. Returns null when
 * the URL doesn't follow the standard /ext/bc/<id>/rpc shape — callers
 * must then ask for an explicit ws URL or omit it entirely rather than
 * emitting an empty value.
 */
export function deriveWsUrl(rpcUrl: string): string | null {
  const trimmed = rpcUrl.trim().replace(/\/+$/, '');
  if (!/\/rpc$/.test(trimmed)) return null;
  const wsPath = trimmed.replace(/\/rpc$/, '/ws');
  if (wsPath.startsWith('https://')) return `wss://${wsPath.slice('https://'.length)}`;
  if (wsPath.startsWith('http://')) return `ws://${wsPath.slice('http://'.length)}`;
  return null;
}

/**
 * Direct `helm upgrade --install` for the Blockscout chart. Deliberately
 * NOT `make k8s-blockscout`: the make wrapper never passes l1.rpcUrl or
 * l1.wsUrl and the chart has no `required` guard, so it silently renders
 * an empty ETHEREUM_JSONRPC_HTTP_URL. The wsUrl --set line is omitted
 * (never emitted empty) when no ws endpoint is known.
 */
/** Escape a value for helm --set: backslashes and commas are metacharacters there. */
function escapeHelmSetValue(value: string): string {
  return escapeDoubleQuotes(value.replace(/\\/g, '\\\\').replace(/,/g, '\\,'));
}

export function genHelmBlockscoutCommand(config: AvalancheDeployBlockscoutConfig): string {
  const { blockchainId, evmChainId, chainName, rpcUrl, wsUrl } = config;
  const lines = [
    'helm upgrade --install blockscout ./helm/blockscout \\',
    `  --set "l1.chainId=${blockchainId}" \\`,
    `  --set "l1.evmChainId=${evmChainId}" \\`,
    `  --set "l1.chainName=${escapeHelmSetValue(chainName)}" \\`,
    `  --set "l1.rpcUrl=${rpcUrl}"${wsUrl ? ' \\' : ''}`,
  ];
  if (wsUrl) {
    lines.push(`  --set "l1.wsUrl=${wsUrl}"`);
  }
  return lines.join('\n');
}

export function genHelmIngressCommand(host: string, apiHost: string): string {
  return [
    'helm upgrade --install blockscout ./helm/blockscout --reuse-values \\',
    '  --set "ingress.enabled=true" \\',
    `  --set "ingress.host=${host}" \\`,
    `  --set "ingress.apiHost=${apiHost}"`,
  ].join('\n');
}
