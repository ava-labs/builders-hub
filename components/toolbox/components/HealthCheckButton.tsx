import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { nipify } from './HostInput';
import { HoverArrow, PRIMARY_BTN } from './NodeSetupUI';

interface HealthCheckResult {
  success: boolean;
  response?: any;
  error?: string;
}

interface HealthCheckButtonProps {
  chainId: string;
  domain: string;
  /** Fires after every check so parents can gate follow-up steps on a green proxy. */
  onResult?: (result: { success: boolean }) => void;
}

export const checkNodeHealth = async (chainId: string, domain: string): Promise<HealthCheckResult> => {
  const processedDomain = nipify(domain);
  const baseUrl = 'https://' + processedDomain;

  // Create AbortController for 1-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1000);

  try {
    const response = await fetch(`${baseUrl}/ext/bc/${chainId}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
      signal: controller.signal,
    });

    // Clear timeout if request completes successfully
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: `RPC Error: ${data.error.message || data.error}`,
      };
    }

    return {
      success: true,
      response: data.result,
    };
  } catch (error) {
    // Clear timeout in case of error
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout (1 second) - node may still be bootstrapping',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

export const HealthCheckButton = ({ chainId, domain, onResult }: HealthCheckButtonProps) => {
  const [isChecking, setIsChecking] = useState(false);
  const [healthCheckResult, setHealthCheckResult] = useState<HealthCheckResult | null>(null);

  const performHealthCheck = async () => {
    setIsChecking(true);
    setHealthCheckResult(null);

    const result = await checkNodeHealth(chainId, domain);
    setHealthCheckResult(result);
    onResult?.({ success: result.success });

    setIsChecking(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={performHealthCheck} disabled={isChecking} className={PRIMARY_BTN}>
        {isChecking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {isChecking ? 'Checking...' : 'Check Node Health'}
        <HoverArrow />
      </button>

      {healthCheckResult && (
        <span
          role="status"
          className={cn(
            'inline-flex items-center gap-2 text-[12.5px] font-medium',
            healthCheckResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
          )}
        >
          <span
            aria-hidden
            className={cn('h-1.5 w-1.5 rounded-full', healthCheckResult.success ? 'bg-emerald-500' : 'bg-red-500')}
          />
          {healthCheckResult.success
            ? 'RPC endpoint is healthy and responding'
            : 'RPC endpoint not responding (node may still be bootstrapping)'}
        </span>
      )}
    </div>
  );
};
