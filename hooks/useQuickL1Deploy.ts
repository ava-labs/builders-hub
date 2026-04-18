'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeployRequest, DeployResponse, DeploymentJob } from '@/lib/quick-l1/types';

/**
 * Client-side wrapper for the Basic L1 Setup deploy + status endpoints.
 *
 * Split into two hooks so the intake form and progress screen each only
 * pull in what they need:
 *   - `useStartDeployment`   — one-shot mutation for the form
 *   - `useDeploymentStatus`  — polling read for the progress screen
 */

export function useStartDeployment() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deploy = useCallback(async (request: DeployRequest): Promise<string | null> => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/quick-l1/deploy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Deploy failed (HTTP ${res.status})`);
      }
      const data: DeployResponse = await res.json();
      return data.jobId;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { deploy, submitting, error };
}

/**
 * Polls /api/quick-l1/status/:jobId on a ~2s interval. Stops polling
 * automatically when the job reaches a terminal state ('complete' or
 * 'failed') so we don't burn requests after the work is done.
 */
export function useDeploymentStatus(jobId: string | null) {
  const [job, setJob] = useState<DeploymentJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    const tick = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/quick-l1/status/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Status fetch failed (HTTP ${res.status})`);
        }
        const next: DeploymentJob = await res.json();
        if (cancelled) return;
        setJob(next);
        // Stop polling at a terminal state.
        if (next.status !== 'complete' && next.status !== 'failed') {
          timerRef.current = setTimeout(tick, 2000);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          // Retry with backoff — transient network hiccups shouldn't kill the screen.
          timerRef.current = setTimeout(tick, 4000);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId]);

  return { job, loading, error };
}
