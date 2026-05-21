"use client";

import { useEffect, useState } from "react";

export interface ResolvedReferrer {
  teamId: string | null;
  userId: string | null;
  userName: string | null;
}

export interface UseReferrerAutoFillResult {
  resolved: ResolvedReferrer | null;
  loading: boolean;
  // True when ?ref=CODE resolved to a real link — picker should render in
  // locked / read-only mode. False if no code in URL or code 404'd.
  locked: boolean;
}

// Reads `?ref=CODE` on mount, resolves it via /api/referrals/resolve, and
// returns the referrer's team + user identity for picker pre-fill. 404s
// are silent — caller falls back to manual mode.
export function useReferrerAutoFill(): UseReferrerAutoFillResult {
  const [resolved, setResolved] = useState<ResolvedReferrer | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [locked, setLocked] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URL(window.location.href).searchParams.get("ref")?.trim();
    if (!code) return;

    let cancelled = false;
    setLoading(true);
    fetch(`/api/referrals/resolve?ref=${encodeURIComponent(code)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setResolved(null);
          setLocked(false);
          return;
        }
        const data = (await res.json()) as ResolvedReferrer;
        setResolved(data);
        setLocked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setResolved(null);
        setLocked(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { resolved, loading, locked };
}
