'use client';

import { useState } from 'react';
import { Shield, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { RPCURLInput } from '@/components/toolbox/components/RPCURLInput';

type Status = 'ok' | 'info' | 'warning' | 'error';

interface CheckResult {
  method: string;
  expectedValue: string;
  actualValue: string;
  status: Status;
}

interface CheckGroup {
  title: string;
  description: string;
  results: CheckResult[];
}

async function rpcCall(
  url: string,
  method: string,
  params: unknown[] | Record<string, unknown> = [],
): Promise<{ result?: unknown; error?: { message: string; code?: number } }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  return response.json();
}

async function runEVMTests(evmRpcUrl: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // eth_chainId
  try {
    const data = await rpcCall(evmRpcUrl, 'eth_chainId');
    if (data.result) {
      results.push({
        method: 'eth_chainId',
        expectedValue: 'Returns chain ID (hex)',
        actualValue: String(data.result),
        status: 'ok',
      });
    } else {
      results.push({
        method: 'eth_chainId',
        expectedValue: 'Returns chain ID (hex)',
        actualValue: data.error?.message || 'No result returned',
        status: 'error',
      });
    }
  } catch (err) {
    results.push({
      method: 'eth_chainId',
      expectedValue: 'Returns chain ID (hex)',
      actualValue: err instanceof Error ? err.message : 'Request failed',
      status: 'error',
    });
  }

  // eth_blockNumber
  try {
    const data = await rpcCall(evmRpcUrl, 'eth_blockNumber');
    if (data.result) {
      results.push({
        method: 'eth_blockNumber',
        expectedValue: 'Returns latest block number (hex)',
        actualValue: String(data.result),
        status: 'ok',
      });
    } else {
      results.push({
        method: 'eth_blockNumber',
        expectedValue: 'Returns latest block number (hex)',
        actualValue: data.error?.message || 'No result returned',
        status: 'error',
      });
    }
  } catch (err) {
    results.push({
      method: 'eth_blockNumber',
      expectedValue: 'Returns latest block number (hex)',
      actualValue: err instanceof Error ? err.message : 'Request failed',
      status: 'error',
    });
  }

  // eth_getBlockByNumber
  try {
    const data = await rpcCall(evmRpcUrl, 'eth_getBlockByNumber', ['latest', false]);
    if (data.result && typeof data.result === 'object' && 'number' in data.result) {
      const blockNum = Number(BigInt((data.result as { number: string }).number));
      results.push({
        method: 'eth_getBlockByNumber',
        expectedValue: 'Returns block object',
        actualValue: `Block #${blockNum}`,
        status: 'ok',
      });
    } else {
      results.push({
        method: 'eth_getBlockByNumber',
        expectedValue: 'Returns block object',
        actualValue: data.error?.message || 'No block returned',
        status: 'error',
      });
    }
  } catch (err) {
    results.push({
      method: 'eth_getBlockByNumber',
      expectedValue: 'Returns block object',
      actualValue: err instanceof Error ? err.message : 'Request failed',
      status: 'error',
    });
  }

  // debug_traceBlockByNumber - check if enabled
  try {
    const data = await rpcCall(evmRpcUrl, 'debug_traceBlockByNumber', ['latest']);
    if (data.error) {
      results.push({
        method: 'debug_traceBlockByNumber',
        expectedValue: 'Enabled or disabled',
        actualValue: 'Disabled (restricted)',
        status: 'ok',
      });
    } else {
      results.push({
        method: 'debug_traceBlockByNumber',
        expectedValue: 'Enabled or disabled',
        actualValue: 'Enabled',
        status: 'info',
      });
    }
  } catch (err) {
    results.push({
      method: 'debug_traceBlockByNumber',
      expectedValue: 'Enabled or disabled',
      actualValue: err instanceof Error ? err.message : 'Request failed',
      status: 'ok',
    });
  }

  // trace_block - check if enabled
  try {
    const data = await rpcCall(evmRpcUrl, 'trace_block', ['latest']);
    if (data.error) {
      results.push({
        method: 'trace_block',
        expectedValue: 'Enabled or disabled',
        actualValue: 'Disabled (restricted)',
        status: 'ok',
      });
    } else {
      results.push({
        method: 'trace_block',
        expectedValue: 'Enabled or disabled',
        actualValue: 'Enabled',
        status: 'info',
      });
    }
  } catch (err) {
    results.push({
      method: 'trace_block',
      expectedValue: 'Enabled or disabled',
      actualValue: err instanceof Error ? err.message : 'Request failed',
      status: 'ok',
    });
  }

  return results;
}

