import { useState, useCallback } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';

interface TraceResult {
  /** Raw trace output from debug_traceTransaction */
  trace: unknown;
  /** Extracted revert reason if available */
  revertReason: string | null;
  /** Human-readable summary of the failure */
  summary: string | null;
}

/**
 * Hook for tracing failed transactions via the debug RPC proxy.
 * Only works for Fuji testnet — the debug RPC is not available on mainnet.
 *
 * Usage:
 * ```ts
 * const { traceTransaction, isTracing, traceResult, error } = useDebugTrace();
 *
 * // After a transaction fails:
 * const result = await traceTransaction(txHash);
 * if (result?.revertReason) {
 *   showError(`Reverted: ${result.revertReason}`);
 * }
 * ```
 */
export function useDebugTrace() {
  const { isTestnet } = useWalletStore();
  const [isTracing, setIsTracing] = useState(false);
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const traceTransaction = useCallback(
    async (txHash: string): Promise<TraceResult | null> => {
      if (!isTestnet) {
        setError('Debug tracing is only available on Fuji testnet.');
        return null;
      }

      if (!txHash || !txHash.startsWith('0x')) {
        setError('Invalid transaction hash.');
        return null;
      }

      setIsTracing(true);
      setError(null);
      setTraceResult(null);

      try {
        const response = await fetch('/api/debug-rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'debug_traceTransaction',
            params: [txHash, { tracer: 'callTracer', tracerConfig: { onlyTopCall: false } }],
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Debug trace failed (${response.status})`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error.message || 'RPC error during trace');
        }

        const trace = data.result;
        const revertReason = extractRevertReason(trace);
        const summary = revertReason
          ? `Transaction reverted: ${revertReason}`
          : trace?.error
            ? `Transaction failed: ${trace.error}`
            : null;

        const result: TraceResult = { trace, revertReason, summary };
        setTraceResult(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to trace transaction';
        setError(message);
        return null;
      } finally {
        setIsTracing(false);
      }
    },
    [isTestnet],
  );

  /**
   * Simulate a call via debug_traceCall to get detailed revert info
   * before actually submitting the transaction.
   */
  const traceCall = useCallback(
    async (callParams: { from: string; to: string; data: string; value?: string }): Promise<TraceResult | null> => {
      if (!isTestnet) {
        setError('Debug tracing is only available on Fuji testnet.');
        return null;
      }

      setIsTracing(true);
      setError(null);

      try {
        const response = await fetch('/api/debug-rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'debug_traceCall',
            params: [callParams, 'latest', { tracer: 'callTracer' }],
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Debug trace call failed (${response.status})`);
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error.message || 'RPC error during trace call');
        }

        const trace = data.result;
        const revertReason = extractRevertReason(trace);
        const summary = revertReason ? `Call would revert: ${revertReason}` : null;

        const result: TraceResult = { trace, revertReason, summary };
        setTraceResult(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to trace call';
        setError(message);
        return null;
      } finally {
        setIsTracing(false);
      }
    },
    [isTestnet],
  );

  return {
    traceTransaction,
    traceCall,
    isTracing,
    traceResult,
    error,
    isAvailable: isTestnet,
  };
}

/**
 * Extract a human-readable revert reason from a callTracer result.
 */
function extractRevertReason(trace: any): string | null {
  if (!trace) return null;

  // callTracer returns { output: "0x..." } for reverts
  const output = trace.output || trace.returnValue;
  if (!output || output === '0x') return null;

  // Try to decode Error(string) — selector 0x08c379a0
  if (typeof output === 'string' && output.startsWith('0x08c379a0')) {
    try {
      // Skip selector (4 bytes = 8 hex chars + 2 for 0x) + offset (32 bytes = 64 hex chars)
      const dataStart = 10 + 64;
      const lengthHex = output.slice(dataStart, dataStart + 64);
      const length = parseInt(lengthHex, 16);
      const stringHex = output.slice(dataStart + 64, dataStart + 64 + length * 2);
      const bytes = new Uint8Array(stringHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
      return new TextDecoder().decode(bytes);
    } catch {
      // Fall through to raw output
    }
  }

  // Try to decode Panic(uint256) — selector 0x4e487b71
  if (typeof output === 'string' && output.startsWith('0x4e487b71')) {
    const code = parseInt(output.slice(10), 16);
    const panicCodes: Record<number, string> = {
      0x00: 'Generic compiler panic',
      0x01: 'Assertion failed',
      0x11: 'Arithmetic overflow/underflow',
      0x12: 'Division by zero',
      0x21: 'Invalid enum value',
      0x22: 'Corrupt storage',
      0x31: 'Pop on empty array',
      0x32: 'Array out of bounds',
      0x41: 'Out of memory',
      0x51: 'Uninitialized function pointer',
    };
    return panicCodes[code] || `Panic(${code})`;
  }

  // Return raw output if short enough to be useful
  if (typeof output === 'string' && output.length <= 200) {
    return output;
  }

  // Check for error field in trace
  if (trace.error) return trace.error;

  return null;
}
