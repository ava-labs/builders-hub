import { useState, useEffect } from 'react';
import type { Context as ContextNamespace } from '@avalabs/avalanchejs';
import { parseContext } from '@/components/toolbox/coreViem/utils/contextSerde';

/**
 * Loads the Avalanche network Context from the same-origin `/api/avalanche-context`
 * route (which resolves it server-side) and revives its bigint fields.
 *
 * Passing this context into the SDK's `prepareExport/ImportTxn` stops the SDK from
 * fetching it itself via a direct browser call to the public X-Chain endpoint,
 * which fails from non-production origins. Reusable by any SDK-based console tool.
 */

type AvalancheContext = ContextNamespace.Context;

// Shared across components so a network's context is fetched at most once.
const contextCache: Partial<Record<'testnet' | 'mainnet', AvalancheContext>> = {};

interface UseAvalancheContextResult {
  context: AvalancheContext | null;
  isLoading: boolean;
  error: string | null;
}

export function useAvalancheContext(isTestnet: boolean): UseAvalancheContextResult {
  const key = isTestnet ? 'testnet' : 'mainnet';
  const [context, setContext] = useState<AvalancheContext | null>(contextCache[key] ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!contextCache[key]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = contextCache[key];
    if (cached) {
      setContext(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/avalanche-context?testnet=${isTestnet ? 'true' : 'false'}`);
        if (!res.ok) {
          throw new Error(`Network context request failed (${res.status})`);
        }
        const revived = parseContext<AvalancheContext>(await res.text());
        if (cancelled) return;
        contextCache[key] = revived;
        setContext(revived);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load network context');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, isTestnet]);

  return { context, isLoading, error };
}