async function runAdminTests(baseUrl: string): Promise<CheckResult[]> {
  const adminMethods = [
    { name: 'admin.alias', params: { alias: 'myAlias', endpoint: 'bc/X' } },
    {
      name: 'admin.aliasChain',
      params: { chain: 'sV6o671RtkGBcno1FiaDbVcFv2sG5aVXMZYzKdP4VQAWmJQnM', alias: 'myBlockchainAlias' },
    },
    { name: 'admin.getChainAliases', params: { chain: 'sV6o671RtkGBcno1FiaDbVcFv2sG5aVXMZYzKdP4VQAWmJQnM' } },
    { name: 'admin.getLoggerLevel', params: { loggerName: 'C' } },
    { name: 'admin.loadVMs', params: {} },
    { name: 'admin.lockProfile', params: {} },
    { name: 'admin.memoryProfile', params: {} },
    { name: 'admin.setLoggerLevel', params: { loggerName: 'C', logLevel: 'DEBUG', displayLevel: 'INFO' } },
    { name: 'admin.startCPUProfiler', params: {} },
    { name: 'admin.stopCPUProfiler', params: {} },
  ];

  const results: CheckResult[] = [];

  for (const method of adminMethods) {
    try {
      const response = await fetch(`${baseUrl}/ext/admin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method.name, params: method.params }),
      });
      const data = await response.json();

      if (data.error) {
        results.push({
          method: method.name,
          expectedValue: 'Error (API secured)',
          actualValue: data.error.message || JSON.stringify(data.error),
          status: 'ok',
        });
      } else {
        results.push({
          method: method.name,
          expectedValue: 'Error (API secured)',
          actualValue: 'Admin API is accessible',
          status: 'error',
        });
      }
    } catch (err) {
      results.push({
        method: method.name,
        expectedValue: 'Error (API secured)',
        actualValue: err instanceof Error ? err.message : 'Request failed',
        status: 'ok',
      });
    }
  }

  return results;
}

async function runMetricsTest(baseUrl: string): Promise<CheckResult[]> {
  try {
    const response = await fetch(`${baseUrl}/ext/metrics`);
    const text = await response.text();
    const hasMetrics = text.includes('avalanche_') || text.includes('network_') || text.includes('vm_');

    if (hasMetrics) {
      return [
        {
          method: 'GET /ext/metrics',
          expectedValue: 'Error (API restricted)',
          actualValue: 'Metrics API is publicly accessible',
          status: 'error',
        },
      ];
    } else {
      return [
        {
          method: 'GET /ext/metrics',
          expectedValue: 'Error (API restricted)',
          actualValue: 'Metrics API properly secured',
          status: 'ok',
        },
      ];
    }
  } catch (err) {
    return [
      {
        method: 'GET /ext/metrics',
        expectedValue: 'Error (API restricted)',
        actualValue: err instanceof Error ? err.message : 'Request failed',
        status: 'ok',
      },
    ];
  }
}

async function runPChainTests(baseUrl: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const pchainUrl = `${baseUrl}/ext/bc/P`;

  // platform.getHeight
  try {
    const data = await rpcCall(pchainUrl, 'platform.getHeight');
    if (data.result && typeof data.result === 'object' && 'height' in data.result) {
      results.push({
        method: 'platform.getHeight',
        expectedValue: 'Returns current P-Chain height',
        actualValue: `Height: ${(data.result as { height: string }).height}`,
        status: 'ok',
      });
    } else if (data.error) {
      results.push({
        method: 'platform.getHeight',
        expectedValue: 'Returns current P-Chain height',
        actualValue: data.error.message || 'P-Chain not accessible',
        status: 'error',
      });
    } else {
      results.push({
        method: 'platform.getHeight',
        expectedValue: 'Returns current P-Chain height',
        actualValue: 'No result returned',
        status: 'error',
      });
    }
  } catch (err) {
    results.push({
      method: 'platform.getHeight',
      expectedValue: 'Returns current P-Chain height',
      actualValue: err instanceof Error ? err.message : 'Request failed',
      status: 'error',
    });
  }

  // platform.getBlockchains
  try {
    const data = await rpcCall(pchainUrl, 'platform.getBlockchains');
    if (data.result && typeof data.result === 'object' && 'blockchains' in data.result) {
      const blockchains = (data.result as { blockchains: unknown[] }).blockchains;
      results.push({
        method: 'platform.getBlockchains',
        expectedValue: 'Returns list of blockchains',
        actualValue: `${blockchains.length} blockchain(s) found`,
        status: 'ok',
      });
    } else if (data.error) {
      results.push({
        method: 'platform.getBlockchains',
        expectedValue: 'Returns list of blockchains',
        actualValue: data.error.message || 'Failed to get blockchains',
        status: 'error',
      });
    } else {
      results.push({
        method: 'platform.getBlockchains',
        expectedValue: 'Returns list of blockchains',
        actualValue: 'No result returned',
        status: 'error',
      });
    }
  } catch (err) {
    results.push({
      method: 'platform.getBlockchains',
      expectedValue: 'Returns list of blockchains',
      actualValue: err instanceof Error ? err.message : 'Request failed',
      status: 'error',
    });
  }

  // platform.getSubnets (now L1s)
  try {
    const data = await rpcCall(pchainUrl, 'platform.getSubnets', {});
    if (data.result && typeof data.result === 'object' && 'subnets' in data.result) {
      const subnets = (data.result as { subnets: unknown[] }).subnets;
      results.push({
        method: 'platform.getSubnets',
        expectedValue: 'Returns list of L1s/Subnets',
        actualValue: `${subnets.length} L1(s) found`,
        status: 'ok',
      });
    } else if (data.error) {
      results.push({
        method: 'platform.getSubnets',
        expectedValue: 'Returns list of L1s/Subnets',
        actualValue: data.error.message || 'Failed to get subnets',
        status: 'error',
      });
    } else {
      results.push({
        method: 'platform.getSubnets',
        expectedValue: 'Returns list of L1s/Subnets',
        actualValue: 'No result returned',
        status: 'error',
      });
    }
  } catch (err) {
    results.push({
      method: 'platform.getSubnets',
      expectedValue: 'Returns list of L1s/Subnets',
      actualValue: err instanceof Error ? err.message : 'Request failed',
      status: 'error',
    });
  }

  // platform.getCurrentValidators (Primary Network)
  try {
    const data = await rpcCall(pchainUrl, 'platform.getCurrentValidators', { subnetID: null });
    if (data.result && typeof data.result === 'object' && 'validators' in data.result) {
      const validators = (data.result as { validators: unknown[] }).validators;
      results.push({
        method: 'platform.getCurrentValidators',
        expectedValue: 'Returns Primary Network validators',
        actualValue: `${validators.length} validator(s) active`,
        status: 'ok',
      });
    } else if (data.error) {
      results.push({
        method: 'platform.getCurrentValidators',
        expectedValue: 'Returns Primary Network validators',
        actualValue: data.error.message || 'Failed to get validators',
        status: 'error',
      });
    } else {
      results.push({
        method: 'platform.getCurrentValidators',
        expectedValue: 'Returns Primary Network validators',
        actualValue: 'No result returned',
        status: 'error',
      });
    }
  } catch (err) {
    results.push({
      method: 'platform.getCurrentValidators',
      expectedValue: 'Returns Primary Network validators',
      actualValue: err instanceof Error ? err.message : 'Request failed',
      status: 'error',
    });
  }

  return results;
}

function deriveBaseUrl(evmRpcUrl: string): string {
  const parts = evmRpcUrl.split('/ext/bc/');
  return parts[0] || evmRpcUrl.replace(/\/+$/, '');
}

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  ok: {
    label: 'OK',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  info: {
    label: 'Enabled',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  warning: {
    label: 'Warning',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  error: {
    label: 'Error',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
};

function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function ResultsTable({ results }: { results: CheckResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-900/30">
            <th className="py-3 px-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Method</th>
            <th className="py-3 px-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Expected Value</th>
            <th className="py-3 px-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Actual Value</th>
            <th className="py-3 px-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr
              key={result.method}
              className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
            >
              <td className="py-3 px-4 font-mono text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                {result.method}
              </td>
              <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{result.expectedValue}</td>
              <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 break-all max-w-xs">{result.actualValue}</td>
              <td className="py-3 px-4">
                <StatusBadge status={result.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RPCMethodsChecker() {
  const [evmRpcUrl, setEvmRpcUrl] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<CheckGroup[]>([]);

  async function runChecks() {
    if (!evmRpcUrl) {
      setError('Please enter an EVM RPC URL');
      return;
    }

    setIsRunning(true);
    setError(null);
    setGroups([]);

    const resolvedBaseUrl = baseUrl || deriveBaseUrl(evmRpcUrl);

    try {
      const [evmResults, pchainResults, adminResults, metricsResults] = await Promise.all([
        runEVMTests(evmRpcUrl),
        runPChainTests(resolvedBaseUrl),
        runAdminTests(resolvedBaseUrl),
        runMetricsTest(resolvedBaseUrl),
      ]);

      setGroups([
        {
          title: 'EVM API Tests',
          description: 'Checks EVM endpoints and debug/trace method availability.',
          results: evmResults,
        },
        {
          title: 'P-Chain API Tests',
          description: 'Verifies P-Chain endpoints are accessible for network operations.',
          results: pchainResults,
        },
        {
          title: 'Admin API Security',
          description: 'Verifies administrative endpoints are properly secured.',
          results: adminResults,
        },
        {
          title: 'Metrics API Security',
          description: 'Ensures metrics endpoint is properly restricted.',
          results: metricsResults,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsRunning(false);
    }
  }

  const totalChecks = groups.reduce((sum, g) => sum + g.results.length, 0);
  const okCount = groups.reduce((sum, g) => sum + g.results.filter((r) => r.status === 'ok').length, 0);
  const infoCount = groups.reduce((sum, g) => sum + g.results.filter((r) => r.status === 'info').length, 0);
  const warningCount = groups.reduce((sum, g) => sum + g.results.filter((r) => r.status === 'warning').length, 0);
  const errorCount = groups.reduce((sum, g) => sum + g.results.filter((r) => r.status === 'error').length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">RPC Methods Security Check</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Verify the security configuration of your node&apos;s RPC endpoints.
        </p>
      </div>

      {/* Configuration */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RPCURLInput
            label="EVM Chain RPC URL"
            value={evmRpcUrl}
            onChange={setEvmRpcUrl}
            placeholder="e.g., https://api.avax-test.network/ext/bc/C/rpc"
            disabled={isRunning}
          />
          <RPCURLInput
            label="Base Node URL (optional)"
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="Auto-derived from EVM URL"
            disabled={isRunning}
            helperText="Leave empty to auto-derive from the EVM RPC URL"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button
            onClick={runChecks}
            disabled={!evmRpcUrl || isRunning}
            loading={isRunning}
            loadingText="Running Security Checks..."
          >
            <Shield className="h-4 w-4 mr-2" />
            Run Security Check
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
        <h3 className="font-semibold text-blue-800 dark:text-blue-400">Understanding Results</h3>
        <ul className="mt-1 space-y-1 text-blue-700 dark:text-blue-300 ml-4 list-disc">
          <li>
            <strong>OK</strong> means the endpoint behaved as expected
          </li>
          <li>
            <strong>Enabled</strong> indicates a debug/trace endpoint is accessible (useful for development)
          </li>
          <li>
            <strong>Warning</strong> means the result is unexpected but may not be critical
          </li>
          <li>
            <strong>Error</strong> indicates a security concern or failed check
          </li>
          <li>For Admin endpoints, errors from the RPC are expected and indicate proper security</li>
        </ul>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 dark:text-red-300">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isRunning && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
          <span className="text-zinc-500 dark:text-zinc-400">Running security checks...</span>
        </div>
      )}

      {/* Summary */}
      {groups.length > 0 && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totalChecks}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Total Checks</div>
          </div>
          <div className="bg-white dark:bg-zinc-950 border border-green-200 dark:border-green-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{okCount}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">OK</div>
          </div>
          <div className="bg-white dark:bg-zinc-950 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{infoCount}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Enabled</div>
          </div>
          <div className="bg-white dark:bg-zinc-950 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{warningCount}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Warning</div>
          </div>
          <div className="bg-white dark:bg-zinc-950 border border-red-200 dark:border-red-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{errorCount}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Error</div>
          </div>
        </div>
      )}

      {/* Results Groups */}
      {groups.map((group) => (
        <div
          key={group.title}
          className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-zinc-500" />
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{group.title}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{group.description}</p>
              </div>
            </div>
          </div>
          <ResultsTable results={group.results} />
        </div>
      ))}
    </div>
  );
}
