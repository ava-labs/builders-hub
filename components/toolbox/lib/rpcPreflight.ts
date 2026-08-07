import { classifyRpcUrlForPage } from './rpcUrl';

/**
 * Cheap page-context reachability + identity check for an L1's RPC URL,
 * run BEFORE opening the wallet. Turns "Unable to calculate gas limit"
 * three layers down into an immediate, specific message.
 *
 * This checks the CONSOLE's configured URL only. It cannot see the URL the
 * wallet has stored for the chain; wallet-side failures are handled by
 * classifyEvmTxError's wallet-rpc-unreachable branch.
 */

export type RpcPreflightResult =
  | { ok: true; chainId: number }
  | {
      ok: false;
      reason: 'unreachable' | 'chain-mismatch' | 'mixed-content-blocked' | 'bad-response';
      actualChainId?: number;
      detail?: string;
    };

export async function preflightRpc(
  rpcUrl: string,
  expectedChainId: number,
  opts: { timeoutMs?: number; fetchFn?: typeof fetch; pageProtocol?: string } = {},
): Promise<RpcPreflightResult> {
  const { timeoutMs = 5000, fetchFn = fetch, pageProtocol } = opts;

  let response: Response;
  try {
    response = await fetchFn(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const blockedByPage = pageProtocol !== undefined && classifyRpcUrlForPage(rpcUrl, pageProtocol) === 'mixed-content';
    return {
      ok: false,
      reason: blockedByPage ? 'mixed-content-blocked' : 'unreachable',
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  if (!response.ok) return { ok: false, reason: 'bad-response', detail: `HTTP ${response.status}` };

  let result: unknown;
  try {
    result = ((await response.json()) as { result?: unknown }).result;
  } catch {
    return { ok: false, reason: 'bad-response', detail: 'response is not JSON' };
  }
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(result)) {
    return { ok: false, reason: 'bad-response', detail: 'eth_chainId returned no chain id' };
  }

  const chainId = parseInt(result, 16);
  if (chainId !== expectedChainId) return { ok: false, reason: 'chain-mismatch', actualChainId: chainId };
  return { ok: true, chainId };
}

export function formatPreflightError(
  result: Extract<RpcPreflightResult, { ok: false }>,
  rpcUrl: string,
  expectedChainId: number,
): string {
  switch (result.reason) {
    case 'mixed-content-blocked':
      return (
        `Can't reach your L1's RPC at ${rpcUrl} from this page: browsers block http:// requests to remote ` +
        'hosts from an https page (mixed content). Put an HTTPS reverse proxy in front of the node (see the ' +
        'reverse proxy step in L1 Nodes setup) and use that URL. http://localhost stays fine for a node on ' +
        'this machine.'
      );
    case 'chain-mismatch':
      return (
        `The RPC at ${rpcUrl} answers for chain ID ${result.actualChainId}, but this L1 is chain ` +
        `${expectedChainId}. The URL likely points at a different node or chain.`
      );
    case 'bad-response':
      return `The RPC at ${rpcUrl} responded, but not like an EVM endpoint (${result.detail ?? 'unexpected response'}). Check that the URL ends in /ext/bc/<blockchainID>/rpc.`;
    case 'unreachable':
    default:
      return `Can't reach your L1's RPC at ${rpcUrl} from this page. Check that the node is running, the URL is correct, and the port is reachable.`;
  }
}
