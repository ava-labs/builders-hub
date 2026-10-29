import type { RpcPreflightResult } from './rpcPreflight';

/**
 * Decision logic for the Edit RPC URL modal, kept pure for tests.
 *
 * A chain-identity mismatch is never overridable: the URL provably serves
 * a different chain, so saving it can only break every tool that reads it.
 * Reachability failures are overridable because the node may be down right
 * now, or reachable by the wallet extension but not by the page (mixed
 * content), and the user may still want to store the correct URL.
 */
export type EditRpcDecision = {
  save: boolean;
  allowForce: boolean;
  message: string | null;
};

export function validateRpcUrlInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return 'Enter an RPC URL.';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'This is not a valid URL.';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'The RPC URL must start with http:// or https://.';
  }
  return null;
}

export function decideRpcEdit(result: RpcPreflightResult, expectedChainId: number): EditRpcDecision {
  if (result.ok) return { save: true, allowForce: false, message: null };

  switch (result.reason) {
    case 'chain-mismatch':
      return {
        save: false,
        allowForce: false,
        message: `This URL serves chain ID ${result.actualChainId}, but this network is chain ID ${expectedChainId}. Check that the blockchain ID in the URL path belongs to this chain.`,
      };
    case 'mixed-content-blocked':
      return {
        save: false,
        allowForce: true,
        message:
          'The browser blocks this http:// URL from an https page, so console tools cannot reach it. Use an https reverse proxy URL for a remote node. Save anyway only if you know the endpoint works outside the browser.',
      };
    case 'unreachable':
      return {
        save: false,
        allowForce: true,
        message: `Could not reach this RPC endpoint${result.detail ? ` (${result.detail})` : ''}. The node may be down or the URL may be wrong. You can save anyway and retry later.`,
      };
    case 'bad-response':
      return {
        save: false,
        allowForce: true,
        message: `The endpoint responded but not like an EVM RPC${result.detail ? ` (${result.detail})` : ''}. Check that the URL ends with the chain's /rpc path. You can save anyway if you know it is correct.`,
      };
  }
}
