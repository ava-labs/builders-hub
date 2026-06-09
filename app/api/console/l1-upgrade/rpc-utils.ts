import { isValidAddress } from '@/lib/console/upgrade-json';

type JsonRpcResponse<T> = {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code?: number; message?: string };
};

export function validatePublicRpcUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return 'RPC URL must be a valid URL.';
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'RPC URL must use http or https.';
  }

  if (process.env.NODE_ENV !== 'development') {
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '0.0.0.0' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host === '169.254.169.254' ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return 'Private or local RPC URLs cannot be fetched by Builder Hub. Use a public RPC URL or continue with manual instructions.';
    }
  }

  return null;
}

export async function callJsonRpc<T>(rpcUrl: string, method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`RPC returned HTTP ${response.status}`);
  }

  const json = (await response.json()) as JsonRpcResponse<T>;
  if (json.error) {
    throw new Error(json.error.message || `RPC error ${json.error.code ?? ''}`.trim());
  }
  return json.result as T;
}

export function validateRpcAddress(address: string): string | null {
  return isValidAddress(address) ? null : 'Address must be a 0x-prefixed EVM address.';
}
